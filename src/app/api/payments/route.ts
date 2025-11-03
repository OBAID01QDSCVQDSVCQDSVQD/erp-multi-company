import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reglement from '@/lib/models/Reglement';
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
    const type = searchParams.get('type'); // client or fournisseur
    const documentId = searchParams.get('documentId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId };
    
    if (type) query.type = type;
    if (documentId) query.documentId = documentId;

    const payments = await (Reglement as any).find(query)
      .sort('-datePaiement')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Reglement as any).countDocuments(query);

    return NextResponse.json({ items: payments, total });
  } catch (error) {
    console.error('Erreur GET /payments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Find related document
    const document = await (Document as any).findOne({ 
      _id: body.documentId, 
      tenantId 
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    // Determine type and sens
    const type = body.type || (document.customerId ? 'client' : 'fournisseur');
    const sens = body.sens || (type === 'client' ? 'entree' : 'sortie');

    const payment = new Reglement({
      ...body,
      tenantId,
      type,
      sens,
      processedBy: session.user.email
    });

    await (payment as any).save();

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /payments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
