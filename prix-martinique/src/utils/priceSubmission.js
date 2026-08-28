import { posthog } from '../posthogClient';

// Shared by the live "online" submit path (App10.jsx's submitPrice) and the
// offline-queue sync drainer (syncQueue.js) -- one function, two callers, so the
// two paths can never drift the way calculateSavings did (see CLAUDE.md).
function base64ToBlob(dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
}

// payload shape: { productName, barcode, price, storeId, isMainland, mainlandChain,
//   userName, productPhoto (base64 data URL | null), priceTagPhoto (base64 data URL | null),
//   isDeclaredBqp, categoryId, isLocal, isMdd, submissionMethod, queuedOffline }
export async function performPriceSubmission({ supabase, awardPoints, user, userProfile, payload }) {
    // Step 1: find-or-create product. Deliberately re-resolved here every time
    // (even on a queued/offline-drafted submission) rather than trusting a
    // client-resolved productId, so a barcode added by someone else in the
    // meantime still matches instead of creating a duplicate.
    let productId;

    if (payload.barcode) {
        const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('barcode', payload.barcode)
            .single();
        productId = existingProduct?.id;
    }

    if (!productId) {
        const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .ilike('name', payload.productName)
            .single();
        productId = existingProduct?.id;
    }

    if (!productId) {
        const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert([{
                name: payload.productName,
                barcode: payload.barcode || null,
                category: null, // Legacy field
                category_id: payload.categoryId || null,
                is_local_production: payload.isLocal || false,
                is_declared_bqp: payload.isDeclaredBqp || false,
                is_mdd: payload.isMdd || false,
            }])
            .select()
            .single();

        if (productError) throw productError;
        productId = newProduct.id;
    }

    // Step 2: upload photos if present
    // Upload failures here were previously silent -- caught, logged to
    // PostHog, but never surfaced to the caller, so a user could get a normal
    // "Prix enregistré !" success with a photo they'd just taken quietly
    // missing (confirmed live, Aug 28, 2026: a real submission ended up with
    // both photo URLs null and nothing ever told the user). photosDropped
    // tracks which ones failed so submitPrice can warn instead of staying
    // silent, without changing the fact that a failed upload still shouldn't
    // block the price itself from saving.
    let productPhotoUrl = null;
    let priceTagPhotoUrl = null;
    const photosDropped = [];

    if (payload.productPhoto) {
        const fileName = `${Date.now()}_${productId}_product.jpg`;
        const blob = base64ToBlob(payload.productPhoto);
        const { error: uploadError } = await supabase.storage.from('product-photos').upload(fileName, blob);
        if (uploadError) {
            console.error('Product photo upload error:', uploadError);
            posthog.captureException(uploadError, { context: 'product_photo_upload' });
            photosDropped.push('product');
        } else {
            const { data: urlData } = supabase.storage.from('product-photos').getPublicUrl(fileName);
            productPhotoUrl = urlData.publicUrl;
        }
    }

    if (payload.priceTagPhoto) {
        const fileName = `${Date.now()}_${productId}_pricetag.jpg`;
        const blob = base64ToBlob(payload.priceTagPhoto);
        const { error: uploadError } = await supabase.storage.from('price-tag-photos').upload(fileName, blob);
        if (uploadError) {
            console.error('Price tag photo upload error:', uploadError);
            posthog.captureException(uploadError, { context: 'price_tag_photo_upload' });
            photosDropped.push('price_tag');
        } else {
            const { data: urlData } = supabase.storage.from('price-tag-photos').getPublicUrl(fileName);
            priceTagPhotoUrl = urlData.publicUrl;
        }
    }

    // Step 3: insert the price row
    // user_name must never read "Anonyme" for a row that actually has a real
    // user_id attached -- that mismatch is exactly what undermines being able
    // to trace a submission back to a real account (confirmed live, Aug 28,
    // 2026: a signed-in user's row had a correct user_id but user_name fell
    // through to the literal 'Anonyme' because the free-text field happened to
    // be empty at submit time). Prefer the free-text field if the user typed
    // something custom, otherwise fall back to their real profile/account
    // identity before ever reaching the generic anonymous label.
    const resolvedUserName = payload.userName
        || userProfile?.display_name
        || user?.email
        || 'Anonyme';

    const priceData = {
        product_id: productId,
        store_id: payload.isMainland ? null : payload.storeId,
        price: parseFloat(payload.price),
        user_name: resolvedUserName,
        product_photo_url: productPhotoUrl,
        price_tag_photo_url: priceTagPhotoUrl,
    };

    if (payload.isMainland) {
        priceData.origin_region_code = 'Hexagone';
        priceData.mainland_chain = payload.mainlandChain;
        priceData.source_type = 'scan';
    }

    if (user) {
        priceData.user_id = user.id;
        if (userProfile && !payload.isMainland) {
            priceData.origin_region_code = userProfile.region_code;
            priceData.origin_city = userProfile.city;
        }
    }

    const { error: priceError } = await supabase.from('prices').insert([priceData]);
    if (priceError) throw priceError;

    posthog.capture('price_submitted', {
        submission_method: payload.submissionMethod || 'manual_entry',
        product_id: productId,
        price: priceData.price,
        store_id: priceData.store_id,
        is_mainland: !!payload.isMainland,
        has_product_photo: !!productPhotoUrl,
        has_price_tag_photo: !!priceTagPhotoUrl,
        authenticated: !!user,
        synced_from_offline_queue: !!payload.queuedOffline,
    });

    if (!localStorage.getItem('ph_first_contribution_done')) {
        localStorage.setItem('ph_first_contribution_done', '1');
        posthog.capture('first_contribution_completed');
    }

    // Step 4: award points if authenticated
    let pointsAwarded = 0;
    if (user) {
        const { error: pointsError } = await awardPoints(
            'price_submission',
            10,
            `Prix soumis: ${payload.productName}`
        );
        if (!pointsError) pointsAwarded = 10;
    }

    // BQP-link prompt: only if this product isn't already associated with a BQP category
    let bqpPrompt = null;
    const { data: existingAssoc } = await supabase
        .from('product_bqp_associations')
        .select('id')
        .eq('product_id', productId)
        .single();

    if (!existingAssoc) {
        const { data: p } = await supabase.from('products').select('*').eq('id', productId).single();
        bqpPrompt = p || null;
    }

    return { productId, pointsAwarded, bqpPrompt, photosDropped };
}
