import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Supplier from '@/lib/models/Supplier';
import Document from '@/lib/models/Document';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');
        const tenantId = session.user.companyId || (request.headers.get('X-Tenant-Id') as string);

        if (!q || q.length < 2) {
            return NextResponse.json([]);
        }

        await connectDB();

        const regex = new RegExp(q, 'i');

        // Parallel search
        const results: any[] = [];

        // 1. Search Customers
        const customers = await Customer.find({
            tenantId,
            $or: [
                { raisonSociale: regex },
                { nom: regex },
                { prenom: regex },
                { email: regex }
            ]
        }).select('_id raisonSociale nom prenom type').limit(5);

        customers.forEach(c => {
            const name = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
            results.push({
                _id: c._id,
                type: 'Client',
                title: name,
                subtitle: 'Fiche Client',
                url: `/customers/${c._id}`
            });
        });

        // 2. Search Suppliers
        const suppliers = await Supplier.find({
            tenantId,
            $or: [
                { raisonSociale: regex },
                { nom: regex },
                { prenom: regex },
                { email: regex }
            ]
        }).select('_id raisonSociale nom prenom type').limit(5);

        suppliers.forEach(s => {
            const name = s.raisonSociale || `${s.nom || ''} ${s.prenom || ''}`.trim();
            results.push({
                _id: s._id,
                type: 'Fournisseur',
                title: name,
                subtitle: 'Fiche Fournisseur',
                url: `/suppliers/${s._id}`
            });
        });

        // 3. Search Documents (Direct match on number or ref)
        const directDocs = await Document.find({
            tenantId,
            $or: [
                { numero: regex },
                { referenceExterne: regex }
            ]
        }).sort({ dateDoc: -1 }).limit(5);

        // 4. Search Documents by Customer/Supplier IDs found
        const customerIds = customers.map(c => c._id);
        const supplierIds = suppliers.map(s => s._id);

        let relatedDocs: any[] = [];
        if (customerIds.length > 0 || supplierIds.length > 0) {
            relatedDocs = await Document.find({
                tenantId,
                $or: [
                    { customerId: { $in: customerIds } },
                    { supplierId: { $in: supplierIds } }
                ]
            }).sort({ dateDoc: -1 }).limit(10);
        }

        // Merge docs, avoiding duplicates
        const allDocs = [...directDocs, ...relatedDocs];
        const uniqueBook = new Set();

        allDocs.forEach(d => {
            if (uniqueBook.has(d._id.toString())) return;
            uniqueBook.add(d._id.toString());

            let url = '/';
            let typeLabel = d.type;

            switch (d.type) {
                case 'DEVIS':
                    url = `/sales/quotes/${d._id}`;
                    typeLabel = 'Devis';
                    break;
                case 'BC':
                    url = `/sales/orders/${d._id}`;
                    typeLabel = 'Commande Client';
                    break;
                case 'BL':
                    url = `/sales/deliveries/${d._id}`;
                    typeLabel = 'Bon de Livraison';
                    break;
                case 'FAC':
                    url = `/sales/invoices/${d._id}`;
                    typeLabel = 'Facture';
                    break;
                case 'AVOIR':
                    url = `/sales/credit-notes/${d._id}`;
                    typeLabel = 'Avoir';
                    break; // Add other types as needed
                case 'PO':
                    url = `/purchases/orders/${d._id}`; // Assumption
                    typeLabel = 'Commande Fournisseur';
                    break;
                case 'FACFO':
                    url = `/purchases/invoices/${d._id}`; // Assumption
                    typeLabel = 'Facture Fournisseur';
                    break;
                default:
                    url = `/documents/${d._id}`;
            }

            results.push({
                _id: d._id,
                type: typeLabel,
                title: d.numero,
                subtitle: `Date: ${new Date(d.dateDoc).toLocaleDateString()}`,
                url: url,
                meta: d.totalTTC ? `${d.totalTTC.toFixed(3)} ${d.devise || 'TND'}` : undefined
            });
        });

        return NextResponse.json(results.slice(0, 15)); // Limit total results
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
