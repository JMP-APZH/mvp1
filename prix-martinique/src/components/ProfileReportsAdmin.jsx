import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Flag, CheckCircle2, Clock, EyeOff, ShieldAlert } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Admin review queue for profile_reports (see profile_card_migration.sql).
// Append-only reports; the admin marks each reviewed/dismissed and can blank the
// offending profile's bio / status / avatar via the admin_moderate_profile RPC
// (user_profiles' own RLS only lets a user edit their own row).
const REASON_LABELS = {
  impersonation: 'Usurpation d’identité',
  offensive: 'Contenu offensant',
  spam: 'Spam',
  other: 'Autre',
};

const ProfileReportsAdmin = () => {
  const [reports, setReports] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: reportErr } = await supabase
        .from('profile_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (reportErr) throw reportErr;
      setReports(data || []);

      const ids = [...new Set((data || []).map((r) => r.reported_user_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, display_name, bio, status_text, avatar_url')
          .in('id', ids);
        setProfiles(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      }
    } catch (err) {
      console.error('Error loading profile reports:', err);
      setError('Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (report, status) => {
    setBusyId(report.id);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from('profile_reports')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', report.id);
      if (updErr) throw updErr;
      await load();
    } catch (err) {
      console.error('Error updating report:', err);
      setError('Mise à jour impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const moderate = async (report, fields) => {
    setBusyId(report.id);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('admin_moderate_profile', {
        p_user_id: report.reported_user_id,
        p_clear_bio: !!fields.bio,
        p_clear_status: !!fields.status,
        p_clear_avatar: !!fields.avatar,
      });
      if (rpcErr) throw rpcErr;
      await supabase
        .from('profile_reports')
        .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
        .eq('id', report.id);
      await load();
    } catch (err) {
      console.error('Error moderating profile:', err);
      setError('Modération impossible (migration appliquée ?).');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const pending = reports.filter((r) => r.status === 'pending');
  const other = reports.filter((r) => r.status !== 'pending');

  const renderCard = (report) => {
    const prof = profiles[report.reported_user_id];
    return (
      <div key={report.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-gray-900 truncate">
              {prof?.display_name || 'Profil supprimé'}
            </p>
            <p className="text-[11px] font-bold text-red-600">{REASON_LABELS[report.reason] || report.reason}</p>
            <p className="text-[10px] text-gray-400">
              Signalé le {new Date(report.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          {report.status !== 'pending' && (
            <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
              {report.status === 'reviewed' ? 'Traité' : 'Rejeté'}
            </span>
          )}
        </div>

        {report.details && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">« {report.details} »</p>
        )}

        {prof && (prof.bio || prof.status_text) && (
          <div className="text-[11px] text-gray-500 border-l-2 border-gray-200 pl-2 space-y-0.5">
            {prof.status_text && <p><span className="font-bold">Statut :</span> {prof.status_text}</p>}
            {prof.bio && <p><span className="font-bold">Bio :</span> {prof.bio}</p>}
          </div>
        )}

        {report.status === 'pending' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => moderate(report, { bio: true, status: true })}
              disabled={busyId === report.id}
              className="flex items-center gap-1 bg-red-50 text-red-700 text-[11px] font-bold px-2 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" /> Effacer bio + statut
            </button>
            <button
              onClick={() => moderate(report, { avatar: true })}
              disabled={busyId === report.id}
              className="flex items-center gap-1 bg-red-50 text-red-700 text-[11px] font-bold px-2 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" /> Effacer la photo
            </button>
            <button
              onClick={() => setStatus(report, 'reviewed')}
              disabled={busyId === report.id}
              className="flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-bold px-2 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Traité
            </button>
            <button
              onClick={() => setStatus(report, 'dismissed')}
              disabled={busyId === report.id}
              className="flex items-center gap-1 bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Rejeter
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

      <section>
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" /> À traiter ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Aucun profil signalé.
          </p>
        ) : (
          <div className="space-y-2">{pending.map(renderCard)}</div>
        )}
      </section>

      {other.length > 0 && (
        <section>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Flag className="w-5 h-5 text-gray-400" /> Historique
          </h3>
          <div className="space-y-2">{other.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
};

export default ProfileReportsAdmin;
