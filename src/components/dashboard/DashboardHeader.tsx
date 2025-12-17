'use client';

import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

interface DashboardHeaderProps {
    userName?: string | null;
    companyName?: string | null;
}

export default function DashboardHeader({ userName, companyName }: DashboardHeaderProps) {
    const currentDate = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
        >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Bonjour, <span className="text-indigo-600">{userName || 'Utilisateur'}</span> 👋
                    </h1>
                    <p className="mt-2 text-gray-500">
                        Voici ce qui se passe dans votre entreprise aujourd'hui.
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center text-gray-600 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 mb-2">
                        <BuildingOfficeIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        <span className="font-medium">{companyName}</span>
                    </div>
                    <p className="text-sm text-gray-400 capitalize">
                        {currentDate}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
