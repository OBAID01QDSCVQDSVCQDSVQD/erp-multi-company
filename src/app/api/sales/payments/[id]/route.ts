import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementClient from '@/lib/models/PaiementClient';
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

    const tenantId = session.user.companyId?.toString() || '';
    const { id } = await params;

    const paiement = await (PaiementClient as any).findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!paiement) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    console.log('🔍 [API Sales Payment GET] Payment found:', paiement.numero);
    console.log('🔍 [API Sales Payment GET] Payment images (raw):', paiement.images);

    // Enrich payment lines with referenceExterne from invoices if missing
    if (paiement.lignes && paiement.lignes.length > 0) {
      const enrichedLignes = await Promise.all(
        paiement.lignes.map(async (ligne: any) => {
          if (!ligne.referenceExterne && ligne.factureId) {
            const invoice = await (Document as any).findOne({
              _id: ligne.factureId,
              tenantId: tenantId,
              type: 'FAC',
            }).select('referenceExterne numero').lean();
            
            if (invoice) {
              ligne.referenceExterne = invoice.referenceExterne || invoice.numero;
            }
          }
          return ligne;
        })
      );
      paiement.lignes = enrichedLignes;
    }

    const responseData = {
      ...paiement,
      images: paiement.images || [], // Ensure images array is always present
    };
    
    console.log('🔍 [API Sales Payment GET] Response data:', responseData);
    console.log('🔍 [API Sales Payment GET] Response images:', responseData.images);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Erreur GET /api/sales/payments/:id:', error);
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

    const paiement = await (PaiementClient as any).findOne({
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

    const updatedPaiement = await (PaiementClient as any).findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    return NextResponse.json(updatedPaiement);
  } catch (error) {
    console.error('Erreur PUT /api/sales/payments/[id]:', error);
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

    const paiement = await (PaiementClient as any).findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!paiement) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Update invoice payment status before deleting payment
    for (const ligne of paiement.lignes) {
      if (ligne.factureId && !ligne.isPaymentOnAccount) {
        const invoice = await (Document as any).findOne({
          _id: ligne.factureId,
          tenantId,
          type: 'FAC',
        });

        if (invoice) {
          // Recalculate total paid amount after this payment is deleted
          const allPayments = await (PaiementClient as any).find({
            societeId: new mongoose.Types.ObjectId(tenantId),
            'lignes.factureId': ligne.factureId,
            _id: { $ne: id }, // Exclude the payment being deleted
          }).lean();

          let totalPaye = 0;
          allPayments.forEach((payment: any) => {
            payment.lignes.forEach((line: any) => {
              if (line.factureId && line.factureId.toString() === ligne.factureId.toString()) {
                totalPaye += line.montantPaye;
              }
            });
          });

          const montantFacture = invoice.totalTTC || 0;
          
          if (totalPaye >= montantFacture - 0.001) {
            invoice.statut = 'PAYEE';
          } else if (totalPaye > 0) {
            invoice.statut = 'PARTIELLEMENT_PAYEE';
          } else {
            invoice.statut = 'BROUILLON';
          }

          await invoice.save();
        }
      }
    }

    // Delete payment
    await paiement.deleteOne();

    return NextResponse.json({ message: 'Paiement supprimé', paiement });
  } catch (error) {
    console.error('Erreur DELETE /api/sales/payments/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

