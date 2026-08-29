import React, { useState, useEffect } from 'react';
import { Loader2, UserX, Mail, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Admin-side half of the GDPR deletion flow (see deletion_requests_migration.sql
// and supabase/functions/delete-user-account). Actually deleting the auth
// user needs the service-role key, which never runs client-side -- this
// component only ever calls the deployed Edge Function, which does that
// work server-side after re-checking the caller is an admin itself.
const DeletionRequestsAdmin = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('deletion_requests')
                .select('*')
                .order('requested_at', { ascending: false });
            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Error loading deletion requests:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleProcess = async (req) => {
        setProcessingId(req.id);
        setError(null);
        try {
            const { error } = await supabase.functions.invoke('delete-user-account', {
                body: { user_id: req.user_id, deletion_request_id: req.id },
            });
            if (error) throw error;
            await load();
        } catch (err) {
            console.error('Error processing deletion:', err);
            setError(`Échec pour ${req.user_email} : ${err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    // No transactional email sending is wired up in this app -- this just
    // pre-fills the admin's own mail client, same pattern as the "Nous
    // contacter" link, rather than adding a whole email-sending integration
    // for a low-volume, admin-mediated flow.
    const confirmationMailto = (email) => {
        const subject = 'Confirmation de suppression de votre compte Prix Martinique';
        const body = "Bonjour,\n\nVotre demande de suppression de compte a été traitée. Votre compte et vos données privées ont été supprimés ; vos prix soumis restent visibles mais ont été anonymisés.\n\nCordialement,\nL'équipe Prix Martinique";
        return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const pending = requests.filter(r => r.status === 'pending');
    const other = requests.filter(r => r.status !== 'pending');

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>
            )}

            <section>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> En attente ({pending.length})
                </h3>
                {pending.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune demande en attente.</p>
                ) : (
                    <div className="space-y-2">
                        {pending.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <div>
                                    <p className="font-medium text-sm text-gray-900">{req.user_email}</p>
                                    <p className="text-xs text-gray-500">Demandé le {new Date(req.requested_at).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <button
                                    onClick={() => handleProcess(req)}
                                    disabled={processingId === req.id}
                                    className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                                >
                                    <UserX className="w-3.5 h-3.5" />
                                    {processingId === req.id ? 'Traitement...' : 'Traiter la suppression'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" /> Historique
                </h3>
                {other.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune demande traitée pour le moment.</p>
                ) : (
                    <div className="space-y-2">
                        {other.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-3">
                                <div>
                                    <p className="font-medium text-sm text-gray-900">{req.user_email}</p>
                                    <p className="text-xs text-gray-500">
                                        {req.status === 'completed'
                                            ? `Supprimé le ${new Date(req.completed_at).toLocaleDateString('fr-FR')}`
                                            : 'Demande annulée'}
                                    </p>
                                </div>
                                {req.status === 'completed' && (
                                    <a
                                        href={confirmationMailto(req.user_email)}
                                        className="flex items-center gap-1.5 text-orange-600 text-xs font-bold hover:underline flex-shrink-0"
                                    >
                                        <Mail className="w-3.5 h-3.5" /> Envoyer confirmation
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default DeletionRequestsAdmin;
