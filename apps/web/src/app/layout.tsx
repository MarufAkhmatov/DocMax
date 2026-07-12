import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope, Sora } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Providers } from './providers';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['600', '700'],
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'DocMax',
  description: 'Korxona ichki normativ hujjatlari ombori',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${sora.variable} ${manrope.variable}`}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
