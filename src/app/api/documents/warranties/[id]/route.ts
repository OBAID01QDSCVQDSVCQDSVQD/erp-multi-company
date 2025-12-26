import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        const warranty = await (Warranty as any).findOne({ _id: params.id, tenantId })
            .populate('templateId')
            .populate('customerId')
            .populate('invoiceId')
            .populate('items.productId');

        if (!warranty) {
            return NextResponse.json({ error: 'Warranty not found' }, { status: 404 });
        }

        return NextResponse.json(warranty);
    } catch (error) {
        console.error('Error fetching warranty:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const body = await req.json();

        await connectDB();

        const warranty = await (Warranty as any).findOne({ _id: params.id, tenantId });

        if (!warranty) {
            return NextResponse.json({ error: 'Warranty not found' }, { status: 404 });
        }

        if (body.status) warranty.status = body.status;
        if (body.data) warranty.data = body.data;
        if (body.items) warranty.items = body.items;
        if (body.content !== undefined) warranty.content = body.content;
        if (body.exclusiveAdvantages !== undefined) warranty.exclusiveAdvantages = body.exclusiveAdvantages;

        await warranty.save();

        return NextResponse.json(warranty);
    } catch (error) {
        console.error('Error updating warranty:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        const result = await (Warranty as any).deleteOne({ _id: params.id, tenantId });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Warranty not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting warranty:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
