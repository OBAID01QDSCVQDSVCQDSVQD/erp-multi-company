'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { toast } from 'react-hot-toast';
import {
    ArrowLeftIcon,
    PrinterIcon,
    CheckIcon,
    PencilSquareIcon
} from '@heroicons/react/24/outline';

interface CreditNote {
    _id: string;
    numero: string;
    dateDoc: string;
    supplier?: {
        raisonSociale?: string;
        nom?: string;
        prenom?: string;
    };
    lignes: any[];
    totalBaseHT: number;
    remiseGlobalePct: number;
    fodec?: {
        enabled: boolean;
        tauxPct: number;
        montant: number;
    };
    totalFodec: number;
    totalTVA: number;
    timbreFiscal: number;
    totalTTC: number;
    devise: string;
    statut: string;
}

export default function CreditNoteDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { tenantId } = useTenantId();
    const [note, setNote] = useState<CreditNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        remiseGlobalePct: 0,
        timbreFiscal: 0,
        fodecEnabled: false,
        fodecTaux: 1
    });

    useEffect(() => {
        if (tenantId && params.id) {
            fetchCreditNote();
        }
    }, [tenantId, params.id]);

    const fetchCreditNote = async () => {
        try {
            const response = await fetch(`/api/purchases/credit-notes/${params.id}`, {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setNote(data);
                setEditForm({
                    remiseGlobalePct: data.remiseGlobalePct || 0,
                    timbreFiscal: data.timbreFiscal || 0.600,
                    fodecEnabled: data.fodec?.enabled || false,
                    fodecTaux: data.fodec?.tauxPct || 1
                });
            } else {
                toast.error('Erreur lors du chargement');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!tenantId || !note) return;
        setSaving(true);
        try {
            const response = await fetch(`/api/purchases/credit-notes/${note._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId
                },
                body: JSON.stringify({
                    remiseGlobalePct: editForm.remiseGlobalePct,
                    timbreFiscal: editForm.timbreFiscal,
                    fodec: {
                        enabled: editForm.fodecEnabled,
                        tauxPct: editForm.fodecTaux
                    }
                })
            });

            if (response.ok) {
                const updated = await response.json();
                setNote(updated);
                setIsEditing(false);
                toast.success('Mise à jour réussie');
            } else {
                toast.error('Erreur lors de la mise à jour');
            }
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Erreur technique');
        } finally {
            setSaving(false);
        }
    };

    const formatPrice = (val: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(val || 0);

    if (loading) return <DashboardLayout><div className="p-8 text-center">Chargement...</div></DashboardLayout>;
    if (!note) return <DashboardLayout><div className="p-8 text-center">Document non trouvé</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                        >
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Avoir {note.numero}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(note.dateDoc).toLocaleDateString('fr-FR')} - {note.supplier?.raisonSociale || 'Fournisseur inconnu'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <PencilSquareIcon className="w-4 h-4" />
                                Modifier
                            </button>
                        )}
                        {isEditing && (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {saving ? '...' : <><CheckIcon className="w-4 h-4" /> Enregistrer</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 transition-colors">
                    {/* Lines Table */}
                    <div className="overflow-x-auto -mx-4 sm:mx-0 mb-8 px-4 sm:px-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                <tr>
                                    <th className="p-3 rounded-l-lg whitespace-nowrap">Description</th>
                                    <th className="p-3 text-right whitespace-nowrap">Qté</th>
                                    <th className="p-3 text-right whitespace-nowrap">PU HT</th>
                                    <th className="p-3 text-right whitespace-nowrap">Remise %</th>
                                    <th className="p-3 text-right rounded-r-lg whitespace-nowrap">Total HT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                                {note.lignes.map((line: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-3 min-w-[200px]">{line.designation}</td>
                                        <td className="p-3 text-right">{line.quantite}</td>
                                        <td className="p-3 text-right">{formatPrice(line.prixUnitaireHT)}</td>
                                        <td className="p-3 text-right">{line.remisePct}%</td>
                                        <td className="p-3 text-right font-medium">
                                            {formatPrice(line.quantite * line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals & Edit Form */}
                    <div className="flex flex-col sm:flex-row justify-end border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div className="w-full sm:max-w-sm space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Total HT (Brut):</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatPrice(note.totalBaseHT)}</span>
                            </div>

                            {/* Remise Globale */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400 pt-2">Remise Globale (%):</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editForm.remiseGlobalePct}
                                        onChange={e => setEditForm({ ...editForm, remiseGlobalePct: parseFloat(e.target.value) || 0 })}
                                        className="w-28 text-right p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    />
                                ) : (
                                    <span className="font-medium text-gray-900 dark:text-white">{note.remiseGlobalePct}%</span>
                                )}
                            </div>

                            {/* Fodec */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400 pt-2">FODEC (1%):</span>
                                {isEditing ? (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.fodecEnabled}
                                            onChange={e => setEditForm({ ...editForm, fodecEnabled: e.target.checked })}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400 select-none">Appliquer</span>
                                    </label>
                                ) : (
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {note.fodec?.enabled ? formatPrice(note.totalFodec) : '-'}
                                    </span>
                                )}
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Total TVA:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatPrice(note.totalTVA)}</span>
                            </div>

                            {/* Timbre */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 dark:text-gray-400 pt-2">Timbre Fiscal:</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        step="0.100"
                                        value={editForm.timbreFiscal}
                                        onChange={e => setEditForm({ ...editForm, timbreFiscal: parseFloat(e.target.value) || 0 })}
                                        className="w-28 text-right p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    />
                                ) : (
                                    <span className="font-medium text-gray-900 dark:text-white">{formatPrice(note.timbreFiscal)}</span>
                                )}
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2 flex justify-between items-center">
                                <span className="text-base font-bold text-gray-900 dark:text-white">Net à Payer (TTC):</span>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatPrice(note.totalTTC)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
