import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import { NumberingService } from '@/lib/services/NumberingService';
import Supplier from '@/lib/models/Supplier';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const statut = searchParams.get('statut');
    const fournisseurId = searchParams.get('fournisseurId');

    const query: any = { societeId: tenantId };
    if (statut) {
      query.statut = statut;
    }
    if (fournisseurId) {
      query.fournisseurId = fournisseurId;
    }

    const skip = (page - 1) * limit;
    const total = await (PurchaseInvoice as any).countDocuments(query);
    const invoices = await (PurchaseInvoice as any)
      .find(query)
      .sort({ dateFacture: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Ensure default values for fodec and timbre
    const normalizedInvoices = invoices.map((inv: any) => ({
      ...inv,
      fodec: {
        enabled: inv.fodec?.enabled ?? false,
        tauxPct: inv.fodec?.tauxPct ?? 1,
        montant: inv.fodec?.montant ?? 0,
      },
      timbre: {
        enabled: inv.timbre?.enabled ?? true,
        montant: inv.timbre?.montant ?? 1.000,
      },
      totaux: {
        ...inv.totaux,
        totalRemise: inv.totaux?.totalRemise ?? 0,
        totalFodec: inv.totaux?.totalFodec ?? 0,
        totalTimbre: inv.totaux?.totalTimbre ?? 0,
      },
    }));

    return NextResponse.json({
      items: normalizedInvoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/invoices:', error);
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

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const body = await request.json();

    // Generate invoice number
    const numero = await NumberingService.next(tenantId, 'facfo');

    // Get supplier name if not provided
    let fournisseurNom = body.fournisseurNom || '';
    if (!fournisseurNom && body.fournisseurId) {
      const supplier = await (Supplier as any).findOne({
        _id: body.fournisseurId,
        tenantId,
      });
      if (supplier) {
        fournisseurNom = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
      }
    }

    // Prepare lines
    const lignes = (body.lignes || []).map((line: any) => ({
      produitId: line.produitId || undefined,
      designation: line.designation || '',
      quantite: line.quantite || 0,
      prixUnitaireHT: line.prixUnitaireHT || 0,
      remisePct: line.remisePct || 0,
      tvaPct: line.tvaPct || 0,
      fodecPct: line.fodecPct || 0,
      totalLigneHT: 0,
    }));

    // Prepare fodec
    const fodec = {
      enabled: body.fodec?.enabled ?? false,
      tauxPct: body.fodec?.tauxPct ?? 1,
      montant: 0,
    };

    // Prepare timbre
    const timbre = {
      enabled: body.timbre?.enabled ?? true,
      montant: body.timbre?.montant ?? 1.000,
    };

    const invoice = new PurchaseInvoice({
      societeId: tenantId,
      numero,
      dateFacture: body.dateFacture ? new Date(body.dateFacture) : new Date(),
      referenceFournisseur: body.referenceFournisseur || undefined,
      fournisseurId: body.fournisseurId,
      fournisseurNom,
      devise: body.devise || 'TND',
      tauxChange: body.tauxChange || 1,
      conditionsPaiement: body.conditionsPaiement || undefined,
      statut: body.statut || 'BROUILLON',
      lignes,
      fodec,
      timbre,
      totaux: {
        totalHT: 0,
        totalRemise: 0,
        totalFodec: 0,
        totalTVA: 0,
        totalTimbre: 0,
        totalTTC: 0,
      },
      bonsReceptionIds: body.bonsReceptionIds || [],
      fichiers: body.fichiers || [],
      paiements: body.paiements || [],
      notes: body.notes || '',
      createdBy: session.user.email,
    });

    // Totals will be calculated by pre-save hook
    await (invoice as any).save();

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/purchases/invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
