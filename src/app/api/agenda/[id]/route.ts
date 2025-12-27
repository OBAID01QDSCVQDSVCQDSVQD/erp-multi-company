import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Event from '@/lib/models/Event';

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
        const tenantId = session.user.companyId?.toString() || '';

        const event = await Event.findOne({ _id: params.id, tenantId })
            .populate('clientId', 'firstName lastName raisonSociale phone mobile')
            .populate('employeeId', 'firstName lastName position');

        if (!event) {
            return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
        }

        return NextResponse.json(event);
    } catch (error: any) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString() || '';
        const body = await request.json();

        // Sanitize optional fields
        if (body.clientId === '') body.clientId = null;
        if (body.employeeId === '') body.employeeId = null;

        const event = await Event.findOneAndUpdate(
            { _id: params.id, tenantId },
            { $set: body },
            { new: true }
        );

        if (!event) {
            return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
        }

        return NextResponse.json(event);
    } catch (error: any) {
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
        const tenantId = session.user.companyId?.toString() || '';

        const event = await Event.findOneAndDelete({ _id: params.id, tenantId });

        if (!event) {
            return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Supprimé avec succès' });
    } catch (error: any) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
