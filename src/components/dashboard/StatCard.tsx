'use client';

import { motion } from 'framer-motion';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  name: string;
  value: string;
  subtitle?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  color: string;
  delay?: number;
}

export default function StatCard({
  name,
  value,
  subtitle,
  change,
  changeType = 'neutral',
  icon: Icon,
  color,
  delay = 0,
}: StatCardProps) {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
    if (changeType === 'negative') return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400';
    return 'text-gray-600 bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400';
  };

  const ChangeIcon = () => {
    if (changeType === 'positive') return <ArrowTrendingUpIcon className="w-2 h-2 mr-0.5" />;
    if (changeType === 'negative') return <ArrowTrendingDownIcon className="w-2 h-2 mr-0.5" />;
    return <MinusIcon className="w-2 h-2 mr-0.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden group"
    >
      <div className="p-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 mb-0 uppercase tracking-wider truncate leading-none">{name}</p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-none mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
              {value}
            </h3>
            {subtitle && (
              <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 truncate leading-none">{subtitle}</p>
            )}
          </div>
          <div className={`p-1 rounded-md ${color} bg-opacity-10 text-opacity-100 flex-shrink-0`}>
            <div className={`${color.replace('bg-', 'text-').replace('500', '600')} dark:${color.replace('bg-', 'text-').replace('500', '400')}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {change && (
          <div className="mt-1.5 flex items-center">
            <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium leading-none ${getChangeColor()}`}>
              <ChangeIcon />
              {change}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-1 leading-none">vs mois dernier</span>
          </div>
        )}
      </div>
      <div className="h-0.5 w-full bg-gray-50 dark:bg-gray-700">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 1, delay: delay + 0.2 }}
          className={`h-full ${color}`}
        />
      </div>
    </motion.div>
  );
}
