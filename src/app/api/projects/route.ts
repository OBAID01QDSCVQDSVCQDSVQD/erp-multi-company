import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering since we use getServerSession which uses headers()
export const dynamic = 'force-dynamic';

// GET /api/projects - Get projects
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const actif = searchParams.get('actif');

    // TODO: Implement projects model and database logic
    // For now, return empty array to prevent 404 errors
    const projects: any[] = [];

    // Filter by actif if requested
    let filteredProjects = projects;
    if (actif === 'true') {
      filteredProjects = projects.filter((p: any) => p.actif !== false);
    }

    return NextResponse.json({
      items: filteredProjects,
      total: filteredProjects.length,
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des projets:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

