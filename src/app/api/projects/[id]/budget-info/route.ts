import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import DocumentModel from '@/lib/models/Document';
import Expense from '@/lib/models/Expense';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const { id } = await params;
    
    // Get optional excludeInvoiceId from query params (for editing)
    const { searchParams } = new URL(request.url);
    const excludeInvoiceId = searchParams.get('excludeInvoiceId');

    // Validate ObjectId format
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { error: 'ID de projet invalide' },
        { status: 400 }
      );
    }

    const projectObjectId = new mongoose.Types.ObjectId(id);
    const excludeInvoiceObjectId = excludeInvoiceId && /^[0-9a-fA-F]{24}$/.test(excludeInvoiceId) 
      ? new mongoose.Types.ObjectId(excludeInvoiceId) 
      : null;

    // Fetch project
    const project = await (Project as any).findOne({
      _id: projectObjectId,
      tenantId,
    }).lean();

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const budget = project.budget || 0;
    const currency = project.currency || 'TND';

    // Calculate current costs using the same logic as the project detail page
    let totalExpenses = 0;
    let totalProducts = 0;
    let totalLabor = 0;

    // 1. Calculate expenses (regular expenses only, INT_FAC will be added separately)
    const expenses = await (Expense as any).find({
      tenantId,
      projetId: projectObjectId,
    }).lean();
    
    totalExpenses = expenses.reduce((sum: number, exp: any) => {
      return sum + (exp.totalTTC || exp.totalHT || 0);
    }, 0);

    // Add internal invoices (INT_FAC), excluding the one being edited if provided
    const internalInvoiceQuery: any = {
      tenantId,
      type: 'INT_FAC',
      projetId: projectObjectId,
    };
    
    if (excludeInvoiceObjectId) {
      internalInvoiceQuery._id = { $ne: excludeInvoiceObjectId };
    }
    
    const internalInvoices = await (DocumentModel as any).find(internalInvoiceQuery).lean();

    const internalInvoicesTotal = internalInvoices.reduce((sum: number, inv: any) => {
      const invTotal = inv.totalTTC || inv.totalBaseHT || 0;
      return sum + invTotal;
    }, 0);
    
    totalExpenses += internalInvoicesTotal;

    // 2. Calculate products cost (same logic as /api/projects/[id]/products)
    const { default: MouvementStock } = await import('@/lib/models/MouvementStock');
    const { default: Product } = await import('@/lib/models/Product');
    
    // Get linked BL IDs from project
    const blIds = project.blIds?.map((bl: any) => bl._id?.toString() || bl.toString()) || [];
    
    // Get stock movements for this project
    const toNumber = (value: any): number => {
      if (typeof value === 'number') {
        return isNaN(value) ? 0 : value;
      }
      if (typeof value === 'string') {
        const normalized = value.replace(/\s+/g, '').replace(',', '.');
        const parsed = Number(normalized);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const stockMovements = await (MouvementStock as any).find({
      societeId: tenantId,
      $or: [
        { projectId: id },
        { source: 'BL', sourceId: { $in: blIds } }
      ],
      type: 'SORTIE', // Only outgoing movements (consumption)
    }).lean();
    
    // Get products from BLs if no stock movements
    let productsFromBLs: any[] = [];
    if (blIds.length > 0) {
      const bls = await (DocumentModel as any).find({
        _id: { $in: blIds.map((bid: string) => new mongoose.Types.ObjectId(bid)) },
        tenantId,
        type: 'BL',
      }).lean();
      
      for (const bl of bls) {
        if (bl.lignes && bl.lignes.length > 0) {
          for (const line of bl.lignes) {
            if (line.productId && line.quantite > 0) {
              const productId = line.productId.toString();
              const existing = productsFromBLs.find(p => p.productId === productId && p.blId === bl._id.toString());
              
              if (!existing) {
                productsFromBLs.push({
                  productId: productId,
                  blId: bl._id.toString(),
                  quantity: line.quantite,
                  prixUnitaireHT: line.prixUnitaireHT || 0,
                });
              }
            }
          }
        }
      }
    }
    
    // Get all product IDs
    const allProductIds = [
      ...new Set([
        ...stockMovements.map((m: any) => m.productId?.toString()).filter(Boolean),
        ...productsFromBLs.map((p: any) => p.productId).filter(Boolean),
      ])
    ];
    
    const products = allProductIds.length > 0 ? await (Product as any).find({
      _id: { $in: allProductIds.map((pid: string) => new mongoose.Types.ObjectId(pid)) },
      tenantId,
    }).lean() : [];
    
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    // Calculate total from stock movements
    stockMovements.forEach((movement: any) => {
      const productId = movement.productId?.toString();
      if (!productId) return;
      
      const product = productMap.get(productId) as any;
      if (!product) return;
      
      const costHT = toNumber(product.prixAchatRef ?? product.prixVenteHT ?? 0);
      const tvaPct = toNumber(product.tvaPct ?? product.tauxTVA ?? 0);
      const costTTC = costHT * (1 + tvaPct / 100);
      const quantity = toNumber(movement.qte ?? movement.quantite ?? movement.quantity ?? 0);
      
      totalProducts += costTTC * quantity;
    });
    
    // Add products from BLs (if not already counted from movements)
    productsFromBLs.forEach((blProduct: any) => {
      const productId = blProduct.productId;
      const product = productMap.get(productId) as any;
      if (!product) return;
      
      // Check if already processed from movements
      const alreadyCounted = stockMovements.some((m: any) => 
        m.productId?.toString() === productId && m.source === 'BL' && m.sourceId === blProduct.blId
      );
      
      if (!alreadyCounted) {
        const costHT = toNumber(
          blProduct.prixUnitaireHT ??
            product.prixAchatRef ??
            product.prixVenteHT ??
            0
        );
        const tvaPct = toNumber(product.tvaPct ?? product.tauxTVA ?? 0);
        const costTTC = costHT * (1 + tvaPct / 100);
        const quantity = toNumber(blProduct.quantity ?? 0);
        
        totalProducts += costTTC * quantity;
      }
    });

    // 3. Calculate labor cost (same logic as /api/projects/[id]/labor)
    const populatedProject = await (Project as any).findOne({
      _id: projectObjectId,
      tenantId,
    }).populate({
      path: 'assignedEmployees.employeeId',
      select: 'firstName lastName dailyRate',
      model: Employee,
    }).lean();

    const assignedEmployees = populatedProject?.assignedEmployees || [];

    for (const assignment of assignedEmployees) {
      const employeeId = assignment.employeeId?._id || assignment.employeeId;
      if (!employeeId) continue;

      const employeeObjectId = new mongoose.Types.ObjectId(
        typeof employeeId === 'string' ? employeeId : employeeId.toString()
      );
      const employee = typeof assignment.employeeId === 'object' ? assignment.employeeId : undefined;

      // Get attendance records for this employee and project
      const attendanceRecords = await (Attendance as any).find({
        tenantId,
        employeeId: employeeObjectId,
        $or: [
          { projectId: projectObjectId },
          { projectAssignments: projectObjectId },
        ],
      }).lean();

      const daysWorked = attendanceRecords.filter((a: any) => 
        a.checkIn && a.checkOut
      ).length;

      const totalHours = attendanceRecords.reduce((sum: number, a: any) => 
        sum + (a.totalHours || 0), 0
      );

      // Get daily rate from assignment or employee
      const dailyRate = assignment.dailyRate || employee?.dailyRate || 0;
      const hourlyRate = assignment.hourlyRate || (dailyRate / 8); // Assume 8 hours per day
      const laborCost = dailyRate > 0 ? (dailyRate * daysWorked) : (hourlyRate * totalHours);

      totalLabor += laborCost;
    }

    const currentCost = totalExpenses + totalProducts + totalLabor;
    const remaining = budget > 0 ? budget - currentCost : 0;
    const budgetUsed = budget > 0 ? (currentCost / budget) * 100 : 0;
    const isExceeded = currentCost > budget && budget > 0;

    // Debug: Log calculation details
    console.log('=== Project Budget Calculation ===');
    console.log(`Project ID: ${id}`);
    console.log(`Budget: ${budget} ${currency}`);
    console.log(`Total Expenses: ${totalExpenses} (Regular: ${totalExpenses - (internalInvoices?.reduce((s: number, inv: any) => s + (inv.totalTTC || inv.totalBaseHT || 0), 0) || 0)}, Internal Invoices: ${internalInvoices?.reduce((s: number, inv: any) => s + (inv.totalTTC || inv.totalBaseHT || 0), 0) || 0})`);
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Total Labor: ${totalLabor}`);
    console.log(`Current Cost: ${currentCost}`);
    console.log(`Internal Invoices Count: ${internalInvoices?.length || 0}`);
    if (internalInvoices && internalInvoices.length > 0) {
      console.log('Internal Invoices Details:');
      internalInvoices.forEach((inv: any, idx: number) => {
        console.log(`  ${idx + 1}. ${inv.numero || inv._id}: ${inv.totalTTC || inv.totalBaseHT || 0} TND`);
      });
    }
    console.log('================================');

    return NextResponse.json({
      budget,
      currency,
      currentCost,
      remaining,
      budgetUsed: Math.min(budgetUsed, 100),
      isExceeded,
      breakdown: {
        expenses: totalExpenses,
        products: totalProducts,
        labor: totalLabor,
      },
    });
  } catch (error: any) {
    console.error('Error fetching project budget info:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

