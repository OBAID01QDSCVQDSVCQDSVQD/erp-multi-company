import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import StockTransfer from '@/lib/models/StockTransfer';
import MouvementStock from '@/lib/models/MouvementStock';
import Warehouse from '@/lib/models/Warehouse';
import mongoose from 'mongoose';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

        console.log(`--- START VALIDATION --- ID=${params.id} Tenant=${tenantId}`);

        const transfer = await (StockTransfer as any).findOne({ _id: params.id, societeId: tenantId });
        if (!transfer) {
            console.log('DEBUG: Transfer not found');
            return NextResponse.json({ error: 'Transfert non trouvé' }, { status: 404 });
        }

        console.log('DEBUG: Transfer Found:', JSON.stringify(transfer, null, 2));

        if (transfer.statut === 'VALIDE') {
            return NextResponse.json({ error: 'Déjà validé' }, { status: 400 });
        }

        // Check stock availability in Source Warehouse
        const sourceWhId = transfer.sourceWarehouseId;
        const warehouse = await (Warehouse as any).findOne({ _id: sourceWhId, tenantId });

        for (const line of transfer.lignes) {
            let matchQuery: any = {
                societeId: tenantId,
                productId: line.productId
            };

            if (warehouse && warehouse.isDefault) {
                // Include legacy stock for default warehouse
                matchQuery.$or = [
                    { warehouseId: new mongoose.Types.ObjectId(sourceWhId) },
                    { warehouseId: null },
                    { warehouseId: { $exists: false } }
                ];
            } else {
                matchQuery.warehouseId = new mongoose.Types.ObjectId(sourceWhId);
            }

            const movements = await (MouvementStock as any).find(matchQuery).lean();

            console.log(`DEBUG Check Stock: Product=${line.productId}, Warehouse=${sourceWhId}, IsDefault=${warehouse?.isDefault}, Moves=${movements.length}`);

            let currentStock = 0;
            for (const m of movements) {
                const qte = Number(m.qte) || 0;
                if (m.type === 'ENTREE') currentStock += qte;
                else if (m.type === 'SORTIE') currentStock -= qte;
                else if (m.type === 'INVENTAIRE') currentStock += qte;
            }

            const requiredQty = Number(line.quantity);
            console.log(`DEBUG Stock Check: Prod="${line.designation}", Wh="${warehouse?.name}", Stock=${currentStock}, Needed=${requiredQty}`);

            // Validation with clear French error message
            if (currentStock < requiredQty) {
                console.log('DEBUG: Insufficient Stock Error Triggered');
                return NextResponse.json({
                    error: `Stock insuffisant pour l'article "${line.designation || line.productId}" dans l'entrepôt source "${warehouse?.name || sourceWhId}". (Disponible: ${currentStock}, Demandé: ${requiredQty})`
                }, { status: 400 });
            }
        }

        // Proceed to create movements
        const moveOuts = transfer.lignes.map((line: any) => ({
            societeId: tenantId,
            productId: line.productId,
            warehouseId: transfer.sourceWarehouseId,
            type: 'SORTIE',
            qte: line.quantity,
            date: new Date(),
            source: 'TRANSFERT',
            sourceId: transfer._id.toString(),
            notes: `Transfert vers ${transfer.destinationWarehouseId} (Ref: ${transfer.numero})`,
            createdBy: session.user.name || session.user.email
        }));

        const moveIns = transfer.lignes.map((line: any) => ({
            societeId: tenantId,
            productId: line.productId,
            warehouseId: transfer.destinationWarehouseId,
            type: 'ENTREE',
            qte: line.quantity,
            date: new Date(),
            source: 'TRANSFERT',
            sourceId: transfer._id.toString(),
            notes: `Transfert depuis ${transfer.sourceWarehouseId} (Ref: ${transfer.numero})`,
            createdBy: session.user.name || session.user.email
        }));

        await (MouvementStock as any).insertMany([...moveOuts, ...moveIns]);

        // Update status
        transfer.statut = 'VALIDE';
        await transfer.save();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur POST validate transfer:', error);
        return NextResponse.json({ error: 'Erreur serveur', details: (error as Error).message }, { status: 500 });
    }
}
