import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

// GET /api/reports/expenses/by-company - Rapport des dépenses par entreprise
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

    // Agrégation par entreprise (tenant)
    const companyExpenses = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
          statut: { $in: ['valide', 'paye'] }
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'tenantId',
          foreignField: '_id',
          as: 'company'
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
            tenantId: '$tenantId',
            companyName: { $first: '$company.name' }
          },
          totalMontant: { $sum: '$montant' },
          nombreDepenses: { $sum: 1 },
          montantTVA: { $sum: { $multiply: ['$montant', { $divide: ['$tvaPct', 100] }] } },
          categories: {
            $push: {
              categorieId: '$categorieId',
              categorieNom: '$categorie.nom',
              montant: '$montant'
            }
          },
          modesPaiement: {
            $push: {
              mode: '$modePaiement',
              montant: '$montant'
            }
          }
        }
      },
      {
        $addFields: {
          categoriesGrouped: {
            $reduce: {
              input: '$categories',
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $in: [
                          '$$this.categorieId',
                          '$$value.categorieId'
                        ]
                      },
                      [],
                      [{
                        categorieId: '$$this.categorieId',
                        categorieNom: '$$this.categorieNom',
                        montant: '$$this.montant'
                      }]
                    ]
                  }
                ]
              }
            }
          },
          modesPaiementGrouped: {
            $reduce: {
              input: '$modesPaiement',
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $in: [
                          '$$this.mode',
                          '$$value.mode'
                        ]
                      },
                      [],
                      [{
                        mode: '$$this.mode',
                        montant: '$$this.montant'
                      }]
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      {
        $sort: { totalMontant: -1 }
      }
    ]);

    // Statistiques par statut
    const statusStats = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$statut',
          count: { $sum: 1 },
          totalMontant: { $sum: '$montant' }
        }
      },
      {
        $sort: { totalMontant: -1 }
      }
    ]);

    // Statistiques par mode de paiement
    const paymentModeStats = await (Expense as any).aggregate([
      {
        $match: {
          tenantId,
          date: { $gte: startDate, $lte: endDate },
          statut: { $in: ['valide', 'paye'] }
        }
      },
      {
        $group: {
          _id: '$modePaiement',
          count: { $sum: 1 },
          totalMontant: { $sum: '$montant' }
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
      companyExpenses,
      statusStats,
      paymentModeStats,
      resume: {
        totalDepenses: companyExpenses.reduce((sum, company) => sum + company.totalMontant, 0),
        nombreTotalDepenses: companyExpenses.reduce((sum, company) => sum + company.nombreDepenses, 0),
        totalTVA: companyExpenses.reduce((sum, company) => sum + company.montantTVA, 0)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport par entreprise:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
