import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import Supplier from '@/lib/models/Supplier';
import CompanySettings from '@/lib/models/CompanySettings';
import { generatePurchaseInvoicePdf } from '@/lib/utils/pdf/purchaseInvoiceTemplate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const invoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    }).lean();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Ensure default values
    const normalizedInvoice = {
      ...invoice,
      fodec: {
        enabled: invoice.fodec?.enabled ?? false,
        tauxPct: invoice.fodec?.tauxPct ?? 1,
        montant: invoice.fodec?.montant ?? 0,
      },
      timbre: {
        enabled: invoice.timbre?.enabled ?? true,
        montant: invoice.timbre?.montant ?? 1.000,
      },
      totaux: {
        ...invoice.totaux,
        totalRemise: invoice.totaux?.totalRemise ?? 0,
        totalFodec: invoice.totaux?.totalFodec ?? 0,
        totalTimbre: invoice.totaux?.totalTimbre ?? 0,
      },
    };

    // Fetch company settings (same as other PDF routes)
    const settings = await (CompanySettings as any).findOne({ tenantId: tenantId });
    if (!settings) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    // Get supplier address
    let supplierAddress = '';
    let supplierMatricule = '';
    let supplierPhone = '';
    if (invoice.fournisseurId) {
      try {
        const supplier = await (Supplier as any).findOne({
          _id: invoice.fournisseurId,
          tenantId: tenantId,
        }).lean();
        if (supplier && supplier.adresseFacturation) {
          supplierAddress = [
            supplier.adresseFacturation.ligne1,
            supplier.adresseFacturation.ligne2,
            supplier.adresseFacturation.codePostal,
            supplier.adresseFacturation.ville
          ].filter(Boolean).join(', ');
        }
        supplierMatricule = supplier?.matriculeFiscale || '';
        supplierPhone = supplier?.telephone || '';
      } catch (error) {
        console.error('Error fetching supplier:', error);
      }
    }

    // Prepare invoice data for PDF
    const invoiceData = {
      numero: invoice.numero,
      dateFacture: invoice.dateFacture.toISOString(),
      documentType: 'FACTURE D\'ACHAT',
      referenceFournisseur: invoice.referenceFournisseur,
      supplierName: invoice.fournisseurNom,
      supplierAddress: supplierAddress,
      supplierMatricule: supplierMatricule,
      supplierPhone: supplierPhone,
      devise: invoice.devise || 'TND',
      lignes: invoice.lignes.map((line: any) => ({
        designation: line.designation || '',
        quantite: line.quantite || 0,
        prixUnitaireHT: line.prixUnitaireHT || 0,
        remisePct: line.remisePct || 0,
        tvaPct: line.tvaPct || 0,
        totalLigneHT: line.totalLigneHT || 0,
      })),
      totalHT: invoice.totaux.totalHT || 0,
      totalRemise: invoice.totaux.totalRemise || 0,
      fodec: invoice.totaux.totalFodec || 0,
      totalTVA: invoice.totaux.totalTVA || 0,
      timbre: invoice.totaux.totalTimbre || 0,
      totalTTC: invoice.totaux.totalTTC || 0,
      fodecActif: normalizedInvoice.fodec.enabled,
      tauxFodec: normalizedInvoice.fodec.tauxPct,
      timbreActif: normalizedInvoice.timbre.enabled,
      montantTimbre: normalizedInvoice.timbre.montant,
      notes: invoice.notes || '',
      statut: invoice.statut,
    };

    // Generate PDF (use settings.societe like other routes)
    const pdfDoc = generatePurchaseInvoicePdf(invoiceData, settings.societe);
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${invoice.numero}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/invoices/[id]/pdf:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

