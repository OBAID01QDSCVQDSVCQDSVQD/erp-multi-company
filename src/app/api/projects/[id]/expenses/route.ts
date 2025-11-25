import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Project from '@/lib/models/Project';
import Expense from '@/lib/models/Expense';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import Supplier from '@/lib/models/Supplier';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantIdFromHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdFromHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: 'Identifiant projet invalide' },
        { status: 400 }
      );
    }

    const projectObjectId = new mongoose.Types.ObjectId(params.id);

    // Ensure referenced models are registered before populate
    if (!mongoose.models.ExpenseCategory) {
      void ExpenseCategory;
    }
    if (!mongoose.models.Supplier) {
      void Supplier;
    }

    const project = await (Project as any).findOne({
      _id: projectObjectId,
      tenantId,
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    // Get expenses for this project
    const expenses = await (Expense as any)
      .find({
        tenantId,
        projetId: projectObjectId,
      })
      .populate({
        path: 'categorieId',
        select: 'nom',
        model: ExpenseCategory,
      })
      .populate({
        path: 'fournisseurId',
        select: 'nom raisonSociale',
        model: Supplier,
      })
      .sort('-date')
      .lean();

    const total = expenses.reduce(
      (sum: number, exp: any) => sum + (exp.totalTTC ?? exp.totalHT ?? 0),
      0
    );

    return NextResponse.json({
      expenses,
      total,
    });
  } catch (error: any) {
    console.error('Error fetching project expenses:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

