import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const body = await request.json();
    const { amount, date, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Le montant doit être supérieur à 0' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'La date est requise' },
        { status: 400 }
      );
    }

    const salary = await (Salary as any).findOne({
      _id: params.id,
      tenantId,
    });

    if (!salary) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      );
    }

    // Initialize advancesList if it doesn't exist
    if (!salary.deductions.advancesList) {
      salary.deductions.advancesList = [];
    }

    // Add new advance
    salary.deductions.advancesList.push({
      amount: parseFloat(amount),
      date: new Date(date),
      notes: notes || undefined,
    });

    // Recalculate total advances
    salary.deductions.advances = salary.deductions.advancesList.reduce(
      (sum: number, advance: any) => sum + advance.amount,
      0
    );

    // Recalculate total deductions
    salary.deductions.totalDeductions =
      (salary.deductions.taxes || 0) +
      (salary.deductions.socialSecurity || 0) +
      (salary.deductions.insurance || 0) +
      salary.deductions.advances +
      (salary.deductions.otherDeductions || 0);

    // Recalculate net salary
    salary.netSalary = salary.earnings.totalEarnings - salary.deductions.totalDeductions;

    await salary.save();

    return NextResponse.json(salary.toObject());
  } catch (error: any) {
    console.error('Error adding advance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const body = await request.json();
    const { index } = body;

    if (index === undefined || index === null) {
      return NextResponse.json(
        { error: 'Index requis' },
        { status: 400 }
      );
    }

    const salary = await (Salary as any).findOne({
      _id: params.id,
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

    if (index < 0 || index >= salary.deductions.advancesList.length) {
      return NextResponse.json(
        { error: 'Index invalide' },
        { status: 400 }
      );
    }

    // Remove advance at index
    salary.deductions.advancesList.splice(index, 1);

    // Recalculate total advances
    salary.deductions.advances = salary.deductions.advancesList.reduce(
      (sum: number, advance: any) => sum + advance.amount,
      0
    );

    // Recalculate total deductions
    salary.deductions.totalDeductions =
      (salary.deductions.taxes || 0) +
      (salary.deductions.socialSecurity || 0) +
      (salary.deductions.insurance || 0) +
      salary.deductions.advances +
      (salary.deductions.otherDeductions || 0);

    // Recalculate net salary
    salary.netSalary = salary.earnings.totalEarnings - salary.deductions.totalDeductions;

    await salary.save();

    return NextResponse.json(salary.toObject());
  } catch (error: any) {
    console.error('Error deleting advance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

