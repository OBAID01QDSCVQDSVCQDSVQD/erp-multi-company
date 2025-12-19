'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  UserIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface AttendanceRecord {
  _id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'on_leave';
  totalHours?: number;
  notes?: string;
  projectId?: {
    _id: string;
    name: string;
    projectNumber?: string;
  } | string;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  employeeNumber?: string;
}

interface Project {
  _id: string;
  name: string;
  projectNumber?: string;
  status?: string;
}

interface ProjectSelectorProps {
  currentProjectId?: string;
  projects: Project[];
  disabled?: boolean;
  onChange: (projectId: string) => void;
}

export default function AttendancePage() {
  const { tenantId } = useTenantId();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    checkIn: '',
    checkOut: '',
    date: ''
  });

  useEffect(() => {
    if (tenantId) {
      fetchEmployees();
      if (viewMode === 'daily') {
        fetchAttendance();
      }
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      fetchProjects();
    }
  }, [tenantId, selectedDate, viewMode]);

  // Refresh attendance when selectedDate changes
  useEffect(() => {
    if (tenantId && viewMode === 'daily') {
      fetchAttendance();
    }
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/hr/employees?status=active', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?limit=500', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.items || data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/attendance?date=${selectedDate}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (response.ok) {
        const data = await response.json();

        // Process and normalize employeeId for easier matching
        const processedItems = (data.items || []).map((item: any, index: number) => {
          let normalizedEmployeeId: string | null = null;

          if (item.employeeId) {
            if (typeof item.employeeId === 'object' && item.employeeId !== null) {
              // Handle populated employee object
              if (item.employeeId._id) {
                normalizedEmployeeId = item.employeeId._id.toString();
              } else if (item.employeeId.toString) {
                normalizedEmployeeId = item.employeeId.toString();
              } else {
                normalizedEmployeeId = String(item.employeeId);
              }
            } else {
              normalizedEmployeeId = String(item.employeeId);
            }
          }

          return {
            ...item,
            _normalizedEmployeeId: normalizedEmployeeId // Add normalized ID for easier matching
          };
        });

        setAttendance(processedItems);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement des données');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = async (recordId: string, projectId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/attendance/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({ projectId: projectId || null })
      });

      if (response.ok) {
        const updatedRecord = await response.json();
        toast.success('Projet associé au pointage');
        setAttendance(prev =>
          prev.map(record => (record._id === recordId ? { ...record, projectId: updatedRecord.projectId } : record))
        );
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'association du projet');
      }
    } catch (error) {
      console.error('Error updating project on attendance:', error);
      toast.error('Erreur lors de l\'association du projet');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (employeeId: string) => {
    try {
      setLoading(true);

      // Use selectedDate if available, otherwise use today
      const targetDate = selectedDate || new Date().toISOString().split('T')[0];

      const response = await fetch('/api/hr/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({
          employeeId,
          date: targetDate, // Send the selected date
          checkIn: new Date().toISOString()
        })
      });

      if (response.ok) {
        toast.success('Pointage d\'entrée enregistré');
        fetchAttendance();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du pointage');
      }
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Erreur lors du pointage');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (employeeId: string, recordId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/attendance/${recordId}/check-out`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({
          checkOut: new Date().toISOString()
        })
      });

      if (response.ok) {
        toast.success('Pointage de sortie enregistré');
        fetchAttendance();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du pointage');
      }
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Erreur lors du pointage');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (record: AttendanceRecord) => {
    setEditingRecord(record);

    // Convert dates to local time for datetime-local input
    const recordDate = record.date ? new Date(record.date) : new Date(selectedDate);

    // Format date as YYYY-MM-DD (local date, not UTC)
    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Format datetime-local as YYYY-MM-DDTHH:mm (local time, not UTC)
    const formatDateTimeLocal = (dateString: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEditForm({
      date: formatDateLocal(recordDate),
      checkIn: record.checkIn ? formatDateTimeLocal(record.checkIn) : '',
      checkOut: record.checkOut ? formatDateTimeLocal(record.checkOut) : ''
    });

    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !tenantId) return;

    try {
      setLoading(true);
      const updateData: any = {};

      // Convert local datetime to UTC for storage
      if (editForm.checkIn) {
        // datetime-local gives us local time, convert to UTC
        const localDate = new Date(editForm.checkIn);
        updateData.checkIn = localDate.toISOString();
      }

      if (editForm.checkOut) {
        // datetime-local gives us local time, convert to UTC
        const localDate = new Date(editForm.checkOut);
        updateData.checkOut = localDate.toISOString();
      }

      if (editForm.date) {
        // Send date as YYYY-MM-DD format to avoid timezone issues
        updateData.date = editForm.date;
      }

      const response = await fetch(`/api/hr/attendance/${editingRecord._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success('Pointage modifié avec succès');
        setShowEditModal(false);
        setEditingRecord(null);

        // If date was changed, update selectedDate to show the updated record
        if (editForm.date && editForm.date !== selectedDate) {
          setSelectedDate(editForm.date);
        } else {
          // Otherwise, just refresh the attendance data
          fetchAttendance();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la modification');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEmployees = employees.length;
    const presentCount = attendance.filter(a => a.status === 'present' || a.checkIn).length;
    const absentCount = totalEmployees - presentCount;
    const attendanceRate = totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0;
    const lateCount = attendance.filter(a => a.status === 'late').length;

    return {
      total: totalEmployees,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      rate: attendanceRate
    };
  }, [attendance, employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch =
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;

      return matchesSearch && matchesDepartment;
    });
  }, [employees, searchQuery, filterDepartment]);

  // Get departments list
  const departments = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.department))).filter(Boolean);
  }, [employees]);

  // Format time
  const formatTime = (timeString?: string) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate hours worked
  const calculateHours = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return '-';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diff.toFixed(2) + 'h';
  };

  // Get status badge
  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.status === 'present' || record.checkIn) {
      if (record.checkOut) {
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Présent</span>;
      }
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">En cours</span>;
    }
    if (record.status === 'late') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">En retard</span>;
    }
    if (record.status === 'on_leave') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">En congé</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Absent</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Présence / Pointage</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Suivez et gérez la présence de vos employés</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'daily' ? 'monthly' : 'daily')}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-200 transition-colors text-sm sm:text-base"
            >
              {viewMode === 'daily' ? 'Vue mensuelle' : 'Vue quotidienne'}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base">
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
          </div>
        </div>

        {/* View Mode Toggle and Date Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              {viewMode === 'daily' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              ) : (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{new Date(selectedDate).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total employés</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Présents</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats.present}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Absents</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{stats.absent}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Taux de présence</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.rate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <ClockIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou poste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="all">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 p-4 items-center border-b dark:border-gray-700 last:border-0">
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun employé trouvé</h3>
              <p className="text-gray-600 dark:text-gray-400">Aucun employé ne correspond aux critères de recherche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Département</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Entrée</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Sortie</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Heures</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Projet</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredEmployees.map((employee) => {
                    const employeeIdStr = String(employee._id);
                    const record = attendance.find(a => {
                      if ((a as any)._normalizedEmployeeId) {
                        return (a as any)._normalizedEmployeeId === employeeIdStr;
                      }

                      if (!a.employeeId) return false;
                      let attendanceEmployeeId: string;
                      const empId = a.employeeId;
                      if (typeof empId === 'object' && empId !== null) {
                        const empObj = empId as { _id?: any; toString?: () => string };
                        if (empObj._id) {
                          attendanceEmployeeId = empObj._id.toString();
                        } else if (typeof empObj.toString === 'function') {
                          attendanceEmployeeId = empObj.toString();
                        } else {
                          attendanceEmployeeId = String(empObj);
                        }
                      } else {
                        attendanceEmployeeId = String(empId);
                      }
                      return attendanceEmployeeId === employeeIdStr;
                    });

                    const hasCheckedIn = record?.checkIn;
                    const hasCheckedOut = record?.checkOut;

                    return (
                      <tr key={employee._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                                {employee.firstName[0]}{employee.lastName[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {(() => {
                                  const isPositionValid = employee.position &&
                                    !/^\d+$/.test(employee.position.trim()) &&
                                    employee.position.trim().length > 0;

                                  if (isPositionValid) {
                                    return employee.position;
                                  } else {
                                    return employee.employeeNumber || 'N/A';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{employee.department}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatTime(record?.checkIn)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatTime(record?.checkOut)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {calculateHours(record?.checkIn, record?.checkOut)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {record ? getStatusBadge(record) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Non pointé</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {record ? (
                            projects.length > 0 ? (
                              <ProjectSelector
                                currentProjectId={
                                  typeof record.projectId === 'string'
                                    ? record.projectId
                                    : record.projectId?._id
                                }
                                projects={projects}
                                disabled={loading}
                                onChange={(projectId) => handleProjectChange(record._id, projectId)}
                              />
                            ) : record.projectId ? (
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {typeof record.projectId === 'object'
                                  ? record.projectId?.name || 'Projet lié'
                                  : 'Projet lié'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!hasCheckedIn ? (
                              <button
                                onClick={() => handleCheckIn(employee._id)}
                                disabled={loading}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Entrée
                              </button>
                            ) : !hasCheckedOut ? (
                              <>
                                <button
                                  onClick={() => handleCheckOut(employee._id, record._id)}
                                  disabled={loading}
                                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Sortie
                                </button>
                                <button
                                  onClick={() => handleEditClick(record)}
                                  disabled={loading}
                                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Modifier manuellement"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">✓ Complet</span>
                                <button
                                  onClick={() => handleEditClick(record)}
                                  disabled={loading}
                                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Modifier manuellement"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && editingRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border dark:border-gray-700">
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Modifier le pointage</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRecord(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Heure d'entrée
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Heure de sortie
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingRecord(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProjectSelector({ currentProjectId, projects, disabled, onChange }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedProject = projects.find((project) => project._id === currentProjectId);
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    const query = searchTerm.toLowerCase();
    return projects.filter((project) => {
      const name = project.name?.toLowerCase() || '';
      const number = (project.projectNumber || '').toLowerCase();
      return name.includes(query) || number.includes(query);
    });
  }, [projects, searchTerm]);

  const handleSelect = (value: string) => {
    onChange(value);
    setSearchTerm('');
    setIsOpen(false);
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const map: Record<string, { label: string; classes: string }> = {
      pending: { label: 'En attente', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
      in_progress: { label: 'En cours', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      completed: { label: 'Terminé', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      cancelled: { label: 'Annulé', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    };
    const data = map[status] || { label: status, classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${data.classes}`}>
        {data.label}
      </span>
    );
  };

  const renderList = ({ floating = false, className = '' }: { floating?: boolean; className?: string } = {}) => (
    <div className={`flex flex-col ${floating ? 'relative pt-16' : ''} ${className}`}>
      <div
        className={`space-y-3 ${floating ? 'absolute -top-14 left-0 right-0 px-3 z-10' : 'p-3 border-b border-gray-100 dark:border-gray-700'
          }`}
      >
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            placeholder="Rechercher par nom ou numéro..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto text-xs text-gray-600 dark:text-gray-400">
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => {
                setSearchTerm(letter);
              }}
              className={`px-2 py-1 rounded-md border transition-colors ${searchTerm === letter
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-64 overflow-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => handleSelect('')}
          className={`w-full flex flex-col items-start gap-1 px-4 py-3 text-sm border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!currentProjectId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
            }`}
        >
          Aucun projet
          <span className="text-xs text-gray-500 dark:text-gray-400">Ne pas associer ce pointage</span>
        </button>
        {filteredProjects.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">Aucun projet trouvé</div>
        ) : (
          filteredProjects.map((project) => (
            <button
              key={project._id}
              type="button"
              onClick={() => handleSelect(project._id)}
              className={`w-full text-left px-4 py-3 border-b dark:border-gray-700 flex flex-col gap-1 transition-colors ${currentProjectId === project._id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{project.name}</div>
                {renderStatusBadge(project.status)}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {project.projectNumber && <span>#{project.projectNumber}</span>}
                {project.status && (
                  <span className="hidden sm:inline capitalize text-gray-400">{project.status}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="relative inline-block w-full sm:w-auto" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            if (!disabled && projects.length > 0) {
              setIsOpen((prev) => !prev);
            }
          }}
          className={`w-full sm:w-56 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between transition-colors ${disabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-700'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
        >
          <span className="truncate">
            {selectedProject ? selectedProject.name : projects.length ? 'Associer à un projet' : 'Aucun projet'}
          </span>
          <svg
            className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!isMobile && isOpen && projects.length > 0 && (
          <div className="absolute z-30 mt-6 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {renderList({ floating: true })}
          </div>
        )}
      </div>

      {isMobile && isOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-40 flex items-end sm:hidden">
          <div className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sélectionner un projet</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            {renderList()}
          </div>
        </div>
      )}
    </>
  );
}
