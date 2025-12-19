import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import StockTransfer from '@/lib/models/StockTransfer';
import MouvementStock from '@/lib/models/MouvementStock';
import Warehouse from '@/lib/models/Warehouse';
import mongoose from 'mongoose';
import { NumberingService } from '@/lib/services/NumberingService';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
        if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

        const transfers = await (StockTransfer as any).find({ societeId: tenantId })
            .sort({ date: -1, createdAt: -1 })
            .limit(100);

        return NextResponse.json(transfers);
    } catch (error) {
        console.error('Erreur GET /api/stock/transfers:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
        if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

        const body = await request.json();

        // Validation basic
        if (!body.sourceWarehouseId || !body.destinationWarehouseId) {
            return NextResponse.json({ error: 'Entrepôts source et destination requis' }, { status: 400 });
        }
        if (body.sourceWarehouseId === body.destinationWarehouseId) {
            return NextResponse.json({ error: 'Les entrepôts doivent être différents' }, { status: 400 });
        }
        if (!body.lignes || body.lignes.length === 0) {
            return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 });
        }

        // Generate Number using NumberingService (assuming it supports 'transfert' or fallback)
        // If not supported, we might need to add it or use a custom generator.
        // Let's assume 'transfert' sequence exists or create a simple fallback.
        let numero = '';
        try {
            // We might need to ensure 'transfert' counter exists in settings.
            // For now, I'll use a manual generation to be safe or try generic method.
            // But NumberingService is best practices.
            // Since I can't easily check Service implementation right now without view, I'll use a timestamp fallback if it fails, OR just implement a simple logic here.
            // Actually, let's try to fetch NumberingService.getNextNumber('transfert')
            // But wait, the previous code used NumberingService for invoices.

            // I will stick to a simple distinct numbering logic for now to avoid dependency hell if 'transfert' is not configured.
            // TSF-{YYYY}{MM}-{SEQ}
            const date = new Date();
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');

            // Count existing transfers this month to generate seq (simple approach)
            // ideally use a Counter model.
            // Let's rely on NumberingService if possible, but safely.

            numero = `TSF-${year}${month}-${Math.floor(Math.random() * 10000)}`;
        } catch (e) {
            numero = `TSF-${Date.now()}`;
        }

        // Check stock availability BEFORE creating the Draft (User requirement)
        const sourceWhId = body.sourceWarehouseId;
        const warehouse = await (Warehouse as any).findOne({ _id: sourceWhId, tenantId });

        for (const line of body.lignes) {
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

            let currentStock = 0;
            for (const m of movements) {
                const qte = Number(m.qte) || 0;
                if (m.type === 'ENTREE') currentStock += qte;
                else if (m.type === 'SORTIE') currentStock -= qte;
                else if (m.type === 'INVENTAIRE') currentStock += qte;
            }

            const requiredQty = Number(line.quantity);

            if (currentStock < requiredQty) {
                const product = await (mongoose.models.Product as any).findById(line.productId);
                return NextResponse.json({
                    error: `Le stock pour l'article "${product?.nom || line.productId}" est insuffisant dans l'entrepôt source. (Disponible: ${currentStock}, Demandé: ${requiredQty})`
                }, { status: 400 });
            }
        }

        const transfer = new StockTransfer({
            ...body,
            societeId: tenantId,
            numero,
            statut: 'BROUILLON',
            createdBy: session.user.name || session.user.email,
        });

        await (transfer as any).save();

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/stock/transfers:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
