import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import mongoose from 'mongoose';

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

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const { id } = await params;

    const retour = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'RETOUR',
    }).lean();

    if (!retour) {
      return NextResponse.json(
        { error: 'Bon de retour non trouvé' },
        { status: 404 }
      );
    }

    // Populate customer info (similar to list route)
    if (retour.customerId) {
      const Customer = (await import('@/lib/models/Customer')).default;
      try {
        const customer = await (Customer as any).findOne({
          _id:
            typeof retour.customerId === 'string'
              ? new mongoose.Types.ObjectId(retour.customerId)
              : retour.customerId,
          tenantId,
        })
          .select('nom prenom raisonSociale')
          .lean();

        if (customer) {
          retour.customerId = customer;
        }
      } catch (error) {
        console.error('Error fetching customer for return:', error);
      }
    }

    // Populate BL numero
    if (retour.blId) {
      try {
        const blDoc = await (Document as any).findOne({
          _id:
            typeof retour.blId === 'string'
              ? new mongoose.Types.ObjectId(retour.blId)
              : retour.blId,
          tenantId,
          type: 'BL',
        })
          .select('numero')
          .lean();

        if (blDoc) {
          (retour as any).blNumero = blDoc.numero;
        }
      } catch (error) {
        console.error('Error fetching BL for return:', error);
      }
    }

    return NextResponse.json(retour);
  } catch (error) {
    console.error('Erreur GET /sales/returns/:id:', error);
    const errorMessage = (error as Error).message || 'Erreur lors de la récupération du retour';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const { id } = await params;

    const retour = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'RETOUR',
    });

    if (!retour) {
      return NextResponse.json(
        { error: 'Bon de retour non trouvé' },
        { status: 404 }
      );
    }

    // NOTE: pour le moment، نحذف bon de retour دون إعادة عكس الكميات أو مخزون الستوك
    await (retour as any).deleteOne();

    return NextResponse.json({ message: 'Bon de retour supprimé', retour });
  } catch (error) {
    console.error('Erreur DELETE /sales/returns/:id:', error);
    const errorMessage = (error as Error).message || 'Erreur lors de la suppression du retour';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}



