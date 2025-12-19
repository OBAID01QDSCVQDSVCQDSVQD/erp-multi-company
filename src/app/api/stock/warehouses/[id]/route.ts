
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Warehouse from '@/lib/models/Warehouse';

// PUT: Update warehouse
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;
        const body = await request.json();
        const tenantId = session.user.companyId?.toString();

        await connectDB();

        // Prevent removing isDefault from the only default warehouse without setting another one
        // (Though simple logic: we trust the frontend or user to manage defaults via the 'save' hook in model)

        // Using findOneAndUpdate
        const warehouse = await (Warehouse as any).findOneAndUpdate(
            { _id: id, tenantId },
            { $set: body },
            { new: true }
        );

        if (!warehouse) {
            return NextResponse.json({ error: 'Entrepôt non trouvé' }, { status: 404 });
        }

        // Trigger pre-save hook for isDefault logic if needed? 
        // findOneAndUpdate might bypass pre('save'). 
        // If isDefault was set to true, we need to unset others.
        if (body.isDefault) {
            await (Warehouse as any).updateMany(
                { tenantId, _id: { $ne: id } },
                { $set: { isDefault: false } }
            );
        }

        return NextResponse.json(warehouse);
    } catch (error) {
        console.error('Error updating warehouse:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE: Delete warehouse
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = params;
        const tenantId = session.user.companyId?.toString();

        await connectDB();

        const warehouse = await (Warehouse as any).findOne({ _id: id, tenantId });
        if (!warehouse) {
            return NextResponse.json({ error: 'Entrepôt non trouvé' }, { status: 404 });
        }

        // Prevent deleting the default warehouse
        if (warehouse.isDefault) {
            return NextResponse.json({ error: 'Impossible de supprimer l\'entrepôt par défaut. Veuillez d\'abord définir un autre entrepôt par défaut.' }, { status: 400 });
        }

        await (Warehouse as any).deleteOne({ _id: id });

        return NextResponse.json({ message: 'Entrepôt supprimé' });
    } catch (error) {
        console.error('Error deleting warehouse:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
