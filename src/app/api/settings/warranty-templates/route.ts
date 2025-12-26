import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import WarrantyTemplate from '@/lib/models/WarrantyTemplate';

export async function GET(req: Request) {
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

        const templates = await (WarrantyTemplate as any).find({ tenantId }).sort({ createdAt: -1 });

        return NextResponse.json(templates);
    } catch (error) {
        console.error('Error fetching warranty templates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
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
        const { name, content, exclusiveAdvantages, fields, isActive } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        await connectDB();

        const newTemplate = new (WarrantyTemplate as any)({
            tenantId,
            name,
            content,
            exclusiveAdvantages,
            fields: fields || [],
            isActive: isActive !== undefined ? isActive : true,
        });

        await newTemplate.save();

        return NextResponse.json(newTemplate, { status: 201 });
    } catch (error) {
        console.error('Error creating warranty template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
