import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

// GET /api/reports/expenses/by-project - Rapport des dépenses par projet
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
    const isDeclaredParam = searchParams.get('isDeclared');

    await connectDB();

    // Dates par défaut (6 derniers mois)
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    // Construction du filtre de base
    const baseMatch: any = {
      tenantId,
      date: { $gte: startDate, $lte: endDate },
      statut: { $in: ['valide', 'paye'] }
    };

    if (isDeclaredParam === 'true') {
      baseMatch.isDeclared = true;
    } else if (isDeclaredParam === 'false') {
      baseMatch.isDeclared = false;
    }

    // Agrégation par projet
    const projectExpenses = await (Expense as any).aggregate([
      {
        $match: {
          ...baseMatch,
          projetId: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projetId',
          foreignField: '_id',
          as: 'projet'
        }
      },
      {
        $unwind: '$projet'
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
            projetId: '$projetId',
            projetNom: '$projet.name',
            projetCode: '$projet.code'
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
          }
        }
      },
      {
        $sort: { totalMontant: -1 }
      }
    ]);

    // Dépenses sans projet
    const noProjectExpenses = await (Expense as any).aggregate([
      {
        $match: {
          ...baseMatch,
          $or: [
            { projetId: { $exists: false } },
            { projetId: null }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalMontant: { $sum: '$montant' },
          nombreDepenses: { $sum: 1 },
          montantTVA: { $sum: { $multiply: ['$montant', { $divide: ['$tvaPct', 100] }] } }
        }
      }
    ]);

    return NextResponse.json({
      periode: {
        from: startDate,
        to: endDate
      },
      projectExpenses,
      noProjectExpenses: noProjectExpenses[0] || { totalMontant: 0, nombreDepenses: 0, montantTVA: 0 },
      resume: {
        totalDepenses: projectExpenses.reduce((sum, project) => sum + project.totalMontant, 0) +
          (noProjectExpenses[0]?.totalMontant || 0),
        nombreTotalDepenses: projectExpenses.reduce((sum, project) => sum + project.nombreDepenses, 0) +
          (noProjectExpenses[0]?.nombreDepenses || 0)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport par projet:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
