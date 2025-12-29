import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import { Toaster } from 'react-hot-toast';
import SecurityEnforcer from '@/components/auth/SecurityEnforcer';

export const metadata: Metadata = {
  title: 'ERP Multi-Entreprises',
  description: 'Solution complète de gestion d\'entreprise pour plusieurs sociétés',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ERP Multi',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <SecurityEnforcer />
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
