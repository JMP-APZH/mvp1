import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';

const PriceHistoryChart = ({ data, title = 'Évolution du prix (TTC)' }) => {
    if (!data || data.length < 2) return null;

    return (
        <div className="bg-white border border-gray-100 rounded-lg p-3 mt-4">
            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                {title}
            </p>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#94a3b8' }}
                        />
                        <YAxis
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#94a3b8' }}
                            tickFormatter={(val) => `${val}€`}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white border shadow-sm p-2 rounded-lg text-xs">
                                            <p className="font-bold text-gray-900">{payload[0].value.toFixed(2)}€</p>
                                            <p className="text-gray-500">{payload[0].payload.fullDate}</p>
                                            <p className="text-orange-600 font-medium">{payload[0].payload.store}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PriceHistoryChart;
