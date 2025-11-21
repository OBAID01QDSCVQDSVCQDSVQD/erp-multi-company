import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import GlobalExpenseCategory from '@/lib/models/GlobalExpenseCategory';

// Force dynamic rendering since we use getServerSession which uses headers()
export const dynamic = 'force-dynamic';

// GET /api/expense-categories - Récupérer les catégories (globales + locales)
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

    // Récupérer les catégories locales
    const localCategories = await (ExpenseCategory as any).find({ 
      tenantId,
      isActive: true 
    }).sort({ nom: 1 });

    // Récupérer les catégories globales
    const globalCategories = await (GlobalExpenseCategory as any).find({ 
      isActive: true 
    }).sort({ nom: 1 });

    // Créer un map des codes locaux pour éviter les doublons
    const localCodes = new (Set as any)(localCategories.map(cat => cat.code));

    // Filtrer les catégories globales qui n'ont pas de doublon local
    const filteredGlobalCategories = globalCategories.filter(
      cat => !localCodes.has(cat.code)
    );

    // Combiner les catégories (locales en premier)
    const allCategories = [
      ...localCategories.map(cat => ({
        ...cat.toObject(),
        _source: 'tenant' as const,
      })),
      ...filteredGlobalCategories.map(cat => ({
        ...cat.toObject(),
        _source: 'global' as const,
      })),
    ];

    return NextResponse.json({ data: allCategories });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/expense-categories - Créer une nouvelle catégorie locale
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    await connectDB();

    // Vérifier si la catégorie existe déjà (locale ou globale)
    const existingLocal = await (ExpenseCategory as any).findOne({
      tenantId,
      code: body.code.toUpperCase()
    });

    const existingGlobal = await (GlobalExpenseCategory as any).findOne({
      code: body.code.toUpperCase()
    });

    if (existingLocal || existingGlobal) {
      return NextResponse.json(
        { error: 'Une catégorie avec ce code existe déjà' },
        { status: 400 }
      );
    }

    const categoryData = {
      ...body,
      tenantId,
      code: body.code.toUpperCase(),
      isActive: true,
    };

    const category = new (ExpenseCategory as any)(categoryData);
    await (category as any).save();

    return NextResponse.json(category, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: 'Erreur de validation', details: errors },
        { status: 400 }
      );
    }
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Une catégorie avec ce code existe déjà' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
