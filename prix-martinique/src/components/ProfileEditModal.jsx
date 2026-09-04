import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../supabaseClient';
import { posthog } from '../posthogClient';
import { uploadAvatar } from '../utils/avatarUpload';

const NAME_MAX = 40;
const BIO_MAX = 200;
const STATUS_MAX = 80;

// Blocked outright -- these read as official / someone-else's identity on a
// public app. Not a uniqueness system (two real "Marie"s are fine), just an
// impersonation guard. Compared case-insensitively, punctuation/space stripped.
const RESERVED = [
  'prixmartinique', 'prixmtq', 'rpprac', 'vwapepla', 'officiel', 'official',
  'admin', 'administrateur', 'moderateur', 'moderator', 'equipe', 'support',
  'martinique972', 'staff',
];

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ProfileEditModal = ({ onClose }) => {
  const { user, userProfile, updateProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState(userProfile?.display_name || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [statusText, setStatusText] = useState(userProfile?.status_text || '');
  const [isPublic, setIsPublic] = useState(userProfile?.is_profile_public !== false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(userProfile?.avatar_url || null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const originalName = userProfile?.display_name || '';

  const handlePickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formats acceptés : JPEG, PNG, WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image trop lourde (5 Mo maximum).');
      return;
    }
    setError(null);
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = () => {
    setError(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateName = (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return 'Le pseudo doit contenir au moins 2 caractères.';
    if (trimmed.length > NAME_MAX) return `Le pseudo est limité à ${NAME_MAX} caractères.`;
    if (RESERVED.includes(normalize(trimmed))) return 'Ce pseudo est réservé, choisissez-en un autre.';
    return null;
  };

  const handleSave = async () => {
    const nameError = validateName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let avatarUrl = userProfile?.avatar_url || null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user.id, avatarFile);
      } else if (removeAvatar) {
        avatarUrl = null;
        // Best-effort cleanup of the old object so removed photos don't linger
        // in storage. `avatar_url` is `<origin>/storage/v1/object/public/avatars/<path>`.
        const oldPath = userProfile?.avatar_url?.split('/avatars/')[1];
        if (oldPath) {
          try {
            await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)]);
          } catch (rmErr) {
            console.error('Old avatar cleanup failed (non-blocking):', rmErr);
          }
        }
      }

      const trimmedName = displayName.trim();
      const nameChanged = trimmedName !== originalName;

      const fullUpdate = {
        display_name: trimmedName,
        bio: bio.trim() || null,
        status_text: statusText.trim() || null,
        status_updated_at: statusText.trim() ? new Date().toISOString() : null,
        is_profile_public: isPublic,
        avatar_url: avatarUrl,
      };

      const { error: updateError } = await updateProfile(fullUpdate);
      let partial = false;

      // Before profile_card_migration.sql is applied, bio/status/visibility
      // columns don't exist and the whole PATCH 42703s. Fall back to saving
      // just name + avatar (columns that already exist) so the modal still
      // does something useful, and tell the user why the rest didn't stick.
      if (updateError) {
        const retry = await updateProfile({ display_name: trimmedName, avatar_url: avatarUrl });
        if (retry.error) {
          throw new Error(typeof retry.error === 'string' ? retry.error : retry.error.message);
        }
        partial = true;
      }

      // prices.user_name is a denormalized copy frozen at submission time (shown
      // in the Comparer feed, ProductDetailModal, MyScansModal). The live-resolved
      // surfaces (leaderboard, hunter card, comment threads) already follow
      // display_name, but the feed won't without this. Best-effort: a failure
      // here just leaves old scans showing the old name, it doesn't block the
      // rename.
      if (nameChanged) {
        try {
          await supabase.from('prices').update({ user_name: trimmedName }).eq('user_id', user.id);
        } catch (backfillErr) {
          console.error('user_name backfill failed (non-blocking):', backfillErr);
        }
      }

      posthog.capture('profile_edited', {
        name_changed: nameChanged,
        avatar_changed: !!avatarFile || removeAvatar,
        avatar_removed: removeAvatar,
        has_bio: !!bio.trim(),
        has_status: !!statusText.trim(),
        is_public: isPublic,
      });
      if (avatarFile) posthog.capture('profile_photo_uploaded');

      await refreshProfile();

      if (partial) {
        setError('Pseudo et photo enregistrés. La bio et le statut seront disponibles très bientôt.');
      } else {
        setSaved(true);
        setTimeout(onClose, 800);
      }
    } catch (err) {
      console.error('Profile save error:', err);
      posthog.captureException(err, { context: 'profile_edit_save' });
      setError('Enregistrement impossible. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (displayName.trim()[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
        <div className="relative bg-gradient-to-br from-orange-500 to-red-600 p-6 pt-10 text-white flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold">Mon profil</h2>
          <p className="text-sm text-orange-100">Votre carte visible par la communauté</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-orange-100 overflow-hidden flex items-center justify-center text-2xl font-black text-orange-500 flex-shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" /> {avatarPreview ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 text-sm font-bold px-2.5 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Retirer
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {removeAvatar
                  ? 'La photo sera retirée — votre initiale sera affichée.'
                  : 'JPEG, PNG ou WebP · 5 Mo max'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePickAvatar}
                className="hidden"
              />
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pseudo</label>
            <input
              type="text"
              value={displayName}
              maxLength={NAME_MAX}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre pseudo"
              className="mt-1 w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Affiché sur le classement, vos prix et vos commentaires.
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Statut du moment</label>
            <input
              type="text"
              value={statusText}
              maxLength={STATUS_MAX}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Ex : Je relève les prix du petit-déjeuner cette semaine"
              className="mt-1 w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{statusText.length}/{STATUS_MAX}</p>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              maxLength={BIO_MAX}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Quelques mots sur vous et pourquoi vous contribuez."
              className="mt-1 w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{bio.length}/{BIO_MAX}</p>
          </div>

          {/* Visibility */}
          <button
            onClick={() => setIsPublic((v) => !v)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {isPublic ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
              <div>
                <p className="text-sm font-bold text-gray-900">Profil public</p>
                <p className="text-[10px] text-gray-500">
                  {isPublic
                    ? 'Photo, bio et statut visibles sur votre carte.'
                    : 'Seuls votre pseudo et vos statistiques restent visibles.'}
                </p>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors ${isPublic ? 'bg-green-500' : 'bg-gray-300'} relative`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${isPublic ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : null}
            {saving ? 'Enregistrement...' : saved ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
