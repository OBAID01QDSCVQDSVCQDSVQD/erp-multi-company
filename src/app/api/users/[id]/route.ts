import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    
    const user = await (User as any).findOne({
      _id: id,
      companyId: session.user.companyId,
    })
      .select('-password -__v')
      .populate('companyId', 'name');

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé. Seuls les administrateurs peuvent modifier les utilisateurs.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, email, role, permissions, isActive } = body;

    await connectDB();
    
    const user = await (User as any).findOne({
      _id: id,
      companyId: session.user.companyId,
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email && email.toLowerCase().trim() !== user.email) {
      const existingUser = await (User as any).findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: id }
      });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 400 }
        );
      }
      user.email = email.toLowerCase().trim();
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (role) user.role = role;
    if (permissions !== undefined) {
      user.permissions = role === 'admin' ? ['all'] : permissions;
    }
    if (isActive !== undefined) user.isActive = isActive;

    await (user as any).save();

    const userResponse = await (User as any).findById(user._id)
      .select('-password -__v')
      .populate('companyId', 'name');

    return NextResponse.json(userResponse);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé. Seuls les administrateurs peuvent désactiver les utilisateurs.' }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();
    
    const user = await (User as any).findOne({
      _id: id,
      companyId: session.user.companyId,
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Ne pas permettre de désactiver soi-même
    if (user._id.toString() === session.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas désactiver votre propre compte' },
        { status: 400 }
      );
    }

    // Désactiver au lieu de supprimer
    user.isActive = false;
    await (user as any).save();

    return NextResponse.json({ message: 'Utilisateur désactivé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la désactivation de l\'utilisateur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

