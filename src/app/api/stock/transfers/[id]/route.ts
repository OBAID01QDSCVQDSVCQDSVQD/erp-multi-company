import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import StockTransfer from '@/lib/models/StockTransfer';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

        console.log(`DEBUG GET Transfer: ID=${params.id}, Tenant=${tenantId}`);

        // Try finding by ID first to debug
        const transfer = await (StockTransfer as any).findOne({ _id: params.id });

        if (!transfer) {
            console.log(`DEBUG: Transfer ${params.id} not found in DB`);
            return NextResponse.json({ error: `Transfert introuvable (ID: ${params.id}) dans la base de données.` }, { status: 404 });
        }

        if (transfer.societeId !== tenantId) {
            console.log(`DEBUG: Tenant Mismatch. Found: ${transfer.societeId}, Expected: ${tenantId}`);
            return NextResponse.json({
                error: `Non autorisé (Tenant mismatch). Reçu: ${tenantId}, Attendu: ${transfer.societeId}`
            }, { status: 404 });
        }

        return NextResponse.json(transfer);
    } catch (error) {
        console.error('Erreur GET /api/stock/transfers/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

        const transfer = await (StockTransfer as any).findOne({ _id: params.id, societeId: tenantId });
        if (!transfer) return NextResponse.json({ error: 'Transfert non trouvé' }, { status: 404 });

        if (transfer.statut === 'VALIDE') {
            return NextResponse.json({ error: 'Impossible de supprimer un transfert validé' }, { status: 400 });
        }

        await (StockTransfer as any).deleteOne({ _id: params.id });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/stock/transfers/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
        const body = await request.json();

        const transfer = await (StockTransfer as any).findOne({ _id: params.id, societeId: tenantId });
        if (!transfer) return NextResponse.json({ error: 'Transfert non trouvé' }, { status: 404 });

        if (transfer.statut === 'VALIDE' && body.statut === 'ANNULE') {
            return NextResponse.json({ error: 'Impossible d\'annuler un transfert déjà validé (incohérence de stock)' }, { status: 400 });
        }

        Object.assign(transfer, body);
        await transfer.save();

        return NextResponse.json(transfer);
    } catch (error) {
        console.error('Erreur PATCH /api/stock/transfers/[id]:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
