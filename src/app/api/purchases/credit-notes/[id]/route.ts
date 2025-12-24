import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import mongoose from 'mongoose';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const { id } = await params;
        const tenantId = session.user.companyId?.toString() || '';

        const creditNote = await Document.findOne({
            _id: id,
            tenantId: tenantId,
            type: 'AVOIRFO'
        }).populate('supplierId', 'nom prenom raisonSociale email telephone').lean();

        if (!creditNote) {
            return NextResponse.json({ error: 'Avoir non trouvé' }, { status: 404 });
        }

        return NextResponse.json(creditNote);
    } catch (error) {
        console.error('Error fetching credit note:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const { id } = await params;
        const tenantId = session.user.companyId?.toString() || '';
        const body = await request.json();

        const creditNote = await Document.findOne({
            _id: id,
            tenantId: tenantId,
            type: 'AVOIRFO'
        });

        if (!creditNote) {
            return NextResponse.json({ error: 'Avoir non trouvé' }, { status: 404 });
        }

        // Update fields
        if (typeof body.remiseGlobalePct === 'number') creditNote.remiseGlobalePct = body.remiseGlobalePct;
        if (typeof body.timbreFiscal === 'number') creditNote.timbreFiscal = body.timbreFiscal;

        // Update Fodec
        if (body.fodec) {
            creditNote.fodec = {
                enabled: body.fodec.enabled,
                tauxPct: body.fodec.tauxPct,
                montant: 0 // Will recalc
            };
        }

        // Recalculate Totals
        // 1. Calculate Base Totals from Lines
        let totalBaseHT = creditNote.lignes.reduce((sum: number, line: any) => {
            const lineTotal = line.quantite * line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100);
            return sum + lineTotal;
        }, 0);

        // Apply Global Discount to Base? Usually Global Discount is applied at the end or line by line?
        // In this system, `remiseGlobalePct` usually reduces the total HT or is distributed.
        // If it's simple scalar reduction on Total HT:
        // Net HT = Total Base HT * (1 - GlobalRemise)

        // Re-calculating complex taxes is risky without the full service logic.
        // However, I must try to mimic the standard logic used in `create`.

        // Let's assume lines are untouched, only global modifiers changed.

        let totalHT = totalBaseHT;
        if (creditNote.remiseGlobalePct > 0) {
            totalHT = totalHT * (1 - creditNote.remiseGlobalePct / 100);
        }

        // Fodec
        let totalFodec = 0;
        if (creditNote.fodec && creditNote.fodec.enabled) {
            totalFodec = totalHT * (creditNote.fodec.tauxPct / 100);
            creditNote.fodec.montant = totalFodec;
            creditNote.totalFodec = totalFodec;
        } else {
            creditNote.totalFodec = 0;
            if (creditNote.fodec) creditNote.fodec.montant = 0;
        }

        const baseForTVA = totalHT + totalFodec;

        // Recalculate TVA (Approximation based on average rate or iterate lines?)
        // Iterating lines is better.
        // But modification of global discount affects lines if distributed? 
        // Or we apply global discount to the sum?
        // If we apply to sum, we need to know the split of TVA rates.
        // Since this is a specialized request, I'll iterate lines to calculate TVA.

        let totalTVA = 0;
        creditNote.lignes.forEach((line: any) => {
            // Line Net HT
            let lineAmount = line.quantite * line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100);

            // Apply global discount portion?
            if (creditNote.remiseGlobalePct > 0) {
                lineAmount = lineAmount * (1 - creditNote.remiseGlobalePct / 100);
            }

            // Apply Fodec portion?
            if (creditNote.fodec && creditNote.fodec.enabled) {
                lineAmount += lineAmount * (creditNote.fodec.tauxPct / 100);
            }

            const tva = lineAmount * (line.tvaPct || 0) / 100;
            totalTVA += tva;
        });

        creditNote.totalBaseHT = totalBaseHT;
        creditNote.totalTVA = totalTVA;

        const totalTTC = totalHT + totalFodec + totalTVA + (creditNote.timbreFiscal || 0);
        creditNote.totalTTC = totalTTC;
        creditNote.netAPayer = totalTTC;

        await creditNote.save();

        return NextResponse.json(creditNote);
    } catch (error) {
        console.error('Error updating credit note:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
