import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'ERP Multi-Entreprises',
  description: 'Solution complète de gestion d\'entreprise pour plusieurs sociétés',
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
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
