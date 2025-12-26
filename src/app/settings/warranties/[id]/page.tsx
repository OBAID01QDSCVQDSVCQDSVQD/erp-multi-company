'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon, PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface WarrantyField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string;
    order: number;
}

interface WarrantyTemplate {
    _id?: string;
    name: string;
    isActive: boolean;
    content: string;
    exclusiveAdvantages?: string;
    fields: WarrantyField[];
}

export default function WarrantyTemplateEditor({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { data: session } = useSession();
    const isNew = params.id === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    const [template, setTemplate] = useState<WarrantyTemplate>({
        name: '',
        isActive: true,
        content: '',
        exclusiveAdvantages: '',
        fields: []
    });

    useEffect(() => {
        if (!isNew && session) {
            fetchTemplate();
        }
    }, [params.id, session]);

    const fetchTemplate = async () => {
        try {
            const res = await fetch(`/api/settings/warranty-templates/${params.id}`, {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplate(data);
            } else {
                toast.error('Modèle introuvable');
                router.push('/settings/warranties');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    };

    const addField = () => {
        const newField: WarrantyField = {
            id: `field_${Date.now()}`,
            label: '',
            type: 'text',
            required: false,
            placeholder: '',
            order: template.fields.length
        };
        setTemplate({ ...template, fields: [...template.fields, newField] });
    };

    const removeField = (index: number) => {
        const newFields = template.fields.filter((_, i) => i !== index);
        setTemplate({ ...template, fields: newFields });
    };

    const updateField = (index: number, key: keyof WarrantyField, value: any) => {
        const newFields = [...template.fields];
        newFields[index] = { ...newFields[index], [key]: value };
        setTemplate({ ...template, fields: newFields });
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === template.fields.length - 1) return;

        const newFields = [...template.fields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
        setTemplate({ ...template, fields: newFields });
    };

    const saveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const url = isNew
                ? '/api/settings/warranty-templates'
                : `/api/settings/warranty-templates/${params.id}`;

            const method = isNew ? 'POST' : 'PUT';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                },
                body: JSON.stringify(template),
            });

            if (res.ok) {
                toast.success('Modèle enregistré');
                router.push('/settings/warranties');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Erreur lors de l\'enregistrement');
            }
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Erreur serveur');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Chargement...</div>;

    return (
        <DashboardLayout>
            <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-gray-400 hover:text-gray-500"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {isNew ? 'Nouveau Modèle de Garantie' : 'Modifier le Modèle'}
                        </h1>
                    </div>
                </div>

                <form onSubmit={saveTemplate} className="space-y-8">
                    {/* General Info */}
                    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 space-y-6">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Informations Générales</h2>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du modèle</label>
                                <input
                                    type="text"
                                    required
                                    value={template.name}
                                    onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border-0 py-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:focus:ring-blue-500 transition-all duration-200"
                                    placeholder="Garantie Standard 1 An"
                                />
                            </div>

                            <div className="flex items-center pt-8">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={template.isActive}
                                        onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Modèle Actif</span>
                                </label>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Avantage exclusif
                                </label>
                                <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
                                    <ReactQuill
                                        theme="snow"
                                        value={template.exclusiveAdvantages || ''}
                                        onChange={(exclusiveAdvantages) => setTemplate({ ...template, exclusiveAdvantages })}
                                        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                                        [&_.ql-toolbar]:border-b-gray-200 dark:[&_.ql-toolbar]:border-b-gray-700 
                                        [&_.ql-container]:border-none 
                                        [&_.ql-editor]:min-h-[150px] [&_.ql-editor]:text-base
                                        dark:[&_.ql-stroke]:stroke-gray-300 
                                        dark:[&_.ql-fill]:fill-gray-300 
                                        dark:[&_.ql-picker]:text-gray-300
                                        dark:[&_.ql-picker-options]:bg-gray-800
                                        dark:[&_.ql-editor.ql-blank::before]:text-gray-500"
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                [{ 'header': [1, 2, 3, false] }],
                                                [{ 'color': [] }, { 'background': [] }],
                                                ['clean']
                                            ],
                                        }}
                                        placeholder="Ex: Main d'œuvre gratuite, Pièces d'origine..."
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Conditions / Texte de Garantie
                                </label>
                                <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200">
                                    <ReactQuill
                                        theme="snow"
                                        value={template.content}
                                        onChange={(content) => setTemplate({ ...template, content })}
                                        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                                        [&_.ql-toolbar]:border-b-gray-200 dark:[&_.ql-toolbar]:border-b-gray-700 
                                        [&_.ql-container]:border-none 
                                        [&_.ql-editor]:min-h-[150px] [&_.ql-editor]:text-base
                                        dark:[&_.ql-stroke]:stroke-gray-300 
                                        dark:[&_.ql-fill]:fill-gray-300 
                                        dark:[&_.ql-picker]:text-gray-300
                                        dark:[&_.ql-picker-options]:bg-gray-800
                                        dark:[&_.ql-editor.ql-blank::before]:text-gray-500"
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                [{ 'header': [1, 2, 3, false] }],
                                                [{ 'color': [] }, { 'background': [] }],
                                                ['clean']
                                            ],
                                        }}
                                        placeholder="Les présentes conditions de garantie couvrent..."
                                    />
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ce texte apparaîtra sur le certificat PDF.</p>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Fields Builder */}
                    <div className="bg-white dark:bg-gray-800 shadow-lg sm:rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Champs Dynamiques</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Définissez les champs spécifiques à remplir lors de la création d'une garantie.</p>
                            </div>

                        </div>

                        <div className="space-y-4">
                            {template.fields.length === 0 && (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                                    <PlusIcon className="mx-auto h-12 w-12 text-gray-400" />
                                    <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucun champ dynamique</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Commencez par ajouter un champ à votre modèle.</p>
                                </div>
                            )}

                            {template.fields.map((field, index) => (
                                <div key={index} className="group relative flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all duration-200">
                                    <div className="flex flex-col gap-1 pt-2">
                                        <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                                            <ArrowUpIcon className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => moveField(index, 'down')} disabled={index === template.fields.length - 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                                            <ArrowDownIcon className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-4">
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nom du champ</label>
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
                                                    updateField(index, 'label', capitalized);
                                                }}
                                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:focus:ring-blue-500"
                                                placeholder="Nouveau champ"
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type de donnée</label>
                                            <select
                                                value={field.type}
                                                onChange={(e) => updateField(index, 'type', e.target.value)}
                                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:focus:ring-blue-500"
                                            >
                                                <option value="text">Texte Court</option>
                                                <option value="textarea">Texte Long</option>
                                                <option value="date">Date</option>
                                                <option value="boolean">Oui/Non</option>
                                                <option value="number">Nombre</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Placeholder (Optionnel)</label>
                                            <input
                                                type="text"
                                                value={field.placeholder || ''}
                                                onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:focus:ring-blue-500"
                                                placeholder="Saisir ici..."
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex items-center pt-6 justify-center sm:justify-start">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required}
                                                    onChange={(e) => updateField(index, 'required', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">Requis</span>
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removeField(index)}
                                        className="pt-2 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Supprimer ce champ"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addField}
                            className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all duration-200 group"
                        >
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-900/30 dark:group-hover:text-blue-400 transition-colors">
                                <PlusIcon className="h-5 w-5" />
                            </div>
                            <span className="font-medium">Ajouter un nouveau champ</span>
                        </button>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                        >
                            {saving ? 'Enregistrement...' : 'Enregistrer le Modèle'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
