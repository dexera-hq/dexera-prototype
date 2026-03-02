import type { Metadata } from 'next';
import { Providers } from './_components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dexera | Non-Custodial Execution Surface',
  description:
    'Dexera stages wallet connectivity, shared contracts, and HyperEVM readiness in a single non-custodial frontend surface.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
