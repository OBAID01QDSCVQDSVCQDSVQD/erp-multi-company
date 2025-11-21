import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering since we use getServerSession which uses headers()
export const dynamic = 'force-dynamic';

// GET /api/cost-centers - Get cost centers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const actif = searchParams.get('actif');

    // TODO: Implement cost centers model and database logic
    // For now, return empty array to prevent 404 errors
    const costCenters: any[] = [];

    // Filter by actif if requested
    let filteredCenters = costCenters;
    if (actif === 'true') {
      filteredCenters = costCenters.filter((cc: any) => cc.actif !== false);
    }

    return NextResponse.json({
      items: filteredCenters,
      total: filteredCenters.length,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des centres de coût:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

