import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import TaxRate from '@/lib/models/TaxRate';
import Product from '@/lib/models/Product';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = session.user.companyId?.toString() || '';
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    await connectDB();

    // Récupérer les taux de TVA
    const taxRates = await (TaxRate as any).find({ tenantId, actif: true });
    const taxMap: { [key: string]: number } = {};
    taxRates.forEach(rate => {
      taxMap[rate.code] = rate.tauxPct;
    });

    // Trouver tous les produits sans tvaPct
    const products = await (Product as any).find({ 
      tenantId, 
      taxCode: { $exists: true, $ne: null, $nin: [''] },
      $or: [
        { tvaPct: { $exists: false } },
        { tvaPct: null }
      ]
    });

    let updated = 0;
    for (const product of products) {
      if (product.taxCode && taxMap[product.taxCode] !== undefined) {
        await (Product as any).updateOne(
          { _id: product._id },
          { $set: { tvaPct: taxMap[product.taxCode] } }
        );
        updated++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      total: products.length, 
      updated 
    });

  } catch (error) {
    console.error('Erreur fix-products-tva:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

