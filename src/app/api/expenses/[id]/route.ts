import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Project from '@/lib/models/Project';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import Supplier from '@/lib/models/Supplier';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

// PATCH /api/expenses/[id] - Mettre à jour une dépense (validation/paiement)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await request.json();

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    await connectDB();

    // Ensure models are registered before using populate
    // Note: Implicit registration via top-level imports should handle this,
    // but explicit model passing to populate is safer.

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

    // Track approval and payment
    const currentStatut = expense.statut;
    const newStatut = expenseData.statut;

    // Vérifier que l'utilisateur est admin pour changer le statut
    const userRole = session.user.role;
    const userPermissions = session.user.permissions || [];
    const isAdmin = userRole === 'admin' || userPermissions.includes('all');

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Seuls les administrateurs peuvent modifier le statut' },
        { status: 403 }
      );
    }

    // Empêcher le changement de statut depuis "paye" vers une autre état
    if (currentStatut === 'paye' && newStatut !== 'paye') {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut d\'une dépense déjà payée' },
        { status: 400 }
      );
    }

    // Si le statut change vers "valide", enregistrer l'approbation
    if (newStatut === 'valide' && currentStatut !== 'valide') {
      expenseData.approvedBy = new mongoose.Types.ObjectId(session.user.id);
      expenseData.approvedAt = new Date();
    }

    // Si le statut change vers "paye", enregistrer le paiement
    if (newStatut === 'paye' && currentStatut !== 'paye') {
      expenseData.paidBy = new mongoose.Types.ObjectId(session.user.id);
      expenseData.paidAt = new Date();
    }

    // Mise à jour de la dépense
    const updatedExpense = await ((Expense as any).findByIdAndUpdate(
      id,
      { ...expenseData, updatedAt: new Date() },
      { new: true }
    ) as any).populate([
      { path: 'approvedBy', select: 'firstName lastName', model: User as any },
      { path: 'paidBy', select: 'firstName lastName', model: User as any },
      { path: 'categorieId', select: 'nom code icone', model: ExpenseCategory as any },
      // { path: 'centreCoutId', select: 'code nom' }, // Model not implemented yet
      { path: 'fournisseurId', select: 'type raisonSociale nom prenom', model: Supplier as any },
      { path: 'employeId', select: 'firstName lastName', model: User as any },
      { path: 'projetId', select: 'name', model: Project as any }
    ] as any);

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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    await connectDB();

    // Ensure models are registered before using populate
    // Note: Implicit registration via top-level imports should handle this,
    // but explicit model passing to populate is safer.

    const expense = await ((Expense as any).findOne({ _id: id, tenantId }) as any)
      .populate([
        { path: 'categorieId', select: 'nom code icone', model: ExpenseCategory as any },
        // { path: 'centreCoutId', select: 'code nom' }, // Model not implemented yet
        { path: 'fournisseurId', select: 'type raisonSociale nom prenom', model: Supplier as any },
        { path: 'employeId', select: 'firstName lastName', model: User as any },
        { path: 'projetId', select: 'name', model: Project as any },
        { path: 'approvedBy', select: 'firstName lastName', model: User as any },
        { path: 'paidBy', select: 'firstName lastName', model: User as any }
      ] as any);

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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

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
