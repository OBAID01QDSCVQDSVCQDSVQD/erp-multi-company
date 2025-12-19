'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserGroupIcon } from '@heroicons/react/24/outline';

interface LaborTabProps {
    projectId: string;
    tenantId: string;
    currency: string;
}

interface ProjectLaborEntry {
    employee: {
        _id: string;
        firstName: string;
        lastName: string;
        position?: string;
        department?: string;
    };
    role: string;
    salaryId?: string;
    startDate?: string;
    endDate?: string;
    dailyRate?: number;
    hourlyRate?: number;
    daysWorked: number;
    totalHours: number;
    laborCost: number;
    attendanceRecords?: number;
    advanceAmount?: number;
    advanceDays?: number;
}

interface LaborSummary {
    totalEmployees: number;
    totalDays: number;
    totalHours: number;
    totalCost: number;
    totalAdvances: number;
}

export default function LaborTab({ projectId, tenantId, currency }: LaborTabProps) {
    const [labor, setLabor] = useState<ProjectLaborEntry[]>([]);
    const [summary, setSummary] = useState<LaborSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchLabor = async () => {
            if (!tenantId || !projectId) return;
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`/api/projects/${projectId}/labor`, {
                    headers: { 'X-Tenant-Id': tenantId },
                });
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data?.error || 'Erreur lors du chargement de la main d’œuvre');
                }
                const data = await response.json();
                if (mounted) {
                    setLabor(data.labor || []);
                    setSummary(data.summary || null);
                }
            } catch (err: any) {
                if (mounted) setError(err.message || 'Erreur lors du chargement de la main d’œuvre');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchLabor();
        return () => {
            mounted = false;
        };
    }, [projectId, tenantId]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
        }).format(value || 0);

    const formatNumber = (value: number, decimals = 0) =>
        new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value || 0);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 h-24">
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    ))}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700 h-64">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    </div>
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-16 text-center text-red-500 dark:text-red-400">
                {error}
            </div>
        );
    }

    if (!labor.length) {
        return (
            <div className="text-center py-12">
                <UserGroupIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Main d'œuvre</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucun membre d’équipe n’est associé à ce projet.</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Coût total: {formatCurrency(0)}</p>
            </div>
        );
    }

    const totalDays = summary?.totalDays ?? labor.reduce((sum, l) => sum + (l.daysWorked || 0), 0);
    const totalHours = summary?.totalHours ?? labor.reduce((sum, l) => sum + (l.totalHours || 0), 0);
    const totalCost = summary?.totalCost ?? labor.reduce((sum, l) => sum + (l.laborCost || 0), 0);
    const totalAdvances = summary?.totalAdvances ?? labor.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Équipe</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{summary?.totalEmployees ?? labor.length}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Membres affectés</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Jours travaillés</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatNumber(totalDays)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Validés via présence</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Heures cumulées</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatNumber(totalHours, 1)} h</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Basées sur les pointages</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Coût total</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Avances: {formatCurrency(totalAdvances)}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Employé</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Rôle</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Jours</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Heures</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Taux jour</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Coût</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Avances</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {labor.map((item) => (
                                <tr key={item.employee?._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/hr/salaries/${item.salaryId ?? ''}`}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
                                        >
                                            {item.employee?.firstName} {item.employee?.lastName}
                                        </Link>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.employee?.position}
                                            {item.employee?.department ? ` • ${item.employee.department}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.role || '-'}</td>
                                    <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                                        {formatNumber(item.daysWorked || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                                        {formatNumber(item.totalHours || 0, 1)} h
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                        {formatCurrency(item.dailyRate || item.hourlyRate || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(item.laborCost || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                                        <div className="flex flex-col items-end">
                                            <span>{formatCurrency(item.advanceAmount || 0)}</span>
                                            {item.advanceAmount ? (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {formatNumber(item.advanceDays || 0, 1)} j
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Total</td>
                                <td></td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                                    {formatNumber(totalDays)}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                                    {formatNumber(totalHours, 1)} h
                                </td>
                                <td></td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(totalCost)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(totalAdvances)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
