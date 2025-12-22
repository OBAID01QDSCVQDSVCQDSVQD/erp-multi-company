
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();
        const user = await User.findById(session.user.id);

        if (!user) {
            return NextResponse.json({ message: 'Utilisateur non trouvé' }, { status: 404 });
        }

        if (user.isTwoFactorEnabled) {
            return NextResponse.json({ message: '2FA est déjà activé' }, { status: 400 });
        }

        // Generate Secret
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, 'ERP Multi-Company', secret);

        // Save secret explicitly using native collection to bypass Mongoose schema cache
        console.log('[2FA Generate] Saving secret via native collection...');
        await User.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(user._id) },
            { $set: { twoFactorSecret: secret } }
        );
        console.log('[2FA Generate] Secret saved.');

        // Generate QR Code
        const qrCodeUrl = await QRCode.toDataURL(otpauth);

        return NextResponse.json({
            secret,
            qrCodeUrl
        });

    } catch (error) {
        console.error('2FA Generate Error:', error);
        return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
    }
}
