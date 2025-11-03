import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/lib/models/Invoice';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    await connectDB();
    
    let query: any = { companyId: session.user.companyId };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    const documents = await (Invoice as any).find(query)
      .populate('customerId', 'name')
      .sort({ createdAt: -1 });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Erreur lors de la récupération des documents:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
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
    const { 
      number, 
      type, 
      customerId, 
      date, 
      dueDate, 
      items, 
      notes, 
      paymentTerms 
    } = body;
    
    await connectDB();
    
    // Vérifier si le numéro de document existe déjà pour cette entreprise
    const existingDocument = await (Invoice as any).findOne({ 
      companyId: session.user.companyId,
      number 
    });
    
    if (existingDocument) {
      return NextResponse.json(
        { error: 'Un document avec ce numéro existe déjà' },
        { status: 400 }
      );
    }

    // Calculer les totaux
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const vatTotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice * item.vatRate / 100), 0);
    const total = subtotal + vatTotal;

    const document = new Invoice({
      number,
      type: type || 'quote',
      customerId,
      companyId: session.user.companyId,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      items: items || [],
      subtotal,
      vatTotal,
      total,
      notes,
      paymentTerms,
      status: 'draft',
      paymentStatus: 'unpaid',
      paidAmount: 0,
    });

    await (document as any).save();

    // Retourner le document avec les informations du client
    const populatedDocument = await (Invoice as any).findById(document._id)
      .populate('customerId', 'name');

    return NextResponse.json(populatedDocument, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création du document:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
