
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse('Non autorisé', { status: 401 });
        }

        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return new NextResponse('Champs manquants', { status: 400 });
        }

        if (newPassword.length < 8) {
            return new NextResponse('Le mot de passe doit contenir au moins 8 caractères', { status: 400 });
        }

        await connectDB();

        // @ts-ignore
        const user = await User.findById(session.user.id).select('+password');
        if (!user) {
            return new NextResponse('Utilisateur non trouvé', { status: 404 });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return new NextResponse('Mot de passe actuel incorrect', { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return NextResponse.json({ message: 'Mot de passe mis à jour' });
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        return new NextResponse('Erreur interne', { status: 500 });
    }
}
