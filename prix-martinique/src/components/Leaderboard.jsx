import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, TrendingUp, Crown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const Leaderboard = () => {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all'); // 'all', 'month', 'week'
  const { user } = useAuth();

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('id, display_name, points, level, total_contributions')
        .order('points', { ascending: false })
        .limit(10);

      const { data, error } = await query;

      if (error) throw error;
      setLeaders(data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
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

  const getLevelTitle = (level) => {
    const titles = {
      1: 'Debutant',
      2: 'Contributeur',
      3: 'Chasseur',
      4: 'Expert',
      5: 'Champion',
      6: 'Legende',
      7: 'Maitre',
      8: 'Grand Maitre',
      9: 'Elite',
      10: 'Heros'
    };
    return titles[level] || `Niv.${level}`;
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
          Soyez le premier a vous inscrire et contribuer!
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

      {/* Top 3 podium */}
      {leaders.length >= 3 && (
        <div className="flex items-end justify-center gap-2 py-4">
          {/* 2nd place */}
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xl font-bold text-gray-600 border-4 border-gray-300">
              {leaders[1]?.level || 1}
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs font-medium text-gray-700 truncate max-w-16">
                {leaders[1]?.display_name?.split(' ')[0] || 'Anon'}
              </p>
              <p className="text-xs text-gray-500">{leaders[1]?.points} pts</p>
            </div>
            <div className="w-16 h-16 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-500">2</span>
            </div>
          </div>

          {/* 1st place */}
          <div className="flex flex-col items-center -mt-4">
            <Crown className="w-8 h-8 text-yellow-500 mb-1" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center text-2xl font-bold text-yellow-800 border-4 border-yellow-400 shadow-lg">
              {leaders[0]?.level || 1}
            </div>
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-gray-800 truncate max-w-20">
                {leaders[0]?.display_name?.split(' ')[0] || 'Anon'}
              </p>
              <p className="text-xs text-yellow-600 font-medium">{leaders[0]?.points} pts</p>
            </div>
            <div className="w-20 h-24 bg-gradient-to-t from-yellow-400 to-yellow-300 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-yellow-700">1</span>
            </div>
          </div>

          {/* 3rd place */}
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center text-xl font-bold text-orange-700 border-4 border-orange-300">
              {leaders[2]?.level || 1}
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs font-medium text-gray-700 truncate max-w-16">
                {leaders[2]?.display_name?.split(' ')[0] || 'Anon'}
              </p>
              <p className="text-xs text-gray-500">{leaders[2]?.points} pts</p>
            </div>
            <div className="w-16 h-12 bg-gradient-to-t from-orange-400 to-orange-300 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-orange-600">3</span>
            </div>
          </div>
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
              className={`flex items-center gap-3 p-3 rounded-lg border ${getRankBackground(rank)} ${
                isCurrentUser ? 'ring-2 ring-orange-400' : ''
              }`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8">
                {getRankIcon(rank)}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium truncate ${isCurrentUser ? 'text-orange-600' : 'text-gray-900'}`}>
                    {leader.display_name || 'Anonyme'}
                    {isCurrentUser && <span className="text-xs text-orange-500 ml-1">(vous)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                    Niv.{leader.level || 1}
                  </span>
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
    </div>
  );
};

export default Leaderboard;
