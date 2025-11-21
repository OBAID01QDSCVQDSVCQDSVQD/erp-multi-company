import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import Counter from '@/lib/models/Counter';
import mongoose from 'mongoose';

// GET /api/expenses - Récupérer les dépenses avec filtres
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = session.user.companyId;
    
    // Filtres
    const periode = searchParams.get('periode');
    const categorieId = searchParams.get('categorieId');
    const statut = searchParams.get('statut');
    const projetId = searchParams.get('projetId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    await connectDB();

    // Construction du filtre
    const filter: any = { tenantId };
    
    if (periode) {
      const [startDate, endDate] = periode.split(',');
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (categorieId) {
      filter.categorieId = categorieId;
    }
    
    if (statut) {
      filter.statut = statut;
    }
    
    if (projetId) {
      filter.projetId = projetId;
    }

    // Récupération des dépenses avec pagination
    const expenses = await (Expense as any).find(filter)
      .populate('categorieId', 'nom code icone')
      .populate('fournisseurId', 'name')
      .populate('employeId', 'firstName lastName')
      .populate('projetId', 'name')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await (Expense as any).countDocuments(filter);

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des dépenses:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/expenses - Créer une nouvelle dépense
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = session.user.companyId;
    const societeId = session.user.companyId; // Use companyId as societeId
    
    console.log('POST /api/expenses - Body received:', JSON.stringify(body, null, 2));
    console.log('POST /api/expenses - TenantId:', tenantId);

    await connectDB();

    // Génération du numéro séquentiel
    const currentYear = new Date().getFullYear();
    const counter = await (Counter as any).findOneAndUpdate(
      { tenantId, seqName: 'expense' },
      { $inc: { value: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const numero = `EXP-${currentYear}-${counter.value.toString().padStart(5, '0')}`;

    // Création de la dépense
    // Remove societeId from body if present, and set it from session
    const { societeId: _, description, ...bodyWithoutSocieteId } = body;
    
    // Build expenseData, only include description if it's not empty
    const expenseData: any = {
      ...bodyWithoutSocieteId,
      tenantId,
      societeId: new mongoose.Types.ObjectId(societeId),
      numero,
      createdBy: session.user.id,
    };
    
    // Only add description if it's not empty
    if (description && description.trim() !== '') {
      expenseData.description = description.trim();
    }

    const expense = new (Expense as any)(expenseData);
    await (expense as any).save();

    // Populate pour la réponse
    await (expense as any).populate([
      { path: 'categorieId', select: 'nom code icone' },
      { path: 'fournisseurId', select: 'name' },
      { path: 'employeId', select: 'firstName lastName' },
      { path: 'projetId', select: 'name' }
    ]);

    return NextResponse.json(expense, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création de la dépense:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
