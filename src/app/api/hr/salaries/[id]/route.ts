import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Salary from '@/lib/models/Salary';
import { determinePaymentStatus } from '../utils';

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

    const salary = await (Salary as any)
      .findOne({
        _id: params.id,
        tenantId,
      })
      .populate('employeeId', 'firstName lastName employeeNumber position department baseSalary currency paymentMethod');

    if (!salary) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(salary.toObject());
  } catch (error: any) {
    console.error('Error fetching salary:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const {
      paymentStatus,
      paymentDate,
      notes,
      baseSalary,
      dailyRate,
      advances,
      deductionsEnabled,
    } = body;

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

    if (paymentStatus !== undefined) {
      salary.paymentStatus = paymentStatus;
    }
    if (paymentDate !== undefined) {
      salary.paymentDate = paymentDate ? new Date(paymentDate) : null;
    }
    if (notes !== undefined) {
      salary.notes = notes;
    }

    // Update base salary and daily rate
    if (baseSalary !== undefined) {
      salary.baseSalary = baseSalary;
    }
    if (dailyRate !== undefined) {
      salary.dailyRate = dailyRate;
    }

    // Update advances
    if (advances !== undefined) {
      salary.deductions.advances = advances;
      // Recalculate total deductions
      salary.deductions.totalDeductions = 
        (salary.deductions.taxes || 0) +
        (salary.deductions.socialSecurity || 0) +
        (salary.deductions.insurance || 0) +
        advances +
        (salary.deductions.otherDeductions || 0);
      // Recalculate net salary
      salary.netSalary = salary.earnings.totalEarnings - salary.deductions.totalDeductions;
    }

    // Handle automatic deductions toggle
    if (deductionsEnabled !== undefined) {
      salary.deductionsEnabled = deductionsEnabled;
      const earningsTotal = salary.earnings.totalEarnings || 0;
      if (deductionsEnabled) {
        salary.deductions.taxes = earningsTotal * 0.1;
        salary.deductions.socialSecurity = earningsTotal * 0.09;
      } else {
        salary.deductions.taxes = 0;
        salary.deductions.socialSecurity = 0;
      }
      salary.deductions.totalDeductions =
        (salary.deductions.taxes || 0) +
        (salary.deductions.socialSecurity || 0) +
        (salary.deductions.insurance || 0) +
        (salary.deductions.advances || 0) +
        (salary.deductions.otherDeductions || 0);
      salary.netSalary = salary.earnings.totalEarnings - salary.deductions.totalDeductions;
    }

    // If base salary or daily rate changed, recalculate earnings
    if (baseSalary !== undefined || dailyRate !== undefined) {
      const finalBaseSalary = baseSalary !== undefined ? baseSalary : salary.baseSalary;
      const finalDailyRate = dailyRate !== undefined ? dailyRate : salary.dailyRate;
      const daysInMonth = salary.totalDays;
      
      // Recalculate base salary earning based on worked days
      salary.earnings.baseSalary = (finalBaseSalary / daysInMonth) * salary.workedDays;
      salary.earnings.totalEarnings = 
        salary.earnings.baseSalary +
        (salary.earnings.overtimePay || 0) +
        (salary.earnings.bonuses || 0) +
        (salary.earnings.allowances || 0) +
        (salary.earnings.otherEarnings || 0);
      
      // Recalculate deductions if needed
      if (deductionsEnabled === undefined && advances === undefined) {
        salary.deductions.totalDeductions = 
          (salary.deductions.taxes || 0) +
          (salary.deductions.socialSecurity || 0) +
          (salary.deductions.insurance || 0) +
          (salary.deductions.advances || 0) +
          (salary.deductions.otherDeductions || 0);
      }
      
      // Recalculate net salary
      salary.netSalary = salary.earnings.totalEarnings - salary.deductions.totalDeductions;
    }

    salary.paymentStatus = determinePaymentStatus(
      salary.netSalary || 0,
      salary.deductions?.advances || 0
    );

    await salary.save();
    await salary.populate('employeeId', 'firstName lastName employeeNumber position department');

    return NextResponse.json(salary.toObject());
  } catch (error: any) {
    console.error('Error updating salary:', error);
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

    const salary = await (Salary as any).findOneAndDelete({
      _id: params.id,
      tenantId,
    });

    if (!salary) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Salaire supprimé avec succès' });
  } catch (error: any) {
    console.error('Error deleting salary:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

