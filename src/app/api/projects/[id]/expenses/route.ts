import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import Expense from '@/lib/models/Expense';

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
    const tenantId = session.user.companyId?.toString() || '';

    const project = await (Project as any).findOne({
      _id: params.id,
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
        projetId: params.id,
      })
      .populate('categorieId', 'nom')
      .populate('fournisseurId', 'nom raisonSociale')
      .sort('-date')
      .lean();

    return NextResponse.json({
      expenses,
      total: expenses.reduce((sum: number, exp: any) => sum + (exp.totalHT || 0), 0),
    });
  } catch (error: any) {
    console.error('Error fetching project expenses:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

