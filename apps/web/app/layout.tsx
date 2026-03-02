import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dexera Terminal',
  description: 'Dexera monorepo bootstrap status view',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
