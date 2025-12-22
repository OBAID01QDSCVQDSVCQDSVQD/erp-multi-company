import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { authenticator } from 'otplib';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
        }

        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ message: 'Code requis' }, { status: 400 });
        }

        await connectDB();

        // Use native findOne to bypass stale Mongoose schema
        const user = await User.collection.findOne({
            _id: new mongoose.Types.ObjectId(session.user.id)
        });

        console.log(`[2FA Turn-On] User ID: ${session.user.id}`);
        console.log(`[2FA Turn-On] User Found: ${!!user}`);
        console.log(`[2FA Turn-On] Secret Present: ${!!user?.twoFactorSecret}`);

        if (!user || !user.twoFactorSecret) {
            console.error('[2FA Turn-On] Missing secret in DB');
            return NextResponse.json({ message: 'Configuration 2FA non trouvée' }, { status: 400 });
        }

        // Verify Token
        const isValid = authenticator.check(token, user.twoFactorSecret);

        if (!isValid) {
            return NextResponse.json({ message: 'Code invalide' }, { status: 400 });
        }

        // Enable 2FA
        console.log(`[2FA Turn-On] Enabling 2FA for user ${user._id}`);

        // Try Mongoose method first to ensure hooks run if any
        let updateResult = await (User as any).findByIdAndUpdate(user._id, {
            $set: { isTwoFactorEnabled: true }
        }, { new: true });

        if (!updateResult) {
            console.log('[2FA Turn-On] Mongoose update failed, trying native...');
            // Fallback to native
            await User.collection.updateOne(
                { _id: new mongoose.Types.ObjectId(user._id) },
                { $set: { isTwoFactorEnabled: true } }
            );
        }

        // Verify it stuck
        const verifyUser = await User.collection.findOne({
            _id: new mongoose.Types.ObjectId(user._id)
        });
        console.log(`[2FA Turn-On] Verification - isTwoFactorEnabled: ${verifyUser?.isTwoFactorEnabled}`);

        if (!verifyUser?.isTwoFactorEnabled) {
            throw new Error("Failed to persist 2FA status");
        }

        return NextResponse.json({ message: '2FA activé avec succès' });

    } catch (error) {
        console.error('2FA Turn On Error:', error);
        return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
    }
}
