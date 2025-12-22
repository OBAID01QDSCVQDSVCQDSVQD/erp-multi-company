
import connectDB from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Log an action to the AuditLog.
 * Can be used server-side in API routes.
 */
export async function logAction(
    session: any,
    action: string,
    resource: string,
    details: string,
    metadata: any = null
) {
    try {
        if (!session || !session.user) return; // Anonymous actions usually not logged or handled differently

        await connectDB();

        // Attempt to get IP from headers if passed in metadata or context, otherwise hard to get here directly
        // Usually IP is extracted from request headers in the route handler.
        const ipAddress = metadata?.ip || 'Unknown';

        // Fetch location info if IP is available
        let location = 'Inconnu';
        if (ipAddress && ipAddress !== 'Unknown' && ipAddress !== '::1' && ipAddress !== '127.0.0.1') {
            try {
                // Using ip-api.com (Free for non-commercial, rate limited 45/min)
                // In production, consider a paid service or local DB like geoip-lite
                const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}`);
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    if (geoData.status === 'success') {
                        location = `${geoData.city}, ${geoData.country}`;
                    }
                }
            } catch (err) {
                // Ignore geo fetch errors
            }
        } else if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
            location = 'Localhost';
        }

        await (AuditLog as any).create({
            userId: session.user.id,
            userName: session.user.name,
            userEmail: session.user.email,
            action,
            resource,
            details,
            ipAddress,
            location,
            metadata
        });
    } catch (error) {
        console.error('Failed to write audit log:', error);
        // Don't crash main flow for logging failure
    }
}
