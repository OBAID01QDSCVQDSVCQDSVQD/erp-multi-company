'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    UsersIcon,
    BuildingOfficeIcon,
    CreditCardIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for the chart
const data = [
    { name: 'Jan', revenue: 4000, companies: 24 },
    { name: 'Fév', revenue: 3000, companies: 28 },
    { name: 'Mar', revenue: 2000, companies: 35 },
    { name: 'Avr', revenue: 2780, companies: 42 },
    { name: 'Mai', revenue: 1890, companies: 48 },
    { name: 'Juin', revenue: 2390, companies: 55 },
    { name: 'Juil', revenue: 3490, companies: 62 },
];

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === 'loading') return null;

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Welcome Section */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 shadow-lg text-white">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Tableau de bord Administrateur</h1>
                        <p className="text-slate-300">Bienvenue, {session?.user?.name}. Voici un aperçu de la performance de la plateforme.</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-3">
                        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-semibold border border-white/10">
                            v1.0.0
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Revenu Total"
                        value="124,500 TND"
                        trend="+12.5%"
                        trendUp={true}
                        icon={CurrencyDollarIcon}
                        color="bg-emerald-500"
                    />
                    <StatCard
                        title="Entreprises Actives"
                        value="42"
                        trend="+4"
                        trendUp={true}
                        icon={BuildingOfficeIcon}
                        color="bg-blue-500"
                    />
                    <StatCard
                        title="Utilisateurs"
                        value="156"
                        trend="+12"
                        trendUp={true}
                        icon={UsersIcon}
                        color="bg-indigo-500"
                    />
                    <StatCard
                        title="Abonnements Premium"
                        value="18"
                        trend="-2"
                        trendUp={false}
                        icon={CreditCardIcon}
                        color="bg-purple-500"
                    />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Revenus & Croissance</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-6">Dernières Inscriptions</h3>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                            C{i}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Company {i}</p>
                                            <p className="text-xs text-gray-500">Starter Plan</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-400">2h ago</span>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-6 py-2 text-sm text-center text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Voir tout
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ title, value, trend, trendUp, icon: Icon, color }: any) {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                    <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
                </div>
            </div>
            <div className="mt-4 flex items-center">
                {trendUp ? (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500 mr-1" />
                ) : (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trend}
                </span>
                <span className="text-sm text-gray-400 ml-2">vs mois dernier</span>
            </div>
        </div>
    );
}
