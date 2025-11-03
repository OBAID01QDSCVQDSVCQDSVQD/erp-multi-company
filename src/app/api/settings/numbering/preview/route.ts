import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NumberingService } from '@/lib/services/NumberingService';

// GET /api/settings/numbering/preview - Prévisualiser un numéro
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('type');
    let type: 'devis' | 'bc' | 'bl' | 'fac' | 'avoir' | 'ca' | 'br' | 'facfo' | 'avoirfo' | undefined;
    
    if (rawType === 'facture') {
      type = 'fac';
    } else if (rawType && ['devis', 'bc', 'bl', 'fac', 'avoir', 'ca', 'br', 'facfo', 'avoirfo'].includes(rawType)) {
      type = rawType as any;
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Type de numérotation invalide' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const previewNumber = await NumberingService.preview(tenantId, type);

    return NextResponse.json({
      type,
      preview: previewNumber,
    });

  } catch (error) {
    console.error('Erreur lors de la prévisualisation:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
