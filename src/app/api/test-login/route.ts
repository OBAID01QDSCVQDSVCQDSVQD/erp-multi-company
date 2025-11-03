import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('Test login API called with:', { email, password });
    
    await connectDB();
    
    const user = await (User as any).findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    }).populate('companyId');
    
    console.log('User found:', user ? 'YES' : 'NO');
    
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 401 });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }
    
    console.log('Login successful for:', user.email);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        companyId: user.companyId._id.toString(),
        companyName: user.companyId.name,
      }
    });
    
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

