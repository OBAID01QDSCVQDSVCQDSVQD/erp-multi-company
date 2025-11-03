'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

export default function EditQuotePage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();

  useEffect(() => {
    // Redirect to main quotes page with edit modal
    toast('Fonctionnalité de modification à venir', { icon: 'ℹ️' });
    router.push('/sales/quotes');
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Redirection...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

