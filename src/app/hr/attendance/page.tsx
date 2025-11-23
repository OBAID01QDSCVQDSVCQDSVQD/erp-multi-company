'use client';

import { useState, useEffect, useMemo } from 'react';
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
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  employeeNumber?: string;
}

export default function AttendancePage() {
  const { tenantId } = useTenantId();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
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
        console.log('=== Employees Data ===');
        console.log('Total employees:', data.items?.length || 0);
        console.log('Employees:', data.items);
        if (data.items && data.items.length > 0) {
          console.log('First employee:', data.items[0]);
          console.log('First employee position:', data.items[0].position);
          console.log('First employee employeeNumber:', data.items[0].employeeNumber);
          console.log('First employee department:', data.items[0].department);
        }
        setEmployees(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
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
        console.log('=== Attendance Data ===');
        console.log('Selected date:', selectedDate);
        console.log('Total records:', data.items?.length || 0);
        
        // Process and normalize employeeId for easier matching
        const processedItems = (data.items || []).map((item: any, index: number) => {
          let normalizedEmployeeId: string | null = null;
          
          console.log(`Processing attendance item ${index + 1}:`, {
            _id: item._id,
            employeeId: item.employeeId,
            employeeIdType: typeof item.employeeId,
            employeeIdIsObject: typeof item.employeeId === 'object' && item.employeeId !== null,
            employeeId_id: item.employeeId?._id
          });
          
          if (item.employeeId) {
            if (typeof item.employeeId === 'object' && item.employeeId !== null) {
              // Handle populated employee object
              if (item.employeeId._id) {
                normalizedEmployeeId = item.employeeId._id.toString();
                console.log(`  -> Using employeeId._id: ${normalizedEmployeeId}`);
              } else if (item.employeeId.toString) {
                normalizedEmployeeId = item.employeeId.toString();
                console.log(`  -> Using employeeId.toString(): ${normalizedEmployeeId}`);
              } else {
                normalizedEmployeeId = String(item.employeeId);
                console.log(`  -> Using String(employeeId): ${normalizedEmployeeId}`);
              }
            } else {
              normalizedEmployeeId = String(item.employeeId);
              console.log(`  -> Using String(employeeId) [not object]: ${normalizedEmployeeId}`);
            }
          } else {
            console.log(`  -> No employeeId found!`);
          }
          
          return {
            ...item,
            _normalizedEmployeeId: normalizedEmployeeId // Add normalized ID for easier matching
          };
        });
        
        console.log('=== Processed Attendance Records ===');
        processedItems.forEach((item: any, index: number) => {
          console.log(`Processed Item ${index + 1}:`, {
            _id: item._id,
            employeeId: item.employeeId,
            _normalizedEmployeeId: item._normalizedEmployeeId,
            date: item.date,
            checkIn: item.checkIn,
            checkOut: item.checkOut
          });
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
    console.log('=== Opening Edit Modal ===');
    console.log('Record ID:', record._id);
    console.log('Record employeeId:', record.employeeId);
    console.log('Record date:', record.date);
    console.log('Record checkIn:', record.checkIn);
    console.log('Record checkOut:', record.checkOut);
    
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
    
    console.log('Form data set:', {
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
        console.log('CheckIn - Local:', editForm.checkIn, 'UTC:', localDate.toISOString());
      }

      if (editForm.checkOut) {
        // datetime-local gives us local time, convert to UTC
        const localDate = new Date(editForm.checkOut);
        updateData.checkOut = localDate.toISOString();
        console.log('CheckOut - Local:', editForm.checkOut, 'UTC:', localDate.toISOString());
      }

      if (editForm.date) {
        // Send date as YYYY-MM-DD format to avoid timezone issues
        updateData.date = editForm.date;
        console.log('Date:', editForm.date);
      }

      console.log('=== Submitting Edit ===');
      console.log('Record ID:', editingRecord._id);
      console.log('Record employeeId:', editingRecord.employeeId);
      console.log('Update data:', updateData);

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
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Présent</span>;
      }
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">En cours</span>;
    }
    if (record.status === 'late') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">En retard</span>;
    }
    if (record.status === 'on_leave') {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">En congé</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Absent</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Présence / Pointage</h1>
            <p className="mt-1 text-sm text-gray-600">Suivez et gérez la présence de vos employés</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'daily' ? 'monthly' : 'daily')}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
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
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              {viewMode === 'daily' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                />
              ) : (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
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
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total employés</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Présents</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">{stats.present}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absents</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taux de présence</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">{stats.rate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou poste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun employé trouvé</h3>
              <p className="text-gray-600">Aucun employé ne correspond aux critères de recherche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Département</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Entrée</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Sortie</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Heures</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => {
                    // Find matching attendance record
                    // Use normalized employeeId if available, otherwise compute it
                    const employeeIdStr = String(employee._id);
                    const record = attendance.find(a => {
                      // First try to use pre-normalized ID
                      if ((a as any)._normalizedEmployeeId) {
                        const matches = (a as any)._normalizedEmployeeId === employeeIdStr;
                        if (matches) {
                          console.log(`Match found for employee ${employee.firstName} ${employee.lastName}:`, {
                            employeeId: employeeIdStr,
                            normalizedId: (a as any)._normalizedEmployeeId,
                            recordId: a._id
                          });
                        }
                        return matches;
                      }
                      
                      // Fallback to computing it
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
                      
                      const matches = attendanceEmployeeId === employeeIdStr;
                      if (matches) {
                        console.log(`Match found (fallback) for employee ${employee.firstName} ${employee.lastName}:`, {
                          employeeId: employeeIdStr,
                          attendanceEmployeeId: attendanceEmployeeId,
                          recordId: a._id
                        });
                      }
                      return matches;
                    });
                    
                    const hasCheckedIn = record?.checkIn;
                    const hasCheckedOut = record?.checkOut;
                    
                    if (!record && attendance.length > 0) {
                      // Debug: show why no match was found
                      const firstRecord = attendance[0];
                      let firstRecordEmployeeId: string | null = null;
                      
                      if (firstRecord.employeeId) {
                        const empId = firstRecord.employeeId;
                        if (typeof empId === 'object' && empId !== null) {
                          const empObj = empId as { _id?: any; toString?: () => string };
                          firstRecordEmployeeId = empObj._id?.toString() || 
                                                  (typeof empObj.toString === 'function' ? empObj.toString() : null) || 
                                                  null;
                        } else {
                          firstRecordEmployeeId = String(empId);
                        }
                      }
                      
                      console.log('=== No Record Found for Employee ===');
                      console.log('Employee ID:', employee._id);
                      console.log('Employee Name:', `${employee.firstName} ${employee.lastName}`);
                      console.log('First record employeeId (raw):', firstRecord.employeeId);
                      console.log('First record employeeId (parsed):', firstRecordEmployeeId);
                      console.log('Match:', firstRecordEmployeeId === employee._id.toString());
                    }
                    
                    return (
                      <tr key={employee._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-sm">
                                {employee.firstName[0]}{employee.lastName[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {(() => {
                                  // Check if position is a valid text (not just numbers)
                                  const isPositionValid = employee.position && 
                                    !/^\d+$/.test(employee.position.trim()) &&
                                    employee.position.trim().length > 0;
                                  
                                  if (isPositionValid) {
                                    return employee.position;
                                  } else {
                                    // If position is invalid or just numbers, show employeeNumber or fallback
                                    return employee.employeeNumber || 'N/A';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{employee.department}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(record?.checkIn)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(record?.checkOut)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {calculateHours(record?.checkIn, record?.checkOut)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {record ? getStatusBadge(record) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Non pointé</span>
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
                                <span className="text-sm text-gray-500 font-medium">✓ Complet</span>
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
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Modifier le pointage</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRecord(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure d'entrée
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure de sortie
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingRecord(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
