'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  IdentificationIcon,
  PencilIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobile?: string;
  dateOfBirth?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  cin?: string;
  socialSecurityNumber?: string;
  employeeNumber?: string;
  position: string;
  department: string;
  manager?: string;
  hireDate: string;
  contractType: 'cdi' | 'cdd' | 'stage' | 'freelance';
  status: 'active' | 'inactive' | 'on_leave';
  baseSalary?: number;
  dailyRate?: number;
  currency: string;
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
  bankAccount: {
    bankName?: string;
    accountNumber?: string;
    rib?: string;
    iban?: string;
  };
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
  skills?: string[];
  languages?: string[];
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchEmployee();
    }
  }, [tenantId, params.id]);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/employees/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement de l\'employé');
        router.push('/hr/employees');
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Erreur lors du chargement de l\'employé');
      router.push('/hr/employees');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (amount: number, currency: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getContractTypeLabel = (type: string) => {
    const labels = {
      cdi: 'CDI (Contrat à durée indéterminée)',
      cdd: 'CDD (Contrat à durée déterminée)',
      stage: 'Stage',
      freelance: 'Freelance',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      bank_transfer: 'Virement bancaire',
      check: 'Chèque',
      cash: 'Espèces',
    };
    return labels[method as keyof typeof labels] || method;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      on_leave: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      active: 'Actif',
      inactive: 'Inactif',
      on_leave: 'En congé',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.inactive}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/hr/employees')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{employee.position} • {employee.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(employee.status)}
            <button
              onClick={() => router.push(`/hr/employees/${params.id}/edit`)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PencilIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                Informations personnelles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Prénom</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{employee.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Nom</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{employee.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <EnvelopeIcon className="w-4 h-4" />
                    Email
                  </p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{employee.email}</p>
                </div>
                {employee.phone && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <PhoneIcon className="w-4 h-4" />
                      Téléphone
                    </p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.phone}</p>
                  </div>
                )}
                {employee.mobile && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Mobile</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.mobile}</p>
                  </div>
                )}
                {employee.dateOfBirth && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date de naissance</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{formatDate(employee.dateOfBirth)}</p>
                  </div>
                )}
                {employee.cin && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <IdentificationIcon className="w-4 h-4" />
                      CIN
                    </p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.cin}</p>
                  </div>
                )}
                {employee.socialSecurityNumber && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Numéro de sécurité sociale</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.socialSecurityNumber}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            {employee.address && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-gray-400" />
                  Adresse
                </h2>
                <div className="space-y-2">
                  <p className="text-base text-gray-900 dark:text-white">{employee.address.line1}</p>
                  {employee.address.line2 && (
                    <p className="text-base text-gray-900 dark:text-white">{employee.address.line2}</p>
                  )}
                  <p className="text-base text-gray-900 dark:text-white">
                    {employee.address.city}
                    {employee.address.postalCode && `, ${employee.address.postalCode}`}
                  </p>
                  <p className="text-base text-gray-900 dark:text-white">{employee.address.country}</p>
                </div>
              </div>
            )}

            {/* Professional Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BriefcaseIcon className="w-5 h-5 text-gray-400" />
                Informations professionnelles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {employee.employeeNumber && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Numéro d'employé</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.employeeNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Poste</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{employee.position}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Département</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{employee.department}</p>
                </div>
                {employee.manager && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manager</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.manager}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    Date d'embauche
                  </p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{formatDate(employee.hireDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Type de contrat</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">{getContractTypeLabel(employee.contractType)}</p>
                </div>
              </div>
            </div>

            {/* Salary Information */}
            {(employee.baseSalary || employee.dailyRate) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
                  Informations salariales
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {employee.baseSalary && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Salaire de base</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        {formatPrice(employee.baseSalary, employee.currency)}
                      </p>
                    </div>
                  )}
                  {employee.dailyRate && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Taux journalier</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        {formatPrice(employee.dailyRate, employee.currency)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Devise</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{employee.currency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Mode de paiement</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {getPaymentMethodLabel(employee.paymentMethod)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Account */}
            {employee.bankAccount && (employee.bankAccount.bankName || employee.bankAccount.accountNumber) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compte bancaire</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {employee.bankAccount.bankName && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Banque</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.bankAccount.bankName}</p>
                    </div>
                  )}
                  {employee.bankAccount.accountNumber && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Numéro de compte</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.bankAccount.accountNumber}</p>
                    </div>
                  )}
                  {employee.bankAccount.rib && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">RIB</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.bankAccount.rib}</p>
                    </div>
                  )}
                  {employee.bankAccount.iban && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">IBAN</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.bankAccount.iban}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            {employee.emergencyContact && (employee.emergencyContact.name || employee.emergencyContact.phone) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact d'urgence</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {employee.emergencyContact.name && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nom</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.emergencyContact.name}</p>
                    </div>
                  )}
                  {employee.emergencyContact.relationship && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Relation</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.emergencyContact.relationship}</p>
                    </div>
                  )}
                  {employee.emergencyContact.phone && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Téléphone</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.emergencyContact.phone}</p>
                    </div>
                  )}
                  {employee.emergencyContact.email && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white">{employee.emergencyContact.email}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skills and Languages */}
            {(employee.skills && employee.skills.length > 0) || (employee.languages && employee.languages.length > 0) ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compétences et langues</h2>
                <div className="space-y-4">
                  {employee.skills && employee.skills.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Compétences</p>
                      <div className="flex flex-wrap gap-2">
                        {employee.skills.map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {employee.languages && employee.languages.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Langues</p>
                      <div className="flex flex-wrap gap-2">
                        {employee.languages.map((lang, index) => (
                          <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Notes */}
            {employee.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{employee.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statut</h3>
              <div className="space-y-3">
                <div>
                  {getStatusBadge(employee.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Type de contrat</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {getContractTypeLabel(employee.contractType)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date d'embauche</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {formatDate(employee.hireDate)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions rapides</h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/hr/employees/${params.id}/edit`)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PencilIcon className="w-5 h-5" />
                  Modifier l'employé
                </button>
                <button
                  onClick={() => router.push(`/hr/attendance?employeeId=${params.id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ClockIcon className="w-5 h-5" />
                  Voir la présence
                </button>
                <button
                  onClick={() => router.push(`/hr/salaries?employeeId=${params.id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Voir les salaires
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

