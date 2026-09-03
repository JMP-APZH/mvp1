import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    Users,
    Package,
    Store,
    ChevronRight,
    Activity,
    ArrowUpRight,
    ShieldCheck,
    MapPin,
    X,
    Wrench,
    ChefHat,
    MessageSquare,
    FlaskConical,
    LineChart,
    ExternalLink,
    Smartphone,
    UserX
} from 'lucide-react';

// PostHog project dashboard -- kept as an external link rather than embedded,
// since embedding would require PostHog's public share links (bypassing our
// own admin-only auth gate) or a backend proxy for a read API key (this app
// has none). See CLAUDE.md's Jul 30, 2026 PostHog entry for the reasoning.
const POSTHOG_DASHBOARD_URL = 'https://eu.posthog.com/project/232864/dashboard/862895';
import { supabase } from '../supabaseClient';
import ProductCompletion from './ProductCompletion';
import MainlandPriceAdmin from './MainlandPriceAdmin';
import RecipeAdmin from './RecipeAdmin';
import FeatureRequestAdmin from './FeatureRequestAdmin';
import TestDataAdmin from './TestDataAdmin';
import DeletionRequestsAdmin from './DeletionRequestsAdmin';
import FlagFrance from './flags/FlagFrance';

// Simple stacked-percentage breakdown card -- shared shape for the three
// device/auth-method admin stats (platform, display mode, sign-in method).
const BreakdownBar = ({ title, segments }) => {
    const total = segments.reduce((sum, s) => sum + s.count, 0);
    return (
        <div className="bg-white border border-gray-100 rounded-3xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</p>
            {total === 0 ? (
                <p className="text-sm text-gray-400">Pas encore de données</p>
            ) : (
                <div className="space-y-2">
                    <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
                        {segments.filter(s => s.count > 0).map((s, i) => (
                            <div key={i} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {segments.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                                <span className="text-gray-600">{s.label}</span>
                                <span className="font-bold text-gray-900">{s.count}</span>
                                <span className="text-gray-400">({Math.round((s.count / total) * 100)}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminDashboard = ({ onClose }) => {
    const [subTab, setSubTab] = useState('overview'); // 'overview' | 'complete' | 'mainland' | 'recipes' | 'suggestions' | 'testdata'

    // M1: founder / test / family accounts are excluded from adoption metrics by
    // default. Persisted per admin so the toggle sticks across sessions.
    const [excludeInternal, setExcludeInternal] = useState(() => {
        try { return localStorage.getItem('pm_admin_exclude_internal') !== 'false'; } catch { return true; }
    });
    // Correctly-scoped headline numbers from the admin_kpi_overview RPC
    // (analytics_admin_functions_migration.sql). null until loaded; kpiError
    // means the migration isn't applied yet -- the dashboard still renders,
    // showing "—" for the filtered figures.
    const [kpi, setKpi] = useState(null);
    const [kpiError, setKpiError] = useState(false);
    const [stats, setStats] = useState({
        catalogProducts: 0,     // count(*) products, all -- context for "produits avec prix"
        recentActivity: [],
        platformCounts: {},
        displayModeCounts: {},
        authMethodCounts: {}
    });
    const [, setLoading] = useState(true);

    const fetchAdminStats = useCallback(async () => {
        setLoading(true);
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // --- M1: correctly-scoped headline KPIs (server-side, admin-gated RPC) ---
        try {
            const { data: kpiRows, error: kErr } = await supabase.rpc('admin_kpi_overview', {
                p_since: since,
                p_exclude_internal: excludeInternal,
            });
            if (kErr) throw kErr;
            setKpi(Array.isArray(kpiRows) ? (kpiRows[0] || null) : kpiRows);
            setKpiError(false);
        } catch (err) {
            console.error('admin_kpi_overview failed (migration pending?):', err);
            setKpi(null);
            setKpiError(true);
        }

        // --- concerns M2 will rework (sessions / auth / recent activity) ---
        try {
            const { count: catalogProducts } = await supabase
                .from('products').select('*', { count: 'exact', head: true });

            const { data: sessionData } = await supabase
                .from('app_sessions').select('device_platform, display_mode');
            const platformCounts = (sessionData || []).reduce((acc, s) => {
                acc[s.device_platform] = (acc[s.device_platform] || 0) + 1; return acc;
            }, {});
            const displayModeCounts = (sessionData || []).reduce((acc, s) => {
                acc[s.display_mode] = (acc[s.display_mode] || 0) + 1; return acc;
            }, {});

            const { data: authEventData } = await supabase.from('auth_events').select('provider');
            const authMethodCounts = (authEventData || []).reduce((acc, a) => {
                acc[a.provider] = (acc[a.provider] || 0) + 1; return acc;
            }, {});

            const { data: activity } = await supabase
                .from('prices').select('stores(name)')
                .order('created_at', { ascending: false }).limit(5);

            setStats({
                catalogProducts: catalogProducts || 0,
                recentActivity: activity || [],
                platformCounts, displayModeCounts, authMethodCounts,
            });
        } catch (err) {
            console.error('Error fetching admin stats:', err);
        } finally {
            setLoading(false);
        }
    }, [excludeInternal]);

    useEffect(() => {
        fetchAdminStats();
    }, [fetchAdminStats]);

    const toggleExcludeInternal = () => {
        setExcludeInternal(prev => {
            const next = !prev;
            try { localStorage.setItem('pm_admin_exclude_internal', String(next)); } catch { /* ignore */ }
            return next;
        });
    };

    return (
        <div className="fixed inset-0 bg-white z-[250] flex flex-col overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-red-600 px-6 py-6 pt-12 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Console Admin</h2>
                            <p className="text-red-100 text-xs">Vue d'ensemble du système</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Sub-tabs -- horizontally scrollable so all 5 stay reachable on narrow
                    (mobile) viewports instead of overflowing the fixed-width header and
                    getting clipped with no way to reach the hidden ones. */}
                <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar -mx-6 px-6">
                    <button
                        onClick={() => setSubTab('overview')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'overview' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <BarChart3 className="w-3.5 h-3.5" /> Vue d'ensemble
                    </button>
                    <button
                        onClick={() => setSubTab('complete')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'complete' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <Wrench className="w-3.5 h-3.5" /> Compléter produit
                    </button>
                    <button
                        onClick={() => setSubTab('mainland')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'mainland' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <FlagFrance className="w-3.5 h-3.5" /> Prix France Hexagonale
                    </button>
                    <button
                        onClick={() => setSubTab('recipes')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'recipes' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <ChefHat className="w-3.5 h-3.5" /> Recettes
                    </button>
                    <button
                        onClick={() => setSubTab('suggestions')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'suggestions' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> Suggestions
                    </button>
                    <button
                        onClick={() => setSubTab('testdata')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'testdata' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <FlaskConical className="w-3.5 h-3.5" /> Données test
                    </button>
                    <button
                        onClick={() => setSubTab('deletions')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap ${subTab === 'deletions' ? 'bg-white text-red-600' : 'bg-white/10 text-white'
                            }`}
                    >
                        <UserX className="w-3.5 h-3.5" /> Suppressions
                    </button>
                    <button
                        onClick={() => window.open(POSTHOG_DASHBOARD_URL, '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex-shrink-0 whitespace-nowrap bg-white/10 text-white"
                    >
                        <LineChart className="w-3.5 h-3.5" /> Analytics <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                </div>
            </div>

            {subTab === 'complete' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <ProductCompletion />
                </div>
            ) : subTab === 'mainland' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <MainlandPriceAdmin />
                </div>
            ) : subTab === 'recipes' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <RecipeAdmin />
                </div>
            ) : subTab === 'suggestions' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <FeatureRequestAdmin />
                </div>
            ) : subTab === 'testdata' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <TestDataAdmin />
                </div>
            ) : subTab === 'deletions' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <DeletionRequestsAdmin />
                </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {kpiError && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 leading-relaxed">
                        Chiffres filtrés indisponibles — la migration <code className="font-mono">analytics_admin_functions_migration.sql</code> n'est pas encore appliquée.
                        Les tuiles affichent « — » en attendant. (Onglet « Données test » : {stats.catalogProducts} produits au catalogue.)
                    </div>
                )}

                {/* Scope controls */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={excludeInternal}
                            onChange={toggleExcludeInternal}
                            className="rounded border-gray-300"
                        />
                        Exclure les comptes internes (équipe / tests)
                    </label>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">7 derniers jours</span>
                </div>

                {/* Main KPIs -- correctly scoped (real user contributions only) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 mb-3">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.real_submissions : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contributions de prix</p>
                        {kpi && (kpi.test_submissions > 0 || kpi.reference_prices > 0) && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                exclus&nbsp;: {kpi.test_submissions} test · {kpi.reference_prices} réf. en ligne
                            </p>
                        )}
                        {kpi && kpi.submissions_in_window > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                                <ArrowUpRight className="w-3 h-3" /> +{kpi.submissions_in_window} cette semaine
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-purple-100 w-10 h-10 rounded-2xl flex items-center justify-center text-purple-600 mb-3">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.distinct_contributors : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contributeurs</p>
                        {excludeInternal && <p className="text-[10px] text-gray-400 mt-0.5">hors équipe</p>}
                        {kpi && kpi.contributors_in_window > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                                <ArrowUpRight className="w-3 h-3" /> +{kpi.contributors_in_window} cette semaine
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-green-100 w-10 h-10 rounded-2xl flex items-center justify-center text-green-600 mb-3">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.real_products_priced : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Produits avec prix</p>
                        {kpi && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                {stats.catalogProducts} au catalogue · {kpi.test_products} test
                            </p>
                        )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-orange-100 w-10 h-10 rounded-2xl flex items-center justify-center text-orange-600 mb-3">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.mdd_priced_products : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Produits MDD avec prix</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">marques distributeur</p>
                    </div>
                </div>

                {/* Diaspora -- scans from France (community), separate from admin reference prices */}
                <section className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <MapPin className="w-5 h-5" /> Diaspora — scans depuis la France
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-3xl font-black">{kpi ? kpi.diaspora_scan_submissions : '—'}</div>
                                <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest mt-1">Scans communauté diaspora</p>
                            </div>
                            <div>
                                <div className="text-3xl font-black">{kpi ? kpi.diaspora_contributors : '—'}</div>
                                <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest mt-1">Contributeurs diaspora</p>
                            </div>
                        </div>
                        {kpi && kpi.reference_prices > 0 && (
                            <p className="text-blue-100 text-[10px] mt-4 leading-relaxed">
                                + {kpi.reference_prices} prix de référence France saisis manuellement (hors scans) — voir l'onglet « Prix France Hexagonale ».
                            </p>
                        )}
                    </div>
                    <Activity className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                </section>

                {/* Devices & Sign-in */}
                <section>
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-red-600" /> Appareils & Connexion
                    </h3>
                    <div className="space-y-3">
                        <BreakdownBar
                            title="Plateforme (sessions)"
                            segments={[
                                { label: 'iOS', count: stats.platformCounts.ios || 0, color: 'bg-gray-900' },
                                { label: 'Android', count: stats.platformCounts.android || 0, color: 'bg-green-600' },
                                { label: 'Autre', count: stats.platformCounts.other || 0, color: 'bg-gray-300' },
                            ]}
                        />
                        <BreakdownBar
                            title="Application installée vs navigateur"
                            segments={[
                                { label: 'App installée (PWA)', count: stats.displayModeCounts.standalone || 0, color: 'bg-orange-500' },
                                { label: 'Navigateur', count: stats.displayModeCounts.browser || 0, color: 'bg-blue-400' },
                            ]}
                        />
                        <BreakdownBar
                            title="Méthode de connexion"
                            segments={[
                                { label: 'Email + mot de passe', count: stats.authMethodCounts.email || 0, color: 'bg-pink-500' },
                                { label: 'Google', count: stats.authMethodCounts.google || 0, color: 'bg-blue-500' },
                            ]}
                        />
                    </div>
                </section>

                {/* System Health */}
                <section>
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-red-600" /> Activité Récente
                    </h3>
                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                        {stats.recentActivity.map((act, i) => (
                            <div key={i} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{act.stores?.name}</p>
                                        <p className="text-[10px] text-gray-500">Nouveau scan de prix</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Tools Placeholder */}
                <section className="bg-red-50 p-6 rounded-3xl border border-red-100">
                    <h4 className="font-bold text-red-900 mb-2">Actions Rapides</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="bg-white p-3 rounded-2xl text-[11px] font-bold text-red-600 shadow-sm">Modérer Prix</button>
                        <button className="bg-white p-3 rounded-2xl text-[11px] font-bold text-red-600 shadow-sm">Exporter CSV</button>
                    </div>
                </section>
            </div>
            )}
        </div>
    );
};

export default AdminDashboard;
