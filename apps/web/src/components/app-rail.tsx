'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Building2, LayoutDashboard, Moon, Network, Radar, Settings, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', icon: LayoutDashboard, title: 'Dashboard' },
  { href: '/vault', icon: FolderGlyph, title: 'Vault' },
] as const;

/** design/docmax-ui-v3.html — .rail .ric svg (papka ikonkasi, aynan shu path) */
function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
}

/** design/docmax-ui-v3.html — chap ikonka-panel. Keyingi bosqichlarda kerak bo'ladigan
 * yo'nalishlar (Bog'lanishlar, Monitoring, Struktura) hozircha nofaol ko'rsatiladi. */
export function AppRail() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="rail">
      <div className="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 8a3 3 0 013-3h3l2 2.5h5a3 3 0 013 3V17a3 3 0 01-3 3H7a3 3 0 01-3-3V8z"
            fill="#04240F"
          />
        </svg>
      </div>

      {NAV.map(({ href, icon: Icon, title }) => (
        <Link key={href} href={href} title={title} className={cn('ric', pathname === href && 'on')}>
          <Icon />
        </Link>
      ))}

      <div title="Bog'lanishlar (tez orada)" className="ric cursor-not-allowed opacity-40">
        <Network />
      </div>
      <div title="Monitoring (tez orada)" className="ric cursor-not-allowed opacity-40">
        <Radar />
      </div>
      <div title="Struktura (tez orada)" className="ric cursor-not-allowed opacity-40">
        <Building2 />
      </div>

      <div className="spacer" />

      <button
        title="Rejim"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="ric"
      >
        {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
      </button>
      <Link href="/settings/profile" title="Sozlamalar" className={cn('ric', pathname === '/settings/profile' && 'on')}>
        <Settings />
      </Link>
    </aside>
  );
}
