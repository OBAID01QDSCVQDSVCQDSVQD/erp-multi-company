import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Reception from '@/lib/models/Reception';
import { NumberingService } from '@/lib/services/NumberingService';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        await connectDB();

        const tenantId = session.user.companyId?.toString() || '';
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');

        const query: any = {
            tenantId,
            type: 'RETOUR_ACHAT'
        };

        let returns = await (Document as any).find(query)
            .sort('-createdAt')
            .lean();

        // Populate supplierId and brId
        const Supplier = (await import('@/lib/models/Supplier')).default;
        const supplierIds = [...new Set(returns.map((r: any) => r.supplierId).filter(Boolean))];
        const brIds = [...new Set(returns.map((r: any) => r.brId).filter(Boolean))];

        // Fetch suppliers
        if (supplierIds.length > 0) {
            const suppliers = await (Supplier as any).find({
                _id: { $in: supplierIds.map((id: any) => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id) },
                tenantId,
            }).select('nom prenom raisonSociale').lean();

            const supplierMap = new Map(suppliers.map((s: any) => [s._id.toString(), s]));

            for (const returnDoc of returns) {
                if (returnDoc.supplierId) {
                    const supplier = supplierMap.get(
                        typeof returnDoc.supplierId === 'string'
                            ? returnDoc.supplierId
                            : returnDoc.supplierId.toString()
                    );
                    if (supplier) {
                        returnDoc.supplierId = supplier;
                    }
                }
            }
        }

        // Fetch BRs to get numbers
        if (brIds.length > 0) {
            const brs = await (Reception as any).find({
                _id: { $in: brIds.map((id: any) => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id) },
                societeId: tenantId,
            }).select('numero').lean();

            const brMap = new Map(brs.map((br: any) => [br._id.toString(), br.numero]));

            for (const returnDoc of returns) {
                if (returnDoc.brId) {
                    const brNumero = brMap.get(
                        typeof returnDoc.brId === 'string'
                            ? returnDoc.brId
                            : returnDoc.brId.toString()
                    );
                    if (brNumero) {
                        returnDoc.brNumero = brNumero;
                    }
                }
            }
        }

        // Filter by search query
        let filteredReturns = returns;
        if (q) {
            const searchLower = q.toLowerCase();
            filteredReturns = returns.filter((returnDoc: any) => {
                const matchesNumero = returnDoc.numero?.toLowerCase().includes(searchLower);
                const supplier = returnDoc.supplierId;
                let supplierName = '';
                if (supplier) {
                    if (typeof supplier === 'object' && supplier !== null) {
                        supplierName = (supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || '').toLowerCase();
                    }
                }
                const matchesSupplier = supplierName.includes(searchLower);
                const matchesBR = returnDoc.brNumero?.toLowerCase().includes(searchLower);
                return matchesNumero || matchesSupplier || matchesBR;
            });
        }

        return NextResponse.json({ items: filteredReturns, total: filteredReturns.length });
    } catch (error) {
        console.error('Erreur GET /purchases/returns:', error);
        const errorMessage = (error as Error).message || 'Erreur lors de la récupération des retours d\'achat';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

// Helper to validate stock availability before processing
async function validateStockAvailability(lines: any[], warehouseId: string | undefined, tenantId: string) {
    const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
    const Product = (await import('@/lib/models/Product')).default;

    for (const line of lines || []) {
        if (!line.productId || !line.quantite || line.quantite <= 0) continue;

        const productIdStr = line.productId.toString();

        // Check if product exists and is stocked
        const product = await (Product as any).findOne({
            _id: productIdStr,
            tenantId,
        }).lean();

        if (!product || product.estStocke === false) {
            continue;
        }

        // CHECK STOCK AVAILABILITY
        const matchQuery: any = {
            societeId: tenantId,
            productId: productIdStr,
        };

        if (warehouseId) {
            // Check if this is the default warehouse handling
            const Warehouse = (await import('@/lib/models/Warehouse')).default;
            const warehouse = await (Warehouse as any).findOne({
                _id: warehouseId,
                tenantId,
            }).lean();

            if (warehouse && warehouse.isDefault) {
                matchQuery.$or = [
                    { warehouseId: new mongoose.Types.ObjectId(warehouseId) },
                    { warehouseId: { $exists: false } },
                    { warehouseId: null }
                ];
            } else {
                matchQuery.warehouseId = new mongoose.Types.ObjectId(warehouseId);
            }
        }

        const stockAggregation = await (MouvementStock as any).aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$productId',
                    totalEntree: { $sum: { $cond: [{ $eq: ['$type', 'ENTREE'] }, '$qte', 0] } },
                    totalSortie: { $sum: { $cond: [{ $eq: ['$type', 'SORTIE'] }, '$qte', 0] } },
                    totalInventaire: { $sum: { $cond: [{ $eq: ['$type', 'INVENTAIRE'] }, '$qte', 0] } },
                },
            },
        ]);

        const currentStock = stockAggregation.length > 0
            ? (stockAggregation[0].totalEntree - stockAggregation[0].totalSortie + (stockAggregation[0].totalInventaire || 0))
            : 0;

        if (currentStock < line.quantite) {
            throw new Error(`Stock insuffisant pour le produit "${line.designation || 'Inconnu'}". Disponible: ${currentStock}, Demandé: ${line.quantite}`);
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const body = await request.json();
        await connectDB();

        const tenantId = session.user.companyId?.toString() || '';

        // Validate stock availability BEFORE any DB writes
        // This prevents the creation of the document if stock is insufficient
        await validateStockAvailability(body.lignes, body.warehouseId, tenantId);

        // Generate numero
        const numero = await NumberingService.next(tenantId, 'retour_achat');

        // Create return document
        const returnDoc = new Document({
            ...body,
            tenantId,
            type: 'RETOUR_ACHAT',
            numero,
            createdBy: session.user.email,
            statut: 'VALIDEE', // Returns are automatically validated
            brId: body.brId ? body.brId : undefined,
            supplierId: body.supplierId ? body.supplierId : undefined,
            warehouseId: body.warehouseId ? new mongoose.Types.ObjectId(body.warehouseId) : undefined,
        });

        // Calculate totals
        calculateDocumentTotals(returnDoc);

        await (returnDoc as any).save();

        // Update BR quantities and add note
        if (body.brId) {
            await updateBRForReturn(returnDoc, body.brId, tenantId, session.user.email);
        }

        // Remove products from stock
        // We validated before, but this function does the actual movement creation
        await removeProductsFromStock(returnDoc, tenantId, session.user.email);

        return NextResponse.json(returnDoc, { status: 201 });
    } catch (error) {
        console.error('Erreur POST /purchases/returns:', error);

        // Handle custom stock error message specifically to pass it to the frontend
        if ((error as Error).message.includes('Stock insuffisant')) {
            return NextResponse.json(
                { error: (error as Error).message },
                { status: 400 } // Bad Request for validation error, not 500
            );
        }

        const errorMessage = (error as Error).message || 'Erreur lors de la création du retour d\'achat';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

function calculateDocumentTotals(doc: any) {
    let totalBaseHT = 0;
    let totalTVA = 0;

    if (!doc.lignes || !Array.isArray(doc.lignes)) {
        doc.totalBaseHT = 0;
        doc.totalTVA = 0;
        doc.totalTTC = 0;
        doc.netAPayer = 0;
        return;
    }

    doc.lignes.forEach((line: any) => {
        const quantite = line.quantite || 0;
        const remise = line.remisePct || 0;
        const prixHT = (line.prixUnitaireHT || 0) * (1 - remise / 100);
        const montantHT = prixHT * quantite;
        totalBaseHT += montantHT;

        if (line.tvaPct) {
            totalTVA += montantHT * (line.tvaPct / 100);
        }
    });

    doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
    doc.totalTVA = Math.round(totalTVA * 100) / 100;

    // Add timbre fiscal if it exists in the document
    const timbreFiscal = doc.timbreFiscal || 0;
    doc.totalTTC = doc.totalBaseHT + doc.totalTVA + timbreFiscal;
    doc.netAPayer = doc.totalTTC;
}

async function updateBRForReturn(returnDoc: any, brId: string, tenantId: string, createdBy: string) {
    try {
        // Fetch BR
        const br = await (Reception as any).findOne({
            _id: brId,
            societeId: tenantId,
        });

        if (!br) {
            throw new Error(`Bon de réception ${brId} non trouvé`);
        }

        // Update quantities in BR lines
        // Reception uses 'qteRecue' instead of 'quantite'
        const updatedLines = br.lignes.map((brLine: any) => {
            const returnLine = returnDoc.lignes.find((retLine: any) =>
                retLine.productId &&
                brLine.productId &&
                retLine.productId.toString() === brLine.productId.toString()
            );

            if (returnLine) {
                // Get current line as plain object
                const lineObj = brLine.toObject ? brLine.toObject() : (typeof brLine === 'object' ? { ...brLine } : {});

                // Subtract return quantity from qteRecue
                const currentQteRecue = lineObj.qteRecue || 0;
                const returnQty = returnLine.quantite || 0;
                const newQteRecue = Math.max(0, currentQteRecue - returnQty);

                return {
                    ...lineObj,
                    qteRecue: newQteRecue,
                };
            }

            return brLine.toObject ? brLine.toObject() : (typeof brLine === 'object' ? { ...brLine } : brLine);
        });

        // Add note about the return
        const returnDate = new Date(returnDoc.dateDoc).toLocaleDateString('fr-FR');
        const returnLinesSummary = returnDoc.lignes.map((l: any) =>
            `${l.quantite} ${l.uomCode || ''} ${l.designation}`
        ).join(', ');

        // Get warehouse name if available
        let warehouseName = '';
        if (returnDoc.warehouseId) {
            try {
                const Warehouse = (await import('@/lib/models/Warehouse')).default;
                const warehouse = await (Warehouse as any).findOne({ _id: returnDoc.warehouseId }).select('name').lean();
                if (warehouse) warehouseName = warehouse.name;
            } catch (e) {
                console.error('Error fetching warehouse name for return note:', e);
            }
        }

        const returnNote =
            `\n[ATTENTION : Ce BR a fait l'objet d'un RETOUR ACHAT ${returnDoc.numero} le ${returnDate} ` +
            `– Quantités sorties du stock${warehouseName ? ` (${warehouseName})` : ''}: ${returnLinesSummary}]`;

        const updatedNotes = (br.notes || '') + returnNote;

        // Recalculate totals not needed as strongly as for BL/Invoice, but good for consistency
        // But Reception model uses 'totaux' subdoc differently.
        // We'll skip complex recalc for now as Reception model uses hooks, but hooks only run on .save()
        // Since we want to update atomically, we might use findOneAndUpdate, but that bypasses hooks.
        // Let's use save() to trigger hooks for consistent totals.

        br.lignes = updatedLines;
        br.notes = updatedNotes;
        await br.save();

    } catch (error) {
        console.error('Error updating BR for return:', error);
        const errorMessage = (error as Error).message || 'Erreur lors de la mise à jour du bon de réception';
        throw new Error(errorMessage);
    }
}

async function removeProductsFromStock(returnDoc: any, tenantId: string, createdBy: string) {
    try {
        const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
        const Product = (await import('@/lib/models/Product')).default;

        for (const line of returnDoc.lignes || []) {
            if (!line.productId || !line.quantite || line.quantite <= 0) continue;

            try {
                const productIdStr = line.productId.toString();

                // Check if product exists and is stocked
                const product = await (Product as any).findOne({
                    _id: productIdStr,
                    tenantId,
                }).lean();

                if (!product) {
                    continue;
                }

                // Skip non-stocked products
                if (product.estStocke === false) {
                    continue;
                }

                // CHECK STOCK AVAILABILITY
                const warehouseId = returnDoc.warehouseId;
                const matchQuery: any = {
                    societeId: tenantId,
                    productId: productIdStr,
                };

                if (warehouseId) {
                    // Check if this is the default warehouse handling
                    const Warehouse = (await import('@/lib/models/Warehouse')).default;
                    const warehouse = await (Warehouse as any).findOne({
                        _id: warehouseId,
                        tenantId,
                    }).lean();

                    if (warehouse && warehouse.isDefault) {
                        matchQuery.$or = [
                            { warehouseId: new mongoose.Types.ObjectId(warehouseId) },
                            { warehouseId: { $exists: false } },
                            { warehouseId: null }
                        ];
                    } else {
                        matchQuery.warehouseId = new mongoose.Types.ObjectId(warehouseId);
                    }
                }

                const stockAggregation = await (MouvementStock as any).aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: '$productId',
                            totalEntree: { $sum: { $cond: [{ $eq: ['$type', 'ENTREE'] }, '$qte', 0] } },
                            totalSortie: { $sum: { $cond: [{ $eq: ['$type', 'SORTIE'] }, '$qte', 0] } },
                            totalInventaire: { $sum: { $cond: [{ $eq: ['$type', 'INVENTAIRE'] }, '$qte', 0] } },
                        },
                    },
                ]);

                const currentStock = stockAggregation.length > 0
                    ? (stockAggregation[0].totalEntree - stockAggregation[0].totalSortie + (stockAggregation[0].totalInventaire || 0))
                    : 0;

                if (currentStock < line.quantite) {
                    throw new Error(`Stock insuffisant pour le produit "${line.designation}". Disponible: ${currentStock}, Demandé: ${line.quantite}`);
                }

                // Create stock movement (SORTIE - exit from stock)
                const mouvement = new MouvementStock({
                    societeId: tenantId,
                    productId: productIdStr,
                    type: 'SORTIE', // خروج - ينقص المخزون
                    qte: line.quantite, // الكمية المرجوعة
                    date: returnDoc.dateDoc || new Date(),
                    source: 'RETOUR_ACHAT',
                    sourceId: returnDoc._id.toString(),
                    warehouseId: returnDoc.warehouseId,
                    notes: `Retour achat ${returnDoc.numero} - ${line.designation}`,
                    createdBy,
                });

                await (mouvement as any).save();

            } catch (error) {
                console.error(`Error creating stock movement for product ${line.productId}:`, error);
                // Propagate the specific error (like insufficient stock) by re-throwing
                throw error;
            }
        }
    } catch (error) {
        console.error('Error removing products from stock:', error);
        // Only wrap generic errors, preserve specific ones
        if ((error as Error).message.includes('Stock insuffisant')) {
            throw error;
        }
        const errorMessage = (error as Error).message || 'Erreur lors de la sortie des produits du stock';
        throw new Error(errorMessage);
    }
}
