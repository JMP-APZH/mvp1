import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquare, ThumbsUp, ThumbsDown, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { posthog } from '../posthogClient';

const STATUS_OPTIONS = [
    { value: 'under_review', label: 'En revue' },
    { value: 'planned', label: 'Prévu' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'completed', label: 'Terminé' },
    { value: 'rejected', label: 'Refusé' },
];

const FeatureRequestAdmin = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [draft, setDraft] = useState({ status: 'under_review', admin_comment: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data, error: loadError } = await supabase
                .from('feature_request_stats')
                .select('*')
                .order('created_at', { ascending: false });
            if (loadError) throw loadError;
            setRequests(data || []);
        } catch (err) {
            console.error('Error loading feature requests:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openEdit = (req) => {
        setExpandedId(req.id);
        setDraft({ status: req.status || 'under_review', admin_comment: req.admin_comment || '' });
        setError(null);
    };

    const closeEdit = () => setExpandedId(null);

    const save = async (req) => {
        setSaving(true);
        setError(null);
        try {
            const { error: updateError } = await supabase
                .from('feature_requests')
                .update({
                    status: draft.status,
                    admin_comment: draft.admin_comment.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', req.id);
            if (updateError) throw updateError;
            posthog.capture('feature_request_admin_replied', { feature_id: req.id, status: draft.status });
            setExpandedId(null);
            await load();
        } catch (err) {
            console.error('Error updating feature request:', err);
            setError("Erreur lors de l'enregistrement -- vérifiez que feature_request_comments_migration.sql a bien été appliquée.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-xs text-orange-800 flex items-start gap-2">
                <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                    Suggestions soumises dans l'onglet Communauté &gt; Améliorations, triées par date -- les plus
                    récentes en premier. Une réponse ici s'affiche comme confirmation officielle directement sur
                    la proposition, visible par tous.
                </p>
            </div>

            {requests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune proposition pour le moment.</p>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => {
                        const isExpanded = expandedId === req.id;
                        return (
                            <div key={req.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                <button
                                    onClick={() => (isExpanded ? closeEdit() : openEdit(req))}
                                    className="w-full text-left p-3 flex items-start gap-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-gray-900 truncate">{req.title}</p>
                                            <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase">
                                                {req.category}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{req.description}</p>
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-bold flex-wrap">
                                            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{req.upvotes || 0}</span>
                                            <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3" />{req.downvotes || 0}</span>
                                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{req.comment_count || 0}</span>
                                            <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                            <span className="bg-gray-50 px-2 py-0.5 rounded-full">
                                                {STATUS_OPTIONS.find(s => s.value === req.status)?.label || req.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-gray-300 mt-1">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                                        <select
                                            value={draft.status}
                                            onChange={(e) => setDraft(d => ({ ...d, status: e.target.value }))}
                                            className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                        >
                                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                        <textarea
                                            value={draft.admin_comment}
                                            onChange={(e) => setDraft(d => ({ ...d, admin_comment: e.target.value }))}
                                            placeholder="Réponse officielle, visible par tous sur la proposition..."
                                            rows={3}
                                            className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                        />
                                        {error && <p className="text-xs text-red-600">{error}</p>}
                                        <button
                                            onClick={() => save(req)}
                                            disabled={saving}
                                            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Enregistrer
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FeatureRequestAdmin;
