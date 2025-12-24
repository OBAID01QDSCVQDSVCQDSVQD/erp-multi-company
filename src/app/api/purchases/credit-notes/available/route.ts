import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
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
        const supplierId = searchParams.get('supplierId') || '';

        if (!supplierId) {
            return NextResponse.json({ error: 'supplierId requis' }, { status: 400 });
        }

        // Get all available Avoirs (excluding ANNULEE and PAYEE)
        const query: any = {
            tenantId: tenantId,
            supplierId: supplierId,
            type: 'AVOIRFO',
            statut: { $nin: ['ANNULEE', 'PAYEE'] }
        };

        const avoirs = await Document.find(query).sort({ dateDoc: -1 }).lean();

        // Calculate remaining balance for each Avoir
        const availableAvoirs = await Promise.all(
            avoirs.map(async (avoir: any) => {
                // 1. Get usages from PaiementFournisseur (linked via invoice lines)
                const payments = await (PaiementFournisseur as any).find({
                    societeId: tenantId,
                    'lignes.factureId': avoir._id,
                }).lean();

                let montantUtilise = 0;
                payments.forEach((payment: any) => {
                    payment.lignes.forEach((line: any) => {
                        if (line.factureId.toString() === avoir._id.toString()) {
                            montantUtilise += Math.abs(line.montantPaye || 0);
                        }
                    });
                });

                // 2. Add usages stored directly on the Avoir (e.g. Conversions)
                if (avoir.paiements && Array.isArray(avoir.paiements)) {
                    avoir.paiements.forEach((p: any) => {
                        montantUtilise += Math.abs(p.montant || 0);
                    });
                }

                const totalTTC = avoir.totalTTC || 0;
                const soldeRestant = totalTTC - montantUtilise;

                if (soldeRestant <= 0.005) return null; // Fully used

                return {
                    _id: avoir._id,
                    numero: avoir.numero,
                    date: avoir.dateDoc,
                    montantTotal: totalTTC,
                    montantUtilise: montantUtilise,
                    soldeRestant: soldeRestant
                };
            })
        );

        // Filter out nulls
        const validAvoirs = availableAvoirs.filter(a => a !== null);

        return NextResponse.json(validAvoirs);
    } catch (error) {
        console.error('Erreur GET /api/purchases/credit-notes/available:', error);
        return NextResponse.json(
            { error: 'Erreur serveur', details: (error as Error).message },
            { status: 500 }
        );
    }
}
