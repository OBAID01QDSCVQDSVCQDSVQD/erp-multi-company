'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Customer {
  _id: string;
  type: 'societe' | 'particulier';
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  dailyRate?: number;
}

interface Document {
  _id: string;
  numero: string;
  date: string;
  totalTTC: number;
  customerId: {
    _id: string;
    nom?: string;
    prenom?: string;
    raisonSociale?: string;
  };
}

export default function NewProjectPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [quotes, setQuotes] = useState<Document[]>([]);
  const [deliveries, setDeliveries] = useState<Document[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customerId: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedEndDate: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed' | 'cancelled',
    budget: '',
    currency: 'TND',
    devisIds: [] as string[],
    blIds: [] as string[],
    assignedEmployees: [] as Array<{
      employeeId: string;
      role: string;
      hourlyRate?: string;
      dailyRate?: string;
      startDate: string;
      endDate?: string;
    }>,
    notes: '',
    tags: [] as string[],
  });

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  const fetchData = async () => {
    try {
      setLoadingData(true);

      // Fetch customers
      const customersRes = await fetch('/api/customers?actif=true&limit=1000', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.items || []);
      }

      // Fetch employees
      const employeesRes = await fetch('/api/hr/employees?limit=1000', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (employeesRes.ok) {
        const employeesData = await employeesRes.json();
        setEmployees(employeesData.items || []);
      }

      // Fetch quotes (Devis)
      const quotesRes = await fetch('/api/sales/quotes?limit=1000', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (quotesRes.ok) {
        const quotesData = await quotesRes.json();
        setQuotes(quotesData.items || []);
      }

      // Fetch deliveries (BL)
      const deliveriesRes = await fetch('/api/sales/deliveries?limit=1000', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        setDeliveries(deliveriesData.items || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.customerId || !formData.startDate) {
      toast.error('Veuillez remplir les champs obligatoires (Nom, Client, Date de début)');
      return;
    }

    try {
      setLoading(true);

      if (!tenantId) {
        toast.error('Tenant ID manquant');
        return;
      }

      const payload: any = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        devisIds: formData.devisIds || [],
        blIds: formData.blIds || [],
        assignedEmployees: formData.assignedEmployees.map(emp => ({
          employeeId: emp.employeeId,
          role: emp.role,
          hourlyRate: emp.hourlyRate ? parseFloat(emp.hourlyRate) : undefined,
          dailyRate: emp.dailyRate ? parseFloat(emp.dailyRate) : undefined,
          startDate: emp.startDate,
          endDate: emp.endDate || undefined,
        })),
        tags: formData.tags.filter(tag => tag.trim() !== ''),
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Projet créé avec succès');
        router.push(`/projects/${data._id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Erreur lors de la création du projet');
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = () => {
    setFormData({
      ...formData,
      assignedEmployees: [
        ...formData.assignedEmployees,
        {
          employeeId: '',
          role: '',
          startDate: formData.startDate,
        }
      ]
    });
  };

  const removeEmployee = (index: number) => {
    setFormData({
      ...formData,
      assignedEmployees: formData.assignedEmployees.filter((_, i) => i !== index)
    });
  };

  const updateEmployee = (index: number, field: string, value: any) => {
    const updated = [...formData.assignedEmployees];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, assignedEmployees: updated });
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tag.trim()]
      });
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag)
    });
  };

  const getCustomerName = (customer: Customer) => {
    if (customer.type === 'societe') {
      return customer.raisonSociale || 'Société';
    }
    return `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'Particulier';
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/projects')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Nouveau projet</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Créez un nouveau projet et suivez son avancement</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <BriefcaseIcon className="w-5 h-5 text-gray-400" />
              Informations générales
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom du projet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="Ex: Site web entreprise XYZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="">Sélectionner un client</option>
                    {customers.map(customer => (
                      <option key={customer._id} value={customer._id}>
                        {getCustomerName(customer)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Vous pourrez lier des Devis et des Bons de livraison après la création du projet.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date de début <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date de fin prévue
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={formData.expectedEndDate}
                      onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
                      min={formData.startDate}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Statut
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="pending">En attente</option>
                    <option value="in_progress">En cours</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Budget ({formData.currency})
                  </label>
                  <div className="relative">
                    <CurrencyDollarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Devise
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="TND">TND (Dinar tunisien)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="USD">USD (Dollar américain)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="Description du projet..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Employees */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6 border dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-gray-400" />
                Équipe assignée
              </h2>
              <button
                type="button"
                onClick={addEmployee}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <UserIcon className="w-4 h-4" />
                Ajouter un employé
              </button>
            </div>

            {formData.assignedEmployees.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Aucun employé assigné. Cliquez sur "Ajouter un employé" pour commencer.
              </p>
            ) : (
              <div className="space-y-4">
                {formData.assignedEmployees.map((emp, index) => {
                  const selectedEmployee = employees.find(e => e._id === emp.employeeId);
                  return (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Employé {index + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeEmployee(index)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          Supprimer
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Employé <span className="text-red-500">*</span>
                          </label>
                          <select
                            required
                            value={emp.employeeId}
                            onChange={(e) => {
                              const selectedEmployeeId = e.target.value;
                              updateEmployee(index, 'employeeId', selectedEmployeeId);
                              const emp = employees.find(employee => employee._id === selectedEmployeeId);
                              if (emp && emp.dailyRate) {
                                updateEmployee(index, 'dailyRate', emp.dailyRate.toString());
                              }
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          >
                            <option value="">Sélectionner</option>
                            {employees.map(employee => (
                              <option key={employee._id} value={employee._id}>
                                {employee.firstName} {employee.lastName} - {employee.position}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Rôle <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={emp.role}
                            onChange={(e) => updateEmployee(index, 'role', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            placeholder="Ex: Développeur, Chef de projet..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Taux journalier ({formData.currency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={emp.dailyRate || selectedEmployee?.dailyRate || ''}
                            onChange={(e) => updateEmployee(index, 'dailyRate', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Date de début
                          </label>
                          <input
                            type="date"
                            value={emp.startDate}
                            onChange={(e) => updateEmployee(index, 'startDate', e.target.value)}
                            min={formData.startDate}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes and Tags */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6 border dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informations supplémentaires</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Notes supplémentaires sur le projet..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900 dark:hover:text-blue-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Appuyez sur Entrée pour ajouter un tag"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => router.push('/projects')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
