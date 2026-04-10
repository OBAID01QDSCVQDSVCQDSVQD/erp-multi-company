'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    BriefcaseIcon,
    CheckIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
    _id: string;
    name: string;
    projectNumber?: string;
    status?: string;
}

interface ProjectSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (projectId: string) => void;
    projects: Project[];
    currentProjectId?: string;
    title?: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: 'Terminé', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function ProjectSearchModal({
    isOpen,
    onClose,
    onSelect,
    projects,
    currentProjectId,
    title = 'Sélectionner un projet',
}: ProjectSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const alphabet = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);

    const filteredProjects = useMemo(() => {
        let results = projects;
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            results = projects.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.projectNumber && p.projectNumber.toLowerCase().includes(query))
            );
        }
        return results;
    }, [projects, searchTerm]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setSelectedIndex(-1);
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filteredProjects.length ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex === -1) {
                onSelect('');
            } else if (filteredProjects[selectedIndex]) {
                onSelect(filteredProjects[selectedIndex]._id);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const selectedEl = listRef.current.children[selectedIndex + 1] as HTMLElement; // +1 for "None" option
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal / Drawer */}
                <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    className="relative bg-white dark:bg-gray-900 w-full max-w-xl h-full sm:h-auto sm:max-h-[85vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <BriefcaseIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Search Area */}
                    <div className="p-6 space-y-4 bg-gray-50/50 dark:bg-gray-800/50 border-b dark:border-gray-800">
                        <div className="relative group">
                            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Rechercher par nom ou numéro..."
                                className="w-full pl-12 pr-12 py-3 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 dark:text-white"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Alphabet Shortcuts */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            {alphabet.map(letter => (
                                <button
                                    key={letter}
                                    onClick={() => setSearchTerm(letter)}
                                    className={`flex-shrink-0 min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${searchTerm === letter
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results List */}
                    <div
                        ref={listRef}
                        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 custom-scrollbar"
                    >
                        {/* Option "None" */}
                        <button
                            onClick={() => onSelect('')}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center justify-between group ${!currentProjectId && selectedIndex === -1
                                    ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 ring-2 ring-blue-500/20'
                                    : selectedIndex === -1
                                        ? 'bg-gray-50 dark:bg-gray-800 border-blue-400'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">Aucun projet</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Ne pas associer ce pointage</div>
                                </div>
                            </div>
                            {!currentProjectId && <CheckIcon className="w-6 h-6 text-blue-600" />}
                        </button>

                        {filteredProjects.length === 0 ? (
                            <div className="py-12 text-center">
                                <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400">Aucun projet trouvé</p>
                            </div>
                        ) : (
                            filteredProjects.map((project, index) => {
                                const isSelected = currentProjectId === project._id;
                                const isFocused = selectedIndex === index;
                                const status = statusMap[project.status || ''] || { label: project.status, color: 'bg-gray-100 text-gray-600' };

                                return (
                                    <button
                                        key={project._id}
                                        onClick={() => onSelect(project._id)}
                                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center justify-between group ${isSelected
                                                ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 ring-2 ring-blue-500/20'
                                                : isFocused
                                                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-400'
                                                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                                                }`}>
                                                <BriefcaseIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900 dark:text-white truncate">
                                                        {project.name}
                                                    </span>
                                                    {project.status && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${status.color}`}>
                                                            {status.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                    {project.projectNumber && (
                                                        <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                                            #{project.projectNumber}
                                                        </span>
                                                    )}
                                                    <span className="truncate">Cliquez pour sélectionner</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <CheckIcon className="w-6 h-6 text-blue-600" />
                                        ) : (
                                            <ChevronRightIcon className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800 flex items-center justify-between text-[11px] font-medium text-gray-400 uppercase tracking-widest">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <span className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">Esc</span>
                                <span>Fermer</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-gray-600 dark:text-gray-300">↑↓</span>
                                <span>Naviguer</span>
                            </span>
                        </div>
                        <span>{filteredProjects.length} Projets</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
