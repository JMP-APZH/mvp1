import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, LogOut, Trophy, Star, ChevronDown, Award, Wallet, MapPin, Store, Plus, Search, Settings, TrendingUp, ChevronRight, X, ShieldCheck, BarChart3, Lock, ScanLine, Info, Target } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../supabaseClient';
import { calculateSavings } from '../utils/userStats';
import { getWantedScans } from '../utils/scanRequests';

const CHAIN_ICONS = {
  'Carrefour': '🔵',
  'E.Leclerc': '🔴',
  'Leclerc': '🔴',
  'Euromarché': '🟠',
  'Auchan': '🔴',
  'Pli Bel Price': '🟡',
  'Caraïbe Price': '🟢',
  'U Express': '🔵',
  '8 à Huit': '🟣',
  'MACK 2': '🟤',
  'Proxi': '🟠',
  'Carrefour Market': '🔵',
  'Carrefour Express': '🔵',
};

const UserMenu = ({ onSignInClick, onOpenStats, onOpenAdmin, onOpenMyScans, onOpenWantedScans, stores }) => {
  const { user, userProfile, userBadges, userRoles, loading, signOut, updateProfile, updatePassword, userFavoriteStores, toggleFavoriteStore } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [savings, setSavings] = useState(null);
  const [wantedCount, setWantedCount] = useState(null);
  const scrollRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);
  const [showStoreSearch, setShowStoreSearch] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [cityInput, setCityInput] = useState(userProfile?.city || "");
  const [syncedProfileCity, setSyncedProfileCity] = useState(userProfile?.city);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const menuRef = useRef(null);

  const martiniqueCities = [
    "Fort-de-France", "Le Lamentin", "Le Robert", "Schoelcher", "Sainte-Marie",
    "Le François", "Ducos", "Saint-Joseph", "La Trinité", "Rivière-Pilote",
    "Rivière-Salée", "Gros-Morne", "Sainte-Luce", "Saint-Esprit", "Le Marin",
    "Le Lorrain", "Le Diamant", "Le Vauclin", "Case-Pilote", "Saint-Pierre",
    "Les Anses-d'Arlet", "Basse-Pointe", "Grand'Rivière", "Ajoupa-Bouillon",
    "Le Morne-Rouge", "Le Morne-Vert", "Le Carbet", "Le Prêcheur",
    "Fond-Saint-Denis", "Sainte-Anne", "Macouba", "Le Marigot", "Bellefontaine"
  ].sort();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  // Reset the editable city buffer when the profile's city changes externally
  // (initial async load, or an update from elsewhere) -- adjusted during render
  // rather than in an effect, per React's guidance for resetting state from props.
  if (userProfile?.city !== syncedProfileCity) {
    setSyncedProfileCity(userProfile?.city);
    if (userProfile?.city) {
      setCityInput(userProfile.city);
    }
  }

  // Fetch the real savings figure only when the dropdown is actually opened
  // (shares the same methodology as PersoStats.jsx via calculateSavings --
  // previously this tile had its own separate, fake `scanCount * 0.85` calc
  // that had drifted from the correct one).
  useEffect(() => {
    if (isOpen && user) {
      calculateSavings(supabase, user.id).then(setSavings);
      getWantedScans(supabase, [...(userFavoriteStores || [])]).then(results => setWantedCount(results.length));
    }
  }, [isOpen, user, userFavoriteStores]);

  // "More to see" hint: the dropdown's lower section (budget, magasins,
  // géographie, etc.) scrolls but gave no visual cue that it did -- reported
  // as not obvious. Re-checked on open and on every scroll.
  const checkScrollable = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollHint(el.scrollHeight - el.scrollTop - el.clientHeight > 10);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(checkScrollable, 100);
      return () => clearTimeout(t);
    }
  }, [isOpen, checkScrollable]);

  const handleCityChange = async (city) => {
    setIsUpdatingCity(true);
    await updateProfile({ city });
    setIsUpdatingCity(false);
  };

  const handleRegionChange = async (region_code) => {
    setIsUpdatingCity(true);
    const is_diaspora = region_code === 'Hexagone';
    await updateProfile({ region_code, is_diaspora });
    setIsUpdatingCity(false);
  };

  const handleBqpChange = async (val) => {
    setIsUpdatingCity(true); // Re-use the same loading state for simplicity
    await updateProfile({ consumes_bqp: val });
    setIsUpdatingCity(false);
  };

  const handleBudgetChange = async (type, value) => {
    setIsUpdatingCity(true);
    await updateProfile({ [type]: parseFloat(value) || 0 });
    setIsUpdatingCity(false);
  };

  // Only email/password users can change their password (not Google OAuth users)
  const isEmailUser = user?.identities?.some(id => id.provider === 'email');

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    setIsChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError('Erreur : ' + error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess(false);
      }, 2000);
    }
    setIsChangingPassword(false);
  };

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
    s.chain?.toLowerCase().includes(storeSearchQuery.toLowerCase())
  ).slice(0, 5);

  // Calculate progress to next level
  const getNextLevelProgress = () => {
    if (!userProfile) return 0;
    const currentLevel = userProfile.level || 1;
    const pointsForCurrentLevel = (currentLevel - 1) * 100;
    const pointsForNextLevel = currentLevel * 100;
    const progressPoints = (userProfile.points || 0) - pointsForCurrentLevel;
    const pointsNeeded = pointsForNextLevel - pointsForCurrentLevel;
    return Math.min((progressPoints / pointsNeeded) * 100, 100);
  };

  // Get level title
  const getLevelTitle = (level) => {
    const titles = {
      1: 'Debutant',
      2: 'Contributeur',
      3: 'Chasseur de prix',
      4: 'Expert',
      5: 'Champion',
      6: 'Legende',
      7: 'Maitre',
      8: 'Grand Maitre',
      9: 'Elite',
      10: 'Heros de Martinique'
    };
    return titles[level] || `Niveau ${level}`;
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse"></div>
    );
  }

  // Not logged in - show sign in button
  if (!user) {
    return (
      <button
        onClick={onSignInClick}
        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">Connexion</span>
      </button>
    );
  }

  // Logged in - show user menu
  const displayName = userProfile?.display_name || user.email?.split('@')[0] || 'Utilisateur';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg transition-colors"
      >
        {/* Avatar */}
        <div className="relative">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">
              {userProfile?.level || 1}
            </div>
          )}
          {userBadges.length > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
              <Award className="w-2.5 h-2.5 text-yellow-800" />
            </div>
          )}
        </div>

        {/* Points display */}
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-xs font-medium leading-tight">{displayName}</span>
          <span className="text-xs text-orange-100 leading-tight flex items-center gap-1">
            <Star className="w-3 h-3" />
            {userProfile?.points || 0} pts
          </span>
        </div>

        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[110]">
          {/* User info header */}
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-4 text-white">
            <div className="flex items-center gap-3">
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-xl font-bold">
                  {userProfile?.level || 1}
                </div>
              )}
              <div>
                <p className="font-semibold">{displayName}</p>
                <p className="text-sm text-orange-100">
                  {getLevelTitle(userProfile?.level || 1)}
                </p>
              </div>
            </div>

            {/* Level progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-orange-100 mb-1">
                <span>Niveau {userProfile?.level || 1}</span>
                <span>Niveau {(userProfile?.level || 1) + 1}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${getNextLevelProgress()}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Main User Stats */}
          <div className="p-4 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-4 text-center">
              <button
                onClick={() => { onOpenMyScans('savings'); setIsOpen(false); }}
                className="bg-orange-50 hover:bg-orange-100 p-3 rounded-xl border border-orange-100 transition-colors"
              >
                <div className="text-2xl font-bold text-orange-600">
                  {savings === null ? '…' : `${savings.toFixed(2)}€`}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider font-bold text-orange-400 flex items-center justify-center gap-1"
                  title="Comparé au prix moyen observé pour ces produits sur les 12 derniers mois, tous magasins confondus."
                >
                  Mes Économies <Info className="w-2.5 h-2.5" />
                </div>
              </button>
              <button
                onClick={() => { onOpenMyScans('all'); setIsOpen(false); }}
                className="bg-blue-50 hover:bg-blue-100 p-3 rounded-xl border border-blue-100 transition-colors"
              >
                <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                  <ScanLine className="w-5 h-5" /> {userProfile?.total_contributions || 0}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-blue-400">Mes contributions à l'effort collectif</div>
              </button>
            </div>

          </div>
          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => {
                onOpenStats();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-500 p-2 rounded-lg text-white shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Mon Impact</p>
                  <p className="text-[10px] text-orange-600 font-medium tracking-tight">Vérifier mon score et mes badges</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-orange-300" />
            </button>
          </div>

          <div className="p-2 border-b border-gray-100">
            <button
              onClick={() => {
                onOpenWantedScans();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-lg text-white shadow-sm group-hover:scale-110 transition-transform relative">
                  <Target className="w-5 h-5" />
                  {wantedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {wantedCount}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Prix recherchés</p>
                  <p className="text-[10px] text-blue-600 font-medium tracking-tight">Aidez la communauté dans vos magasins</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-300" />
            </button>
          </div>

          <div className="relative">
          <div ref={scrollRef} onScroll={checkScrollable} className="max-h-[350px] overflow-y-auto">
            {/* Badges section remains similar but maybe moved... I'll keep it as is for now or move it to PersoStats */}

            {/* Budget Settings */}
            <div className="p-4 border-b border-gray-100 bg-green-50/30">
              <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1 uppercase tracking-wider">
                <Wallet className="w-3.5 h-3.5 text-green-600" /> Budget Courses (Mensuel)
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-gray-400 uppercase font-black ml-1">Min (€)</label>
                  <input
                    type="number"
                    value={userProfile?.budget_min || ""}
                    onChange={(e) => handleBudgetChange('budget_min', e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-lg py-1.5 px-2 text-xs text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-gray-400 uppercase font-black ml-1">Max (€)</label>
                  <input
                    type="number"
                    value={userProfile?.budget_max || ""}
                    onChange={(e) => handleBudgetChange('budget_max', e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-lg py-1.5 px-2 text-xs text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="500"
                  />
                </div>
              </div>
            </div>

            {/* Favorite Shops (Top 3) */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Store className="w-3.5 h-3.5 text-blue-600" /> Mes 3 magasins habituels
                </p>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded">
                  {userFavoriteStores?.size || 0}/3
                </span>
              </div>

              <div className="space-y-1.5">
                {stores.filter(s => userFavoriteStores?.has(s.id)).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 flex-shrink-0 bg-white rounded border flex items-center justify-center text-[10px] font-bold">
                        {CHAIN_ICONS[s.chain] || (s.chain?.[0] || 'M')}
                      </div>
                      <span className="text-xs text-gray-900 font-medium truncate">{s.name}</span>
                    </div>
                    <button
                      onClick={() => toggleFavoriteStore(s.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {(!userFavoriteStores || userFavoriteStores.size < 3) && (
                  <div className="relative">
                    {!showStoreSearch ? (
                      <button
                        onClick={() => setShowStoreSearch(true)}
                        className="w-full py-2 border-2 border-dashed border-gray-100 rounded-lg text-gray-400 text-xs hover:border-blue-200 hover:text-blue-500 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter un magasin
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            autoFocus
                            type="text"
                            value={storeSearchQuery}
                            onChange={(e) => setStoreSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-8 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Chercher un magasin..."
                          />
                          <button onClick={() => { setShowStoreSearch(false); setStoreSearchQuery(""); }} className="absolute right-2 top-2">
                            <X className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                        {storeSearchQuery && (
                          <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden divide-y">
                            {filteredStores.map(s => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  toggleFavoriteStore(s.id);
                                  setStoreSearchQuery("");
                                  setShowStoreSearch(false);
                                }}
                                className="w-full text-left p-2 hover:bg-blue-50 transition-colors flex items-center gap-2"
                              >
                                <span className="text-[10px] font-bold text-gray-400">{s.chain}</span>
                                <span className="text-xs text-gray-700 font-medium">{s.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Geography Selector */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-orange-500" /> Géographie
                {isUpdatingCity && <span className="animate-pulse text-[10px] text-orange-500 ml-2">Mise à jour...</span>}
              </p>
              <div className="space-y-2">
                <select
                  value={userProfile?.region_code || "972"}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  disabled={isUpdatingCity}
                  className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                >
                  <option value="972">Martinique (972)</option>
                  <option value="971">Guadeloupe (971)</option>
                  <option value="973">Guyane (973)</option>
                  <option value="974">La Réunion (974)</option>
                  <option value="976">Mayotte (976)</option>
                  <option value="Hexagone">France Hexagonale</option>
                  <option value="Autre">Autre</option>
                </select>

                <div className="relative">
                  {userProfile?.region_code === '972' ? (
                    <select
                      value={userProfile?.city || ""}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={isUpdatingCity}
                      className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                    >
                      <option value="">Ma Ville (972)...</option>
                      {martiniqueCities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      onBlur={() => handleCityChange(cityInput)}
                      placeholder="Ma Ville..."
                      className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* BQP Preference */}
            <div className="p-4 border-b border-gray-100 bg-blue-50/50">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                🛒 Consommez-vous BQP ?
                {isUpdatingCity && <span className="animate-pulse text-[10px] text-orange-500 ml-2">Mise à jour...</span>}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {['yes', 'no', 'partial'].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleBqpChange(val)}
                    disabled={isUpdatingCity}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold uppercase transition-colors border ${userProfile?.consumes_bqp === val
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    {val === 'yes' ? 'Oui' : val === 'no' ? 'Non' : 'Un peu'}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-2 space-y-1">
              {/* Password change — only for email/password accounts */}
              {isEmailUser && (
                <div>
                  {!showChangePassword ? (
                    <button
                      onClick={() => { setShowChangePassword(true); setPasswordError(null); setPasswordSuccess(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Lock className="w-5 h-5 text-gray-400" />
                      <span>Changer mon mot de passe</span>
                    </button>
                  ) : (
                    <div className="px-4 py-3 space-y-2 bg-gray-50 rounded-xl">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Nouveau mot de passe
                      </p>
                      {passwordError && (
                        <p className="text-xs text-red-600">{passwordError}</p>
                      )}
                      {passwordSuccess && (
                        <p className="text-xs text-green-600 font-medium">Mot de passe modifié !</p>
                      )}
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirmer le mot de passe"
                        className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleChangePassword}
                          disabled={isChangingPassword}
                          className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                        >
                          {isChangingPassword ? 'En cours...' : 'Confirmer'}
                        </button>
                        <button
                          onClick={() => { setShowChangePassword(false); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); }}
                          className="flex-1 bg-gray-200 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {userRoles.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Accès Professionnels</p>
                  <div className="space-y-1">
                    {userRoles.includes('admin') && (
                      <button
                        onClick={() => { onOpenAdmin(); setIsOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <span>Console Admin</span>
                      </button>
                    )}
                    {userRoles.includes('journalist') && (
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                        <BarChart3 className="w-5 h-5" />
                        <span>Portail Journaliste</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-400" />
                <span>Deconnexion</span>
              </button>
            </div>
          </div>
          {showScrollHint && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-1 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400 animate-bounce" />
            </div>
          )}
          </div>
        </div>
      )
      }
    </div >
  );
};

export default UserMenu;
