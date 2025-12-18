import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Company from '@/lib/models/Company';
import mongoose from 'mongoose';

// PATCH: Update specific fields (like status) OR Admin updating any company
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        await connectDB();
        const { id } = params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
        }

        const body = await request.json();

        // Handle status toggle
        if (typeof body.isActive === 'boolean') {
            const updatedCompany = await (Company as any).findByIdAndUpdate(
                id,
                { $set: { isActive: body.isActive } },
                { new: true }
            );

            if (!updatedCompany) {
                return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 });
            }

            // Log action
            const { logAction } = await import('@/lib/logger');
            await logAction(
                session,
                'UPDATE_COMPANY',
                'Company',
                `Updated company status for ${updatedCompany.name} to ${body.isActive}`,
                { companyId: id, changes: body }
            );

            return NextResponse.json(updatedCompany);
        }

        return NextResponse.json({ error: 'Aucune modification valide fournie' }, { status: 400 });

    } catch (error) {
        console.error('Error updating company:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// DELETE: Remove a company
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        await connectDB();
        const { id } = params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
        }

        const deletedCompany = await (Company as any).findByIdAndDelete(id);

        if (!deletedCompany) {
            return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 });
        }

        // Log action
        const { logAction } = await import('@/lib/logger');
        await logAction(
            session,
            'DELETE_COMPANY',
            'Company',
            `Deleted company ${deletedCompany.name} (ID: ${id})`,
            { companyId: id }
        );

        return NextResponse.json({ message: 'Entreprise supprimée avec succès' });

    } catch (error) {
        console.error('Error deleting company:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
