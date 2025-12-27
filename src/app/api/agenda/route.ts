import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Event from '@/lib/models/Event';
import Customer from '@/lib/models/Customer'; // Populate if needed
import Employee from '@/lib/models/Employee'; // Populate if needed

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString() || '';

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        const type = searchParams.get('type');
        const clientId = searchParams.get('clientId');

        const query: any = { tenantId };

        if (start && end) {
            query.startDate = { $gte: new Date(start), $lte: new Date(end) };
        } else if (start) {
            query.startDate = { $gte: new Date(start) };
        }

        if (type && type !== 'all') {
            query.type = type;
        }

        if (clientId) {
            query.clientId = clientId;
        }

        const events = await Event.find(query)
            .populate('clientId', 'firstName lastName raisonSociale phone mobile type')
            .populate('employeeId', 'firstName lastName position')
            .sort({ startDate: 1 })
            .lean();

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('Error fetching events:', error);
        return NextResponse.json({ error: 'Erreur serveur', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const tenantId = session.user.companyId?.toString() || '';
        const body = await request.json();

        if (!body.title || !body.startDate || !body.endDate) {
            return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
        }

        const eventData = { ...body };
        if (!eventData.clientId || eventData.clientId === '') delete eventData.clientId;
        if (!eventData.employeeId || eventData.employeeId === '') delete eventData.employeeId;

        const event = new Event({
            ...eventData,
            tenantId,
            createdBy: session.user.email,
        });

        await event.save();

        return NextResponse.json(event, { status: 201 });
    } catch (error: any) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: 'Erreur serveur', details: error.message }, { status: 500 });
    }
}
