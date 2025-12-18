import Subscription from '@/lib/models/Subscription';
import Document from '@/lib/models/Document';

/**
 * Checks if a tenant has reached their document limit.
 * @param tenantId The ID of the company/tenant
 * @returns Object indicating if action is allowed and optional error message
 */
export async function checkSubscriptionLimit(tenantId: string): Promise<{ allowed: boolean; error?: string }> {
    try {
        const subscription = await (Subscription as any).findOne({ companyId: tenantId });

        // If no subscription found, we assume they are on a legacy/free tier that hasn't been initialized.
        // To be safe and compliant with the "Free = 100" rule, we should probably check against 100, 
        // but for now, if it's missing, we might disrupt operations if we block.
        // However, the user asked for strict limits. 
        // Let's implicitly treat missing subscription as "Free" (100 limit).
        let limit = 100;
        let isActive = true;

        if (subscription) {
            if (subscription.status !== 'active') {
                return { allowed: false, error: 'Votre abonnement n\'est pas actif ou a expiré.' };
            }
            limit = subscription.documentsLimit;
        }

        if (limit === -1) {
            return { allowed: true };
        }

        const count = await (Document as any).countDocuments({ tenantId });

        if (count >= limit) {
            return {
                allowed: false,
                error: `Limite de documents atteinte (${limit}). Veuillez mettre à niveau votre plan pour continuer.`
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Error checking subscription limit:', error);
        // Fail safe: allow operation if check fails to avoid blocking due to system error
        return { allowed: true };
    }
}
