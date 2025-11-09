import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';
import CompanySettings from '@/lib/models/CompanySettings';
import Supplier from '@/lib/models/Supplier';
import { generateReceptionPdf } from '@/lib/utils/pdf/receptionTemplate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const { id } = await params;
    await connectDB();

        // Fetch reception
        const reception = await (Reception as any).findOne({
          _id: id,
          societeId: tenantId,
        }).lean();

        if (!reception) {
          return NextResponse.json({ error: 'Bon de réception non trouvé' }, { status: 404 });
        }

        // Ensure FODEC and TIMBRE fields exist with default values for old documents
        if (reception.fodecActif === undefined) {
          reception.fodecActif = false;
        }
        if (reception.tauxFodec === undefined) {
          reception.tauxFodec = 1;
        }
        if (reception.timbreActif === undefined) {
          reception.timbreActif = true;
        }
        if (reception.montantTimbre === undefined) {
          reception.montantTimbre = 1.000;
        }
        if (!reception.totaux) {
          reception.totaux = {};
        }
        if (reception.totaux.fodec === undefined) {
          reception.totaux.fodec = 0;
        }
        if (reception.totaux.timbre === undefined) {
          reception.totaux.timbre = 0;
        }

    // Fetch company settings
    const settings = await (CompanySettings as any).findOne({ tenantId: tenantId });
    if (!settings) {
      return NextResponse.json({ error: 'Paramètres de société non trouvés' }, { status: 404 });
    }

    // Fetch supplier details
    let supplierAddress = '';
    let supplierMatricule = '';
    let supplierPhone = '';

    if (reception.fournisseurId) {
      try {
        const supplier = await (Supplier as any).findOne({ _id: reception.fournisseurId, tenantId: tenantId });
        if (supplier) {
          if (supplier.adresseFacturation) {
            supplierAddress = [
              supplier.adresseFacturation.ligne1,
              supplier.adresseFacturation.ligne2,
              supplier.adresseFacturation.codePostal,
              supplier.adresseFacturation.ville
            ].filter(Boolean).join(', ');
          }
          supplierMatricule = supplier.matriculeFiscale || '';
          supplierPhone = supplier.telephone || '';
        }
      } catch (error) {
        console.error('Error fetching supplier:', error);
      }
    }

    // Prepare reception data for PDF
    const receptionData = {
      numero: reception.numero,
      dateDoc: reception.dateDoc.toISOString(),
      documentType: 'Bon de réception',
      supplierName: reception.fournisseurNom,
      supplierAddress: supplierAddress,
      supplierMatricule: supplierMatricule,
      supplierPhone: supplierPhone,
      devise: 'TND', // Default, can be enhanced
          lignes: reception.lignes.map((line: any) => ({
            reference: line.reference || '',
            designation: line.designation || '',
            qteCommandee: line.qteCommandee || 0,
            qteRecue: line.qteRecue || 0,
            unite: line.uom || 'PCE',
            prixUnitaireHT: line.prixUnitaireHT || 0,
            remisePct: line.remisePct || 0,
            tvaPct: line.tvaPct || 0,
            totalLigneHT: line.totalLigneHT || 0,
          })),
      totalHT: reception.totaux.totalHT || 0,
      fodec: reception.totaux.fodec || 0,
      totalTVA: reception.totaux.totalTVA || 0,
      timbre: reception.totaux.timbre || 0,
      totalTTC: reception.totaux.totalTTC || 0,
      fodecActif: reception.fodecActif || false,
      tauxFodec: reception.tauxFodec || 1,
      timbreActif: reception.timbreActif || false,
      montantTimbre: reception.montantTimbre || 1.000,
      notes: reception.notes || '',
      statut: reception.statut,
    };

    // Generate PDF
    const pdfDoc = generateReceptionPdf(receptionData, settings.societe);

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));

    // Return PDF as response
    const sanitizedSupplierName = reception.fournisseurNom.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
    const filename = `Reception-${receptionData.numero}${reception.fournisseurNom ? '-' + sanitizedSupplierName : ''}.pdf`;
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', details: error.message },
      { status: 500 }
    );
  }
}
