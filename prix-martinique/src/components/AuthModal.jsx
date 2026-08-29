import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import LegalModal from './LegalModal';

const AuthModal = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot_password' | 'set_password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regionCode, setRegionCode] = useState('972');
  const [city, setCity] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [legalModal, setLegalModal] = useState(null); // null | 'privacy' | 'legal'

  const { signIn, signUp, signInWithGoogle, resetPasswordForEmail, updatePassword } = useAuth();

  // Sync mode when modal is opened with a specific initialMode (e.g. password recovery)
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialMode]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setRegionCode('972');
    setCity('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          throw new Error('Veuillez entrer votre nom');
        }
        const { data, error } = await signUp(email, password, displayName, regionCode, city);
        if (error) throw error;
        // Supabase deliberately does not throw an error when the email already
        // has an account (any provider, e.g. Google) -- to avoid leaking which
        // emails are registered, signUp() instead returns a fake user with an
        // empty identities array and sends no email at all. Without this check
        // the form showed "Compte créé !" regardless, leaving a real user who
        // already had a Google account stuck with no account and no error
        // (confirmed live, Aug 2026 iOS test session).
        if (data?.user?.identities?.length === 0) {
            setSuccessMessage('Aucun email n\'a été envoyé : un compte existe déjà avec cette adresse. Essayez de vous connecter directement, ou réinitialisez votre mot de passe si besoin.');
            setTimeout(() => handleClose(), 6000);
        } else {
            setSuccessMessage('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
            setTimeout(() => handleClose(), 3000);
        }
      } else if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        handleClose();
      } else if (mode === 'forgot_password') {
        const { error } = await resetPasswordForEmail(email);
        if (error) throw error;
        setSuccessMessage(`Un lien de réinitialisation a été envoyé à ${email}. Vérifiez votre boîte de réception.`);
        setTimeout(() => handleClose(), 4000);
      } else if (mode === 'set_password') {
        if (password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caracteres');
        if (password !== confirmPassword) throw new Error('Les mots de passe ne correspondent pas');
        const { error } = await updatePassword(password);
        if (error) throw error;
        setSuccessMessage('Mot de passe modifié avec succès !');
        setTimeout(() => handleClose(), 1500);
      }
    } catch (err) {
      console.error('Auth error:', err);
      // Translate common Supabase errors to French
      let errorMessage = err.message;
      if (err.message.includes('Invalid login credentials')) {
        errorMessage = 'Email ou mot de passe incorrect';
      } else if (err.message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email avant de vous connecter';
      } else if (err.message.includes('User already registered')) {
        errorMessage = 'Un compte existe deja avec cet email';
      } else if (err.message.includes('Password should be at least')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caracteres';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // OAuth will redirect, so no need to close modal
    } catch (err) {
      console.error('Google auth error:', err);
      setError('Erreur lors de la connexion avec Google');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[400] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-6 text-white relative">
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">
            {mode === 'signin' ? 'Connexion'
              : mode === 'signup' ? 'Creer un compte'
              : mode === 'forgot_password' ? 'Mot de passe oublié'
              : 'Nouveau mot de passe'}
          </h2>
          <p className="text-orange-100 text-sm mt-1">
            {mode === 'signin' ? 'Connectez-vous pour gagner des points!'
              : mode === 'signup' ? 'Rejoignez la communaute et gagnez des badges!'
              : mode === 'forgot_password' ? 'Recevez un lien de réinitialisation par email'
              : 'Choisissez un nouveau mot de passe pour votre compte'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {/* Google Sign In — only for signin / signup */}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg py-3 px-4 font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuer avec Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">ou</span>
                </div>
              </div>
            </>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom d'affichage
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Marie L."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Région
                  </label>
                  <select
                    value={regionCode}
                    onChange={(e) => setRegionCode(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg py-3 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="972">Martinique (972)</option>
                    <option value="971">Guadeloupe (971)</option>
                    <option value="973">Guyane (973)</option>
                    <option value="974">La Réunion (974)</option>
                    <option value="976">Mayotte (976)</option>
                    <option value="Hexagone">France Hexagonale</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Paris"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email field — hidden in set_password mode */}
            {mode !== 'set_password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password field — hidden in forgot_password mode */}
            {mode !== 'forgot_password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {mode === 'set_password' ? 'Nouveau mot de passe' : 'Mot de passe'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caracteres"
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {/* Forgot password link — only in signin mode */}
                {mode === 'signin' && (
                  <div className="text-right mt-1">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot_password'); setError(null); setSuccessMessage(null); }}
                      className="text-sm text-orange-600 hover:underline py-2 px-1 min-h-[44px] inline-flex items-center"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Confirm password field — only in set_password mode */}
            {mode === 'set_password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Chargement...
                </span>
              ) : mode === 'signin' ? 'Se connecter'
                : mode === 'signup' ? 'Creer mon compte'
                : mode === 'forgot_password' ? 'Envoyer le lien'
                : 'Enregistrer le nouveau mot de passe'}
            </button>

            {mode === 'signup' && (
              <p className="text-xs text-gray-500 text-center -mt-2">
                En créant un compte, vous acceptez notre{' '}
                <button type="button" onClick={() => setLegalModal('privacy')} className="text-orange-600 hover:underline">
                  Politique de confidentialité
                </button>{' '}
                et nos{' '}
                <button type="button" onClick={() => setLegalModal('legal')} className="text-orange-600 hover:underline">
                  Mentions légales
                </button>.
              </p>
            )}
          </form>

          {/* Switch mode */}
          <div className="mt-6 text-center text-sm text-gray-600">
            {mode === 'signin' ? (
              <>
                Pas encore de compte?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                  className="text-orange-600 font-medium hover:underline"
                >
                  Creer un compte
                </button>
              </>
            ) : mode === 'signup' ? (
              <>
                Deja un compte?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(null); setSuccessMessage(null); }}
                  className="text-orange-600 font-medium hover:underline"
                >
                  Se connecter
                </button>
              </>
            ) : (mode === 'forgot_password' || mode === 'set_password') ? (
              <button
                onClick={() => { setMode('signin'); setError(null); setSuccessMessage(null); }}
                className="text-orange-600 font-medium hover:underline"
              >
                ← Retour à la connexion
              </button>
            ) : null}
          </div>

          {/* Benefits info */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-900 mb-2">
              Pourquoi creer un compte?
            </p>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>+10 points par prix soumis</li>
              <li>Gagnez des badges et montez en niveau</li>
              <li>Apparaissez dans le classement</li>
              <li>Suivez vos contributions</li>
            </ul>
          </div>
        </div>
      </div>
      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
    </div>
  );
};

export default AuthModal;
