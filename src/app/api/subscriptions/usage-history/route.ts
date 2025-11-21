import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import mongoose from 'mongoose';

// Force dynamic rendering since we use getServerSession which uses headers()
export const dynamic = 'force-dynamic';

// GET - Get monthly usage history for current company
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const companyId = session.user.companyId;
    const tenantId = companyId.toString();

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Calculate usage for the last 12 months
    const usageHistory = [];

    for (let i = 11; i >= 0; i--) {
      // Calculate the month to process
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;
      
      // Handle year rollover
      while (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      
      // Start and end of the month
      const startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      // Count sales documents (DEVIS, BL, FAC)
      // Document model uses tenantId as string
      const salesDocsCount = await Document.countDocuments({
        tenantId: tenantId,
        type: { $in: ['DEVIS', 'BL', 'FAC'] },
        dateDoc: {
          $gte: startDate,
          $lte: endDate,
        },
      });

      // Count purchase invoices
      // PurchaseInvoice model uses societeId as string
      const purchaseInvoicesCount = await PurchaseInvoice.countDocuments({
        societeId: tenantId,
        dateFacture: {
          $gte: startDate,
          $lte: endDate,
        },
        statut: { $ne: 'annulee' }, // Exclude cancelled invoices
      });

      // Total documents for this month
      const totalDocuments = salesDocsCount + purchaseInvoicesCount;

      // Format month name in French
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];

      usageHistory.push({
        month: `${monthNames[targetMonth]} ${targetYear}`,
        monthNumber: targetMonth + 1,
        year: targetYear,
        documents: totalDocuments,
        salesDocuments: salesDocsCount,
        purchaseDocuments: purchaseInvoicesCount,
      });
    }

    return NextResponse.json({ usageHistory });
  } catch (error: any) {
    console.error('Error fetching usage history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique d\'utilisation' },
      { status: 500 }
    );
  }
}

