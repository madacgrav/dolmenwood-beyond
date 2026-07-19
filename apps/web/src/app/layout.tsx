import type { Metadata, Viewport } from 'next';
import { Cinzel, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    // suppressHydrationWarning: the pre-paint theme script legitimately sets
    // data-theme on <html> before hydration, so the attribute mismatch is expected.
    <html lang="en" className={`${cinzel.variable} ${jetbrainsMono.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Pre-paint: apply stored theme choice before first render to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('dolmenwood-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
