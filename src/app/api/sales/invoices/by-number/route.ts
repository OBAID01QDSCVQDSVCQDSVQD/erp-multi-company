import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const numero = searchParams.get('numero');
    const query = searchParams.get('q');

    if (!numero && !query) {
      return NextResponse.json(
        { error: 'Un numéro ou une recherche est requis' },
        { status: 400 }
      );
    }

    if (query) {
      const searchRegex = new RegExp(query, 'i');
      const invoices = await (Document as any)
        .find({
          tenantId,
          type: 'FAC',
          numero: { $regex: searchRegex },
        })
        .sort({ numero: -1 })
        .limit(10)
        .select('numero customerId dateDoc totalTTC devise statut')
        .lean();

      return NextResponse.json({ items: invoices });
    }

    const invoice = await (Document as any)
      .findOne({ tenantId, type: 'FAC', numero })
      .lean();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur GET /sales/invoices/by-number:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

