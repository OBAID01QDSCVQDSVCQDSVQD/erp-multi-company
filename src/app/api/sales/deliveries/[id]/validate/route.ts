import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import StockMove from '@/lib/models/StockMove';

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

    const bl = await (Document as any).findOne({ 
      _id: params.id, 
      tenantId, 
      type: 'BL' 
    });

    if (!bl) {
      return NextResponse.json(
        { error: 'Bon de livraison non trouvé' },
        { status: 404 }
      );
    }

    // Create stock moves (OUT)
    const stockMoves = bl.lignes
      .filter((line: any) => line.productId) // Only stocked products
      .map((line: any) => ({
        tenantId,
        type: 'OUT' as const,
        category: 'vente' as const,
        documentId: bl._id.toString(),
        documentType: 'BL',
        documentNumero: bl.numero,
        productId: line.productId,
        designation: line.designation,
        quantite: line.quantite,
        quantiteBase: line.quantite, // TODO: convert via UnitConversionService
        prixUnitaire: line.prixUnitaireHT,
        processedBy: session.user.email
      }));

    if (stockMoves.length > 0) {
      await (StockMove as any).insertMany(stockMoves);
    }

    // Update BL status
    bl.statut = 'livre';
    bl.dateLivraisonReelle = new Date();
    await (bl as any).save();

    return NextResponse.json({ bl, stockMoves }, { status: 200 });
  } catch (error) {
    console.error('Erreur POST /sales/deliveries/:id/validate:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
