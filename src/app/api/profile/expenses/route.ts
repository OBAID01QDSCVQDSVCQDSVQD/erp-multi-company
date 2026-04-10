import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Salary from '@/lib/models/Salary';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// GET /api/profile/expenses - Récupérer les dépenses et avances de l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';
    const userId = session.user.id;
    const userRole = session.user.role;
    const userPermissions = session.user.permissions || [];

    // Vérifier si l'utilisateur est admin
    const isAdmin = userRole === 'admin' || userPermissions.includes('all');

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const type = searchParams.get('type') || 'all'; // 'expenses' | 'advances' | 'all'

    // Ensure models are registered
    if (!(mongoose.models as any)['ExpenseCategory']) {
      const ExpenseCategoryModel = await import('@/lib/models/ExpenseCategory');
      void ExpenseCategoryModel.default;
    }
    if (!(mongoose.models as any)['User']) {
      const UserModel = await import('@/lib/models/User');
      void UserModel.default;
    }

    const results: any = {
      expenses: [],
      advances: [],
      statistics: {
        totalExpenses: 0,
        totalAdvances: 0,
        completedExpenses: 0,
        completedAdvances: 0,
        pendingAdvances: 0,
      },
      isAdmin, // Ajouter cette info pour le frontend
    };

    // Récupérer les dépenses
    if (type === 'all' || type === 'expenses') {
      const expenseFilter: any = {
        tenantId,
      };

      // Si l'utilisateur n'est pas admin, filtrer seulement ses dépenses
      if (!isAdmin) {
        expenseFilter.createdBy = new mongoose.Types.ObjectId(userId);
      }

      // Filtrer par mois si spécifié
      if (month) {
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        expenseFilter.date = {
          $gte: startDate,
          $lte: endDate,
        };
      }

      const expenses = await (Expense as any)
        .find(expenseFilter)
        .populate({
          path: 'categorieId',
          select: 'nom code icone',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'createdBy',
          select: 'firstName lastName email',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'approvedBy',
          select: 'firstName lastName',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'paidBy',
          select: 'firstName lastName',
          options: { strictPopulate: false }
        })
        .sort({ date: -1, createdAt: -1 })
        .lean();

      results.expenses = expenses || [];

      // Calculer les statistiques des dépenses
      results.statistics.totalExpenses = expenses
        .filter((exp: any) => exp.statut !== 'rejete')
        .reduce(
          (sum: number, exp: any) => sum + (exp.totalTTC || exp.montant || 0),
          0
        );
      results.statistics.completedExpenses = expenses
        .filter((exp: any) => exp.statut === 'paye' || exp.statut === 'valide')
        .reduce((sum: number, exp: any) => sum + (exp.totalTTC || exp.montant || 0), 0);
    }

    // Récupérer les avances
    if (type === 'all' || type === 'advances') {
      const salaryFilter: any = {
        tenantId,
      };

      let currentUserEmployeeId: any = null;

      // Si l'utilisateur n'est pas admin, on cherche ses propres avances (soit créées par lui, soit pour lui)
      if (!isAdmin) {
        // ESSENTIEL : Sur production (Fly.io), l'ID utilisateur peut différer de l'ID employé.
        // On cherche l'employé correspondant à l'email de l'utilisateur.
        const Employee = (mongoose.models as any)['Employee'] || (await import('@/lib/models/Employee')).default;
        const employee = await Employee.findOne({
          tenantId,
          email: session.user.email
        }).lean();

        if (employee) {
          currentUserEmployeeId = employee._id;
          salaryFilter.employeeId = currentUserEmployeeId;
        } else {
          // Si on ne trouve pas d'employé avec cet email, on tente avec l'userId (fallback)
          currentUserEmployeeId = new mongoose.Types.ObjectId(userId);
          salaryFilter.employeeId = currentUserEmployeeId;
        }
      }

      // Filtrer par mois/année
      if (month) {
        salaryFilter['period.month'] = month;
      }
      salaryFilter['period.year'] = year;

      const salaries = await (Salary as any)
        .find(salaryFilter)
        .populate('employeeId', 'firstName lastName')
        .lean();

      // Extraire les avances
      const allAdvances: any[] = [];
      salaries.forEach((salary: any) => {
        if (salary.deductions?.advancesList && Array.isArray(salary.deductions.advancesList)) {
          salary.deductions.advancesList.forEach((advance: any, index: number) => {
            allAdvances.push({
              ...advance,
              salaryId: salary._id,
              advanceIndex: index,
              employeeId: salary.employeeId,
              period: salary.period,
              currency: salary.currency || 'TND',
            });
          });
        }
      });

      // Si l'utilisateur n'est pas admin, il peut aussi avoir créé des avances pour d'autres
      if (!isAdmin) {
        const otherSalaryFilter: any = {
          tenantId,
          employeeId: { $ne: currentUserEmployeeId },
          'period.year': year,
          $or: [
            { 'deductions.advancesList.createdBy': session.user.name },
            { 'deductions.advancesList.createdBy': session.user.email }
          ]
        };

        if (month) {
          otherSalaryFilter['period.month'] = month;
        }

        const otherSalaries = await (Salary as any)
          .find(otherSalaryFilter)
          .populate('employeeId', 'firstName lastName')
          .lean();

        otherSalaries.forEach((salary: any) => {
          salary.deductions.advancesList.forEach((advance: any, index: number) => {
            if (advance.createdBy === session.user.name || advance.createdBy === session.user.email) {
              allAdvances.push({
                ...advance,
                salaryId: salary._id,
                advanceIndex: index,
                employeeId: salary.employeeId,
                period: salary.period,
                currency: salary.currency || 'TND',
              });
            }
          });
        });
      }

      // Trier par date
      allAdvances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      results.advances = allAdvances;

      // Calculer les statistiques des avances
      results.statistics.totalAdvances = allAdvances.reduce((sum: number, adv: any) => sum + (adv.amount || 0), 0);
      results.statistics.completedAdvances = allAdvances
        .filter((adv: any) => adv.isRepaid === true)
        .reduce((sum: number, adv: any) => sum + (adv.amount || 0), 0);
      results.statistics.pendingAdvances = allAdvances
        .filter((adv: any) => adv.isRepaid !== true)
        .reduce((sum: number, adv: any) => sum + (adv.amount || 0), 0);
    }

    // --- NOUVEAU : Calculer les totaux IMPAYÉS GLOBAUX (tous les mois/années) ---
    const globalUnpaid: any = { expenses: 0, advances: 0, total: 0 };

    // 1. Dépenses impayées globales
    const unpaidExpenseFilter: any = {
      tenantId,
      statut: { $nin: ['paye', 'valide', 'rejete'] }
    };
    if (!isAdmin) {
      unpaidExpenseFilter.createdBy = new mongoose.Types.ObjectId(userId);
    }
    const allUnpaidExpenses = await (Expense as any).find(unpaidExpenseFilter).lean();
    globalUnpaid.expenses = allUnpaidExpenses.reduce((sum: number, exp: any) => sum + (exp.totalTTC || exp.montant || 0), 0);

    // 2. Avances impayées globales
    const unpaidSalaryFilter: any = { tenantId };
    if (!isAdmin) {
      const Employee = (mongoose.models as any)['Employee'] || (await import('@/lib/models/Employee')).default;
      const employee = await Employee.findOne({ tenantId, email: session.user.email }).lean();
      if (employee) unpaidSalaryFilter.employeeId = employee._id;
      else unpaidSalaryFilter.employeeId = new mongoose.Types.ObjectId(userId);
    }

    const allUnpaidSalaries = await (Salary as any).find(unpaidSalaryFilter).lean();
    allUnpaidSalaries.forEach((salary: any) => {
      if (salary.deductions?.advancesList) {
        salary.deductions.advancesList.forEach((adv: any) => {
          if (adv.isRepaid !== true) {
            // Si non admin, on vérifie que c'est bien son avance (soit pour lui via employeeId, soit créée par lui)
            const isCreatedByMe = adv.createdBy === session.user.name || adv.createdBy === session.user.email;
            if (isAdmin || isCreatedByMe || String(salary.employeeId) === String(unpaidSalaryFilter.employeeId)) {
              globalUnpaid.advances += (adv.amount || 0);
            }
          }
        });
      }
    });

    globalUnpaid.total = globalUnpaid.expenses + globalUnpaid.advances;
    results.globalUnpaid = globalUnpaid;

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des dépenses utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
