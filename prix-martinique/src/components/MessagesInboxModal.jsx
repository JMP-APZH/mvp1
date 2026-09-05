import React, { useState, useEffect } from 'react';
import { X, Loader2, Mail, MailOpen, ChevronRight, Inbox } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/useAuth';
import { posthog } from '../posthogClient';

// One-way admin -> user inbox (see product_completion_and_messaging_migration.sql).
// Read from ProductCompletion.jsx, e.g. to explain why a submission was
// incomplete (missing/unreadable barcode photo, price left pending, etc.).
const MessagesInboxModal = ({ onClose, onSelectProduct }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [migrationPending, setMigrationPending] = useState(false);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_messages')
                    .select('id, subject, body, related_product_id, is_read, created_at')
                    .eq('recipient_id', user.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setMessages(data || []);
                posthog.capture('messages_inbox_opened', {
                    message_count: (data || []).length,
                    unread_count: (data || []).filter(m => !m.is_read).length,
                });
            } catch (err) {
                console.error('Error loading messages (migration pending?):', err);
                setMigrationPending(true);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const markRead = async (message) => {
        if (message.is_read) return;
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_read: true } : m));
        const { error } = await supabase.from('user_messages').update({ is_read: true }).eq('id', message.id);
        if (error) console.error('Error marking message read:', error);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Inbox className="w-5 h-5 text-orange-500" /> Messages
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Notifications de l'équipe sur vos contributions</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : migrationPending || messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
                        <MailOpen className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-600 font-medium">Aucun message</p>
                        <p className="text-sm text-gray-400 mt-1">Vous serez notifié ici si une de vos contributions a besoin d'être complétée.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {messages.map(message => (
                            <div
                                key={message.id}
                                onClick={() => markRead(message)}
                                className={`rounded-2xl p-3 border transition-colors ${message.is_read ? 'bg-gray-50 border-gray-100' : 'bg-orange-50 border-orange-200'}`}
                            >
                                <div className="flex items-start gap-2">
                                    {message.is_read
                                        ? <MailOpen className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                        : <Mail className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${message.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                                            {message.subject}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{message.body}</p>
                                        <p className="text-[10px] text-gray-400 mt-1.5">
                                            {new Date(message.created_at).toLocaleDateString('fr-FR')}
                                        </p>
                                        {message.related_product_id && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSelectProduct?.(message.related_product_id); }}
                                                className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                                            >
                                                Voir le produit <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesInboxModal;
