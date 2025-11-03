import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reglement from '@/lib/models/Reglement';

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

    const payment = await (Reglement as any).findOne({ 
      _id: params.id, 
      tenantId 
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      );
    }

    // Create reversal payment
    const reversal = new (Reglement as any)({
      tenantId,
      type: payment.type,
      sens: payment.sens === 'entree' ? 'sortie' : 'entree',
      customerId: payment.customerId,
      supplierId: payment.supplierId,
      documentId: payment.documentId,
      montant: payment.montant,
      devise: payment.devise,
      modePaiement: payment.modePaiement,
      datePaiement: new Date(),
      notes: `Annulation du paiement ${payment._id}`,
      processedBy: session.user.email
    });

    await (reversal as any).save();

    return NextResponse.json({ 
      message: 'Paiement annulé', 
      original: payment, 
      reversal 
    });
  } catch (error) {
    console.error('Erreur POST /payments/:id/void:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
