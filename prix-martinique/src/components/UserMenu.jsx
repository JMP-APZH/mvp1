import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Trophy, Star, ChevronDown, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UserMenu = ({ onSignInClick }) => {
  const { user, userProfile, userBadges, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

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

  // Calculate progress to next level
  const getNextLevelProgress = () => {
    if (!userProfile) return 0;
    const currentLevel = userProfile.level || 1;
    const pointsForCurrentLevel = (currentLevel - 1) * 100;
    const pointsForNextLevel = currentLevel * 100;
    const progressPoints = userProfile.total_points - pointsForCurrentLevel;
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
        {/* Avatar/Level badge */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">
            {userProfile?.level || 1}
          </div>
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
            {userProfile?.total_points || 0} pts
          </span>
        </div>

        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* User info header */}
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-xl font-bold">
                {userProfile?.level || 1}
              </div>
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

          {/* Stats */}
          <div className="p-4 border-b border-gray-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {userProfile?.total_points || 0}
                </div>
                <div className="text-xs text-gray-500">Points</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {userProfile?.prices_submitted || 0}
                </div>
                <div className="text-xs text-gray-500">Prix</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {userBadges.length}
                </div>
                <div className="text-xs text-gray-500">Badges</div>
              </div>
            </div>
          </div>

          {/* Badges */}
          {userBadges.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Badges obtenus</p>
              <div className="flex flex-wrap gap-2">
                {userBadges.slice(0, 5).map((ub) => (
                  <div
                    key={ub.id}
                    className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full text-xs"
                    title={ub.badges?.description}
                  >
                    <span>{ub.badges?.icon}</span>
                    <span>{ub.badges?.name}</span>
                  </div>
                ))}
                {userBadges.length > 5 && (
                  <div className="text-xs text-gray-500 px-2 py-1">
                    +{userBadges.length - 5} autres
                  </div>
                )}
              </div>
            </div>
          )}

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
      )}
    </div>
  );
};

export default UserMenu;
