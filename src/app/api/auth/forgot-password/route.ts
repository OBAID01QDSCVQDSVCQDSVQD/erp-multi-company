
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json(
                { message: 'Email requis' },
                { status: 400 }
            );
        }

        await dbConnect();

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // For security, do not reveal if user exists or not
            return NextResponse.json(
                { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' },
                { status: 200 }
            );
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        user.resetPasswordToken = token;
        user.resetPasswordExpires = expiry;
        await user.save();

        try {
            await sendPasswordResetEmail(user.email, token);
            return NextResponse.json(
                { message: 'Email de réinitialisation envoyé' },
                { status: 200 }
            );
        } catch (emailError) {
            console.error('Email send error:', emailError);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return NextResponse.json(
                { message: "Erreur lors de l'envoi de l'email" },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { message: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
