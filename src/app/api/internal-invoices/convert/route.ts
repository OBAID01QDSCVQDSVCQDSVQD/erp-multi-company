import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const body = await request.json();
        const { sourceId, sourceType } = body; // sourceType: 'BL' or 'DEVIS'

        if (!sourceId || !sourceType) {
            return NextResponse.json(
                { error: 'sourceId et sourceType sont requis' },
                { status: 400 }
            );
        }

        if (sourceType !== 'BL' && sourceType !== 'DEVIS') {
            return NextResponse.json(
                { error: 'sourceType doit être BL ou DEVIS' },
                { status: 400 }
            );
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString() || '';

        // Fetch source document
        const sourceDoc = await (Document as any).findOne({
            _id: sourceId,
            tenantId,
            type: sourceType
        }).lean();

        if (!sourceDoc) {
            return NextResponse.json(
                { error: `${sourceType === 'BL' ? 'Bon de livraison' : 'Devis'} non trouvé` },
                { status: 404 }
            );
        }

        // Generate invoice number
        let numero: string;
        try {
            const { NumberingService } = await import('@/lib/services/NumberingService');
            numero = await NumberingService.next(tenantId, 'int_fac');
        } catch (e) {
            console.error("Error generating number", e);
            // Fallback
            numero = `INT-${Date.now()}`;
        }

        // Create invoice from source document
        const sourceLignes = sourceDoc.lignes || [];
        const bodyLignes = body.lignes || [];

        // Create a map of body lines by sourceLineId or productId for quick lookup
        const bodyLinesMap = new Map();
        bodyLignes.forEach((line: any) => {
            const key = line.sourceLineId || line.productId?.toString();
            if (key) {
                bodyLinesMap.set(key, line);
            }
        });

        const invoiceLignes = sourceLignes.map((line: any) => {
            const sourceLineId = line._id?.toString() || line.sourceLineId;
            const bodyLine = bodyLinesMap.get(sourceLineId) || bodyLinesMap.get(line.productId?.toString());

            return {
                productId: bodyLine?.productId || line.productId,
                codeAchat: bodyLine?.codeAchat || line.codeAchat,
                categorieCode: bodyLine?.categorieCode || line.categorieCode,
                designation: bodyLine?.designation || line.designation,
                quantite: bodyLine?.quantite !== undefined ? bodyLine.quantite : line.quantite,
                uomCode: bodyLine?.uomCode || line.uomCode,
                prixUnitaireHT: bodyLine?.prixUnitaireHT !== undefined ? bodyLine.prixUnitaireHT : line.prixUnitaireHT,
                remisePct: bodyLine?.remisePct !== undefined ? bodyLine.remisePct : (line.remisePct || 0),
                taxCode: bodyLine?.taxCode || line.taxCode,
                tvaPct: bodyLine?.tvaPct !== undefined ? bodyLine.tvaPct : (line.tvaPct || 0),
                sourceLineId: sourceLineId,
            };
        });

        const invoice = new Document({
            tenantId,
            type: 'INT_FAC',
            numero,
            dateDoc: body.dateDoc ? new Date(body.dateDoc) : new Date(),
            customerId: sourceDoc.customerId,
            projetId: sourceDoc.projetId, // Preserve project link
            referenceExterne: sourceDoc.referenceExterne,
            bonCommandeClient: sourceDoc.bonCommandeClient,
            dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : sourceDoc.dateEcheance,
            devise: sourceDoc.devise || 'TND',
            modePaiement: body.modePaiement || sourceDoc.modePaiement,
            conditionsPaiement: body.conditionsPaiement || sourceDoc.conditionsPaiement,
            notes: body.notes || sourceDoc.notes,
            lignes: invoiceLignes,
            linkedDocuments: [sourceId], // Link to source document
            createdBy: session.user.email,
            statut: 'BROUILLON', // Create as Draft
            fodec: sourceDoc.fodec,
            timbreFiscal: sourceDoc.timbreFiscal,
            remiseGlobalePct: sourceDoc.remiseGlobalePct
        });

        // Calculate totals
        calculateDocumentTotals(invoice);

        await (invoice as any).save();

        // Note: We do NOT move stock here because the invoice is BROUILLON. 
        // The BL retains its stock movement.
        // If Devis, no stock movement existed anyway.

        return NextResponse.json(invoice, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/internal-invoices/convert:', error);
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

    // Calculate TVA after applying global remise
    doc.lignes.forEach((line: any) => {
        const remise = line.remisePct || 0;
        const prixHT = line.prixUnitaireHT * (1 - remise / 100);
        const montantHT = prixHT * line.quantite;
        // Apply global remise to line HT for TVA calculation
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

    // Add timbre fiscal if it exists in the document
    const timbreFiscal = doc.timbreFiscal || 0;
    doc.totalTTC = doc.totalBaseHT + fodec + doc.totalTVA + timbreFiscal;
    doc.netAPayer = doc.totalTTC;
}
