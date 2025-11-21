import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

// PATCH /api/expenses/[id] - Mettre à jour une dépense (validation/paiement)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const tenantId = session.user.companyId;

    await connectDB();

    // Vérifier que la dépense appartient au tenant
    const expense = await (Expense as any).findOne({ _id: id, tenantId });
    
    if (!expense) {
      return NextResponse.json(
        { error: 'Dépense non trouvée' },
        { status: 404 }
      );
    }

    // Nettoyer les champs optionnels (convertir empty strings en undefined)
    const expenseData: any = { ...body };
    if (expenseData.description === '') {
      expenseData.description = undefined;
    }
    if (expenseData.centreCoutId === '') {
      expenseData.centreCoutId = undefined;
    }
    if (expenseData.projetId === '') {
      expenseData.projetId = undefined;
    }
    if (expenseData.fournisseurId === '') {
      expenseData.fournisseurId = undefined;
    }
    if (expenseData.employeId === '') {
      expenseData.employeId = undefined;
    }
    if (expenseData.referencePiece === '') {
      expenseData.referencePiece = undefined;
    }
    if (expenseData.notesInterne === '') {
      expenseData.notesInterne = undefined;
    }

    // Mise à jour de la dépense
    const updatedExpense = await (Expense as any).findByIdAndUpdate(
      id,
      { ...expenseData, updatedAt: new Date() },
      { new: true }
    ).populate([
      { path: 'categorieId', select: 'nom code icone' },
      { path: 'centreCoutId', select: 'code nom' },
      { path: 'fournisseurId', select: 'type raisonSociale nom prenom' },
      { path: 'employeId', select: 'firstName lastName' },
      { path: 'projetId', select: 'name' }
    ]);

    return NextResponse.json(updatedExpense);

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la dépense:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// GET /api/expenses/[id] - Récupérer une dépense spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = params;
    const tenantId = session.user.companyId;

    await connectDB();

    const expense = await (Expense as any).findOne({ _id: id, tenantId })
      .populate([
        { path: 'categorieId', select: 'nom code icone' },
        { path: 'centreCoutId', select: 'code nom' },
        { path: 'fournisseurId', select: 'type raisonSociale nom prenom' },
        { path: 'employeId', select: 'firstName lastName' },
        { path: 'projetId', select: 'name' }
      ]);

    if (!expense) {
      return NextResponse.json(
        { error: 'Dépense non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json(expense);

  } catch (error) {
    console.error('Erreur lors de la récupération de la dépense:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/[id] - Supprimer une dépense
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = params;
    const tenantId = session.user.companyId;

    await connectDB();

    const expense = await (Expense as any).findOneAndDelete({ _id: id, tenantId });

    if (!expense) {
      return NextResponse.json(
        { error: 'Dépense non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Dépense supprimée avec succès' });

  } catch (error) {
    console.error('Erreur lors de la suppression de la dépense:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
