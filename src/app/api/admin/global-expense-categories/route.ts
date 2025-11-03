import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import GlobalExpenseCategory from '@/lib/models/GlobalExpenseCategory';

// GET /api/admin/global-expense-categories - Récupérer toutes les catégories globales
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier les permissions admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
    }

    await connectDB();

    const categories = await (GlobalExpenseCategory as any).find({ isActive: true })
      .sort({ nom: 1 });

    return NextResponse.json({ data: categories });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories globales:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/admin/global-expense-categories - Créer ou mettre à jour une catégorie globale
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier les permissions admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
    }

    const body = await request.json();
    const { code, nom, typeGlobal, icone, description } = body;

    await connectDB();

    // Upsert par code
    const category = await (GlobalExpenseCategory as any).findOneAndUpdate(
      { code: code.toUpperCase() },
      {
        nom,
        typeGlobal,
        icone,
        description,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(category, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création/mise à jour de la catégorie globale:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
