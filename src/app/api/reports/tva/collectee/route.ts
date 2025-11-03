import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// GET /api/reports/tva/collectee - Rapport TVA collectée
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les paramètres from et to sont requis' },
        { status: 400 }
      );
    }

    await connectDB();

    // Pour l'instant, on simule des données
    // Dans un vrai système, on interrogerait la collection des documents de vente
    const mockData = {
      lignes: [
        { code: 'TN19', tauxPct: 19, baseHT: 1000, tva: 190 },
        { code: 'TN13', tauxPct: 13, baseHT: 500, tva: 65 },
        { code: 'TN7', tauxPct: 7, baseHT: 200, tva: 14 },
        { code: 'TN0', tauxPct: 0, baseHT: 100, tva: 0 },
      ],
      totalBase: 1800,
      totalTVA: 269,
      periode: {
        from: new Date(from),
        to: new Date(to),
      },
    };

    return NextResponse.json(mockData);

  } catch (error) {
    console.error('Erreur lors de la génération du rapport TVA collectée:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
