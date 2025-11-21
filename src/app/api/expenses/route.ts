import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import Counter from '@/lib/models/Counter';
import mongoose from 'mongoose';

// Force dynamic rendering since we use getServerSession which uses headers()
export const dynamic = 'force-dynamic';

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

    // Ensure ExpenseCategory model is registered before using populate
    // The import at the top should register it, but we verify it's available
    if (!(mongoose.models as any)['ExpenseCategory']) {
      // Force registration by accessing the default export
      const ExpenseCategoryModel = await import('@/lib/models/ExpenseCategory');
      // Access the default export to ensure it's registered
      void ExpenseCategoryModel.default;
    }

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

    // Ensure ExpenseCategory model is registered before using populate
    // The import at the top should register it, but we verify it's available
    if (!(mongoose.models as any)['ExpenseCategory']) {
      // Force registration by accessing the default export
      const ExpenseCategoryModel = await import('@/lib/models/ExpenseCategory');
      // Access the default export to ensure it's registered
      void ExpenseCategoryModel.default;
    }

    // Génération du numéro séquentiel
    const currentYear = new Date().getFullYear();
    const counter = await (Counter as any).findOneAndUpdate(
      { tenantId, seqName: 'expense' },
      { $inc: { value: 1 }, $setOnInsert: { value: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Ensure counter.value exists and is a number
    const counterValue = counter?.value ?? 0;
    let numero = `EXP-${currentYear}-${counterValue.toString().padStart(5, '0')}`;

    // Check if numero already exists for this tenant (retry if needed)
    let existingExpense = await (Expense as any).findOne({ tenantId, numero });
    if (existingExpense) {
      // If numero exists, increment counter and try again
      const newCounter = await (Counter as any).findOneAndUpdate(
        { tenantId, seqName: 'expense' },
        { $inc: { value: 1 } },
        { new: true }
      );
      const newCounterValue = newCounter?.value ?? counterValue + 1;
      numero = `EXP-${currentYear}-${newCounterValue.toString().padStart(5, '0')}`;
    }

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
    
    try {
      await (expense as any).save();
    } catch (saveError: any) {
      // Handle duplicate key error (E11000)
      if (saveError.code === 11000 || saveError.message?.includes('duplicate key')) {
        // Retry with incremented counter
        const retryCounter = await (Counter as any).findOneAndUpdate(
          { tenantId, seqName: 'expense' },
          { $inc: { value: 1 } },
          { new: true }
        );
        const retryCounterValue = retryCounter?.value ?? counterValue + 1;
        numero = `EXP-${currentYear}-${retryCounterValue.toString().padStart(5, '0')}`;
        expenseData.numero = numero;
        
        // Try saving again with new numero
        const retryExpense = new (Expense as any)(expenseData);
        await (retryExpense as any).save();
        
        // Populate for response
        await (retryExpense as any).populate([
          { path: 'categorieId', select: 'nom code icone' },
          { path: 'fournisseurId', select: 'name' },
          { path: 'employeId', select: 'firstName lastName' },
          { path: 'projetId', select: 'name' }
        ]);
        
        return NextResponse.json(retryExpense, { status: 201 });
      }
      throw saveError; // Re-throw if it's not a duplicate key error
    }

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
