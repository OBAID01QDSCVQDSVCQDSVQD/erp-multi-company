import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();

        const user = await (User as any).findById(session.user.id)
            .select('loginHistory')
            .lean();

        if (!user) {
            return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
        }

        // Sort by timestamp desc and limit to last 20
        const history = (user.loginHistory || [])
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20);

        return NextResponse.json({ history });
    } catch (error) {
        console.error('Error fetching login history:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
