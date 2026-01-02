import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface QuickSupplierCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (supplier: any) => void;
    initialName?: string;
    tenantId: string;
}

export default function QuickSupplierCreateModal({
    isOpen,
    onClose,
    onSuccess,
    initialName,
    tenantId
}: QuickSupplierCreateModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        raisonSociale: initialName || '',
        matriculeFiscale: '',
        telephone: '',
        email: '',
        type: 'societe' // Default
    });

    useEffect(() => {
        if (isOpen) {
            setForm(prev => ({ ...prev, raisonSociale: initialName || '' }));
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.raisonSociale) return;

        setLoading(true);
        try {
            const payload = {
                raisonSociale: form.raisonSociale,
                nom: form.raisonSociale, // For simplicity/search
                matriculeFiscale: form.matriculeFiscale,
                telephone: form.telephone,
                email: form.email,
                type: form.type,
                actif: true
            };

            const res = await fetch('/api/suppliers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newSupplier = await res.json();
                onSuccess(newSupplier);
                onClose();
            } else {
                const txt = await res.text();
                alert('Erreur: ' + txt);
            }
        } catch (err) {
            console.error(err);
            alert('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau Fournisseur</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="typeSupplier"
                                    value="societe"
                                    checked={form.type === 'societe'}
                                    onChange={() => setForm({ ...form, type: 'societe' })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-300">Société</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="typeSupplier"
                                    value="particulier"
                                    checked={form.type === 'particulier'}
                                    onChange={() => setForm({ ...form, type: 'particulier' })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-300">Particulier</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raison Sociale / Nom *</label>
                        <input
                            required
                            value={form.raisonSociale}
                            onChange={e => setForm({ ...form, raisonSociale: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Ex: Société Transport"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matricule Fiscale</label>
                        <input
                            value={form.matriculeFiscale}
                            onChange={e => setForm({ ...form, matriculeFiscale: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Ex: 1234567/A/M/000"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone</label>
                            <input
                                type="tel"
                                value={form.telephone}
                                onChange={e => setForm({ ...form, telephone: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Création...
                                </span>
                            ) : 'Créer & Sélectionner'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
