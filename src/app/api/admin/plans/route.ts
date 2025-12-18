import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Plan from '@/lib/models/Plan';

// GET: List all plans (including inactive, for admin)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        await connectDB();
        const plans = await (Plan as any).find({}).sort({ sortOrder: 1 });
        return NextResponse.json(plans);
    } catch (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

// POST: Create a new plan
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
        }

        const body = await request.json();
        await connectDB();

        // Basic validation
        if (!body.name || !body.slug || body.price === undefined) {
            return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
        }

        const existing = await (Plan as any).findOne({ slug: body.slug });
        if (existing) {
            return NextResponse.json({ error: 'Ce slug existe déjà' }, { status: 400 });
        }

        const plan = await (Plan as any).create(body);
        return NextResponse.json(plan, { status: 201 });
    } catch (error: any) {
        console.error('Error creating plan:', error);
        return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
    }
}
