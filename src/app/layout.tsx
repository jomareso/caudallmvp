import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Caudall — Bienestar financiero',
  description: 'Tu salud financiera, como beneficio de tu empresa',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Caudall'
  }
};

export const viewport: Viewport = {
  themeColor: '#0F5499',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="es">
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
