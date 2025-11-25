import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const projects = await (Project as any)
      .find({ tenantId })
      .select('budget totalCost profit profitMargin')
      .lean();

    const totalBudget = projects.reduce((sum: number, project: any) => sum + (project.budget || 0), 0);
    const totalCostTTC = projects.reduce((sum: number, project: any) => sum + (project.totalCost || 0), 0);
    const profit = totalBudget - totalCostTTC;
    const profitMargin = totalBudget > 0 ? (profit / totalBudget) * 100 : 0;

    return NextResponse.json({
      totalBudget,
      totalCostTTC,
      profit,
      profitMargin,
    });
  } catch (error) {
    console.error('Error fetching project summary:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

