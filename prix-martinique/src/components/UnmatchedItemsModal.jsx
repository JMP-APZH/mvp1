import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const UnmatchedItemsModal = ({ items, storeName, totalAmount, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-[2rem] rounded-t-[2rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" /> Articles non comparés
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Ces articles sont dans votre panier chez {storeName}, mais n'ont pas encore de prix France Hexagonale connu.
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {items.map(item => (
                        <div key={item.productId} className="flex items-center justify-between bg-gray-50 rounded-2xl p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.quantity} × {item.price.toFixed(2)}€</p>
                            </div>
                            <span className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">{item.lineTotal.toFixed(2)}€</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 px-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total non comparé</span>
                        <span className="text-sm font-black text-gray-900">{totalAmount.toFixed(2)}€</span>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex-shrink-0">
                    <p className="text-xs text-gray-400 text-center">
                        Un prix France Hexagonale peut être ajouté depuis la Console Admin pour compléter la comparaison.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UnmatchedItemsModal;
