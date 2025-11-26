import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const projetId = searchParams.get('projetId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId, type: 'INT_FAC' };
    if (customerId) query.customerId = new mongoose.Types.ObjectId(customerId);
    if (projetId) query.projetId = new mongoose.Types.ObjectId(projetId);

    const invoices = await (Document as any)
      .find(query)
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .sort({ numero: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: invoices, total });
  } catch (error) {
    console.error('Erreur GET /internal-invoices:', error);
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
    
    let numero =
      typeof body.numero === 'string' && body.numero.trim().length > 0
        ? body.numero.trim()
        : '';

    if (numero) {
      const exists = await (Document as any).findOne({
        tenantId,
        type: 'INT_FAC',
        numero,
      });
      if (exists) {
        return NextResponse.json(
          { error: 'Ce numéro de facture interne existe déjà. Merci de choisir un autre numéro.' },
          { status: 409 }
        );
      }
    } else {
      // Generate invoice number FACI-YYYY-XXXXX
      const currentYear = new Date().getFullYear();
      const lastInvoice = await (Document as any).findOne({
        tenantId,
        type: 'INT_FAC'
      })
      .sort({ createdAt: -1 })
      .lean();

      if (lastInvoice && lastInvoice.numero) {
        const numericMatch = lastInvoice.numero.match(/(\d+)$/);
        if (numericMatch) {
          const lastNumber = parseInt(numericMatch[1], 10);
          const nextNumber = lastNumber + 1;
          const prefix = lastInvoice.numero.substring(0, lastInvoice.numero.length - numericMatch[1].length);
          const padding = numericMatch[1].length;
          numero = prefix + nextNumber.toString().padStart(padding, '0');
        } else {
          numero = `FACI-${currentYear}-00001`;
        }
      } else {
        numero = `FACI-${currentYear}-00001`;
      }
    }

    const invoice = new Document({
      ...body,
      tenantId,
      type: 'INT_FAC',
      numero,
      statut: 'BROUILLON',
      createdBy: session.user.email
    });

    calculateDocumentTotals(invoice);
    await (invoice as any).save();

    // Convert customerId and projetId to ObjectId if provided
    if (invoice.customerId) {
      (invoice as any).customerId = new mongoose.Types.ObjectId(invoice.customerId);
    }
    if ((invoice as any).projetId) {
      (invoice as any).projetId = new mongoose.Types.ObjectId((invoice as any).projetId);
    }

    // Populate before returning
    const populatedInvoice = await (Document as any)
      .findById(invoice._id)
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .lean();

    return NextResponse.json(populatedInvoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /internal-invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

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

