import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

// GET /api/admin/companies/[id]/users - Récupérer les utilisateurs d'une entreprise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id: companyId } = resolvedParams;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json({ error: 'ID entreprise invalide' }, { status: 400 });
    }

    await connectDB();

    // Convert companyId to ObjectId
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Find all users for this company (including inactive ones for admin view)
    const users = await (User as any).find({
      companyId: companyObjectId
    })
      .select('-password -__v')
      .populate('companyId', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${users.length} users for company ${companyId}`, users);
    console.log('Query used:', { companyId: companyObjectId });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching company users:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
