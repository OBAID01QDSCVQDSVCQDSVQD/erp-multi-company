import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
        if (!tenantId) return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });

        const body = await request.json();
        const { date, warehouseId, notes, lines } = body;

        if (!lines || !Array.isArray(lines) || lines.length === 0) {
            return NextResponse.json({ error: 'Lignes requises' }, { status: 400 });
        }

        const movements = lines.map((line: any) => {
            // Determine type based on quantity sign or explicit type field
            // Assuming quantity is always positive and 'type' field determines direction
            // OR quantity can be positive/negative.
            // Let's assume the UI sends: productId, quantity (positive), type ('ADD' | 'REMOVE')

            const type = line.type === 'ADD' ? 'ENTREE' : 'SORTIE';

            return {
                societeId: tenantId,
                productId: line.productId,
                warehouseId: warehouseId,
                type: type,
                qte: Math.abs(Number(line.quantity)),
                date: date || new Date(),
                source: 'AJUST',
                notes: notes || 'Ajustement manuel',
                createdBy: session.user.name || session.user.email
            };
        });

        await MouvementStock.insertMany(movements);

        return NextResponse.json({ success: true, count: movements.length }, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /api/stock/adjustments:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
