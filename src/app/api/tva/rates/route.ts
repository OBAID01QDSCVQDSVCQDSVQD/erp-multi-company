import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import TaxRate from '@/lib/models/TaxRate';

// GET /api/tva/rates - Récupérer les taux de TVA actifs
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

    await connectDB();

    const { searchParams } = new URL(request.url);
    const actifOnly = searchParams.get('actif') !== 'false';

    const query: any = { tenantId };
    if (actifOnly) {
      query.actif = true;
    }

    const taxRates = await (TaxRate as any).find(query)
      .select('-deductiblePctVentes -deductiblePctAchats')
      .sort({ code: 1 });

    return NextResponse.json({ data: taxRates });

  } catch (error) {
    console.error('Erreur lors de la récupération des taux TVA:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/tva/rates - Créer ou mettre à jour un taux de TVA
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const body = await request.json();
    const { code, libelle, tauxPct, applicableA, actif } = body;

    // Validation des données
    if (!code || !libelle || tauxPct === undefined) {
      return NextResponse.json(
        { error: 'Code, libellé et taux sont requis' },
        { status: 400 }
      );
    }

    if (tauxPct < 0 || tauxPct > 100) {
      return NextResponse.json(
        { error: 'Le taux doit être entre 0 et 100' },
        { status: 400 }
      );
    }

    await connectDB();

    // Upsert par tenantId + code
    const taxRate = await (TaxRate as any).findOneAndUpdate(
      { tenantId, code: code.toUpperCase() },
      {
        $set: {
          libelle,
          tauxPct,
          applicableA: applicableA || 'les_deux',
          actif: actif !== undefined ? actif : true,
        },
        $unset: { deductiblePctVentes: '', deductiblePctAchats: '' },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(taxRate, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création/mise à jour du taux TVA:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Un taux avec ce code existe déjà' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
