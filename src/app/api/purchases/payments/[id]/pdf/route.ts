import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import Supplier from '@/lib/models/Supplier';
import CompanySettings from '@/lib/models/CompanySettings';
import { generatePaymentPdf } from '@/lib/utils/pdf/paymentTemplate';
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
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const { id } = await params;

    // Get payment
    const payment = await PaiementFournisseur.findOne({
      _id: id,
      societeId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Get supplier info
    const supplier = await (Supplier as any).findOne({
      _id: payment.fournisseurId,
      tenantId: tenantId,
    }).lean();

    // Get company settings
    const settings = await (CompanySettings as any).findOne({ tenantId });
    if (!settings || !settings.societe) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    const companyInfo = {
      nom: settings.societe.nom || 'Société',
      adresse: {
        rue: settings.societe.adresse?.rue || '',
        ville: settings.societe.adresse?.ville || '',
        codePostal: settings.societe.adresse?.codePostal || '',
        pays: settings.societe.adresse?.pays || 'Tunisie',
      },
      logoUrl: settings.societe.logoUrl,
      enTete: {
        slogan: settings.societe.enTete?.slogan,
        telephone: settings.societe.enTete?.telephone,
        email: settings.societe.enTete?.email,
        siteWeb: settings.societe.enTete?.siteWeb,
        matriculeFiscal: settings.societe.enTete?.matriculeFiscal,
        registreCommerce: settings.societe.enTete?.registreCommerce,
        capitalSocial: settings.societe.enTete?.capitalSocial,
      },
      piedPage: {
        texte: settings.societe.piedPage?.texte,
        conditionsGenerales: settings.societe.piedPage?.conditionsGenerales,
        mentionsLegales: settings.societe.piedPage?.mentionsLegales,
        coordonneesBancaires: settings.societe.piedPage?.coordonneesBancaires,
      },
    };

    const supplierAddress = supplier
      ? [
          supplier.adresse?.rue || '',
          supplier.adresse?.codePostal || '',
          supplier.adresse?.ville || '',
          supplier.adresse?.pays || '',
        ]
          .filter(Boolean)
          .join(', ')
      : '';

    const paymentData = {
      numero: payment.numero,
      datePaiement: payment.datePaiement.toString(),
      supplierName: payment.fournisseurNom || supplier?.raisonSociale || `${supplier?.nom || ''} ${supplier?.prenom || ''}`.trim(),
      supplierAddress: supplierAddress,
      supplierMatricule: supplier?.matriculeFiscal,
      supplierPhone: supplier?.telephone,
      modePaiement: payment.modePaiement,
      reference: payment.reference,
      montantTotal: payment.montantTotal,
      lignes: payment.lignes.map((line: any) => ({
        numeroFacture: line.numeroFacture,
        referenceFournisseur: line.referenceFournisseur,
        montantFacture: line.montantFacture,
        montantPayeAvant: line.montantPayeAvant,
        montantPaye: line.montantPaye,
        soldeRestant: line.soldeRestant,
      })),
      notes: payment.notes,
    };

    const pdfDoc = generatePaymentPdf(paymentData, companyInfo);

    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="paiement-${payment.numero}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/purchases/payments/[id]/pdf:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

