import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

// PATCH: Update user status or role
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        const { id } = params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
        }

        const body = await request.json();
        const updateData: any = {};

        if (typeof body.isActive === 'boolean') {
            updateData.isActive = body.isActive;
        }

        // Allow updating role if provided
        if (body.role && ['admin', 'manager', 'user'].includes(body.role)) {
            updateData.role = body.role;
        }

        await connectDB();

        const updatedUser = await (User as any).findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!updatedUser) {
            return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }

        // Log action
        const { logAction } = await import('@/lib/logger');
        await logAction(
            session,
            'UPDATE_USER',
            'User',
            `Updated user ${updatedUser.email}`,
            { userId: id, changes: updateData }
        );

        return NextResponse.json(updatedUser);

    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// DELETE: Remove user
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        const { id } = params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
        }

        await connectDB();
        const deletedUser = await (User as any).findByIdAndDelete(id);

        if (!deletedUser) {
            return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
        }

        // Log action
        const { logAction } = await import('@/lib/logger');
        await logAction(
            session,
            'DELETE_USER',
            'User',
            `Deleted user ${deletedUser.email} (ID: ${id})`,
            { userId: id }
        );

        return NextResponse.json({ message: 'Utilisateur supprimé avec succès' });

    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
