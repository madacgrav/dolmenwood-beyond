import type { Metadata, Viewport } from 'next';
import { Cinzel, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dolmenwood Beyond',
  description: 'Digital character management for Dolmenwood RPG',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dolmenwood Beyond',
  },
};

export const viewport: Viewport = {
  themeColor: '#2d5a27',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
