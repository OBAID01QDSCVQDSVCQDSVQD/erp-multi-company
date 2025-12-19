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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
                        tick={{ fontSize: 9, fill: 'var(--chart-text)' }}
                        dy={5}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: 'var(--chart-text)' }}
                        tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" opacity={0.5} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--chart-tooltip-bg)',
                            borderRadius: '8px',
                            border: '1px solid var(--chart-tooltip-border)',
                            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                            padding: '8px',
                            fontSize: '10px',
                            color: 'var(--chart-tooltip-text)'
                        }}
                        formatter={(value: number) => new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(value)}
                        labelStyle={{ color: 'var(--chart-text)', fontSize: '10px', marginBottom: '4px' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenus"
                        name="Rev"
                        stroke="#4F46E5"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                    />
                    <Area
                        type="monotone"
                        dataKey="depenses"
                        name="Dép"
                        stroke="#EF4444"
                        strokeWidth={1.5}
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
        if (value.length > 15) return `${value.substring(0, 13)}...`;
        return value;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full h-full"
        >
            {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data} margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barCategoryGap="20%">
                        <CartesianGrid horizontal={true} vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" opacity={0.5} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={90}
                            tick={{ fontSize: 9, fill: 'var(--chart-text)', fontWeight: 500 }}
                            interval={0}
                            tickFormatter={formatYAxis}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--chart-grid)', opacity: 0.1 }}
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid var(--chart-tooltip-border)',
                                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                                padding: '8px',
                                fontSize: '10px',
                                backgroundColor: 'var(--chart-tooltip-bg)',
                                color: 'var(--chart-tooltip-text)'
                            }}
                            formatter={(value: number) => [new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(value), 'CA']}
                            labelStyle={{ color: 'var(--chart-tooltip-text)', fontWeight: 600, marginBottom: '2px', fontSize: '10px' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`rgba(79, 70, 229, ${1 - index * 0.12})`} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <p className="font-medium text-[10px] text-gray-500 dark:text-gray-400">Aucune vente</p>
                </div>
            )}
        </motion.div>
    );
}
