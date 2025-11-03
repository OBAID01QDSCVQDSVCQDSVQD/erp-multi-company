'use client';

import { useSession } from 'next-auth/react';

export function useTenantId() {
  const { data: session } = useSession();
  const tenantId = session?.user?.companyId as string | undefined;
  
  return { tenantId };
}
