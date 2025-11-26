import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import mongoose from 'mongoose';

// GET /api/internal-invoices/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const tenantId = session.user.companyId?.toString() || '';

    await connectDB();

    const invoice = await (Document as any)
      .findOne({ _id: id, tenantId, type: 'INT_FAC' })
      .populate('customerId', 'raisonSociale nom prenom matriculeFiscale')
      .populate('projetId', 'name projectNumber')
      .lean();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur GET /internal-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/internal-invoices/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const tenantId = session.user.companyId?.toString() || '';
    const body = await request.json();

    await connectDB();

    // Check if invoice exists and belongs to tenant
    const existingInvoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'INT_FAC'
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    // Check numero uniqueness if changed
    if (body.numero && body.numero !== existingInvoice.numero) {
      const numeroExists = await (Document as any).findOne({
        tenantId,
        type: 'INT_FAC',
        numero: body.numero,
        _id: { $ne: id }
      });

      if (numeroExists) {
        return NextResponse.json(
          { error: 'Ce numéro de facture interne existe déjà' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = { ...body };
    
    // Convert IDs to ObjectId - validate first
    if (updateData.customerId !== undefined && updateData.customerId !== null) {
      // If it's already an ObjectId instance, convert to string first
      if (updateData.customerId instanceof mongoose.Types.ObjectId) {
        updateData.customerId = updateData.customerId.toString();
      }
      // If it's an object with _id (populated), extract the _id
      if (typeof updateData.customerId === 'object' && updateData.customerId._id) {
        updateData.customerId = updateData.customerId._id;
      }
      
      // Now convert string to ObjectId
      if (typeof updateData.customerId === 'string') {
        if (updateData.customerId.trim()) {
          // Validate ObjectId format before creating
          if (mongoose.Types.ObjectId.isValid(updateData.customerId)) {
            updateData.customerId = new mongoose.Types.ObjectId(updateData.customerId);
          } else {
            return NextResponse.json(
              { error: 'ID client invalide' },
              { status: 400 }
            );
          }
        } else {
          updateData.customerId = undefined;
        }
      }
    } else if (updateData.customerId === '' || updateData.customerId === null) {
      updateData.customerId = undefined;
    }

    if (updateData.projetId !== undefined && updateData.projetId !== null) {
      // If it's already an ObjectId instance, convert to string first
      if (updateData.projetId instanceof mongoose.Types.ObjectId) {
        updateData.projetId = updateData.projetId.toString();
      }
      // If it's an object with _id (populated), extract the _id
      if (typeof updateData.projetId === 'object' && updateData.projetId._id) {
        updateData.projetId = updateData.projetId._id;
      }
      
      // Now convert string to ObjectId
      if (typeof updateData.projetId === 'string') {
        if (updateData.projetId.trim()) {
          // Validate ObjectId format before creating
          if (mongoose.Types.ObjectId.isValid(updateData.projetId)) {
            updateData.projetId = new mongoose.Types.ObjectId(updateData.projetId);
          } else {
            return NextResponse.json(
              { error: 'ID projet invalide' },
              { status: 400 }
            );
          }
        } else {
          updateData.projetId = undefined;
        }
      }
    } else if (updateData.projetId === '' || updateData.projetId === null) {
      updateData.projetId = undefined;
    }

    // Calculate totals
    calculateDocumentTotals({ ...existingInvoice.toObject(), ...updateData });

    // Update invoice
    const updatedInvoice = await (Document as any).findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .lean();

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Erreur PATCH /internal-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/internal-invoices/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const tenantId = session.user.companyId?.toString() || '';

    await connectDB();

    const invoice = await (Document as any).findOneAndDelete({
      _id: id,
      tenantId,
      type: 'INT_FAC'
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Facture interne supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /internal-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

  if (!doc.lignes || doc.lignes.length === 0) {
    doc.totalBaseHT = 0;
    doc.totalTVA = 0;
    doc.totalTTC = 0;
    if (doc.fodec) {
      doc.fodec.montant = 0;
    }
    return;
  }

  // Calculate HT after line discounts
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalHTAfterLineDiscount += montantHT;
  });

  // Apply global remise
  const remiseGlobalePct = doc.remiseGlobalePct || 0;
  const totalBaseHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

  // Calculate FODEC
  const fodecEnabled = doc.fodec?.enabled || false;
  const fodecTauxPct = doc.fodec?.tauxPct || 1;
  const fodec = fodecEnabled ? totalBaseHT * (fodecTauxPct / 100) : 0;

  // Calculate TVA
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    const montantHTAfterGlobalRemise = montantHT * (1 - (remiseGlobalePct / 100));
    const ligneFodec = fodecEnabled ? montantHTAfterGlobalRemise * (fodecTauxPct / 100) : 0;
    const ligneBaseTVA = montantHTAfterGlobalRemise + ligneFodec;
    
    if (line.tvaPct) {
      totalTVA += ligneBaseTVA * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  
  if (doc.fodec) {
    doc.fodec.montant = Math.round(fodec * 100) / 100;
  }
  
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + fodec + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

