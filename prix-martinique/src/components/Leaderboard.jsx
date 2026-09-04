import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Star, TrendingUp, Crown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/useAuth';
import HunterDetailModal from './HunterDetailModal';
import Avatar from './Avatar';

// Rank position, rendered so it never reads as a level number: an ordinal.
const ordinal = (n) => (n === 1 ? '1re' : `${n}e`);

// Small labelled chip for the gamification level -- "Niv. 3" -- so the bare
// number is never shown on its own next to a ranking position.
const LevelChip = ({ level, className = '' }) => (
  <span className={`inline-flex items-center rounded-full bg-orange-100 text-orange-700 font-bold uppercase tracking-wide ${className}`}>
    Niv.&nbsp;{level || 1}
  </span>
);

const Leaderboard = ({ city, onRequireAuth }) => {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe] = useState('all'); // 'all', 'month', 'week' -- selector UI currently disabled, see commented-out block below
  const [selectedHunterId, setSelectedHunterId] = useState(null);
  const { user } = useAuth();

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, points, level, total_contributions, city')
        .order('points', { ascending: false })
        .limit(10);

      if (city) {
        query = query.eq('city', city);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeaders(data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe, city, loadLeaderboard]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold text-sm">{rank}<sup className="text-[9px]">e</sup></span>;
    }
  };

  const getRankBackground = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
      case 3:
        return 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200';
      default:
        return 'bg-white border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-800">Classement</h3>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-16 animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Pas encore de classement</p>
        <p className="text-sm text-gray-500 mt-1">
          Soyez le premier à vous inscrire et contribuer !
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-800">Classement</h3>
        </div>
        {/* Timeframe selector - simplified for now */}
        {/* <div className="flex text-xs bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1 rounded ${timeframe === 'week' ? 'bg-white shadow' : ''}`}
          >
            Semaine
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1 rounded ${timeframe === 'month' ? 'bg-white shadow' : ''}`}
          >
            Mois
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1 rounded ${timeframe === 'all' ? 'bg-white shadow' : ''}`}
          >
            Total
          </button>
        </div> */}
      </div>

      {/* Top 3 podium -- the circle is the contributor (photo / initial), the
          step is the ranking position (ordinal), and the level is a labelled
          chip. Previously the circle held the bare level number, which read as
          a second, conflicting rank. */}
      {leaders.length >= 3 && (
        <div className="flex items-end justify-center gap-3 py-4">
          {[
            { leader: leaders[1], rank: 2 },
            { leader: leaders[0], rank: 1 },
            { leader: leaders[2], rank: 3 },
          ].map(({ leader, rank }) => (
            <button
              key={leader?.id || rank}
              onClick={() => leader && setSelectedHunterId(leader.id)}
              className={`flex flex-col items-center ${rank === 1 ? '-mt-4' : ''}`}
            >
              {rank === 1 && <Crown className="w-8 h-8 text-yellow-500 mb-1" />}
              <div
                className={`rounded-full overflow-hidden bg-white ${rank === 1
                  ? 'border-4 border-yellow-400 shadow-lg'
                  : rank === 2
                    ? 'border-4 border-gray-300'
                    : 'border-4 border-orange-300'
                  }`}
              >
                <Avatar
                  src={leader?.avatar_url}
                  name={leader?.display_name}
                  size={rank === 1 ? 60 : 52}
                  fallbackClassName={rank === 1
                    ? 'bg-yellow-100 text-yellow-700'
                    : rank === 2
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-orange-100 text-orange-700'}
                />
              </div>
              <p className={`mt-2 text-center text-gray-800 truncate ${rank === 1 ? 'text-sm font-semibold max-w-24' : 'text-xs font-medium max-w-16'}`}>
                {leader?.display_name?.split(' ')[0] || 'Anon'}
              </p>
              <p className={`text-xs font-medium ${rank === 1 ? 'text-yellow-600' : 'text-gray-500'}`}>
                {leader?.points ?? 0} pts
              </p>
              <LevelChip level={leader?.level} className="mt-1 text-[9px] px-1.5 py-0.5" />
              <div
                className={`mt-2 rounded-t-lg bg-gradient-to-t flex items-center justify-center font-bold ${rank === 1
                  ? 'w-20 h-24 from-yellow-400 to-yellow-300 text-yellow-800 text-2xl'
                  : rank === 2
                    ? 'w-16 h-16 from-gray-300 to-gray-200 text-gray-600 text-lg'
                    : 'w-16 h-12 from-orange-400 to-orange-300 text-orange-700 text-lg'
                  }`}
              >
                {ordinal(rank)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Full leaderboard list */}
      <div className="space-y-2">
        {leaders.map((leader, index) => {
          const rank = index + 1;
          const isCurrentUser = user && leader.id === user.id;

          return (
            <div
              key={leader.id}
              onClick={() => setSelectedHunterId(leader.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md active:scale-[0.99] transition-all ${getRankBackground(rank)} ${isCurrentUser ? 'ring-2 ring-orange-400' : ''
                }`}
            >
              {/* Rank position */}
              <div className="flex-shrink-0 w-8">
                {getRankIcon(rank)}
              </div>

              {/* Contributor */}
              <Avatar
                src={leader.avatar_url}
                name={leader.display_name}
                size={36}
                fallbackClassName="bg-orange-100 text-orange-600"
              />

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium truncate ${isCurrentUser ? 'text-orange-600' : 'text-gray-900'}`}>
                    {leader.display_name || 'Anonyme'}
                    {isCurrentUser && <span className="text-xs text-orange-500 ml-1">(vous)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <LevelChip level={leader.level} className="text-[10px] px-1.5 py-0.5" />
                  <span>{leader.total_contributions || 0} prix</span>
                </div>
              </div>

              {/* Points */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {leader.points || 0}
                </div>
                <p className="text-xs text-gray-500">points</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Encouragement for non-ranked users */}
      {user && !leaders.some(l => l.id === user.id) && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <TrendingUp className="w-8 h-8 text-orange-400 mx-auto mb-2" />
          <p className="text-sm text-orange-800 font-medium">
            Vous n'etes pas encore dans le top 10
          </p>
          <p className="text-xs text-orange-600 mt-1">
            Continuez a soumettre des prix pour monter dans le classement!
          </p>
        </div>
      )}

      {selectedHunterId && (
        <HunterDetailModal userId={selectedHunterId} onClose={() => setSelectedHunterId(null)} onRequireAuth={onRequireAuth} />
      )}
    </div>
  );
};

export default Leaderboard;
