import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Token manquant' 
      }, { status: 401 });
    }
    
    const decoded = jwt.verify(
      token, 
      process.env.NEXTAUTH_SECRET || 'fallback-secret'
    ) as any;
    
    return NextResponse.json({
      success: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        companyId: decoded.companyId,
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Token invalide' 
    }, { status: 401 });
  }
}

