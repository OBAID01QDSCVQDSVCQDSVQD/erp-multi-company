
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();

        // Use native findOne for fresh data
        const user = await User.collection.findOne({
            _id: new mongoose.Types.ObjectId(session.user.id)
        });

        if (!user) {
            return NextResponse.json({ message: 'Utilisateur non trouvé' }, { status: 404 });
        }

        return NextResponse.json({
            isTwoFactorEnabled: !!user.isTwoFactorEnabled
        });

    } catch (error) {
        console.error('2FA Status Error:', error);
        return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
    }
}
