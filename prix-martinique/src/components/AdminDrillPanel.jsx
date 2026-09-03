import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Loader2,
    Sparkle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// M2b -- full-screen drill-down over the Admin Dashboard. One component, three
// modes, all backed by analytics_admin_m2b_migration.sql:
//   'submissions' -> admin_submissions_browse (paginated / channel-filterable)
//   'review'      -> same fn, p_review_only := true (the "Modérer Prix" queue)
//   'contributors'-> admin_contributors
// Graceful degradation: an RPC error (migration not applied) shows an inline
// notice, never breaks the parent dashboard.

const PAGE = 25;

const CHANNELS = [
    { key: null, label: 'Tous' },
    { key: 'martinique_scan', label: 'Martinique' },
    { key: 'diaspora_scan', label: 'Diaspora (FR)' },
    { key: 'admin_reference', label: 'Réf. en ligne' },
];

const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const channelBadge = (channel) => {
    if (channel === 'diaspora_scan') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FR</span>;
    if (channel === 'admin_reference') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">RÉF</span>;
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MQ</span>;
};

const MigrationNotice = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 leading-relaxed m-4">
        Données indisponibles — la migration <code className="font-mono">analytics_admin_m2b_migration.sql</code> n'est
        pas encore appliquée.
    </div>
);

