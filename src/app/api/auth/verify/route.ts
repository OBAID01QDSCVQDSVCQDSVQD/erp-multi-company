
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { message: 'Token manquant' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      // Redirect to error page or login with error
      return NextResponse.redirect(new URL('/auth/signin?error=VerificationLinkInvalid', req.url));
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return NextResponse.redirect(new URL('/auth/signin?success=EmailVerified', req.url));

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
