import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString();

        // We can populate here if needed, or just return the raw document 
        // and let the frontend handle the lookup or use the aggregate pipeline if strictly needed.
        // For editing, usually raw IDs are better, but let's see. 
        // Actually, simple findOne is enough, frontend will match IDs to loaded lists.
        const order = await Document.findOne({
            _id: params.id,
            tenantId,
            type: 'BC'
        });

        if (!order) {
            return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error('Erreur GET order:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const body = await request.json();
        await connectDB();
        const tenantId = session.user.companyId?.toString();

        // Check if exists
        const existing = await Document.findOne({ _id: params.id, tenantId, type: 'BC' });
        if (!existing) {
            return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
        }

        // Check status if needed (e.g. can't edit if already paid/delivered?) 
        // For now, allow edit.

        // Recalculate totals
        const totals = calculateTotals(body.lignes || [], body.remiseGlobalePct || 0, body.fodec, body.timbreFiscal);

        const updatedOrder = await Document.findOneAndUpdate(
            { _id: params.id, tenantId, type: 'BC' },
            {
                $set: {
                    customerId: body.customerId,
                    dateDoc: body.dateDoc,
                    dateLivraisonPrevue: body.dateLivraisonPrevue,
                    referenceExterne: body.referenceExterne,
                    devise: body.devise,
                    modePaiement: body.modePaiement,
                    notes: body.notes,
                    remiseGlobalePct: body.remiseGlobalePct,
                    timbreFiscal: body.timbreFiscal,
                    fodec: body.fodec, // Assuming the schema supports this structure or we map it
                    lignes: body.lignes,
                    ...totals,
                    // Don't update numero, createdBy, tenantId
                }
            },
            { new: true }
        );

        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Erreur PUT order:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString();

        const result = await Document.findOneAndDelete({
            _id: params.id,
            tenantId,
            type: 'BC'
        });

        if (!result) {
            return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE order:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

function calculateTotals(lignes: any[], remiseGlobalePct: number = 0, fodec: any, timbre: number = 0) {
    let totalBaseHT = 0;

    lignes.forEach(line => {
        const prixHT = line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100);
        totalBaseHT += prixHT * line.quantite;
    });

    // Remise globale
    const totalHTAfterRemise = totalBaseHT * (1 - remiseGlobalePct / 100);

    // Fodec
    let fodecAmount = 0;
    if (fodec && fodec.enabled) {
        fodecAmount = totalHTAfterRemise * (fodec.tauxPct / 100);
    }

    // TVA
    let totalTVA = 0;
    lignes.forEach(line => {
        const prixHT = line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100);
        const baseLine = prixHT * line.quantite * (1 - remiseGlobalePct / 100);
        // Add Fodec prorata if needed, simplified here:
        // Usually TVA is calculated on (BaseHT + Fodec)
        // We need to apply fodec to line base if fodec is global? 
        // Or simplistic approach: 
        let baseTVA = baseLine;
        if (fodec && fodec.enabled) {
            baseTVA += baseLine * (fodec.tauxPct / 100);
        }
        totalTVA += baseTVA * (line.tvaPct / 100);
    });

    const totalTTC = totalHTAfterRemise + fodecAmount + totalTVA + (timbre || 0);

    return {
        totalBaseHT: totalBaseHT, // This usually ignores global discount in some systems, but let's stick to standard
        totalTVA,
        totalTTC,
        netAPayer: totalTTC
    };
}
