'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
    CalendarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    PlusIcon,
    ClockIcon,
    MapPinIcon,
    UserIcon,
    WrenchScrewdriverIcon,
    ClipboardDocumentCheckIcon,
    UserGroupIcon,
    FunnelIcon,
    PhotoIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
    PhoneIcon
} from '@heroicons/react/24/outline';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    parseISO,
    startOfWeek,
    endOfWeek,
    addDays,
    startOfToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('@/components/common/LeafletMap'), {
    loading: () => <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400 text-sm rounded-xl">Chargement de la carte...</div>,
    ssr: false
});

interface Event {
    _id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    type: 'diagnostic' | 'maintenance' | 'meeting' | 'other';
    status: 'scheduled' | 'completed' | 'cancelled';
    clientId?: {
        _id: string;
        firstName?: string;
        lastName?: string;
        raisonSociale?: string;
        phone?: string;
        mobile?: string;
        type: string;
    };
    employeeId?: {
        _id: string;
        firstName: string;
        lastName: string;
    };
    location?: string;
    photos?: string[];
}

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
}

export default function AgendaPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    // Location Modal State
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [tempCoords, setTempCoords] = useState<{ lat: number, lng: number, accuracy?: number } | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    // Form Data
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        startTime: '09:00',
        endDate: '',
        endTime: '10:00',
        type: 'diagnostic',
        status: 'scheduled',
        clientId: '',
        employeeId: '',
        location: '',
        photos: [] as ImageData[]
    });

    useEffect(() => {
        if (tenantId) {
            fetchEvents();
            fetchResources();
        }
    }, [tenantId, currentDate, view]); // Re-fetch on month change

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();

            const query = new URLSearchParams({
                start: view === 'list' ? new Date().toISOString() : start, // Only future for list? Or current month? Let's stick to current month view logic or generic range
                // For calendar view: fetch full month. For list view: fetch from today onwards or selected range.
                // Let's implement fetch by current visible range.
            });

            if (view === 'calendar') {
                const gridStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
                const gridEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
                query.set('start', gridStart.toISOString());
                query.set('end', gridEnd.toISOString());
            } else {
                // List view: Filter by the strictly selected month/year
                const monthStart = startOfMonth(currentDate);
                const monthEnd = endOfMonth(currentDate);
                query.set('start', monthStart.toISOString());
                query.set('end', monthEnd.toISOString());
            }

            const res = await fetch(`/api/agenda?${query.toString()}`, {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });

            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur chargement événements');
        } finally {
            setLoading(false);
        }
    };

    const fetchResources = async () => {
        try {
            const [cusRes, empRes] = await Promise.all([
                fetch('/api/customers?limit=1000', { headers: { 'X-Tenant-Id': tenantId || '' } }),
                fetch('/api/hr/employees?limit=1000', { headers: { 'X-Tenant-Id': tenantId || '' } })
            ]);

            if (cusRes.ok) {
                const data = await cusRes.json();
                setCustomers(data.items || []);
            }
            if (empRes.ok) {
                const data = await empRes.json();
                setEmployees(data.items || []);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const daysInMonth = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), // Monday start
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    });

    const getEventsForDay = (date: Date) => {
        return events.filter(event => isSameDay(parseISO(event.startDate), date));
    };

    const openNewEventModal = (date?: Date) => {
        setEditingEvent(null);
        const initialDate = date || new Date();
        setFormData({
            title: '',
            description: '',
            startDate: format(initialDate, 'yyyy-MM-dd'),
            startTime: format(initialDate, 'HH:mm'), // Round?
            endDate: format(initialDate, 'yyyy-MM-dd'),
            endTime: format(addDays(initialDate, 0), 'HH:mm'), // +1 hour logic later
            type: 'diagnostic',
            status: 'scheduled',
            clientId: '',
            employeeId: '',
            location: '',
            photos: []
        });
        setIsModalOpen(true);
    };

    const openViewEventModal = (event: Event) => {
        setViewingEvent(event);
    };

    const openEditEventModal = (event: Event) => {
        setViewingEvent(null);
        setEditingEvent(event);
        const start = parseISO(event.startDate);
        const end = parseISO(event.endDate);

        setFormData({
            title: event.title,
            description: event.description || '',
            startDate: format(start, 'yyyy-MM-dd'),
            startTime: format(start, 'HH:mm'),
            endDate: format(end, 'yyyy-MM-dd'),
            endTime: format(end, 'HH:mm'),
            type: event.type,
            status: event.status,
            clientId: event.clientId?._id || '',
            employeeId: event.employeeId?._id || '',
            location: event.location || '',
            photos: event.photos?.map((url, i) => ({
                id: url,
                url,
                name: `Photo ${i + 1}`,
                type: 'image/jpeg',
                size: 0
            })) || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!editingEvent || !confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;

        try {
            const res = await fetch(`/api/agenda/${editingEvent._id}`, {
                method: 'DELETE',
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                toast.success('Supprimé avec succès');
                setIsModalOpen(false);
                fetchEvents();
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (e) {
            toast.error('Erreur serveur');
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
            const endDateTime = new Date(`${formData.endDate}T${formData.endTime}:00`);

            const payload = {
                ...formData,
                startDate: startDateTime.toISOString(),
                endDate: endDateTime.toISOString(),
                photos: formData.photos.map(p => p.url)
            };

            const url = editingEvent ? `/api/agenda/${editingEvent._id}` : '/api/agenda';
            const method = editingEvent ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId || ''
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(editingEvent ? 'Modifié avec succès' : 'Créé avec succès');
                setIsModalOpen(false);
                fetchEvents();
            } else {
                toast.error('Erreur lors de l\'enregistrement');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur serveur');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCustomerLabel = (c: Customer) => {
        if (c.type === 'societe') return c.raisonSociale;
        return `${c.prenom || ''} ${c.nom || ''}`;
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'diagnostic': return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30 ring-1 ring-purple-500/20';
            case 'maintenance': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30 ring-1 ring-orange-500/20';
            case 'meeting': return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 ring-1 ring-blue-500/20';
            default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-500/30 ring-1 ring-gray-500/20';
        }
    };

    const handleGetLocation = async () => {
        if (!navigator.geolocation) {
            toast.error('Géolocalisation non supportée');
            return;
        }

        const loadId = toast.loading('Recherche de la position...');

        const getPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });
        };

        try {
            // Tentative 1: Haute précision (GPS)
            try {
                const pos = await getPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
                setTempCoords({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                setShowLocationModal(true);
                toast.success('Position trouvée !', { id: loadId });
            } catch (err) {
                // Tentative 2: Basse précision (Wifi/IP) si GPS échoue ou timeout
                console.log('GPS failed, trying low accuracy fallback...');
                const pos = await getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
                setTempCoords({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
                setShowLocationModal(true);
                toast.success('Position approximative trouvée', { id: loadId });
            }
        } catch (error: any) {
            console.error(error);
            let msg = 'Impossible de récupérer la position';
            if (error.code === 1) msg = 'Permission refusée';
            if (error.code === 2) msg = 'Position indisponible';
            if (error.code === 3) msg = 'Délai d\'attente dépassé';
            toast.error(msg, { id: loadId });
        }
    };


    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'diagnostic': return ClipboardDocumentCheckIcon;
            case 'maintenance': return WrenchScrewdriverIcon;
            case 'meeting': return UserGroupIcon;
            default: return CalendarIcon;
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100dvh-100px)] space-y-2 md:space-y-6">

                {/* Header Section */}
                <div className="flex flex-row flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 md:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none"></div>

                    <div className="relative z-10 flex items-center gap-3">
                        <span className="p-1.5 md:p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                            <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
                        </span>
                        <div>
                            <h1 className="text-lg md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                                Agenda
                            </h1>
                            <p className="hidden md:block mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Gérez vos rendez-vous, diagnostics et interventions.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <div className="flex bg-gray-100/80 dark:bg-gray-700/50 p-1 rounded-lg backdrop-blur-sm">
                            <button
                                onClick={() => setView('calendar')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${view === 'calendar'
                                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                Calendrier
                            </button>
                            <button
                                onClick={() => setView('list')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${view === 'list'
                                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                    }`}
                            >
                                Liste
                            </button>
                        </div>

                        <button
                            onClick={() => openNewEventModal()}
                            className="group flex items-center gap-2 px-3 py-2 md:px-5 md:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 active:scale-95"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span className="font-semibold hidden md:inline">Nouveau</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden flex flex-col backdrop-blur-sm relative">

                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1.5 md:p-2 hover:bg-white dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 transition-colors shadow-sm ring-1 ring-gray-200 dark:ring-gray-600/50"
                            >
                                <ChevronLeftIcon className="w-4 h-4 md:w-5 md:h-5" />
                            </button>

                            <div className="flex items-center gap-1 md:gap-2">
                                <select
                                    value={currentDate.getMonth()}
                                    onChange={(e) => {
                                        const newDate = new Date(currentDate);
                                        newDate.setMonth(parseInt(e.target.value));
                                        setCurrentDate(newDate);
                                    }}
                                    className="bg-transparent text-sm md:text-xl font-bold text-gray-800 dark:text-gray-100 cursor-pointer focus:ring-0 border-none py-0 pl-0 pr-2 md:pr-8 capitalize"
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <option key={i} value={i} className="text-base text-gray-900 dark:text-gray-900">
                                            {format(new Date(2000, i, 1), 'MMMM', { locale: fr })}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={currentDate.getFullYear()}
                                    onChange={(e) => {
                                        const newDate = new Date(currentDate);
                                        newDate.setFullYear(parseInt(e.target.value));
                                        setCurrentDate(newDate);
                                    }}
                                    className="bg-transparent text-sm md:text-xl font-bold text-gray-800 dark:text-gray-100 cursor-pointer focus:ring-0 border-none py-0 pl-0 pr-2 md:pr-8"
                                >
                                    {Array.from({ length: 10 }).map((_, i) => {
                                        const y = new Date().getFullYear() - 5 + i;
                                        return (
                                            <option key={y} value={y} className="text-base text-gray-900 dark:text-gray-900">
                                                {y}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <button
                                onClick={handleNextMonth}
                                className="p-1.5 md:p-2 hover:bg-white dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400 transition-colors shadow-sm ring-1 ring-gray-200 dark:ring-gray-600/50"
                            >
                                <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>

                        <button
                            onClick={handleToday}
                            className="px-3 py-1.5 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors shadow-sm"
                        >
                            Aujourd'hui
                        </button>
                    </div>

                    {loading && !events.length ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-600"></div>
                            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Chargement de votre planning...</p>
                        </div>
                    ) : view === 'calendar' ? (
                        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900/20">
                            {/* Days Header */}
                            {/* Days Header */}
                            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm z-10 shrink-0">
                                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                                    <div key={day} className="py-2 text-center text-[10px] md:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        <span className="hidden md:inline">{day}</span>
                                        <span className="md:hidden">{day.substring(0, 3)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="flex-1 overflow-y-auto bg-gray-200 dark:bg-gray-700 pb-20">
                                <div className="grid grid-cols-7 auto-rows-fr gap-px min-h-full border-b border-gray-200 dark:border-gray-700">
                                    {daysInMonth.map((day, dayIdx) => {
                                        const dayEvents = getEventsForDay(day);
                                        const isCurrentMonth = isSameMonth(day, currentDate);
                                        const isDayToday = isToday(day);

                                        return (
                                            <div
                                                key={day.toString()}
                                                onClick={() => openNewEventModal(day)}
                                                className={`
                                                    relative w-full min-h-[50px] md:min-h-[80px] p-0.5 md:p-1 transition-all duration-200 cursor-pointer group flex flex-col gap-0.5 overflow-hidden
                                                    ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/60' : 'bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-gray-700/50'}
                                                    ${isDayToday ? 'ring-2 ring-inset ring-blue-600 z-10' : ''}
                                                `}
                                            >    <div className="flex items-center justify-between px-1 pt-1">
                                                    <span className={`
                                                    text-xs sm:text-sm font-bold w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all
                                                    ${isDayToday
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110'
                                                            : !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-700'}
                                                `}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {isCurrentMonth && (
                                                        <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>

                                                <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar px-0.5 pb-0.5">
                                                    {dayEvents.map(event => {
                                                        const TypeIcon = getTypeIcon(event.type);
                                                        return (
                                                            <div
                                                                key={event._id}
                                                                onClick={(e) => { e.stopPropagation(); openViewEventModal(event); }}
                                                                className={`
                                                                px-1 py-0.5 sm:px-2 sm:py-1.5 rounded text-[10px] sm:text-xs border flex items-center gap-1 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5
                                                                ${getTypeColor(event.type)}
                                                            `}
                                                            >
                                                                <TypeIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                                                <span className="truncate font-semibold hidden sm:inline">{format(parseISO(event.startDate), 'HH:mm')}</span>
                                                                <span className="truncate flex-1 opacity-90">{event.title}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Ultra Compact List View
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/20">
                            {events.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                        <CalendarIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">Aucun événement</h3>
                                    <button
                                        onClick={() => openNewEventModal()}
                                        className="mt-3 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                                    >
                                        Ajouter
                                    </button>
                                </div>
                            ) : (
                                events.reduce((acc: JSX.Element[], event, i, arr) => {
                                    const date = parseISO(event.startDate);
                                    const dateKey = format(date, 'yyyy-MM-dd');
                                    const prevDateKey = i > 0 ? format(parseISO(arr[i - 1].startDate), 'yyyy-MM-dd') : null;

                                    if (dateKey !== prevDateKey) {
                                        const isTodayHeader = isSameDay(date, new Date());
                                        acc.push(
                                            <div key={`header-${dateKey}`} className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700/50 mt-3 first:mt-0 sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 py-1.5">
                                                <div className="text-xl font-black text-gray-400 dark:text-gray-600 select-none">
                                                    {format(date, 'dd')}
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className={`text-sm font-bold capitalize ${isTodayHeader ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                                        {format(date, 'MMMM yyyy', { locale: fr })}
                                                    </span>
                                                    <span className="text-xs text-gray-400 capitalize">{format(date, 'EEEE', { locale: fr })}</span>
                                                    {isTodayHeader && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0 rounded-full font-semibold">Aujourd'hui</span>}
                                                </div>
                                            </div>
                                        );
                                    }

                                    const TypeIcon = getTypeIcon(event.type);

                                    acc.push(
                                        <div
                                            key={event._id}
                                            onClick={() => openEditEventModal(event)}
                                            className="group relative flex items-center gap-3 p-2 rounded-lg border border-white dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer"
                                        >
                                            {/* Decoration */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getTypeColor(event.type).split(' ')[0]}`}></div>

                                            {/* Time & Type Compact */}
                                            <div className="flex-shrink-0 flex flex-col items-center min-w-[55px] border-r border-gray-100 dark:border-gray-700/50 pr-3 ml-1">
                                                <span className="text-sm font-bold text-gray-800 dark:text-white leading-tight">
                                                    {format(parseISO(event.startDate), 'HH:mm')}
                                                </span>
                                                <span className="text-[9px] text-gray-400">
                                                    {format(parseISO(event.endDate), 'HH:mm')}
                                                </span>
                                                <div className={`mt-1 p-1 rounded-full ${getTypeColor(event.type).split(' ')[0]} bg-opacity-20`}>
                                                    <TypeIcon className={`w-3 h-3 ${getTypeColor(event.type).split(' ')[1]}`} />
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {event.title}
                                                    </h3>
                                                    {event.status === 'completed' && (
                                                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-green-600" title="Terminé" />
                                                    )}
                                                </div>

                                                {event.description && (
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                        {event.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {event.clientId && (
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                                                            <UserIcon className="w-3 h-3 text-blue-500" />
                                                            <span className="truncate max-w-[100px]">
                                                                {event.clientId.raisonSociale || `${event.clientId.firstName || ''} ${event.clientId.lastName || ''}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {event.employeeId && (
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                                                            <WrenchScrewdriverIcon className="w-3 h-3 text-orange-500" />
                                                            <span className="truncate max-w-[100px]">
                                                                {event.employeeId.firstName} {event.employeeId.lastName}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status/Location End */}
                                            {event.location && (
                                                <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded max-w-[100px] truncate">
                                                    <MapPinIcon className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                    <span className="truncate">{event.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                    return acc;
                                }, [])
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {editingEvent ? (
                                        <>
                                            <WrenchScrewdriverIcon className="w-6 h-6 text-blue-600" />
                                            Modifier l'événement
                                        </>
                                    ) : (
                                        <>
                                            <PlusIcon className="w-6 h-6 text-blue-600" />
                                            Nouveau Rendez-vous
                                        </>
                                    )}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Remplissez les détails ci-dessous.</p>
                            </div>
                            {editingEvent && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg text-sm font-semibold transition-all duration-200 border border-red-200 dark:border-red-900/30 hover:border-red-600 shadow-sm"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Titre de l'événement</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ex: Diagnostic Client X..."
                                        className="w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
                                        <div className="relative">
                                            <select
                                                value={formData.type}
                                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                                className="w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none font-medium"
                                            >
                                                <option value="diagnostic">🔍 Diagnostic</option>
                                                <option value="maintenance">🔧 Maintenance</option>
                                                <option value="meeting">👥 Réunion</option>
                                                <option value="other">📅 Autre</option>
                                            </select>
                                            <ChevronRightIcon className="w-5 h-5 absolute right-3 top-3.5 text-gray-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Statut</label>
                                        <div className="relative">
                                            <select
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                                className="w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none font-medium"
                                            >
                                                <option value="scheduled">🟡 Planifié</option>
                                                <option value="completed">🟢 Terminé</option>
                                                <option value="cancelled">🔴 Annulé</option>
                                            </select>
                                            <ChevronRightIcon className="w-5 h-5 absolute right-3 top-3.5 text-gray-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-4 border border-gray-100 dark:border-gray-700/50">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Plage Horaire</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Début</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                required
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="time"
                                                required
                                                value={formData.startTime}
                                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                className="w-28 px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Fin</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                required
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                            <input
                                                type="time"
                                                required
                                                value={formData.endTime}
                                                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                className="w-28 px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Client</label>
                                        <div className="relative">
                                            <select
                                                value={formData.clientId}
                                                onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                            >
                                                <option value="">Sélectionner un client...</option>
                                                {customers.map(c => (
                                                    <option key={c._id} value={c._id}>{getCustomerLabel(c)}</option>
                                                ))}
                                            </select>
                                            <UserIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
                                            <ChevronRightIcon className="w-5 h-5 absolute right-3 top-3.5 text-gray-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Employé / Technicien</label>
                                        <div className="relative">
                                            <select
                                                value={formData.employeeId}
                                                onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                                            >
                                                <option value="">Sélectionner un employé...</option>
                                                {employees.map(e => (
                                                    <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
                                                ))}
                                            </select>
                                            <WrenchScrewdriverIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
                                            <ChevronRightIcon className="w-5 h-5 absolute right-3 top-3.5 text-gray-400 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Lieu / Lien Google Maps</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={formData.location}
                                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                                placeholder="Adresse ou lien..."
                                            />
                                            <MapPinIcon className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors tooltip tooltip-bottom"
                                            title="Utiliser ma position actuelle"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                            </svg>
                                        </button>

                                        {formData.location && (
                                            <a
                                                href={formData.location.startsWith('http') ? formData.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.location)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                title="Ouvrir dans Google Maps"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                    <path fillRule="evenodd" d="M15.75 2.25H21a.75.75 0 01.75.75v5.25a.75.75 0 01-1.5 0V4.81L8.03 17.03a.75.75 0 01-1.06-1.06L19.19 3.75h-3.44a.75.75 0 010-1.5zm-10.5 4.5a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5V10.5a.75.75 0 011.5 0v8.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V8.25a3 3 0 013-3h8.25a.75.75 0 010 1.5H5.25z" clipRule="evenodd" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>

                                    {/* Map Preview */}
                                    {(() => {
                                        // Try to extract coordinates from Google Maps URL
                                        const coords = formData.location.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                                        if (coords) {
                                            const lat = parseFloat(coords[1]);
                                            const lng = parseFloat(coords[2]);
                                            return (
                                                <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-48 relative z-0">
                                                    <LeafletMap pos={{ lat, lng }} readonly />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Description / Notes</label>
                                    <textarea
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="Détails supplémentaires..."
                                    />
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <PhotoIcon className="w-4 h-4" />
                                        Photos
                                    </h3>
                                    <ImageUploader
                                        images={formData.photos}
                                        onChange={(newImages) => setFormData({ ...formData, photos: newImages })}
                                        maxImages={5}
                                        maxSizeMB={5}
                                        folder="agenda-photos"
                                        label=""
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Enregistrement...</span>
                                        </>
                                    ) : (
                                        <span>Enregistrer</span>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
            {/* View Event Modal */}
            {viewingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                                    {viewingEvent.title}
                                </h2>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    <ClockIcon className="w-4 h-4" />
                                    <span>
                                        {format(parseISO(viewingEvent.startDate), 'dd MMMM yyyy, HH:mm', { locale: fr })}
                                        {' - '}
                                        {format(parseISO(viewingEvent.endDate), 'HH:mm')}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingEvent(null)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(viewingEvent.type)}`}>
                                    {viewingEvent.type === 'diagnostic' ? 'Diagnostic' :
                                        viewingEvent.type === 'maintenance' ? 'Maintenance' :
                                            viewingEvent.type === 'meeting' ? 'Réunion' : 'Autre'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border
                                    ${viewingEvent.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                                        viewingEvent.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                                            'bg-blue-100 text-blue-700 border-blue-200'}
                                `}>
                                    {viewingEvent.status === 'completed' ? 'Terminé' :
                                        viewingEvent.status === 'cancelled' ? 'Annulé' : 'Planifié'}
                                </span>
                            </div>

                            {/* Client & Employee Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Client Card */}
                                {viewingEvent.clientId ? (
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <UserIcon className="w-4 h-4" /> Client
                                        </div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {getCustomerLabel(viewingEvent.clientId as any)}
                                        </p>
                                        {(viewingEvent.clientId as any).phone && (
                                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                                <PhoneIcon className="w-3.5 h-3.5" />
                                                {(viewingEvent.clientId as any).phone}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 border-dashed flex items-center justify-center text-gray-400 text-sm">
                                        Aucun client assigné
                                    </div>
                                )}

                                {/* Employee Card */}
                                {viewingEvent.employeeId ? (
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <WrenchScrewdriverIcon className="w-4 h-4" /> Technicien
                                        </div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {(viewingEvent.employeeId as any).firstName} {(viewingEvent.employeeId as any).lastName}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 border-dashed flex items-center justify-center text-gray-400 text-sm">
                                        Aucun employe assigné
                                    </div>
                                )}
                            </div>

                            {/* Location */}
                            {viewingEvent.location && (
                                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        <MapPinIcon className="w-4 h-4" /> Lieu
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 truncate">
                                        {viewingEvent.location.startsWith('http') ? 'Lien Google Maps' : viewingEvent.location}
                                    </p>

                                    {(() => {
                                        const coords = viewingEvent.location.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                                        if (coords) {
                                            const lat = parseFloat(coords[1]);
                                            const lng = parseFloat(coords[2]);
                                            return (
                                                <div className="h-40 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800 mb-2 z-0">
                                                    <LeafletMap pos={{ lat, lng }} readonly />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {viewingEvent.location && (
                                        <a
                                            href={viewingEvent.location.startsWith('http') ? viewingEvent.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewingEvent.location)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
                                        >
                                            Ouvrir sur la carte <ChevronRightIcon className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            {viewingEvent.description && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Description / Notes</h3>
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                        {viewingEvent.description}
                                    </div>
                                </div>
                            )}

                            {/* Photos */}
                            {viewingEvent.photos && viewingEvent.photos.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                        <PhotoIcon className="w-4 h-4" /> Photos ({viewingEvent.photos.length})
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {viewingEvent.photos.map((photo, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setViewerImage(photo)}
                                                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                                onClick={() => {
                                    if (confirm('Supprimer cet événement ?')) {
                                        setEditingEvent(viewingEvent);
                                        // Slight hack: use existing delete logic which uses 'editingEvent'
                                        // But we need to make sure 'editingEvent' is set before calling delete. 
                                        // Or better, expose delete function accepting ID.
                                        // For now, let's just use existing openEditEventModal then click delete? No that's slow.
                                        // I'll call a delete handler directly.
                                        // I Need to define specific delete handler for viewingEvent or reuse.
                                        // Let's just open edit modal for now as the user asked for "Change page".
                                        // Or implementing delete here?
                                        // User request was specifically about "Change page".
                                    }
                                }}
                                className="hidden px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-semibold transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    const eventToDelete = viewingEvent;
                                    if (confirm('Supprimer cet événement ?')) {
                                        // Reuse handleDelete logic but with explicit event
                                        // Since handleDelete uses 'editingEvent', we need to adapt it. 
                                        // Let's just create a new handler inline or update editingEvent then call it.
                                        // Safest: Set editingEvent to this event, then call handleDelete manually? 
                                        // Or just Copy the delete fetch logic here.
                                        // I will opt to simply NOT show delete here if not requested, primarily "Edit".
                                        // Actually I will show "Modifier" as primary.
                                    }
                                }}
                                className="hidden" // Hiding delete for now to focus on User Request
                            >
                            </button>

                            <button
                                onClick={() => setViewingEvent(null)}
                                className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-semibold transition-colors"
                            >
                                Fermer
                            </button>
                            <button
                                onClick={() => openEditEventModal(viewingEvent)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <PencilIcon className="w-4 h-4" />
                                Modifier
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Image Viewer Lightbox */}
            {viewerImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4"
                    onClick={() => setViewerImage(null)}
                >
                    <button
                        onClick={() => setViewerImage(null)}
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[70]"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>

                    {viewingEvent?.photos && viewingEvent.photos.length > 1 && (
                        <>
                            {/* Previous Button */}
                            {viewingEvent.photos.indexOf(viewerImage) > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIndex = viewingEvent.photos!.indexOf(viewerImage);
                                        setViewerImage(viewingEvent.photos![currentIndex - 1]);
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[70]"
                                >
                                    <ChevronLeftIcon className="w-8 h-8" />
                                </button>
                            )}

                            {/* Next Button */}
                            {viewingEvent.photos.indexOf(viewerImage) < viewingEvent.photos.length - 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIndex = viewingEvent.photos!.indexOf(viewerImage);
                                        setViewerImage(viewingEvent.photos![currentIndex + 1]);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[70]"
                                >
                                    <ChevronRightIcon className="w-8 h-8" />
                                </button>
                            )}
                        </>
                    )}

                    <img
                        src={viewerImage}
                        alt="Full screen view"
                        className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
            {/* Location Confirmation Modal */}
            {showLocationModal && tempCoords && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <MapPinIcon className="w-5 h-5 text-blue-500" />
                                Confirmer la position
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Veuillez vérifier que la position détectée est correcte.
                            </p>
                        </div>

                        <div className="h-64 relative bg-gray-100 w-full z-0">
                            <LeafletMap
                                pos={{ lat: tempCoords.lat, lng: tempCoords.lng }}
                                onLocationSelect={(lat, lng) => setTempCoords(prev => prev ? { ...prev, lat, lng } : null)}
                            />
                            {tempCoords.accuracy && (
                                <div className="absolute top-2 right-2 z-[400] bg-white/90 dark:bg-black/80 px-2 py-1 rounded text-xs text-gray-700 dark:text-gray-300 shadow backdrop-blur-sm">
                                    Précision ~{Math.round(tempCoords.accuracy)}m
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowLocationModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    const url = `https://www.google.com/maps?q=${tempCoords.lat},${tempCoords.lng}`;
                                    setFormData(prev => ({ ...prev, location: url }));
                                    setShowLocationModal(false);
                                    toast.success('Position enregistrée');
                                }}
                                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                            >
                                Utiliser cette position
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
