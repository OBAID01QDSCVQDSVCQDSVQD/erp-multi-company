import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';

export class StockService {
  /**
   * Crée un mouvement de stock
   */
  static async createMouvementStock(data: {
    societeId: string;
    productId: string;
    type: 'ENTREE' | 'SORTIE' | 'INVENTAIRE' | 'AJUSTEMENT';
    qte: number;
    date?: Date;
    source: 'BR' | 'BL' | 'INV' | 'AJUST' | 'RETOUR' | 'PERDU' | 'CASSÉ';
    sourceId?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<any> {
    await connectDB();

    const mouvement = new MouvementStock({
      ...data,
      date: data.date || new Date()
    });

    return await (mouvement as any).save();
  }

  /**
   * Calcule le stock courant d'un produit
   */
  static async getStockCourant(societeId: string, productId: string): Promise<number> {
    await connectDB();

    const result = await (MouvementStock as any).aggregate([
      {
        $match: {
          societeId,
          productId
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $in: ['$type', ['ENTREE', 'INVENTAIRE']] },
                '$qte',
                { $multiply: ['$qte', -1] }
              ]
            }
          }
        }
      }
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  /**
   * Calcule le stock courant pour plusieurs produits
   */
  static async getStocksCourants(societeId: string, productIds: string[]): Promise<{ [productId: string]: number }> {
    await connectDB();

    const result = await (MouvementStock as any).aggregate([
      {
        $match: {
          societeId,
          productId: { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$productId',
          total: {
            $sum: {
              $cond: [
                { $in: ['$type', ['ENTREE', 'INVENTAIRE']] },
                '$qte',
                { $multiply: ['$qte', -1] }
              ]
            }
          }
        }
      }
    ]);

    const stocks: { [key: string]: number } = {};
    result.forEach((item: any) => {
      stocks[item._id] = item.total;
    });

    // Ajouter 0 pour les produits sans mouvement
    productIds.forEach(id => {
      if (!(id in stocks)) {
        stocks[id] = 0;
      }
    });

    return stocks;
  }

  /**
   * Récupère l'historique des mouvements d'un produit
   */
  static async getHistoriqueMouvements(
    societeId: string,
    productId: string,
    limit: number = 50
  ): Promise<any[]> {
    await connectDB();

    return await (MouvementStock as any)
      .find({ societeId, productId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

