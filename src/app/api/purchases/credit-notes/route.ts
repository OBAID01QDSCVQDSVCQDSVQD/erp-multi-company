
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();

        const tenantId = session.user.companyId?.toString() || '';
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '100');

        const filter: any = {
            tenantId,
            type: 'AVOIRFO',
        };

        if (q) {
            filter.$or = [
                { numero: { $regex: q, $options: 'i' } },
                { referenceExterne: { $regex: q, $options: 'i' } },
            ];
        }

        const creditNotes = await (Document as any)
            .find(filter)
            .sort({ dateDoc: -1 })
            .limit(limit)
            .lean();

        // Populate Supplier info manually if needed, or rely on supplierId in front-end fetch
        // For list view, we usually need supplier name.
        // Document model stores supplierId.
        if (creditNotes.length > 0) {
            const Supplier = (await import('@/lib/models/Supplier')).default;
            const supplierIds = [...new Set(creditNotes.map((c: any) => c.supplierId).filter(Boolean))];
            const suppliers = await (Supplier as any).find({ _id: { $in: supplierIds } }).lean();

            const supplierMap = new Map(suppliers.map((s: any) => [s._id.toString(), s]));

            creditNotes.forEach((doc: any) => {
                if (doc.supplierId) {
                    doc.supplier = supplierMap.get(doc.supplierId.toString());
                }
            });
        }

        const total = await (Document as any).countDocuments(filter);

        return NextResponse.json({ items: creditNotes, total });
    } catch (error) {
        console.error('Erreur GET /api/purchases/credit-notes:', error);
        return NextResponse.json(
            { error: 'Erreur serveur', details: (error as Error).message },
            { status: 500 }
        );
    }
}
