import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();

        // Generate 10 codes
        const plainCodes = [];
        const hashedCodes = [];

        for (let i = 0; i < 10; i++) {
            // Generate a random code: XXXX-XXXX
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;

            plainCodes.push(formattedCode);

            const hash = await bcrypt.hash(formattedCode, 10);
            hashedCodes.push({ code: hash, used: false });
        }

        // Save to DB (Native update to ensure it bypasses potential caching issues)
        await User.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(session.user.id) },
            { $set: { twoFactorBackupCodes: hashedCodes } }
        );

        return NextResponse.json({ codes: plainCodes });

    } catch (error) {
        console.error('Backup Codes Generation Error:', error);
        return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
    }
}
