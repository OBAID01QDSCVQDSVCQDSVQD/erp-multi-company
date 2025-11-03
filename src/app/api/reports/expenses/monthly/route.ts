import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import ExpenseCategory from '@/lib/models/ExpenseCategory';

// GET /api/reports/expenses/monthly - Rapport mensuel des dépenses
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = session.user.companyId;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    await connectDB();

    // Dates par défaut (6 derniers mois)
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    // Agrégation par catégorie et par mois
    const monthlyExpenses = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
          statut: { $in: ['valide', 'paye'] }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: 'categorieId',
          foreignField: '_id',
          as: 'categorie'
        }
      },
      {
        $unwind: '$categorie'
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            categorieId: '$categorieId',
            categorieNom: '$categorie.nom',
            categorieCode: '$categorie.code'
          },
          totalMontant: { $sum: '$montant' },
          nombreDepenses: { $sum: 1 },
          montantTVA: { $sum: { $multiply: ['$montant', { $divide: ['$tvaPct', 100] }] } }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.categorieNom': 1
        }
      }
    ]);

    // Agrégation globale par mois
    const monthlyTotals = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
          statut: { $in: ['valide', 'paye'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalMontant: { $sum: '$montant' },
          nombreDepenses: { $sum: 1 },
          montantTVA: { $sum: { $multiply: ['$montant', { $divide: ['$tvaPct', 100] }] } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Agrégation par catégorie (total)
    const categoryTotals = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
          statut: { $in: ['valide', 'paye'] }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: 'categorieId',
          foreignField: '_id',
          as: 'categorie'
        }
      },
      {
        $unwind: '$categorie'
      },
      {
        $group: {
          _id: {
            categorieId: '$categorieId',
            categorieNom: '$categorie.nom',
            categorieCode: '$categorie.code'
          },
          totalMontant: { $sum: '$montant' },
          nombreDepenses: { $sum: 1 },
          montantTVA: { $sum: { $multiply: ['$montant', { $divide: ['$tvaPct', 100] }] } }
        }
      },
      {
        $sort: { totalMontant: -1 }
      }
    ]);

    return NextResponse.json({
      periode: {
        from: startDate,
        to: endDate
      },
      monthlyExpenses,
      monthlyTotals,
      categoryTotals,
      resume: {
        totalDepenses: monthlyTotals.reduce((sum, month) => sum + month.totalMontant, 0),
        nombreTotalDepenses: monthlyTotals.reduce((sum, month) => sum + month.nombreDepenses, 0),
        totalTVA: monthlyTotals.reduce((sum, month) => sum + month.montantTVA, 0)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport mensuel:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
