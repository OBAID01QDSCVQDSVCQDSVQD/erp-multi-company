import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Plan from '@/lib/models/Plan';

// PUT: Update a plan
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        const { id } = params;
        const body = await request.json();
        await connectDB();

        console.log(`Updating plan ${id} with:`, JSON.stringify(body, null, 2));

        // Use $set with strict: false to bypass Mongoose schema filtering in case of cached models
        const plan = await (Plan as any).findByIdAndUpdate(
            id,
            { $set: body },
            {
                new: true,
                runValidators: true,
                strict: false // CRITICAL: Allows saving fields not in the (potentially cached) schema
            }
        );

        if (!plan) {
            return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 });
        }

        console.log('Update Result - Full Plan:', JSON.stringify(plan, null, 2));
        console.log('Update Result - Limits:', JSON.stringify(plan.limits, null, 2));
        return NextResponse.json(plan);
    } catch (error) {
        console.error('Error updating plan:', error);
        return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }
}

// DELETE: Delete a plan (soft delete usually better, but hard delete requested or implied)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        const { id } = params;
        await connectDB();

        const plan = await (Plan as any).findByIdAndDelete(id);
        if (!plan) {
            return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Plan supprimé' });
    } catch (error) {
        console.error('Error deleting plan:', error);
        return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }
}
