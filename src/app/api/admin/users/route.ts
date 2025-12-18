import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import Company from '@/lib/models/Company';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }

        await connectDB();

        // Fetch all users sorted by creation date, populate company
        // Using 'any' for model to avoid strict typing issues during quick dev
        const users = await (User as any).find({})
            .populate('companyId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Transform data to ensure company name is accessible flattened if needed by frontend
        const formattedUsers = users.map((user: any) => ({
            ...user,
            companyName: user.companyId?.name || 'Sans Entreprise'
        }));

        return NextResponse.json(formattedUsers);

    } catch (error) {
        console.error('Error fetching admin users:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
