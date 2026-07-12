import { getTranslations } from 'next-intl/server';
import { HomeAuthLinks } from '@/components/home-auth-links';

export default async function HomePage() {
  const t = await getTranslations('Home');

  const services = [
    { name: t('web'), port: 3000 },
    { name: t('api'), port: 3001 },
    { name: t('worker'), port: null },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-lg rounded-[20px] p-8 shadow-lifted">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.7px] text-txt3">
          {t('skeletonReady')}
        </p>
        <h1 className="mt-2 text-[26px] tracking-[-0.5px]">{t('title')}</h1>
        <p className="mt-1 text-[13px] font-semibold text-txt2">{t('subtitle')}</p>

        <div className="mt-6 border-t border-glass-brd pt-5">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.7px] text-txt3">
            {t('services')}
          </p>
          <ul className="space-y-2">
            {services.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between rounded-[14px] bg-green-soft/40 px-4 py-2.5 text-[13px] font-semibold"
              >
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green" />
                  {s.name}
                </span>
                {s.port && <span className="text-[11px] font-bold text-txt3">:{s.port}</span>}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-[11.5px] font-semibold leading-relaxed text-txt3">
          {t('nextStep')}
        </p>

        <HomeAuthLinks />
      </div>
    </main>
  );
}
