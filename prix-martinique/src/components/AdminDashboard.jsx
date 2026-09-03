import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    Users,
    Package,
    Store,
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
    UserX,
    Download,
    ChevronRight,
    ShieldAlert,
    HeartPulse,
    Target
} from 'lucide-react';

// --- M2a: date-range control ------------------------------------------------
const RANGES = [
    { key: '7', label: '7 j', days: 7 },
    { key: '30', label: '30 j', days: 30 },
    { key: '90', label: '90 j', days: 90 },
    { key: 'all', label: 'Tout', days: null },
];
const DAY_MS = 86400000;

// Relative "il y a ..." label, French, coarse (matches MyScansModal's style).
const relativeDate = (iso) => {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / DAY_MS);
    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 30) return `Il y a ${days} j`;
    if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
    return `Il y a ${Math.floor(days / 365)} an${days >= 730 ? 's' : ''}`;
};

// Date bounds for a range key. Module-level + recomputed per call so a moving
// `Date.now()` never churns fetchAdminStats' identity (which would loop the effect).
const boundsFor = (rk) => {
    const r = RANGES.find(x => x.key === rk) || RANGES[1];
    const sinceIso = r.days ? new Date(Date.now() - r.days * DAY_MS).toISOString() : null;
    const trendSinceIso = sinceIso || new Date(Date.now() - 400 * DAY_MS).toISOString();
    return { sinceIso, trendSinceIso, trendSinceMs: new Date(trendSinceIso).getTime() };
};

// Turn admin_price_timeseries rows into a gap-filled daily array of one field.
const fillDailySeries = (rows, sinceMs, field) => {
    const byDay = new Map();
    (rows || []).forEach((r) => {
        const k = new Date(r.bucket).setHours(0, 0, 0, 0);
        byDay.set(k, Number(r[field]) || 0);
    });
    const out = [];
    const start = new Date(sinceMs); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(0, 0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        out.push(byDay.get(t) || 0);
    }
    return out;
};

