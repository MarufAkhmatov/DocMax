import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@docmax/shared';

// Locale hozircha cookie orqali (URL routing'siz) — TZ-0 §5: uz default, ru, en.
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('NEXT_LOCALE')?.value;
  const locale: Locale = LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
