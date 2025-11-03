import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import Company from '@/lib/models/Company';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('Login attempt for:', email);
    
    await connectDB();
    
    const user = await (User as any).findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    });
    
    if (!user) {
      console.log('User not found:', email);
      return NextResponse.json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      }, { status: 401 });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for:', email);
      return NextResponse.json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      }, { status: 401 });
    }
    
    // Mettre à jour la dernière connexion
    await (User as any).findByIdAndUpdate(user._id, { lastLogin: new Date() });
    
    // Récupérer les informations de l'entreprise
    const company = await (Company as any).findById(user.companyId);
    
    // Créer un token JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      },
      process.env.NEXTAUTH_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for:', user.email);
    
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        companyId: user.companyId.toString(),
        companyName: company ? company.name : 'Entreprise',
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur serveur' 
    }, { status: 500 });
  }
}
