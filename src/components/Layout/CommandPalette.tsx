'use client';

import { Fragment, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import {
    MagnifyingGlassIcon,
    DocumentPlusIcon,
    UserPlusIcon,
    CubeIcon,
    Cog6ToothIcon,
    HomeIcon,
    BanknotesIcon,
    ShoppingCartIcon,
    UsersIcon,
    CalculatorIcon,
    ArchiveBoxIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const router = useRouter();

    // Toggle with Ctrl+K or Cmd+K
    useEffect(() => {
        const onKeydown = (event: KeyboardEvent) => {
            if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setIsOpen(!isOpen);
            }
        };
        window.addEventListener('keydown', onKeydown);
        return () => {
            window.removeEventListener('keydown', onKeydown);
        };
    }, [isOpen]);

    const navigation = [
        { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon, type: 'Page' },
        { name: 'Agenda', href: '/agenda', icon: CalendarDaysIcon, type: 'Page' },
        { name: 'Ventes', href: '/sales/invoices', icon: BanknotesIcon, type: 'Page' },
        { name: 'Achats', href: '/purchases/invoices', icon: ShoppingCartIcon, type: 'Page' },
        { name: 'Clients', href: '/customers', icon: UsersIcon, type: 'Page' },
        { name: 'Produits', href: '/products', icon: CubeIcon, type: 'Page' },
        { name: 'Stock', href: '/inventory', icon: ArchiveBoxIcon, type: 'Page' },
        { name: 'Paramètres', href: '/settings', icon: Cog6ToothIcon, type: 'Page' },
    ];

    const actions = [
        { name: 'Nouvelle Facture', href: '/sales/invoices?action=new', icon: DocumentPlusIcon, type: 'Action' },
        { name: 'Nouveau Devis', href: '/sales/quotes?action=new', icon: DocumentPlusIcon, type: 'Action' },
        { name: 'Nouveau Client', href: '/customers?new=true', icon: UserPlusIcon, type: 'Action' },
        { name: 'Nouveau Produit', href: '/products?action=new', icon: CubeIcon, type: 'Action' },
        { name: 'Nouveau Bon de Livraison (BL)', href: '/sales/deliveries?action=new', icon: DocumentPlusIcon, type: 'Action' },
        { name: 'Nouveau Bon de Réception (BR)', href: '/purchases/receptions?action=new', icon: DocumentPlusIcon, type: 'Action' },
        { name: 'Nouvelle Facture Fournisseur', href: '/purchases/invoices?action=new', icon: DocumentPlusIcon, type: 'Action' },
    ];

    const allItems = [...navigation, ...actions];

    const filteredItems = query === ''
        ? []
        : allItems.filter((item) => {
            return item.name.toLowerCase().includes(query.toLowerCase());
        });

    const handleSelect = (item: any) => {
        setIsOpen(false);
        setQuery('');
        router.push(item.href);
    };

    return (
        <Transition.Root show={isOpen} as={Fragment} afterLeave={() => setQuery('')}>
            <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-25 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto max-w-xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
                            <Combobox onChange={(item: any) => handleSelect(item)}>
                                <div className="relative">
                                    <MagnifyingGlassIcon
                                        className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                    <Combobox.Input
                                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                                        placeholder="Rechercher... (Ctrl+K)"
                                        onChange={(event) => setQuery(event.target.value)}
                                        displayValue={(item: any) => item?.name}
                                    />
                                </div>

                                {(query === '' || filteredItems.length > 0) && (
                                    <Combobox.Options static className="max-h-96 scroll-py-3 overflow-y-auto p-3">
                                        {query === '' && (
                                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 pb-2 pt-1">
                                                Récents / Suggestions
                                            </div>
                                        )}

                                        {(query === '' ? navigation.slice(0, 5) : filteredItems).map((item) => (
                                            <Combobox.Option
                                                key={item.name}
                                                value={item}
                                                className={({ active }) =>
                                                    `cursor-default select-none rounded-md px-3 py-2 flex items-center gap-3 ${active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`
                                                }
                                            >
                                                {({ active }) => (
                                                    <>
                                                        <item.icon
                                                            className={`h-5 w-5 flex-none ${active ? 'text-white' : 'text-gray-400'
                                                                }`}
                                                            aria-hidden="true"
                                                        />
                                                        <span className="flex-auto truncate">{item.name}</span>
                                                        <span className={`ml-auto text-xs ${active ? 'text-indigo-100' : 'text-gray-400'}`}>
                                                            {item.type === 'Action' && '↵'}
                                                        </span>
                                                    </>
                                                )}
                                            </Combobox.Option>
                                        ))}

                                        {query !== '' && filteredItems.length === 0 && (
                                            <p className="p-4 text-sm text-gray-500">Aucun résultat trouvé.</p>
                                        )}
                                    </Combobox.Options>
                                )}
                            </Combobox>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
