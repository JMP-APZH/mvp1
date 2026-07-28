import React, { useState, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, ShieldCheck, MessageSquare, Loader2, CheckCircle2, Clock, Ban, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { posthog } from '../posthogClient';

const getStatusIcon = (status) => {
    switch (status) {
        case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'in_progress': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin-slow" />;
        case 'planned': return <Clock className="w-4 h-4 text-orange-500" />;
        case 'rejected': return <Ban className="w-4 h-4 text-gray-400" />;
        default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'completed': return 'Terminé';
        case 'in_progress': return 'En cours';
        case 'planned': return 'Prévu';
        case 'rejected': return 'Refusé';
        case 'under_review': return 'En revue';
        default: return status;
    }
};

const FeatureRequestDetailModal = ({ featureId, onClose, onRequireAuth }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [feature, setFeature] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadComments = async () => {
        const { data: commentRows, error } = await supabase
            .from('feature_request_comments')
            .select('id, content, created_at, user_id')
            .eq('feature_id', featureId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading feature comments:', error);
            return;
        }

        const userIds = [...new Set((commentRows || []).map(c => c.user_id))];
        let profileByUserId = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, display_name')
                .in('id', userIds);
            profileByUserId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        }

        setComments((commentRows || []).map(c => ({
            id: c.id,
            content: c.content,
            createdAt: c.created_at,
            authorName: profileByUserId[c.user_id]?.display_name || 'Anonyme',
        })));
    };

    useEffect(() => {
        if (!featureId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('feature_request_stats')
                    .select('*')
                    .eq('id', featureId)
                    .single();
                if (error) throw error;

                let userVote = null;
                if (user) {
                    const { data: myVote } = await supabase
                        .from('feature_votes')
                        .select('vote_type')
                        .eq('feature_id', featureId)
                        .eq('user_id', user.id)
                        .maybeSingle();
                    userVote = myVote?.vote_type ?? null;
                }

                setFeature({ ...data, userVote });
                await loadComments();
                posthog.capture('feature_request_opened', { feature_id: featureId });
            } catch (err) {
                console.error('Error loading feature request:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [featureId]);

    const handleVote = async (type) => {
        if (!user) { onRequireAuth?.(); return; }
        try {
            if (feature.userVote === type) {
                await supabase.from('feature_votes').delete().eq('feature_id', featureId).eq('user_id', user.id);
                setFeature(f => ({ ...f, userVote: null, net_votes: f.net_votes - type }));
            } else {
                const prevVote = feature.userVote || 0;
                await supabase.from('feature_votes').upsert({ feature_id: featureId, user_id: user.id, vote_type: type });
                setFeature(f => ({ ...f, userVote: type, net_votes: f.net_votes - prevVote + type }));
            }
        } catch (err) {
            console.error('Error voting:', err);
        }
    };

    const submitComment = async () => {
        if (!user) { onRequireAuth?.(); return; }
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('feature_request_comments')
                .insert([{ feature_id: featureId, user_id: user.id, content: newComment.trim() }]);
            if (error) throw error;
            setNewComment('');
            await loadComments();
            posthog.capture('feature_comment_posted', { feature_id: featureId });
        } catch (err) {
            console.error('Error posting comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">Détail de la proposition</h3>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading || !feature ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-2 min-w-[3.5rem] self-start">
                                <button
                                    onClick={() => handleVote(1)}
                                    className={`p-1.5 rounded-lg transition-colors ${feature.userVote === 1 ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-orange-500'}`}
                                >
                                    <ThumbsUp className="w-5 h-5" />
                                </button>
                                <span className={`text-sm font-bold ${feature.net_votes > 0 ? 'text-orange-600' : feature.net_votes < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {feature.net_votes > 0 ? `+${feature.net_votes}` : feature.net_votes}
                                </span>
                                <button
                                    onClick={() => handleVote(-1)}
                                    className={`p-1.5 rounded-lg transition-colors ${feature.userVote === -1 ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                >
                                    <ThumbsDown className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-bold text-gray-900 leading-tight">{feature.title}</h4>
                                    <span className="shrink-0 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {feature.category}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{feature.description}</p>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg w-fit mt-3">
                                    {getStatusIcon(feature.status)}
                                    <span className="text-[11px] font-bold text-gray-600">{getStatusLabel(feature.status)}</span>
                                </div>
                            </div>
                        </div>

                        {feature.admin_comment && (
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Réponse officielle de l'équipe</span>
                                </div>
                                <p className="text-sm text-blue-900 whitespace-pre-wrap">{feature.admin_comment}</p>
                            </div>
                        )}

                        <div>
                            <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                                <MessageSquare className="w-4 h-4 text-gray-400" />
                                Commentaires {comments.length > 0 && `(${comments.length})`}
                            </h5>
                            {comments.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Aucun commentaire pour le moment. Soyez le premier à réagir.</p>
                            ) : (
                                <div className="space-y-3">
                                    {comments.map(c => (
                                        <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-gray-700">{c.authorName}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-4 border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
                    <textarea
                        rows={1}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onFocus={() => { if (!user) onRequireAuth?.(); }}
                        placeholder={user ? "Ajouter un commentaire..." : "Connectez-vous pour commenter"}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <button
                        onClick={submitComment}
                        disabled={submitting || !newComment.trim()}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors flex-shrink-0"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeatureRequestDetailModal;
