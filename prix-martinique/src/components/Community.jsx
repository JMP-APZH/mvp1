import React, { useState, useEffect } from 'react';
import { Trophy, Vote, BarChart3, Plus, MessageSquare, ThumbsUp, ThumbsDown, CheckCircle2, Clock, Ban, Loader2, Sparkles, Target } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Leaderboard from './Leaderboard';

const Community = () => {
    const [subTab, setSubTab] = useState('ranking'); // 'ranking', 'voting', 'stats'
    const [featureRequests, setFeatureRequests] = useState([]);
    const [loadingFeatures, setLoadingFeatures] = useState(false);
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const [newFeature, setNewFeature] = useState({ title: '', description: '', category: 'General' });
    const [submitting, setSubmitting] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (subTab === 'voting') {
            loadFeatureRequests();
        }
    }, [subTab]);

    const loadFeatureRequests = async () => {
        setLoadingFeatures(true);
        try {
            const { data, error } = await supabase
                .from('feature_request_stats')
                .select('*')
                .order('net_votes', { ascending: false });

            if (error) throw error;
            setFeatureRequests(data || []);
        } catch (err) {
            console.error('Error loading features:', err);
        } finally {
            setLoadingFeatures(false);
        }
    };

    const handleVote = async (featureId, type) => {
        if (!user) {
            alert('Vous devez être connecté pour voter.');
            return;
        }

        try {
            // Check if user already voted with same type
            const { data: existingVote } = await supabase
                .from('feature_votes')
                .select('vote_type')
                .eq('feature_id', featureId)
                .eq('user_id', user.id)
                .single();

            if (existingVote && existingVote.vote_type === type) {
                // Remove vote if clicking same one
                await supabase
                    .from('feature_votes')
                    .delete()
                    .eq('feature_id', featureId)
                    .eq('user_id', user.id);
            } else {
                // Upsert new vote
                await supabase
                    .from('feature_votes')
                    .upsert({
                        feature_id: featureId,
                        user_id: user.id,
                        vote_type: type
                    });
            }
            loadFeatureRequests(); // Refresh list
        } catch (err) {
            console.error('Error voting:', err);
        }
    };

    const submitFeature = async (e) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('feature_requests')
                .insert([{
                    user_id: user.id,
                    title: newFeature.title,
                    description: newFeature.description,
                    category: newFeature.category
                }]);

            if (error) throw error;
            setShowSuggestModal(false);
            setNewFeature({ title: '', description: '', category: 'General' });
            loadFeatureRequests();
        } catch (err) {
            console.error('Error submitting feature:', err);
        } finally {
            setSubmitting(false);
        }
    };

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

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Communauté</h2>
                        <p className="text-sm text-gray-500">Façonnons ensemble l'avenir de l'app</p>
                    </div>
                </div>

                {/* SubTabs Nav */}
                <div className="flex gap-2 p-1 bg-gray-50 rounded-xl overflow-x-auto">
                    <button
                        onClick={() => setSubTab('ranking')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${subTab === 'ranking' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Trophy className="w-4 h-4" />
                        Classement
                    </button>
                    <button
                        onClick={() => setSubTab('voting')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${subTab === 'voting' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Vote className="w-4 h-4" />
                        Voter (Features)
                    </button>
                    <button
                        onClick={() => setSubTab('stats')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${subTab === 'stats' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Impact Local
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide pb-24">
                {subTab === 'ranking' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Leaderboard />
                    </div>
                )}

                {subTab === 'voting' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 border-l-4 border-orange-500 pl-3">Développement Participatif</h3>
                                <p className="text-xs text-gray-500 mt-1 pl-4">Voted pour les prochaines fonctionnalités</p>
                            </div>
                            <button
                                onClick={() => setShowSuggestModal(true)}
                                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Proposer
                            </button>
                        </div>

                        {loadingFeatures ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                                <p className="text-sm text-gray-500">Chargement des idées...</p>
                            </div>
                        ) : featureRequests.length === 0 ? (
                            <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-600 font-medium font-display">Aucune proposition pour le moment</p>
                                <p className="text-sm text-gray-400 mt-2">Soyez le premier à proposer une idée révolutionnaire !</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {featureRequests.map((feature) => (
                                    <div key={feature.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-orange-200 transition-colors">
                                        <div className="flex gap-4">
                                            {/* Voting arrows */}
                                            <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-2 min-w-[3.5rem] self-start">
                                                <button
                                                    onClick={() => handleVote(feature.id, 1)}
                                                    className={`p-1.5 rounded-lg transition-colors ${feature.userVote === 1 ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-orange-500'}`}
                                                >
                                                    <ThumbsUp className="w-5 h-5 font-bold" />
                                                </button>
                                                <span className={`text-sm font-bold ${feature.net_votes > 0 ? 'text-orange-600' : feature.net_votes < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                    {feature.net_votes > 0 ? `+${feature.net_votes}` : feature.net_votes}
                                                </span>
                                                <button
                                                    onClick={() => handleVote(feature.id, -1)}
                                                    className={`p-1.5 rounded-lg transition-colors ${feature.userVote === -1 ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                                >
                                                    <ThumbsDown className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h4 className="font-bold text-gray-900 leading-tight truncate">{feature.title}</h4>
                                                    <span className="shrink-0 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        {feature.category}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{feature.description}</p>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
                                                        {getStatusIcon(feature.status)}
                                                        <span className="text-[11px] font-bold text-gray-600">{getStatusLabel(feature.status)}</span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(feature.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {subTab === 'stats' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Target className="w-24 h-24" />
                            </div>
                            <h3 className="text-lg font-bold mb-1">Score de Souveraineté</h3>
                            <p className="text-indigo-100 text-sm mb-4">Progression vers l'autonomie alimentaire</p>

                            <div className="flex items-end gap-3 mb-2">
                                <span className="text-4xl font-black">28%</span>
                                <span className="text-indigo-200 text-xs pb-1 mb-1">+2% ce mois</span>
                            </div>
                            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full w-[28%] shadow-sm shadow-white/50"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                <div className="bg-green-100 w-10 h-10 rounded-xl flex items-center justify-center text-green-600 mb-3">
                                    <Target className="w-6 h-6" />
                                </div>
                                <p className="text-2xl font-bold text-gray-900 leading-none">156</p>
                                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tight">Produits Locaux</p>
                            </div>
                            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <p className="text-2xl font-bold text-gray-900 leading-none">842</p>
                                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tight">Prix Vérifiés</p>
                            </div>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
                            <h4 className="font-bold text-orange-900 flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5" /> Mission Collective
                            </h4>
                            <p className="text-sm text-orange-800 leading-relaxed">
                                Atteignons ensemble les <strong>1 000 produits vérifiés</strong> pour débloquer le dashboard de transparence des prix !
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Suggest Modal */}
            {showSuggestModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 font-display">Nouvelle Idée</h3>
                            <button onClick={() => setShowSuggestModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                                <Loader2 className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={submitFeature} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1 italic">Titre de la fonctionnalité</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: Mode hors-ligne"
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-gray-900 focus:border-orange-500 focus:ring-0 outline-none transition-all placeholder:text-gray-400"
                                    value={newFeature.title}
                                    onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1 italic">Détails</label>
                                <textarea
                                    required
                                    rows="4"
                                    placeholder="Décrivez comment cela aiderait la communauté..."
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-gray-900 focus:border-orange-500 focus:ring-0 outline-none transition-all placeholder:text-gray-400 resize-none"
                                    value={newFeature.description}
                                    onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-5 rounded-2xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                Publier ma proposition
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Community;
