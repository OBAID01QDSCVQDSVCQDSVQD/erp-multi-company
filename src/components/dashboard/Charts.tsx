'use client';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    Cell,
} from 'recharts';
import { motion } from 'framer-motion';

interface RevenueChartProps {
    data: {
        name: string;
        revenus: number;
        depenses: number;
    }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96"
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Évolution Financière</h3>
                    <p className="text-sm text-gray-500">Revenus vs Dépenses (6 derniers mois)</p>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#9CA3AF' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#9CA3AF' }}
                        tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="3 3" />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            borderRadius: '12px',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '12px'
                        }}
                        formatter={(value: number) => new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(value)}
                        labelStyle={{ color: '#6B7280', fontSize: '12px', marginBottom: '8px' }}
                    />
                    <Legend
                        align="right"
                        verticalAlign="top"
                        iconType="circle"
                        wrapperStyle={{ paddingBottom: '20px', fontSize: '13px' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenus"
                        name="Revenus"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                    />
                    <Area
                        type="monotone"
                        dataKey="depenses"
                        name="Dépenses"
                        stroke="#EF4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExpense)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
}

interface TopProductsProps {
    data: {
        name: string;
        value: number;
    }[];
}

export function TopProductsChart({ data }: TopProductsProps) {
    const formatYAxis = (value: string) => {
        if (value.length > 20) return `${value.substring(0, 18)}...`;
        return value;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col"
        >
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Top 5 Produits</h3>
                <p className="text-sm text-gray-500">Par Chiffre d'affaires (Ce mois)</p>
            </div>

            <div className="flex-1 min-h-0 w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid horizontal={true} vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 12, fill: '#4B5563', fontWeight: 500 }}
                                interval={0}
                                tickFormatter={formatYAxis}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#F9FAFB' }}
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '1px solid #E5E7EB',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    padding: '12px'
                                }}
                                formatter={(value: number) => [new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(value), 'CA']}
                                labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '4px' }}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`rgba(79, 70, 229, ${1 - index * 0.12})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <p className="font-medium text-gray-500">Aucune vente ce mois-ci</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
