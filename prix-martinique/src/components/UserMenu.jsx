import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Trophy, Star, ChevronDown, Award, Wallet, MapPin, Store, Plus, Search, Settings, TrendingUp, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UserMenu = ({ onSignInClick, onOpenStats, stores }) => {
  const { user, userProfile, userBadges, loading, signOut, updateProfile, userFavoriteStores, toggleFavoriteStore } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);
  const [showStoreSearch, setShowStoreSearch] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
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

  const handleCityChange = async (city) => {
    setIsUpdatingCity(true);
    await updateProfile({ city });
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
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <div className="text-2xl font-bold text-orange-600">
                  {((userProfile?.total_contributions || 0) * 0.85).toFixed(2)}€
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-orange-400">Mes Économies</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                  🔥 {userProfile?.streak_count || 1}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-blue-400">Mes contributions à l'effort collectif</div>
              </div>
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

          <div className="max-h-[350px] overflow-y-auto">
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
                    className="w-full bg-white border border-gray-100 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-gray-400 uppercase font-black ml-1">Max (€)</label>
                  <input
                    type="number"
                    value={userProfile?.budget_max || ""}
                    onChange={(e) => handleBudgetChange('budget_max', e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="500"
                  />
                </div>
              </div>
            </div>

            {/* Favorite Shops (Top 3) */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Store className="w-3.5 h-3.5 text-blue-600" /> Mes 3 Magasins Top
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
                        {s.chain?.[0] || 'M'}
                      </div>
                      <span className="text-xs text-gray-700 truncate">{s.name}</span>
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
                            className="w-full pl-7 pr-8 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
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

            {/* City Selector */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-orange-500" /> Ma Ville
                {isUpdatingCity && <span className="animate-pulse text-[10px] text-orange-500 ml-2">Mise à jour...</span>}
              </p>
              <select
                value={userProfile?.city || ""}
                onChange={(e) => handleCityChange(e.target.value)}
                disabled={isUpdatingCity}
                className="w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:opacity-50"
              >
                <option value="">Choisir ma ville...</option>
                {martiniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
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
            <div className="p-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-400" />
                <span>Deconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
};

export default UserMenu;
