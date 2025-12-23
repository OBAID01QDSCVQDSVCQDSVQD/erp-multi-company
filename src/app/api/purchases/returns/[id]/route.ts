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
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        await connectDB();

        const tenantId = session.user.companyId?.toString() || '';

        const doc = await (Document as any).findOne({
            _id: id,
            tenantId,
            type: 'RETOUR_ACHAT'
        }).lean();

        if (!doc) {
            return NextResponse.json({ error: 'Retour non trouvé' }, { status: 404 });
        }

        // Populate Supplier
        if (doc.supplierId) {
            const Supplier = (await import('@/lib/models/Supplier')).default;
            const supplier = await (Supplier as any).findOne({
                _id: doc.supplierId,
                tenantId
            }).select('nom prenom raisonSociale adresse email telephone').lean();

            if (supplier) {
                doc.supplier = supplier; // Add full supplier object
            }
        }

        // Populate Warehouse
        if (doc.warehouseId) {
            const Warehouse = (await import('@/lib/models/Warehouse')).default;
            const warehouse = await (Warehouse as any).findOne({
                _id: doc.warehouseId,
                tenantId
            }).select('name').lean();
            if (warehouse) {
                doc.warehouseName = warehouse.name;
            }
        }

        // Populate BR info if needed
        if (doc.brId) {
            const Reception = (await import('@/lib/models/Reception')).default;
            const br = await (Reception as any).findOne({ _id: doc.brId }).select('numero dateDoc').lean();
            if (br) {
                doc.brInfo = br;
            }
        }

        return NextResponse.json(doc);
    } catch (error) {
        console.error('Erreur GET /api/purchases/returns/[id]:', error);
        return NextResponse.json(
            { error: 'Erreur serveur', details: (error as Error).message },
            { status: 500 }
        );
    }
}
