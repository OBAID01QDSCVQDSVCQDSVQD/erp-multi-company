
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warehouse from '@/lib/models/Warehouse';

// GET: List all warehouses
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString();

        const warehouses = await (Warehouse as any).find({ tenantId }).sort({ isDefault: -1, createdAt: -1 });

        return NextResponse.json(warehouses);
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST: Create a new warehouse
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectDB();
        const tenantId = session.user.companyId?.toString();
        const body = await request.json();

        // Check if name exists
        const existing = await (Warehouse as any).findOne({ tenantId, name: body.name });
        if (existing) {
            return NextResponse.json({ error: 'Un entrepôt avec ce nom existe déjà.' }, { status: 409 });
        }

        // FIX: Drop legacy index that causes unique constraint on 'code' field
        // This handles the "E11000 duplicate key error collection: ... index: tenantId_1_code_1"
        try {
            await (Warehouse as any).collection.dropIndex('tenantId_1_code_1');
            console.log('Dropped legacy index: tenantId_1_code_1');
        } catch (e) {
            // Index might not exist, which is fine
        }

        // Auto-generate code if missing
        let code = body.code;
        if (!code) {
            code = body.name
                .substring(0, 6)
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');

            // Ensure strictly alphanumeric fallback
            if (code.length < 2) code = 'WH-' + Math.floor(Math.random() * 1000);
        }

        // If this is the first warehouse, make it default automatically
        const count = await (Warehouse as any).countDocuments({ tenantId });
        const isDefault = count === 0 ? true : (body.isDefault || false);

        const warehouse = await (Warehouse as any).create({
            ...body,
            code,
            tenantId,
            isDefault
        });

        return NextResponse.json(warehouse, { status: 201 });
    } catch (error) {
        console.error('Error creating warehouse:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
