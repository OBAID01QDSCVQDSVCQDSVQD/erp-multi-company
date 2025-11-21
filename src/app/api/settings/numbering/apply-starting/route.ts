import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Counter from '@/lib/models/Counter';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const body = await request.json();
    const { startingNumbers } = body;
    
    if (!startingNumbers || typeof startingNumbers !== 'object') {
      return NextResponse.json(
        { error: 'startingNumbers est requis' },
        { status: 400 }
      );
    }

    await connectDB();

    // Mapping des noms de séquence
    const seqNameMap: Record<string, string> = {
      devis: 'devis',
      bl: 'bl',
      facture: 'fac',
      avoir: 'avoir',
    };

    // Appliquer les numéros de départ aux compteurs
    const updates: Promise<any>[] = [];
    
    for (const [key, value] of Object.entries(startingNumbers)) {
      if (typeof value === 'number' && value >= 0) {
        const seqName = seqNameMap[key];
        if (seqName) {
          // Vérifier si le compteur existe déjà
          const existingCounter = await (Counter as any).findOne({ tenantId, seqName });
          
          // Si le compteur n'existe pas ou sa valeur est inférieure au starting number
          if (!existingCounter || existingCounter.value < value) {
            updates.push(
              (Counter as any).findOneAndUpdate(
                { tenantId, seqName },
                { $set: { value } },
                { upsert: true, new: true }
              )
            );
          }
        }
      }
    }

    await Promise.all(updates);

    return NextResponse.json({ 
      success: true,
      message: 'Numéros de départ appliqués avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'application des numéros de départ:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}







