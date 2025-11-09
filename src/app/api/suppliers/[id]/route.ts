import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Supplier from '@/lib/models/Supplier';
import mongoose from 'mongoose';

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

    const tenantId = session.user.companyId?.toString() || '';

    const supplier = await (Supplier as any).findOne({
      _id: id,
      tenantId
    }).lean();

    if (!supplier) {
      return NextResponse.json(
        { error: 'Fournisseur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Erreur lors de la récupération du fournisseur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Normalize matricule fiscale if present
    if (body.matriculeFiscale) {
      // Remove all non-alphanumeric characters except letters and numbers
      const cleaned = body.matriculeFiscale.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      // Extract pattern: 7 digits + 1 letter + 3 digits
      const match = cleaned.match(/^(\d{7})([A-Z])(\d{3})$/);
      
      if (match) {
        body.matriculeFiscale = match[1] + match[2] + match[3];
      } else {
        // If format is invalid, accept as is (optional field)
        body.matriculeFiscale = cleaned;
      }
    }

    // Clean empty addresses
    if (body.adresseLivraison && (!body.adresseLivraison.ligne1 || !body.adresseLivraison.ville)) {
      delete body.adresseLivraison;
    }

    // Calculate rating.noteGlobale if sub-ratings exist
    if (body.rating) {
      const { qualite, delai, prix, service } = body.rating;
      const notes = [qualite, delai, prix, service].filter(n => n !== undefined && body.rating[n] !== undefined);
      if (notes.length > 0) {
        body.rating.noteGlobale = notes.reduce((a, n) => a + (body.rating[n] || 0), 0) / notes.length;
      }
    }

    const supplier = await (Supplier as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return NextResponse.json(
        { error: 'Fournisseur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fournisseur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Check if supplier is linked to documents
    // TODO: Add check for purchase orders, invoices, etc.
    const hasDocuments = false; // Placeholder

    if (hasDocuments) {
      // Archive instead of delete
      const supplier = await (Supplier as any).findOneAndUpdate(
        { _id: params.id, tenantId },
        { $set: { archive: true, actif: false } },
        { new: true }
      );

      if (!supplier) {
        return NextResponse.json(
          { error: 'Fournisseur non trouvé' },
          { status: 404 }
        );
      }

      return NextResponse.json({ message: 'Fournisseur archivé', supplier });
    }

    // Soft delete
    const supplier = await (Supplier as any).findOneAndUpdate(
      { _id: params.id, tenantId },
      { $set: { actif: false } },
      { new: true }
    );

    if (!supplier) {
      return NextResponse.json(
        { error: 'Fournisseur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Fournisseur désactivé', supplier });
  } catch (error) {
    console.error('Erreur lors de la suppression du fournisseur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
