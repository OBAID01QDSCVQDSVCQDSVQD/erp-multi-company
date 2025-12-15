'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Wrapper de redirection vers la page de création en mode édition
export default function EditReceptionPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = (params as any)?.id as string | undefined;
    if (!id) {
      router.replace('/purchases/receptions');
      return;
    }
    router.replace(`/purchases/receptions/new?editId=${id}`);
  }, [params, router]);

  return null;
}


