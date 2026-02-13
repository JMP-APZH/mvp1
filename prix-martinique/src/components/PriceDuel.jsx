import React from 'react';
import { TrendingUp, MapPin, ShieldCheck, Info } from 'lucide-react';

const PriceDuel = ({ localPrice, mainlandPrice, productName, mainlandOrigin = "France Continentale", localStore = "Martinique" }) => {
    const priceDiff = localPrice - mainlandPrice;
    const percentage = mainlandPrice > 0 ? ((priceDiff / mainlandPrice) * 100).toFixed(0) : 0;

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-4 animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-500 p-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <h3 className="font-bold text-sm uppercase tracking-wider">Le Duel des Prix ⚔️</h3>
                </div>
                <div className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">
                    LIVE DIASPORA
                </div>
            </div>

            <div className="p-4">
                <p className="text-center text-gray-500 text-xs mb-4 font-medium">{productName}</p>

                <div className="flex items-center justify-between relative px-4">
                    {/* Comparison Line */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100 border-dashed border-t border-gray-300" />

                    {/* Local Price */}
                    <div className="relative z-10 flex flex-col items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm w-[100px]">
                        <span className="text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {localStore}
                        </span>
                        <span className="text-2xl font-black text-red-600">{localPrice.toFixed(2)}€</span>
                    </div>

                    {/* VS Badge */}
                    <div className="relative z-20 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 border-white shadow-md">
                        VS
                    </div>

                    {/* Mainland Price */}
                    <div className="relative z-10 flex flex-col items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm w-[100px]">
                        <span className="text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> {mainlandOrigin}
                        </span>
                        <span className="text-2xl font-black text-blue-600">{mainlandPrice.toFixed(2)}€</span>
                    </div>
                </div>

                {/* Verdict */}
                <div className="mt-6 bg-red-50 rounded-xl p-3 border border-red-100">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-900">Surcoût local :</span>
                        <span className="text-lg font-black text-red-700">+{percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-red-200 rounded-full mt-2 overflow-hidden">
                        <div
                            className="h-full bg-red-600 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-red-600 mt-2 italic flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Ce produit coûte {priceDiff.toFixed(2)}€ de plus qu'en France Hexagonale.
                    </p>
                </div>

                {/* Strategic Privacy Note */}
                <p className="text-[9px] text-gray-400 mt-4 text-center">
                    * Données collectées par la diaspora. La ville précise est masquée pour protéger nos contributeurs.
                </p>
            </div>
        </div>
    );
};

export default PriceDuel;