// Tiny dependency-free trend line. `data` = array of numbers.
const Sparkline = ({ data, stroke = '#2563eb', height = 26 }) => {
    if (!data || data.length < 2) return <div style={{ height }} className="mt-2" />;
    const w = 100;
    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);
    const pts = data
        .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 3) - 1.5).toFixed(1)}`)
        .join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full mt-2" style={{ height }} aria-hidden="true">
            <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
};

// M3: labelled coverage meter. `pct` 0-100 (or null). Bar colour by health band.
const Meter = ({ label, pct, detail }) => {
    const p = pct == null ? null : Math.max(0, Math.min(100, Number(pct)));
    const band = p == null ? 'bg-gray-300'
        : p >= 75 ? 'bg-green-500'
        : p >= 40 ? 'bg-amber-500'
        : 'bg-red-500';
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-gray-600">{label}</span>
                <span className="text-xs font-black text-gray-900 tabular-nums">{p == null ? '—' : `${p}%`}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${band}`} style={{ width: `${p ?? 0}%` }} />
            </div>
            {detail && <p className="text-[10px] text-gray-400 mt-1">{detail}</p>}
        </div>
    );
};

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
import AdminDrillPanel from './AdminDrillPanel';
import ProductDetailModal from './ProductDetailModal';
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
    // M2a: date range driving the windowed KPIs + the trend + the CSV export.
    const [rangeKey, setRangeKey] = useState(() => {
        try { return localStorage.getItem('pm_admin_range') || '30'; } catch { return '30'; }
    });
    const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];

    // Correctly-scoped headline numbers from the admin_kpi_overview RPC
    // (analytics_admin_functions_migration.sql). null until loaded; kpiError
    // means the migration isn't applied yet -- the dashboard still renders,
    // showing "—" for the filtered figures.
    const [kpi, setKpi] = useState(null);
    const [kpiError, setKpiError] = useState(false);
    const [trend, setTrend] = useState({ submissions: [], contributors: [] });
    const [recent, setRecent] = useState([]);   // rich rows from admin_submissions_detail
    const [exportState, setExportState] = useState(''); // '' | 'working' | 'error'
    // M3: "Santé des données" snapshot from admin_data_health. null until loaded.
    const [health, setHealth] = useState(null);
    // M4: MTQ↔Hexagone match coverage from admin_mainland_match_coverage.
    const [mainland, setMainland] = useState(null);
    // M5: "Valeur livrée" mission snapshot from admin_value_delivered.
    const [value, setValue] = useState(null);
    // M2b: drill-down overlay ('submissions' | 'review' | 'contributors' | 'health' | 'mainland')
    // + the product card opened from a drill row.
    const [drill, setDrill] = useState(null);
    const [drillProductId, setDrillProductId] = useState(null);
    const [stats, setStats] = useState({
        catalogProducts: 0,     // count(*) products, all -- context for "produits avec prix"
        platformCounts: {},
        displayModeCounts: {},
        authMethodCounts: {}
    });
    const [, setLoading] = useState(true);

    const fetchAdminStats = useCallback(async () => {
        setLoading(true);
        const { sinceIso, trendSinceIso, trendSinceMs } = boundsFor(rangeKey);

        // --- M1: correctly-scoped headline KPIs ---
        try {
            const { data: kpiRows, error: kErr } = await supabase.rpc('admin_kpi_overview', {
                p_since: sinceIso,
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

        // --- M2a: submission trend for the sparklines ---
        try {
            const { data: tsRows, error: tErr } = await supabase.rpc('admin_price_timeseries', {
                p_bucket: 'day',
                p_since: trendSinceIso,
                p_exclude_internal: excludeInternal,
            });
            if (tErr) throw tErr;
            setTrend({
                submissions: fillDailySeries(tsRows, trendSinceMs, 'submissions'),
                contributors: fillDailySeries(tsRows, trendSinceMs, 'contributors'),
            });
        } catch {
            setTrend({ submissions: [], contributors: [] });
        }

        // --- M2a: rich "Activité Récente" ---
        try {
            const { data: recentRows, error: rErr } = await supabase.rpc('admin_submissions_detail', {
                p_since: null,
                p_exclude_internal: excludeInternal,
                p_limit: 8,
            });
            if (rErr) throw rErr;
            setRecent(recentRows || []);
        } catch {
            setRecent([]);
        }

        // --- M3: data-health snapshot ---
        try {
            const { data: hRows, error: hErr } = await supabase.rpc('admin_data_health');
            if (hErr) throw hErr;
            setHealth(Array.isArray(hRows) ? (hRows[0] || null) : hRows);
        } catch (err) {
            console.error('admin_data_health failed (migration pending?):', err);
            setHealth(null);
        }

        // --- M4: MTQ↔Hexagone match coverage ---
        try {
            const { data: mRows, error: mErr } = await supabase.rpc('admin_mainland_match_coverage');
            if (mErr) throw mErr;
            setMainland(Array.isArray(mRows) ? (mRows[0] || null) : mRows);
        } catch (err) {
            console.error('admin_mainland_match_coverage failed (migration pending?):', err);
            setMainland(null);
        }

        // --- M5: "Valeur livrée" mission snapshot ---
        try {
            const { data: vRows, error: vErr } = await supabase.rpc('admin_value_delivered', { p_since: sinceIso });
            if (vErr) throw vErr;
            setValue(Array.isArray(vRows) ? (vRows[0] || null) : vRows);
        } catch (err) {
            console.error('admin_value_delivered failed (migration pending?):', err);
            setValue(null);
        }

        // --- sessions / auth (M2b will add a time dimension here) ---
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

            setStats({
                catalogProducts: catalogProducts || 0,
                platformCounts, displayModeCounts, authMethodCounts,
            });
        } catch (err) {
            console.error('Error fetching admin stats:', err);
        } finally {
            setLoading(false);
        }
    }, [excludeInternal, rangeKey]);

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

    const pickRange = (key) => {
        setRangeKey(key);
        try { localStorage.setItem('pm_admin_range', key); } catch { /* ignore */ }
    };

    // Client-side CSV of the currently-scoped submissions (range + internal toggle).
    const exportCsv = async () => {
        setExportState('working');
        try {
            const { data, error } = await supabase.rpc('admin_submissions_detail', {
                p_since: boundsFor(rangeKey).sinceIso,
                p_exclude_internal: excludeInternal,
                p_limit: null,
            });
            if (error) throw error;
            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const header = ['date', 'produit', 'prix_eur', 'magasin', 'contributeur', 'canal', 'test'];
            const lines = [header.join(',')].concat(
                (data || []).map(r => [
                    new Date(r.created_at).toISOString(),
                    r.product_name, r.price, r.store_name, r.contributor_name, r.channel,
                    r.is_test ? 'oui' : 'non',
                ].map(esc).join(','))
            );
            const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `prix-martinique-contributions-${range.key}-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setExportState('');
        } catch (err) {
            console.error('CSV export failed:', err);
            setExportState('error');
        }
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

                {/* Scope controls -- date range + internal-account toggle */}
                <div className="space-y-3">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
                        {RANGES.map(r => (
                            <button
                                key={r.key}
                                onClick={() => pickRange(r.key)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${rangeKey === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={excludeInternal}
                            onChange={toggleExcludeInternal}
                            className="rounded border-gray-300"
                        />
                        Exclure les comptes internes (équipe / tests)
                    </label>
                </div>

                {/* Main KPIs -- correctly scoped (real user contributions only) */}
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setDrill('submissions')} className="text-left bg-gray-50 p-4 rounded-3xl border border-gray-100 hover:border-blue-300 transition-colors">
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
                        {kpi && range.days && kpi.submissions_in_window > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                                <ArrowUpRight className="w-3 h-3" /> +{kpi.submissions_in_window} · {range.label}
                            </div>
                        )}
                        <Sparkline data={trend.submissions} stroke="#2563eb" />
                    </button>
                    <button onClick={() => setDrill('contributors')} className="text-left bg-gray-50 p-4 rounded-3xl border border-gray-100 hover:border-purple-300 transition-colors">
                        <div className="bg-purple-100 w-10 h-10 rounded-2xl flex items-center justify-center text-purple-600 mb-3">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.distinct_contributors : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contributeurs</p>
                        {excludeInternal && <p className="text-[10px] text-gray-400 mt-0.5">hors équipe</p>}
                        {kpi && range.days && kpi.contributors_in_window > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                                <ArrowUpRight className="w-3 h-3" /> +{kpi.contributors_in_window} · {range.label}
                            </div>
                        )}
                        <Sparkline data={trend.contributors} stroke="#9333ea" />
                    </button>
                    <button onClick={() => setSubTab('complete')} className="text-left bg-gray-50 p-4 rounded-3xl border border-gray-100 hover:border-green-300 transition-colors">
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
                    </button>
                    <button onClick={() => setSubTab('complete')} className="text-left bg-gray-50 p-4 rounded-3xl border border-gray-100 hover:border-orange-300 transition-colors">
                        <div className="bg-orange-100 w-10 h-10 rounded-2xl flex items-center justify-center text-orange-600 mb-3">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{kpi ? kpi.mdd_priced_products : '—'}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Produits MDD avec prix</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">marques distributeur</p>
                    </button>
                </div>

                {/* M5: Valeur livrée -- the mission headline (vie chère gap + savings) */}
                {value && value.matched_products > 0 && (
                    <section className="bg-gradient-to-br from-red-600 to-rose-700 rounded-3xl p-6 text-white shadow-lg">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5" /> Valeur livrée
                        </h3>
                        <div className="flex items-end gap-3">
                            <span className="text-4xl font-black tabular-nums">
                                {Number(value.weighted_gap_pct) > 0 ? '+' : ''}{value.weighted_gap_pct}%
                            </span>
                            <span className="text-rose-100 text-xs leading-tight pb-1">
                                panier plus cher en Martinique<br />
                                <span className="text-rose-200">médiane {value.median_gap_pct}% · {value.matched_products} produits appariés</span>
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
                            <div>
                                <div className="text-lg font-black tabular-nums">{value.mtq_dearer}</div>
                                <p className="text-rose-200 text-[10px] uppercase font-bold tracking-wider">Plus chers ici</p>
                            </div>
                            <div>
                                <div className="text-lg font-black tabular-nums">{value.mtq_cheaper}</div>
                                <p className="text-rose-200 text-[10px] uppercase font-bold tracking-wider">Moins chers ici</p>
                            </div>
                            <div>
                                <div className="text-lg font-black tabular-nums">{value.bqp_matched_products}</div>
                                <p className="text-rose-200 text-[10px] uppercase font-bold tracking-wider">Dont BQP {value.bqp_median_gap_pct != null ? `· ${value.bqp_median_gap_pct}%` : ''}</p>
                            </div>
                        </div>
                        {Number(value.community_savings_eur) > 0 && (
                            <p className="text-rose-100 text-[11px] mt-4">
                                Économies estimées de la communauté sur la période&nbsp;:
                                <span className="font-black text-white"> {Number(value.community_savings_eur).toFixed(0)} €</span>
                                {' '}({value.savings_contributions} contributions sous la moyenne)
                            </p>
                        )}
                    </section>
                )}

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

                {/* M4: Comparaison France Hexagonale -- the flagship vie-chère gap */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <FlagFrance className="w-5 h-5" /> Comparaison France Hexagonale
                        </h3>
                        <button
                            onClick={() => setDrill('mainland')}
                            className="text-[11px] font-bold text-red-600 flex items-center gap-1 hover:underline"
                        >
                            Détail par catégorie <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {!mainland ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 leading-relaxed">
                            Indisponible — la migration <code className="font-mono">mainland_match_pipeline_migration.sql</code> n'est pas encore appliquée.
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 space-y-4">
                            <Meter
                                label="Produits MTQ avec un prix France"
                                pct={mainland.match_rate_pct}
                                detail={`${mainland.mtq_with_france_price}/${mainland.mtq_priced_products} produits appariés`}
                            />
                            {mainland.median_gap_pct != null && (
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-black tabular-nums ${Number(mainland.median_gap_pct) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Number(mainland.median_gap_pct) > 0 ? '+' : ''}{mainland.median_gap_pct}%
                                    </span>
                                    <span className="text-[11px] text-gray-500 leading-tight">
                                        écart médian MTQ vs France<br />
                                        <span className="text-gray-400">{mainland.products_mtq_dearer} plus chers · {mainland.products_mtq_cheaper} moins chers en MTQ</span>
                                    </span>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3 pt-1">
                                <div>
                                    <div className="text-lg font-black text-gray-900 tabular-nums">{mainland.cov_diaspora_scan}</div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Scans diaspora</p>
                                </div>
                                <div>
                                    <div className="text-lg font-black text-gray-900 tabular-nums">{mainland.cov_online_capture}</div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Captures en ligne</p>
                                </div>
                                <div>
                                    <div className="text-lg font-black text-gray-900 tabular-nums">{mainland.cov_chain_app_screenshot}</div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Screenshots appli</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 pt-1 border-t border-gray-50">
                                <span><span className="font-bold text-gray-900">{mainland.france_without_mtq}</span> produits ont un prix France sans prix MTQ</span>
                                {mainland.unverified_france_entries > 0 && (
                                    <span><span className="font-bold text-amber-600">{mainland.unverified_france_entries}</span> entrées France à vérifier (M4b)</span>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* M3: Santé des données -- is the catalogue becoming *useful*? */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <HeartPulse className="w-5 h-5 text-red-600" /> Santé des données
                        </h3>
                        <button
                            onClick={() => setDrill('health')}
                            className="text-[11px] font-bold text-red-600 flex items-center gap-1 hover:underline"
                        >
                            Voir les lacunes <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {!health ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 leading-relaxed">
                            Indisponible — la migration <code className="font-mono">analytics_data_health_migration.sql</code> n'est pas encore appliquée.
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-3xl p-5 space-y-4">
                            <Meter
                                label="Prix récents (< 30 j)"
                                pct={health.pct_fresh}
                                detail={`${health.fresh_priced_products}/${health.real_priced_products} produits avec prix · âge médian ${health.median_latest_price_age_days ?? '—'} j`}
                            />
                            <Meter
                                label="Catégorisation"
                                pct={health.pct_categorized}
                                detail={`${health.categorized_products}/${health.catalog_products} produits · ${health.categories_with_products}/${health.total_categories} catégories utilisées`}
                            />
                            <Meter
                                label="Photo jointe à la contribution"
                                pct={health.pct_photo}
                                detail={`${health.real_price_rows_with_photo}/${health.real_price_rows} contributions de prix`}
                            />
                            <Meter
                                label="Code-barres renseigné"
                                pct={health.pct_barcode}
                                detail={`${health.products_with_barcode}/${health.catalog_products} produits`}
                            />
                            <div className="grid grid-cols-3 gap-3 pt-1">
                                <div>
                                    <div className="text-lg font-black text-gray-900 tabular-nums">{health.stores_priced_30d}<span className="text-gray-300">/{health.stores_total}</span></div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Magasins actifs 30 j</p>
                                </div>
                                <div>
                                    <div className="text-lg font-black text-gray-900 tabular-nums">{health.bqp_categories_covered}<span className="text-gray-300">/{health.bqp_categories_total}</span></div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Postes BQP couverts</p>
                                </div>
                                <div>
                                    <div className={`text-lg font-black tabular-nums ${health.open_barcode_flags > 0 ? 'text-red-600' : 'text-gray-900'}`}>{health.open_barcode_flags}</div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Signalements ouverts</p>
                                </div>
                            </div>
                        </div>
                    )}
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

                {/* Activité Récente -- last 8 real contributions, all-time */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-red-600" /> Activité Récente
                        </h3>
                        <button
                            onClick={() => setDrill('submissions')}
                            className="text-[11px] font-bold text-red-600 flex items-center gap-1 hover:underline"
                        >
                            Voir tout <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                        {recent.length === 0 ? (
                            <p className="p-4 text-sm text-gray-400">Aucune contribution récente.</p>
                        ) : recent.map((r, i) => (
                            <button
                                key={i}
                                onClick={() => r.product_id && setDrillProductId(r.product_id)}
                                disabled={!r.product_id}
                                className="w-full text-left flex items-start justify-between gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors disabled:hover:bg-white"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{r.product_name}</p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        <span className="tabular-nums font-semibold text-gray-700">{Number(r.price).toFixed(2)} €</span>
                                        {' · '}{r.store_name}{' · '}{r.contributor_name}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{relativeDate(r.created_at)}</span>
                                    <div className="flex gap-1">
                                        {r.is_test && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">TEST</span>}
                                        {r.channel === 'diaspora_scan' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FR</span>}
                                        {r.channel === 'admin_reference' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">RÉF</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Actions Rapides */}
                <section className="bg-red-50 p-6 rounded-3xl border border-red-100">
                    <h4 className="font-bold text-red-900 mb-2">Actions Rapides</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setDrill('review')}
                            className="bg-white p-3 rounded-2xl text-[11px] font-bold text-red-600 shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" /> Modérer Prix
                        </button>
                        <button
                            onClick={exportCsv}
                            disabled={exportState === 'working'}
                            className="bg-white p-3 rounded-2xl text-[11px] font-bold text-red-600 shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {exportState === 'working' ? 'Export…' : 'Exporter CSV'}
                        </button>
                    </div>
                    {exportState === 'error' && (
                        <p className="text-[11px] text-red-700 mt-2">
                            Échec de l'export — la migration <code className="font-mono">analytics_admin_export_migration.sql</code> est-elle appliquée&nbsp;?
                        </p>
                    )}
                    <p className="text-[10px] text-red-400 mt-2">
                        CSV = contributions de la période ({range.label}{excludeInternal ? ', hors équipe' : ''}).
                    </p>
                </section>
            </div>
            )}

            {/* M2b: drill-down overlay + product card opened from a drill row */}
            {drill && (
                <AdminDrillPanel
                    mode={drill}
                    since={boundsFor(rangeKey).sinceIso}
                    rangeLabel={range.label}
                    excludeInternal={excludeInternal}
                    onClose={() => setDrill(null)}
                    onOpenProduct={setDrillProductId}
                />
            )}
            {drillProductId && (
                <ProductDetailModal
                    productId={drillProductId}
                    onClose={() => setDrillProductId(null)}
                    onRequireAuth={() => {}}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
