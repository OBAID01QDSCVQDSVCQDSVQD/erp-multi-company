
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Reception from '@/lib/models/Reception';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';
import mongoose from 'mongoose';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = params;
        await connectDB();

        const tenantId = session.user.companyId?.toString() || '';

        // 1. Fetch the Purchase Return Document
        const returnDoc = await (Document as any).findOne({
            _id: id,
            tenantId,
            type: 'RETOUR_ACHAT'
        });

        if (!returnDoc) {
            return NextResponse.json({ error: 'Retour non trouvé' }, { status: 404 });
        }

        if (returnDoc.statut === 'VALIDEE') {
            return NextResponse.json({ error: 'Retour déjà validé' }, { status: 400 });
        }

        let brDoc = null;
        let invoiceDoc = null;

        // 2. Identify Source (BR or Invoice)
        if (returnDoc.brId) {
            brDoc = await (Reception as any).findOne({
                _id: returnDoc.brId,
                societeId: tenantId
            });
        }

        // Check for linked Invoice directly (if created from Invoice)
        if (returnDoc.linkedDocuments && returnDoc.linkedDocuments.length > 0) {
            const potentialInvoiceId = returnDoc.linkedDocuments[0]; // Assuming first linked doc is the invoice
            invoiceDoc = await (PurchaseInvoice as any).findOne({
                _id: potentialInvoiceId,
                societeId: tenantId
            });
        }

        // 3. Update Stock (Create OUT movements)
        const moveOps = [];

        // Validate warehouse availability if needed, but usually we proceed with negative stock or check.
        // For now, we just create the movement.

        for (const line of returnDoc.lignes) {
            if (line.quantite > 0) {
                // Stock Movement: SORTIE
                const mouvement = new MouvementStock({
                    societeId: tenantId,
                    productId: line.productId,
                    warehouseId: returnDoc.warehouseId, // Use return warehouse
                    type: 'SORTIE',
                    qte: line.quantite,
                    date: new Date(),
                    source: 'RETOUR',
                    sourceId: returnDoc._id.toString(),
                    notes: `Retour Achat ${returnDoc.numero}`,
                    createdBy: session.user.email
                });
                moveOps.push(mouvement.save());

                // Update BR Line Qty Returned (If BR exists)
                if (brDoc) {
                    let remainingToReturn = line.quantite;
                    for (const brLine of brDoc.lignes) {
                        // Match roughly by productId
                        if (brLine.productId?.toString() === line.productId?.toString() && remainingToReturn > 0) {
                            const currentReturned = brLine.qteRetournee || 0;
                            const available = brLine.qteRecue - currentReturned;

                            if (available > 0) {
                                const toAdd = Math.min(available, remainingToReturn);
                                brLine.qteRetournee = currentReturned + toAdd;
                                remainingToReturn -= toAdd;
                            }
                        }
                    }
                }
            }
        }

        await Promise.all(moveOps);

        if (brDoc) {
            brDoc.markModified('lignes');
            await brDoc.save();
        }

        // 4. Financial Impact
        let financialAction = 'NONE';
        let targetInvoice = invoiceDoc;

        // If we didn't start from an invoice, check if the BR is linked to one
        if (!targetInvoice && brDoc) {
            const linkedInvoices = await (PurchaseInvoice as any).find({
                societeId: tenantId,
                bonsReceptionIds: new mongoose.Types.ObjectId(brDoc._id)
            }).sort({ createdAt: -1 });

            if (linkedInvoices.length > 0) {
                targetInvoice = linkedInvoices[0];
            }
        }

        if (targetInvoice) {
            if (targetInvoice.statut === 'BROUILLON') {
                // Scenario A: Linked Invoice is DRAFT -> Adjust it
                financialAction = 'INVOICE_ADJUSTED';

                for (const retLine of returnDoc.lignes) {
                    let remainingToDeduct = retLine.quantite;
                    for (let i = 0; i < targetInvoice.lignes.length; i++) {
                        const invLine = targetInvoice.lignes[i];
                        if (invLine.produitId === retLine.productId && remainingToDeduct > 0) {
                            const deduct = Math.min(invLine.quantite, remainingToDeduct);
                            invLine.quantite -= deduct;
                            remainingToDeduct -= deduct;
                        }
                    }
                    // Filter out 0 qty lines
                    targetInvoice.lignes = targetInvoice.lignes.filter((l: any) => l.quantite > 0);
                }
                await targetInvoice.save();

            } else if (['VALIDEE', 'PAYEE', 'PARTIELLEMENT_PAYEE'].includes(targetInvoice.statut)) {
                // Scenario B: Linked Invoice is VALIDATED -> Create Credit Note (AVOIRFO)
                financialAction = 'CREDIT_NOTE_CREATED';

                const avoirNumero = await NumberingService.next(tenantId, 'avoirfo');

                // Construct AVOIR lines
                const avoirLignes = returnDoc.lignes.map((l: any) => ({
                    productId: l.productId,
                    designation: l.designation,
                    quantite: l.quantite,
                    uomCode: l.uomCode,
                    prixUnitaireHT: l.prixUnitaireHT,
                    remisePct: l.remisePct,
                    tvaPct: l.tvaPct,
                    totalLigneHT: l.totalLigneHT // Or recalculate? Best to recalculate in Schema hook, but mapping is fine.
                }));

                const avoirDoc = new Document({
                    tenantId,
                    type: 'AVOIRFO',
                    numero: avoirNumero,
                    dateDoc: new Date(),
                    statut: 'VALIDEE',
                    supplierId: returnDoc.supplierId, // Supplier from Return
                    linkedDocuments: [targetInvoice._id.toString()], // Link to Invoice
                    lignes: avoirLignes,

                    // Copy financial totals from Return (assuming they are accurate reflection of credit)
                    totalBaseHT: returnDoc.totalBaseHT,
                    totalTVA: returnDoc.totalTVA,
                    totalFodec: returnDoc.totalFodec,
                    totalTTC: returnDoc.totalTTC,
                    netAPayer: returnDoc.totalTTC,

                    remiseGlobalePct: returnDoc.remiseGlobalePct,
                    fodec: returnDoc.fodec,
                    timbreFiscal: returnDoc.timbreFiscal,

                    notes: `Avoir généré automatiquement suite au Retour Achat ${returnDoc.numero}`,
                    createdBy: session.user.email
                });

                await avoirDoc.save();
            }
        }

        // 5. Update Return Status
        returnDoc.statut = 'VALIDEE';
        await returnDoc.save();

        return NextResponse.json({
            success: true,
            financialAction,
            message: 'Retour validé avec succès'
        });

    } catch (error) {
        console.error('Erreur validation retour achat:', error);
        return NextResponse.json(
            { error: 'Erreur serveur', details: (error as Error).message },
            { status: 500 }
        );
    }
}
