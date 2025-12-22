import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import User from '@/lib/models/User';
import connectToDatabase from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        await connectToDatabase();
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ message: 'Email requis' }, { status: 400 });
        }

        // Clean email
        const cleanEmail = email.toLowerCase().trim();

        // Use direct collection access to avoid mongoose middleware/casting issues slightly
        // But here we need to write, so Mongoose model is fine usually.
        // Let's stick to Mongoose Model for simplicity unless we hit issues.
        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            // Fake success to prevent enumeration
            return NextResponse.json({ message: 'Code envoyé' });
        }

        if (!user.isTwoFactorEnabled) {
            return NextResponse.json({ message: '2FA non activé pour ce compte' }, { status: 400 });
        }

        // Generate 6 digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash it
        const hashedCode = await bcrypt.hash(code, 10);
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save using updateOne to minimize side effects
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    emailTwoFactorCode: hashedCode,
                    emailTwoFactorCodeExpires: expires
                }
            }
        );

        // Send Email
        await sendEmail({
            to: user.email,
            subject: 'Votre code de vérification - ERP',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #4F46E5; text-align: center;">Code de connexion</h2>
                    <p style="text-align: center; font-size: 16px; color: #333;">Voici votre code de vérification temporaire :</p>
                    <div style="background: #f4f4f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 8px; margin: 20px 0;">
                        ${code}
                    </div>
                    <p style="text-align: center; color: #666; font-size: 14px;">Ce code expire dans 10 minutes.</p>
                </div>
            `
        });

        return NextResponse.json({ message: 'Code envoyé avec succès' });

    } catch (error) {
        console.error("Send Email 2FA Error:", error);
        return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 });
    }
}
