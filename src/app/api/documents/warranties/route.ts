import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warranty from '@/lib/models/Warranty';
import WarrantyTemplate from '@/lib/models/WarrantyTemplate';
import CompanySettings from '@/lib/models/CompanySettings';
import Counter from '@/lib/models/Counter';
import Customer from '@/lib/models/Customer';

export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const customerId = searchParams.get('customerId');
        const templateId = searchParams.get('templateId');
        const search = searchParams.get('search');

        const query: any = { tenantId };
        if (status) query.status = status;
        if (customerId) query.customerId = customerId;
        if (templateId) query.templateId = templateId;

        if (search) {
            query.$or = [
                { certificateNumber: { $regex: search, $options: 'i' } },
                { 'items.productName': { $regex: search, $options: 'i' } },
                { 'items.serialNumber': { $regex: search, $options: 'i' } }
            ];
        }

        const warranties = await (Warranty as any).find(query)
            .populate('templateId', 'name')
            .populate({ path: 'customerId', model: Customer, select: 'raisonSociale nom prenom telephone mobile' })
            .sort({ createdAt: -1 })
            .limit(50);

        return NextResponse.json(warranties);
    } catch (error) {
        console.error('Error fetching warranties:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function getNextSequenceNumber(tenantId: string): Promise<string> {
    // 1. Get settings for format
    const settings = await (CompanySettings as any).findOne({ tenantId });
    const format = settings?.numerotation?.garantie || 'GAR-{{YYYY}}-{{SEQ:5}}';

    // 2. Increment counter
    const counter = await (Counter as any).findOneAndUpdate(
        { tenantId, seqName: 'garantie' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    );

    const seq = counter.value;

    // 3. Format string
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    let number = format
        .replace('{{YYYY}}', year)
        .replace('{{YY}}', year.substring(2))
        .replace('{{MM}}', month);

    // Handle {{SEQ:N}}
    const seqMatch = number.match(/{{SEQ:(\d+)}}/);
    if (seqMatch) {
        const padding = parseInt(seqMatch[1], 10);
        number = number.replace(seqMatch[0], seq.toString().padStart(padding, '0'));
    } else {
        number = number.replace('{{SEQ}}', seq.toString());
    }

    return number;
}

export async function POST(req: Request) {
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
        const { templateId, customerId, invoiceId, items, data, content, exclusiveAdvantages } = body;

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        await connectDB();

        // Verify template exists
        const template = await (WarrantyTemplate as any).findOne({ _id: templateId, tenantId });
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Generate number
        const certificateNumber = await getNextSequenceNumber(tenantId);

        const newWarranty = new (Warranty as any)({
            tenantId,
            templateId,
            certificateNumber,
            invoiceId,
            customerId,
            items: items || [],
            data: data || {},
            content: content, // Save custom content
            exclusiveAdvantages: exclusiveAdvantages,
            status: 'active'
        });

        await newWarranty.save();

        return NextResponse.json(newWarranty, { status: 201 });
    } catch (error) {
        console.error('Error creating warranty:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
