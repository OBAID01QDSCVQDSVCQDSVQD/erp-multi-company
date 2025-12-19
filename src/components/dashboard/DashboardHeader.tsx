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
    const currentDate = format(new Date(), 'EEEE d MMMM', { locale: fr });

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-0"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                        Bonjour, <span className="text-indigo-600 dark:text-indigo-400">{userName || 'User'}</span>
                    </h1>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-none">
                        Aperçu de votre activité
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-gray-700 mb-0.5">
                        <BuildingOfficeIcon className="w-3 h-3 mr-1 text-indigo-500 dark:text-indigo-400" />
                        <span className="font-bold text-[10px]">{companyName}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 capitalize leading-none">
                        {currentDate}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
