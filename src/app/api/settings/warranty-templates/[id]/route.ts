import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import WarrantyTemplate from '@/lib/models/WarrantyTemplate';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).tenantId || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        const template = await (WarrantyTemplate as any).findOne({ _id: params.id, tenantId });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json(template);
    } catch (error) {
        console.error('Error fetching warranty template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).tenantId || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const body = await req.json();

        await connectDB();

        const template = await (WarrantyTemplate as any).findOne({ _id: params.id, tenantId });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Update fields
        if (body.name !== undefined) template.name = body.name;
        if (body.content !== undefined) template.content = body.content;
        if (body.exclusiveAdvantages !== undefined) template.exclusiveAdvantages = body.exclusiveAdvantages;
        if (body.fields !== undefined) template.fields = body.fields;
        if (body.isActive !== undefined) template.isActive = body.isActive;

        await template.save();

        return NextResponse.json(template);
    } catch (error) {
        console.error('Error updating warranty template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenantId = req.headers.get('X-Tenant-Id') || (session.user as any).tenantId || (session.user as any).companyId;
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        await connectDB();

        const result = await (WarrantyTemplate as any).deleteOne({ _id: params.id, tenantId });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting warranty template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
