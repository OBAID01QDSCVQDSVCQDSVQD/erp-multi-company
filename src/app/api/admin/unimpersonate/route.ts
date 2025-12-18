import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { encode } from 'next-auth/jwt';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as any;

        if (!user || !user.isImpersonating || !user.adminEmail) {
            return NextResponse.json({ error: 'Action non autorisée ou session invalide' }, { status: 403 });
        }

        await connectDB();

        // Find the original admin user
        const adminUser = await (User as any).findOne({
            email: user.adminEmail,
            isActive: true
        });

        if (!adminUser) {
            return NextResponse.json({ error: 'Compte administrateur introuvable' }, { status: 404 });
        }

        // Generate a token to log back in as the admin
        // We treat this as "impersonating" the admin back? No, just a regular login token 
        // BUT our auth logic only accepts "impersonationToken" for passwordless login.
        // So we use the same mechanism: we "impersonate" the admin (ourselves).

        // We do NOT set isImpersonating: true in the token unless we want to stack impersonations (bad idea).
        // If we want to return to normal state, we just log in as admin.
        // However, our `authorize` logic looks for `decoded.isImpersonation === true`.
        // So we MUST set it to true to pass the content check, BUT we should explicitly clear the flag in the session?
        // 
        // Wait, if I set `isImpersonating: true` in the token, the `authorize` function will set `isImpersonating: true` in the user object.
        // This loops forever.
        // 
        // FIX: Update `auth.ts` logic?
        // Or simpler: Send a flag `isRevert: true` in the token.
        // 
        // Let's look at `auth.ts`:
        // It checks `if (decoded?.isImpersonation === true && decoded?.targetEmail)`
        // Then it sets `isImpersonating: true` in the RETURNED object.
        // 
        // I need to update `auth.ts` to ONLY set `isImpersonating: true` if `!decoded.isRevert`.
        // 
        // Let's modify `auth.ts` ONE MORE TIME to handle "Revert".
        // 
        // OR: Just accept that "Back to Admin" is technically "Impersonating the Admin".
        // But then the button "Back to Admin" will still show up?
        // Yes, because `session.isImpersonating` will be true.
        // 
        // So I DO need to fix `auth.ts`.
        // 
        // Plan:
        // 1. Update `auth.ts` to check for `isRevert` in the decoded token.
        // 2. If `isRevert` is true, do NOT set `isImpersonating: true` in the session.

        const token = await encode({
            token: {
                isImpersonation: true, // Needed to pass the initial check
                isRevert: true,        // signal to clear flags
                targetEmail: adminUser.email,
            } as any,
            secret: process.env.NEXTAUTH_SECRET!,
        });

        return NextResponse.json({ impersonationToken: token });

    } catch (error) {
        console.error('Error reverting impersonation:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
