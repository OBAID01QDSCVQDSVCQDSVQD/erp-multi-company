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
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden group relative"
    >
      <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
        <Icon className={`w-16 h-16 ${color.replace('bg-', 'text-')}`} />
      </div>

      <div className="p-4 sm:p-5 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">{name}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {value}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${color} bg-opacity-10 text-opacity-100 flex-shrink-0 shadow-sm`}>
            <div className={`${color.replace('bg-', 'text-').replace('500', '600')} dark:${color.replace('bg-', 'text-').replace('500', '400')}`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {change && (
          <div className="mt-3 flex items-center">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${getChangeColor()}`}>
              <ChangeIcon />
              {change}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">vs période préc.</span>
          </div>
        )}
      </div>
      <div className="h-1 w-full bg-gray-50 dark:bg-gray-700">
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
