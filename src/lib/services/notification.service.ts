import Notification, { INotification } from '@/lib/models/Notification';
import connectDB from '@/lib/mongodb';

export class NotificationService {
    /**
     * Create a new notification for a specific user.
     */
    static async createNotification(data: {
        tenantId: string;
        userId: string;
        type: string;
        title: string;
        message: string;
        link?: string;
        metadata?: any;
    }) {
        await connectDB();

        return Notification.create({
            tenantId: data.tenantId,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
            metadata: data.metadata,
            status: 'unread',
            createdAt: new Date(),
        });
    }

    /**
     * Broadcast a notification to all admins of a tenant.
     * Note: This requires fetching users with role 'admin'.
     */
    static async notifyAdmins(tenantId: string, data: {
        type: string;
        title: string;
        message: string;
        link?: string;
        metadata?: any;
    }) {
        await connectDB();

        const User = (await import('@/lib/models/User')).default;

        const admins = await User.find({
            companyId: tenantId,
            $or: [{ role: 'admin' }, { permissions: 'all' }]
        });

        const notifications = admins.map(admin => ({
            tenantId,
            userId: admin._id,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
            metadata: data.metadata,
            status: 'unread',
            createdAt: new Date(),
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
    }

    /**
     * Check for low stock and generate notifications.
     * Use aggregation to calculate current stock from MouvementStock.
     */
    static async checkLowStock(tenantId: string) {
        await connectDB();
        const Product = (await import('@/lib/models/Product')).default;
        const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
        const mongoose = (await import('mongoose')).default;

        // 1. Get all products that track stock and have a minimum threshold
        // Also check if they are NOT archived
        const trackedProducts = await Product.find({
            tenantId,
            actif: true,
            estStocke: true,
            archive: { $ne: true },
            min: { $gt: 0 } // Only check if min is set and positive
        }).select('_id nom sku min').lean();

        if (trackedProducts.length === 0) return;

        const productIds = trackedProducts.map(p => p._id);

        // 2. Aggregate stock for these products
        const stockAggregation = await MouvementStock.aggregate([
            {
                $match: {
                    societeId: new mongoose.Types.ObjectId(tenantId),
                    productId: { $in: productIds.map(id => id.toString()) }
                }
            },
            {
                $group: {
                    _id: "$productId",
                    totalStock: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "ENTREE"] },
                                "$qte",
                                { $multiply: ["$qte", -1] }
                            ]
                        }
                    }
                }
            }
        ]);

        // Create a map for quick lookup
        const stockMap = new Map();
        stockAggregation.forEach(item => {
            stockMap.set(item._id.toString(), item.totalStock);
        });

        // 3. Compare and notify
        for (const product of trackedProducts) {
            const currentStock = stockMap.get(product._id.toString()) || 0;
            const minStock = product.min || 0;

            if (currentStock <= minStock) {
                // Avoid duplicate notifications for same product today
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                // Use a more specific timestamp check or rely on dedupeKey if we implement it fully later
                // Here we check if we already sent a low_stock notif for this product today
                const exists = await Notification.exists({
                    tenantId,
                    type: 'low_stock',
                    'metadata.productId': product._id.toString(), // Ensure string comparison
                    createdAt: { $gte: startOfDay }
                });

                if (!exists) {
                    await this.notifyAdmins(tenantId, {
                        type: 'low_stock',
                        title: 'Alerte Stock Bas',
                        message: `Le produit "${product.nom}" a atteint son seuil minimum (${currentStock} / ${minStock}).`,
                        link: `/products/${product._id}`,
                        metadata: { productId: product._id.toString() }
                    });
                }
            }
        }
    }

    /**
     * Check for overdue invoices (> 7 days).
     */
    static async checkOverdueInvoices(tenantId: string) {
        await connectDB();
        const Document = (await import('@/lib/models/Document')).default;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find invoices not fully paid created > 7 days ago
        const overdueInvoices = await Document.find({
            tenantId,
            type: 'FAC',
            statut: { $nin: ['PAYEE', 'ANNULEE', 'BROUILLON'] },
            dateDoc: { $lt: sevenDaysAgo }
        }).limit(10);

        for (const invoice of overdueInvoices) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Check if we already notified about this invoice TODAY to avoid spam
            const exists = await Notification.exists({
                tenantId,
                type: 'overdue_invoice',
                'metadata.invoiceId': invoice._id,
                createdAt: { $gte: startOfDay }
            });

            if (!exists) {
                const docDate = new Date(invoice.dateDoc);
                const diffTime = Math.abs(new Date().getTime() - docDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                await this.notifyAdmins(tenantId, {
                    type: 'overdue_invoice',
                    title: 'Facture en Retard',
                    message: `La facture ${invoice.numero} est impayée depuis ${diffDays} jours.`,
                    link: `/sales/invoices/${invoice._id}`,
                    metadata: { invoiceId: invoice._id }
                });
            }
        }
    }
}
