import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import Supplier from '@/lib/models/Supplier';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';

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
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam) : 20;

        if (!q || q.length < 1) {
            return NextResponse.json([]);
        }

        await connectDB();

        const typeParam = searchParams.get('type');
        const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeQ, 'i');

        const results: any[] = [];
        let customers: any[] = [];
        let suppliers: any[] = [];
        let products: any[] = [];
        let directDocs: any[] = [];
        let relatedDocs: any[] = [];

        // 1. Search Customers
        if (!typeParam || typeParam === 'client' || typeParam === 'customer') {
            customers = await Customer.find({
                tenantId,
                $or: [
                    { raisonSociale: regex },
                    { nom: regex },
                    { prenom: regex },
                    { email: regex },
                    { matriculeFiscale: regex }
                ]
            }).select('_id raisonSociale nom prenom type email telephone mobile').limit(10);

            customers.forEach(c => {
                const name = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
                results.push({
                    _id: c._id,
                    type: 'Client',
                    title: name,
                    subtitle: c.email || c.mobile || c.telephone || 'Fiche Client',
                    url: `/customers/${c._id}`,
                    icon: 'UserGroupIcon'
                });
            });
        }

        // 2. Search Suppliers
        if (!typeParam || typeParam === 'supplier' || typeParam === 'fournisseur') {
            suppliers = await Supplier.find({
                tenantId,
                $or: [
                    { raisonSociale: regex },
                    { nom: regex },
                    { prenom: regex },
                    { email: regex },
                    { matriculeFiscale: regex }
                ]
            }).select('_id raisonSociale nom prenom type email').limit(10);

            suppliers.forEach(s => {
                const name = s.raisonSociale || `${s.nom || ''} ${s.prenom || ''}`.trim();
                results.push({
                    _id: s._id,
                    type: 'Fournisseur',
                    title: name,
                    subtitle: s.email || 'Fiche Fournisseur',
                    url: `/suppliers/${s._id}`,
                    icon: 'BuildingOfficeIcon'
                });
            });
        }

        // 3. Search Products
        if (!typeParam || typeParam === 'product' || typeParam === 'produit') {
            products = await Product.find({
                tenantId,
                $or: [
                    { name: regex },
                    { reference: regex },
                    { description: regex },
                    { category: regex }
                ]
            }).select('_id name reference sellPrice stock').limit(5);

            products.forEach(p => {
                results.push({
                    _id: p._id,
                    type: 'Produit',
                    title: p.name,
                    subtitle: `Ref: ${p.reference} | Stock: ${p.stock}`,
                    url: `/products/${p._id}`,
                    meta: `${p.sellPrice?.toFixed(3)} TND`,
                    icon: 'CubeIcon'
                });
            });
        }

        // Return early if specific type requested (Entity Search)
        if (typeParam) {
            return NextResponse.json(results.slice(0, limit));
        }

        // --- GLOBAL SEARCH CONTINUE (Documents, etc.) ---

        // 4. Search Documents (Direct match on number or ref)
        directDocs = await Document.find({
            tenantId,
            $or: [
                { numero: regex },
                { referenceExterne: regex }
            ]
        }).sort({ dateDoc: -1 }).limit(10);

        // Re-declaring variables inside the !typeParam block would be cleaner or lifting them up.
        // I will lift the arrays up.

        // WAIT: The code I am replacing (lines 31-132) covers the entity search + initial doc search.
        // I should just replace the whole body to be clean.

        // Let's rely on the previous structure but add guards.


        // Helper Map to find names easily
        const customerMap = new Map();
        customers.forEach(c => {
            const name = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
            customerMap.set(c._id.toString(), name);
        });

        const supplierMap = new Map();
        suppliers.forEach(s => {
            const name = s.raisonSociale || `${s.nom || ''} ${s.prenom || ''}`.trim();
            supplierMap.set(s._id.toString(), name);
        });

        // Merge docs, avoiding duplicates
        const allDocs = [...directDocs, ...relatedDocs];
        const uniqueBook = new Set();

        // We might need to fetch names for directDocs if they are not in our initial customer/supplier search
        // Collect missing IDs
        const missingCustomerIds = new Set<string>();
        const missingSupplierIds = new Set<string>();

        allDocs.forEach(d => {
            if (d.customerId && !customerMap.has(d.customerId.toString())) missingCustomerIds.add(d.customerId.toString());
            if (d.supplierId && !supplierMap.has(d.supplierId.toString())) missingSupplierIds.add(d.supplierId.toString());
        });

        // Fetch missing names
        if (missingCustomerIds.size > 0) {
            const extraCustomers = await Customer.find({ _id: { $in: Array.from(missingCustomerIds) } }).select('raisonSociale nom prenom');
            extraCustomers.forEach(c => {
                const name = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
                customerMap.set(c._id.toString(), name);
            });
        }
        if (missingSupplierIds.size > 0) {
            const extraSuppliers = await Supplier.find({ _id: { $in: Array.from(missingSupplierIds) } }).select('raisonSociale nom prenom');
            extraSuppliers.forEach(s => {
                const name = s.raisonSociale || `${s.nom || ''} ${s.prenom || ''}`.trim();
                supplierMap.set(s._id.toString(), name);
            });
        }

        allDocs.forEach(d => {
            if (uniqueBook.has(d._id.toString())) return;
            uniqueBook.add(d._id.toString());

            let url = '/documents/${d._id}';
            let typeLabel = d.type;
            let icon = 'DocumentTextIcon';

            const docCustomerId = d.customerId?.toString();
            const docSupplierId = d.supplierId?.toString();

            // Resolve Name
            let clientName = d.clientName || 'Client inconnu'; // Default fallback
            if (docCustomerId && customerMap.has(docCustomerId)) {
                clientName = customerMap.get(docCustomerId);
            } else if (docSupplierId && supplierMap.has(docSupplierId)) {
                clientName = supplierMap.get(docSupplierId);
            } else if (d.type === 'BC' || d.type === 'DEVIS' || d.type === 'FAC' || d.type === 'BL' || d.type === 'AVOIR') {
                // Try to be smarter for sales docs
                if (!d.customerId) clientName = 'Client Passager';
            } else if (d.type === 'PO' || d.type === 'BR' || d.type === 'FACFO') {
                if (!d.supplierId) clientName = 'Fournisseur Divers';
            } else if (clientName === 'Client inconnu' && !docCustomerId && !docSupplierId) {
                // If strictly no ID and no clientName field, maybe display Type?
                // Retaining 'Client inconnu' might be misleading if it's internal..
                // but most docs have a party.
                clientName = 'Entreprise';
            }

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
                    typeLabel = 'Facture Client';
                    break;
                case 'AVOIR':
                    url = `/sales/credit-notes/${d._id}`;
                    typeLabel = 'Avoir Client';
                    break;
                case 'BE': // Bon d'Entrée / Reception
                case 'BR':
                    url = `/purchases/receptions/${d._id}`;
                    typeLabel = 'Bon de Réception';
                    break;
                case 'CDE': // Commande Fournisseur
                case 'PO':
                    url = `/purchases/orders/${d._id}`;
                    typeLabel = 'Commande Fourn.';
                    break;
                case 'FACFO': // Facture Fournisseur
                case 'PI':
                    url = `/purchases/invoices/${d._id}`;
                    typeLabel = 'Facture Fourn.';
                    break;
                default:
                    url = `/documents/${d._id}`;
            }

            results.push({
                _id: d._id,
                type: typeLabel,
                title: d.numero,
                subtitle: `${clientName} | ${new Date(d.dateDoc).toLocaleDateString()}`,
                url: url,
                meta: d.totalTTC ? `${d.totalTTC.toFixed(3)} TND` : undefined,
                icon: icon
            });
        });

        // Prioritize: Exact Matches > Starts With > Contains
        results.sort((a, b) => {
            // Basic scoring
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            const qLower = safeQ.toLowerCase();

            const aExact = aTitle === qLower;
            const bExact = bTitle === qLower;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = aTitle.startsWith(qLower);
            const bStarts = bTitle.startsWith(qLower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            return 0;
        });

        return NextResponse.json(results.slice(0, limit));
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
