import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    const creditNote = await (Document as any)
      .findOne({ _id: id, tenantId, type: 'AVOIR' })
      .lean();

    if (!creditNote) {
      return NextResponse.json(
        { error: 'Avoir introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...creditNote,
      linkedInvoices: creditNote.linkedDocuments || [],
    });
  } catch (error) {
    console.error('Erreur GET /sales/credit-notes/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

