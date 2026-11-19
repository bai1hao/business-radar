'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';

const items = [
  { href: '/overview', zh: '总览', en: 'Overview' },
  { href: '/capture', zh: '采集任务', en: 'Capture' },
  { href: '/evidence', zh: '证据库', en: 'Evidence' },
  { href: '/opportunities', zh: '需求主题', en: 'Opportunities' },
  { href: '/quality', zh: '采集质量', en: 'Quality' },
  { href: '/', zh: '原版分析', en: 'Classic Analysis' },
  { href: '/ai-product', zh: '产品建议', en: 'Product Ideas' }
];

export default function AppNavigation() {
  const locale = useLocale();
  const pathname = usePathname();
  return <header className="border-b border-zinc-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-2 px-5 py-3">
      <Link href={`/${locale}/overview`} className="shrink-0 text-base font-semibold text-zinc-900">Business Radar</Link>
      <nav aria-label={locale === 'zh' ? '主导航' : 'Main navigation'} className="flex min-w-0 flex-1 gap-1 overflow-x-auto whitespace-nowrap">
        {items.map(item => {
          const href = `/${locale}${item.href === '/' ? '' : item.href}`;
          const active = pathname === href || (item.href === '/capture' && pathname.startsWith(`/${locale}/jobs/`));
          return <Link key={item.href} href={href} aria-current={active ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm ${active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}>{locale === 'zh' ? item.zh : item.en}</Link>;
        })}
      </nav>
      <LanguageSwitcher />
    </div>
  </header>;
}
