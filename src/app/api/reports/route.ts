import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Invoice from '@/lib/models/Invoice';
import Customer from '@/lib/models/Customer';
import Product from '@/lib/models/Product';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    
    const companyId = session.user.companyId;

    // Récupérer les statistiques de base
    const [
      totalInvoices,
      totalRevenue,
      totalCustomers,
      totalProducts,
      invoices
    ] = await Promise.all([
      (Invoice as any).countDocuments({ companyId, type: 'invoice' }),
      (Invoice as any).aggregate([
        { $match: { companyId, type: 'invoice' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      (Customer as any).countDocuments({ companyId, isActive: true }),
      (Product as any).countDocuments({ companyId, isActive: true }),
      (Invoice as any).find({ companyId, type: 'invoice' })
        .populate('customerId', 'name')
        .sort({ date: -1 })
    ]);

    // Calculer le chiffre d'affaires total
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Générer les données mensuelles des 6 derniers mois
    const monthlyRevenue = [];
    const currentDate = new (Date as any)();
    for (let i = 5; i >= 0; i--) {
      const date = new (Date as any)(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      
      const monthInvoices = invoices.filter(invoice => {
        const invoiceDate = new (Date as any)(invoice.date);
        return invoiceDate.getMonth() === date.getMonth() && 
               invoiceDate.getFullYear() === date.getFullYear();
      });
      
      const monthRevenue = monthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      
      monthlyRevenue.push({
        month: monthName,
        revenue: monthRevenue
      });
    }

    // Calculer les top clients
    const customerTotals = new (Map as any)();
    invoices.forEach(invoice => {
      const customerName = invoice.customerId.name;
      const currentTotal = customerTotals.get(customerName) || 0;
      customerTotals.set(customerName, currentTotal + invoice.total);
    });

    const topCustomers = Array.from(customerTotals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const reportData = {
      totalInvoices,
      totalRevenue: revenue,
      totalCustomers,
      totalProducts,
      monthlyRevenue,
      topCustomers
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Erreur lors de la génération des rapports:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
