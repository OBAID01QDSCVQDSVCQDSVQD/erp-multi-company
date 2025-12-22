'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';

export default function SecurityEnforcer() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const [isVerifiedLocally, setIsVerifiedLocally] = useState(false);

    // Use ref to track checking status across renders without triggering re-renders
    const isCheckingRef = useRef(false);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user) return;

        const checkAndEnforce = async () => {
            const user = session.user as any;

            // If local verification passed, assume we are good to go while session updates
            if (isVerifiedLocally) return;

            // If system requires 2FA but session says it's disabled
            if (user.requires2FA && !user.isTwoFactorEnabled) {

                // Allow access to setup page (and APIs) without redirecting
                if (pathname && (pathname.startsWith('/auth/setup-2fa') || pathname.match(/^\/api\//))) {
                    return;
                }

                // Prevent multiple checks
                if (isCheckingRef.current) return;
                isCheckingRef.current = true;

                try {
                    // Double check with server to be sure it's not just a stale session
                    const res = await fetch('/api/auth/2fa/status');
                    if (res.ok) {
                        const data = await res.json();

                        if (data.isTwoFactorEnabled) {
                            // Server says ENABLED. Session is stale.
                            console.log('SecurityEnforcer: Session stale, syncing with server...');
                            setIsVerifiedLocally(true); // Stop further checks immediately
                            await update({ isTwoFactorEnabled: true });
                            isCheckingRef.current = false;
                            return;
                        }
                    }
                } catch (e) {
                    console.error('SecurityEnforcer: Failed to verify status', e);
                } finally {
                    isCheckingRef.current = false;
                }

                // If we are here, it is genuinely disabled. Redirect.
                // Check pathname again and verify we haven't been verified locally in the meantime
                if (pathname && !pathname.startsWith('/auth/setup-2fa') && !isVerifiedLocally) {
                    router.replace('/auth/setup-2fa');
                }
            }
        };

        checkAndEnforce();
    }, [session, status, pathname, router, update, isVerifiedLocally]);

    return null;
}