// --- Submissions / moderation queue --------------------------------------------
const SubmissionsView = ({ mode, since, rangeLabel, excludeInternal, onOpenProduct }) => {
    const [page, setPage] = useState(0);
    const [channel, setChannel] = useState(null);
    const [reviewOnly, setReviewOnly] = useState(mode === 'review');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Reset to the first page whenever a filter changes.
    useEffect(() => { setPage(0); }, [channel, reviewOnly, since, excludeInternal]);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error: err } = await supabase.rpc('admin_submissions_browse', {
                p_since: since,
                p_exclude_internal: excludeInternal,
                p_channel: channel,
                p_review_only: reviewOnly,
                p_limit: PAGE,
                p_offset: page * PAGE,
            });
            if (err) throw err;
            setRows(data || []);
            setTotal(data && data.length ? Number(data[0].total_count) : 0);
            setError(false);
        } catch (e) {
            console.error('admin_submissions_browse failed (migration pending?):', e);
            setRows([]);
            setTotal(0);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [since, excludeInternal, channel, reviewOnly, page]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    if (error) return <MigrationNotice />;

    const from = total === 0 ? 0 : page * PAGE + 1;
    const to = Math.min((page + 1) * PAGE, total);
    const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);

    return (
        <div className="p-4 space-y-4">
            {/* Filters */}
            <div className="space-y-3">
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit overflow-x-auto no-scrollbar max-w-full">
                    {CHANNELS.map((c) => (
                        <button
                            key={c.label}
                            onClick={() => setChannel(c.key)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${channel === c.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={reviewOnly}
                        onChange={(e) => setReviewOnly(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    À revoir uniquement (magasin manquant · prix aberrant · compte récent)
                </label>
                <p className="text-[10px] text-gray-400">
                    Période&nbsp;: {rangeLabel}{excludeInternal ? ' · hors équipe' : ''}
                </p>
            </div>

            {/* List */}
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : rows.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">
                        {reviewOnly ? 'Aucune contribution à revoir sur cette période. 👍' : 'Aucune contribution.'}
                    </p>
                ) : rows.map((r) => (
                    <button
                        key={r.price_id}
                        onClick={() => r.product_id && onOpenProduct(r.product_id)}
                        disabled={!r.product_id}
                        className="w-full text-left flex items-start justify-between gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors disabled:hover:bg-white"
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{r.product_name}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                <span className="tabular-nums font-semibold text-gray-700">{Number(r.price).toFixed(2)} €</span>
                                {' · '}{r.store_name}{' · '}{r.contributor_name}
                            </p>
                            {r.review_reason && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {r.review_reason.split(', ').map((reason) => (
                                        <span key={reason} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5" /> {reason}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtDate(r.created_at)}</span>
                            <div className="flex gap-1 items-center">
                                {r.contributor_is_new && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 flex items-center gap-0.5">
                                        <Sparkle className="w-2.5 h-2.5" /> nouveau
                                    </span>
                                )}
                                {r.is_test && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">TEST</span>}
                                {channelBadge(r.channel)}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Pagination */}
            {total > PAGE && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="tabular-nums">{from}–{to} sur {total}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="p-1.5 rounded-full border border-gray-200 disabled:opacity-40"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                            disabled={page >= lastPage || loading}
                            className="p-1.5 rounded-full border border-gray-200 disabled:opacity-40"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Contributor roster ------------------------------------------------------
const ContributorsView = ({ excludeInternal }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data, error: err } = await supabase.rpc('admin_contributors', {
                    p_exclude_internal: excludeInternal,
                    p_limit: 200,
                });
                if (err) throw err;
                if (!cancelled) { setRows(data || []); setError(false); }
            } catch (e) {
                console.error('admin_contributors failed (migration pending?):', e);
                if (!cancelled) { setRows([]); setError(true); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [excludeInternal]);

    if (error) return <MigrationNotice />;

    return (
        <div className="p-4 space-y-4">
            <p className="text-[10px] text-gray-400">
                {rows.length} contributeur{rows.length > 1 ? 's' : ''}{excludeInternal ? ' · hors équipe' : ''} · triés par volume
            </p>
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : rows.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">Aucun contributeur.</p>
                ) : rows.map((r) => (
                    <div key={r.contributor_id} className="flex items-start justify-between gap-3 p-4 border-b border-gray-50 last:border-0">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                                {r.contributor_name}
                                {r.is_internal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">INTERNE</span>}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                {[
                                    r.martinique_scans > 0 && `${r.martinique_scans} MQ`,
                                    r.diaspora_scans > 0 && `${r.diaspora_scans} FR`,
                                    r.reference_prices > 0 && `${r.reference_prices} réf.`,
                                    r.test_submissions > 0 && `${r.test_submissions} test`,
                                ].filter(Boolean).join(' · ') || '—'}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                depuis {fmtDate(r.first_contribution)} · dernier {fmtDate(r.last_contribution)}
                            </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-lg font-black text-gray-900 tabular-nums">{r.total_submissions}</div>
                            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">contrib.</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- M3: data-health lacunas (category coverage + actionable gaps) ------------
const GAP_KINDS = {
    store_stale: { label: 'Magasin sans prix récent', color: 'bg-orange-100 text-orange-700' },
    demanded_unpriced: { label: 'Demandé, sans prix', color: 'bg-violet-100 text-violet-700' },
    uncategorized: { label: 'Sans catégorie', color: 'bg-sky-100 text-sky-700' },
};

const HealthView = () => {
    const [cats, setCats] = useState([]);
    const [gaps, setGaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [c, g] = await Promise.all([
                    supabase.rpc('admin_category_coverage'),
                    supabase.rpc('admin_coverage_gaps', { p_limit: 80 }),
                ]);
                if (c.error) throw c.error;
                if (g.error) throw g.error;
                if (!cancelled) { setCats(c.data || []); setGaps(g.data || []); setError(false); }
            } catch (e) {
                console.error('admin_data_health drill failed (migration pending?):', e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (error) return <MigrationNotice />;
    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>;

    const grouped = gaps.reduce((acc, row) => {
        (acc[row.kind] = acc[row.kind] || []).push(row);
        return acc;
    }, {});

    return (
        <div className="p-4 space-y-6">
            {/* Category coverage */}
            <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Couverture par catégorie</h3>
                <div className="bg-white border border-gray-100 rounded-3xl p-4 space-y-3">
                    {cats.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune catégorie.</p>
                    ) : cats.map((c) => {
                        const p = c.total_products > 0 ? Number(c.pct) : null;
                        const band = p == null ? 'bg-gray-200' : p >= 75 ? 'bg-green-500' : p >= 40 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                            <div key={c.category_id || 'none'}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-xs font-bold text-gray-700">{c.icon} {c.category_name}</span>
                                    <span className="text-[11px] text-gray-500 tabular-nums">
                                        {c.priced_products}/{c.total_products}{p != null && ` · ${p}%`}
                                    </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${band}`} style={{ width: `${p ?? 0}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Actionable gaps */}
            <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lacunes prioritaires</h3>
                {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-3xl p-4">Aucune lacune détectée. 👍</p>
                ) : Object.entries(grouped).map(([kind, rows]) => (
                    <div key={kind} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${GAP_KINDS[kind]?.color || 'bg-gray-100 text-gray-600'}`}>
                                {GAP_KINDS[kind]?.label || kind}
                            </span>
                            <span className="text-[10px] text-gray-400">{rows.length}</span>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                            {rows.map((r, i) => (
                                <div key={r.ref_id + i} className="flex items-start justify-between gap-3 p-3.5 border-b border-gray-50 last:border-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                                    <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{r.sublabel}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
};

// --- M4: MTQ ↔ Hexagone gap by category -------------------------------------
const MainlandView = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data, error: err } = await supabase.rpc('admin_mainland_gap_by_category');
                if (err) throw err;
                if (!cancelled) { setRows(data || []); setError(false); }
            } catch (e) {
                console.error('admin_mainland_gap_by_category failed (migration pending?):', e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (error) return <MigrationNotice />;
    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>;

    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(Number(r.median_gap_pct) || 0)));

    return (
        <div className="p-4 space-y-4">
            <p className="text-[10px] text-gray-400">
                Écart médian MTQ vs France par catégorie · positif = plus cher en Martinique · {rows.length} catégorie{rows.length > 1 ? 's' : ''} appariée{rows.length > 1 ? 's' : ''}
            </p>
            <div className="bg-white border border-gray-100 rounded-3xl p-4 space-y-3">
                {rows.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune paire MTQ↔France appariée pour l'instant.</p>
                ) : rows.map((r) => {
                    const gap = Number(r.median_gap_pct) || 0;
                    const w = (Math.abs(gap) / maxAbs) * 50; // half-width bar around centre
                    return (
                        <div key={r.category_id || 'none'}>
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-bold text-gray-700">{r.icon || '❓'} {r.category_name || 'Sans catégorie'}</span>
                                <span className={`text-xs font-black tabular-nums ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {gap > 0 ? '+' : ''}{r.median_gap_pct}% · {r.matched_products}
                                </span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300" />
                                <div
                                    className={`absolute top-0 bottom-0 ${gap > 0 ? 'bg-red-500 left-1/2' : 'bg-green-500 right-1/2'}`}
                                    style={{ width: `${w}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TITLES = {
    submissions: 'Contributions de prix',
    review: 'Modérer les prix',
    contributors: 'Contributeurs',
    health: 'Santé des données — lacunes',
    mainland: 'Comparaison France Hexagonale',
};

const AdminDrillPanel = ({ mode, since, rangeLabel, excludeInternal, onClose, onOpenProduct }) => (
    <div className="fixed inset-0 bg-gray-50 z-[260] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        <div className="bg-white border-b border-gray-100 px-4 py-4 pt-12 flex items-center gap-3 flex-shrink-0">
            <button onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">{TITLES[mode] || 'Détail'}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
            {mode === 'health' ? (
                <HealthView />
            ) : mode === 'mainland' ? (
                <MainlandView />
            ) : mode === 'contributors' ? (
                <ContributorsView excludeInternal={excludeInternal} />
            ) : (
                <SubmissionsView
                    mode={mode}
                    since={since}
                    rangeLabel={rangeLabel}
                    excludeInternal={excludeInternal}
                    onOpenProduct={onOpenProduct}
                />
            )}
        </div>
    </div>
);

export default AdminDrillPanel;
