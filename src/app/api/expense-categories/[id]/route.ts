import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import ExpenseCategory from '@/lib/models/ExpenseCategory';

// PATCH /api/expense-categories/[id] - Mettre à jour une catégorie
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

    // Vérifier que la catégorie appartient au tenant
    const category = await (ExpenseCategory as any).findOne({ _id: id, tenantId });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    // Si le code change, vérifier qu'il n'existe pas déjà
    if (body.code && body.code !== category.code) {
      const existingCategory = await (ExpenseCategory as any).findOne({
        tenantId,
        code: body.code.toUpperCase(),
        _id: { $ne: id }
      });

      if (existingCategory) {
        return NextResponse.json(
          { error: 'Une catégorie avec ce code existe déjà' },
          { status: 400 }
        );
      }
    }

    // Mise à jour de la catégorie
    const updatedCategory = await (ExpenseCategory as any).findByIdAndUpdate(
      id,
      { 
        ...body, 
        code: body.code ? body.code.toUpperCase() : category.code,
        updatedAt: new Date() 
      },
      { new: true }
    );

    return NextResponse.json(updatedCategory);

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/expense-categories/[id] - Supprimer une catégorie
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

    // Vérifier que la catégorie appartient au tenant
    const category = await (ExpenseCategory as any).findOne({ _id: id, tenantId });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier si la catégorie est utilisée dans des dépenses
    const Expense = (await import('@/lib/models/Expense')).default;
    const expenseCount = await (Expense as any).countDocuments({ categorieId: id });

    if (expenseCount > 0) {
      return NextResponse.json(
        { error: 'Cette catégorie est utilisée dans des dépenses et ne peut pas être supprimée' },
        { status: 400 }
      );
    }

    // Suppression logique (désactivation)
    await (ExpenseCategory as any).findByIdAndUpdate(id, { isActive: false });

    return NextResponse.json({ message: 'Catégorie supprimée avec succès' });

  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
