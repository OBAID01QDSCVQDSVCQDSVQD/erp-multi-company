import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const { statut } = await request.json();

        // Validate status
        const allowed = ['BROUILLON', 'VALIDEE', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE', 'LIVREE'];
        if (!allowed.includes(statut)) {
            return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString();

        const order = await Document.findOneAndUpdate(
            { _id: params.id, tenantId, type: 'BC' },
            { $set: { statut } },
            { new: true }
        );

        if (!order) {
            return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error('Erreur PATCH status:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
