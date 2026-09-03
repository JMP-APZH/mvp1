import { supabase } from '../supabaseClient';

// Client-side downscale + re-encode before upload: avatars are shown at 64px in
// the UserMenu and 64px on the profile card, so 256px covers retina with room to
// spare and keeps the object well under the bucket's 5 MB cap regardless of what
// camera the file came off. Mirrors the base64->Blob->Storage pattern already
// used for price-tag / product photos (see priceSubmission.js), just with a
// resize step since a profile picture isn't evidence and doesn't need full res.
const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.85;

async function resizeToJpegBlob(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encodage de l’image impossible'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

// Uploads to `<userId>/avatar_<ts>.jpg` -- the first path segment is the owner's
// uid, which is what the storage RLS policy in profile_card_migration.sql checks.
// Returns the public URL to store in user_profiles.avatar_url.
export async function uploadAvatar(userId, file) {
  const blob = await resizeToJpegBlob(file);
  const path = `${userId}/avatar_${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
