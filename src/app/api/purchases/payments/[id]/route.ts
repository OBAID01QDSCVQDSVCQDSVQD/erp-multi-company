import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
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

    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    const paiement = await PaiementFournisseur.findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!paiement) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Enrich payment lines with referenceFournisseur from invoices if missing
    const enrichedLignes = await Promise.all(
      (paiement.lignes || []).map(async (ligne: any) => {
        // If referenceFournisseur is missing, fetch it from the invoice
        if (!ligne.referenceFournisseur || ligne.referenceFournisseur === '') {
          const invoice = await (PurchaseInvoice as any).findOne({
            _id: ligne.factureId,
            societeId: new mongoose.Types.ObjectId(tenantId),
          }).lean();
          
          if (invoice && invoice.referenceFournisseur) {
            ligne.referenceFournisseur = invoice.referenceFournisseur;
          }
        }
        return ligne;
      })
    );

    return NextResponse.json({
      ...paiement,
      lignes: enrichedLignes,
      images: paiement.images || [], // Ensure images array is always present
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/payments/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();

    const paiement = await PaiementFournisseur.findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!paiement) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Update images if provided
    if (body.images !== undefined) {
      // Force Mongoose to recognize images as modified
      paiement.images = [];
      if (Array.isArray(body.images) && body.images.length > 0) {
        body.images.forEach((img: any) => {
          paiement.images.push({
            id: img.id || `${Date.now()}-${Math.random()}`,
            name: img.name || '',
            url: img.url || '',
            publicId: img.publicId || undefined,
            type: img.type || 'image/jpeg',
            size: img.size || 0,
            width: img.width || undefined,
            height: img.height || undefined,
            format: img.format || undefined,
          });
        });
      }
      (paiement as any).markModified('images');
    }

    await paiement.save();

    const updatedPaiement = await PaiementFournisseur.findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    return NextResponse.json(updatedPaiement);
  } catch (error) {
    console.error('Erreur PUT /api/purchases/payments/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
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

    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    const paiement = await PaiementFournisseur.findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!paiement) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // TODO: Revert invoice statuses before deleting payment
    // This is a critical operation that should be handled carefully

    await PaiementFournisseur.deleteOne({ _id: id, societeId: new mongoose.Types.ObjectId(tenantId) });

    return NextResponse.json({ message: 'Paiement supprimé avec succès' }, { status: 200 });
  } catch (error) {
    console.error('Erreur DELETE /api/purchases/payments/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

