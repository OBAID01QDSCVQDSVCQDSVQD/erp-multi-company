import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    
    const users = await (User as any).find({ 
      companyId: session.user.companyId,
      isActive: true 
    })
      .select('-password -__v')
      .populate('companyId', 'name')
      .sort({ createdAt: -1 });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé. Seuls les administrateurs peuvent créer des utilisateurs.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, firstName, lastName, role, permissions } = body;
    
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await (User as any).findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new (User as any)({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'user',
      permissions: permissions || [],
      companyId: session.user.companyId,
      isActive: true,
    });

    await (user as any).save();

    // Retourner l'utilisateur sans le mot de passe
    const userResponse = await (User as any).findById(user._id)
      .select('-password -__v')
      .populate('companyId', 'name');

    return NextResponse.json(userResponse, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
