import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    Users,
    Package,
    Store,
    ChevronRight,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    MapPin,
    X
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const AdminDashboard = ({ onClose }) => {
    const [stats, setStats] = useState({
        totalScans: 0,
        uniqueUsers: 0,
        uniqueProducts: 0,
        diasporaScans: 0,
        mddProducts: 0,
        topStores: [],
        diasporaRegions: [],
        recentActivity: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminStats();
    }, []);

    const fetchAdminStats = async () => {
        setLoading(true);
        try {
            // 1. Total Scans
            const { count: totalScans } = await supabase
                .from('prices')
                .select('*', { count: 'exact', head: true });

            // 2. Unique Users (from prices)
            const { data: userData } = await supabase
                .from('prices')
                .select('user_id');
            const uniqueUsers = new Set(userData?.map(u => u.user_id)).size;

            // 3. Unique Products
            const { count: uniqueProducts } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true });

            // 4. Diaspora Scans
            const { count: diasporaScans } = await supabase
                .from('prices')
                .select('*', { count: 'exact', head: true })
                .eq('origin_region_code', 'Hexagone');

            // 5. MDD Products
            const { count: mddProducts } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('is_mdd', true);

            // 6. Diaspora Regions (summary of where scans come from)
            const { data: regionData } = await supabase
                .from('prices')
                .select('origin_region_code')
                .not('origin_region_code', 'is', null);

            const regionCounts = (regionData || []).reduce((acc, curr) => {
                if (curr.origin_region_code) {
                    acc[curr.origin_region_code] = (acc[curr.origin_region_code] || 0) + 1;
                }
                return acc;
            }, {});

            // 7. Activity by store
            const { data: activity } = await supabase
                .from('prices')
                .select('stores(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            setStats({
                totalScans: totalScans || 0,
                uniqueUsers: uniqueUsers || 0,
                uniqueProducts: uniqueProducts || 0,
                diasporaScans: diasporaScans || 0,
                mddProducts: mddProducts || 0,
                topStores: [],
                diasporaRegions: Object.entries(regionCounts).map(([code, count]) => ({ code, count })),
                recentActivity: activity || []
            });
        } catch (err) {
            console.error('Error fetching admin stats:', err);
        } finally {
            setLoading(false);
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
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Main KPIs */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 mb-3">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{stats.totalScans}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Scans</p>
                        <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                            <ArrowUpRight className="w-3 h-3" /> +12%
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-purple-100 w-10 h-10 rounded-2xl flex items-center justify-center text-purple-600 mb-3">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{stats.uniqueUsers}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Utilisateurs Actifs</p>
                        <div className="mt-2 flex items-center gap-1 text-green-600 text-[10px] font-bold">
                            <ArrowUpRight className="w-3 h-3" /> +5%
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-green-100 w-10 h-10 rounded-2xl flex items-center justify-center text-green-600 mb-3">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{stats.uniqueProducts}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Produits Uniques</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <div className="bg-orange-100 w-10 h-10 rounded-2xl flex items-center justify-center text-orange-600 mb-3">
                            <Store className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-black text-gray-900">{stats.mddProducts}</div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Produits MDD</p>
                    </div>
                </div>

                {/* Diaspora Watch */}
                <section className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold flex items-center gap-2">
                                <MapPin className="w-5 h-5" /> Diaspora Watch
                            </h3>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Live Tracking</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-3xl font-black">{stats.diasporaScans}</div>
                                <p className="text-blue-100 text-[10px] uppercase font-bold tracking-widest mt-1">Total Scans Diaspora</p>
                            </div>
                            <div className="space-y-2">
                                {stats.diasporaRegions.slice(0, 3).map((reg, i) => (
                                    <div key={i} className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold opacity-80">{reg.code === 'Hexagone' ? 'France Hex.' : reg.code}</span>
                                        <span className="bg-white/20 px-2 rounded-full font-black">{reg.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Decorative Map Pattern could go here */}
                    <Activity className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
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
        </div>
    );
};

export default AdminDashboard;
