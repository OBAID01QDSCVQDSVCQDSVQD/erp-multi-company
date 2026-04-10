import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> | { id: string; index: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';
    const resolvedParams = await Promise.resolve(params);
    const salaryId = resolvedParams.id;
    const advanceIndex = parseInt(resolvedParams.index);

    if (isNaN(advanceIndex) || advanceIndex < 0) {
      return NextResponse.json(
        { error: 'Index invalide' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { isRepaid } = body;

    if (typeof isRepaid !== 'boolean') {
      return NextResponse.json(
        { error: 'isRepaid doit être un booléen' },
        { status: 400 }
      );
    }

    const salary = await (Salary as any).findOne({
      _id: salaryId,
      tenantId,
    });

    if (!salary) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      );
    }

    if (!salary.deductions.advancesList || salary.deductions.advancesList.length === 0) {
      return NextResponse.json(
        { error: 'Aucune avance trouvée' },
        { status: 404 }
      );
    }

    if (advanceIndex >= salary.deductions.advancesList.length) {
      return NextResponse.json(
        { error: 'Index invalide' },
        { status: 400 }
      );
    }

    // Mettre à jour l'avance
    const advance = salary.deductions.advancesList[advanceIndex];
    advance.isRepaid = isRepaid;
    
    if (isRepaid) {
      advance.repaidBy = session.user.name || session.user.email || 'Unknown';
      advance.repaidAt = new Date();
    } else {
      advance.repaidBy = undefined;
      advance.repaidAt = undefined;
    }

    await salary.save();

    return NextResponse.json(salary.toObject());
  } catch (error: any) {
    console.error('Error updating advance status:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
