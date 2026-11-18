'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSourceQuality, QualityEvidence } from '@/lib/source-quality';

export default function QualityPage() {
  const [rows, setRows] = useState<QualityEvidence[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/evidence', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('无法加载证据');
    setRows(await response.json());
  }).catch(() => setError('质量数据加载失败，请刷新页面')); }, []);
  const quality = getSourceQuality(rows);
  const ratio = (count: number) => quality.total ? `${Math.round(count / quality.total * 100)}%` : '—';
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <Link href="/overview" className="text-sm text-amber-700 underline">返回总览</Link>
    <h1 className="mt-5 text-3xl font-semibold">采集质量</h1>
    <p className="mt-2 text-sm text-zinc-600">这些比例基于已保存评论，帮助发现采集盲区；它们不等于真实市场需求率。</p>
    {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
    <section className="mt-7 grid gap-4 sm:grid-cols-4">{[
      ['证据总量', quality.total.toString()], ['有发布时间', `${quality.dated} · ${ratio(quality.dated)}`],
      ['有评论直达链接', `${quality.direct} · ${ratio(quality.direct)}`], ['疑似重复', `${quality.duplicateCount} · ${ratio(quality.duplicateCount)}`]
    ].map(([label, value]) => <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</section>
    <p className="mt-3 text-xs text-zinc-500">重复按同平台评论 ID，或同平台同原帖的相同文本估算；只提示检查，不自动删除。</p>
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-semibold">来源分布</h2><div className="mt-3 flex flex-wrap gap-2">{quality.platforms.map(item => <span key={item.platform} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">{item.platform} · {item.count}</span>)}</div><p className="mt-3 text-xs text-zinc-500">来源过于集中时，平台采集变化会影响研究连续性；可通过证据库手动添加其他合法来源。</p></section>
    <section className="mt-8 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-semibold">搜索词实际产出</h2><p className="mt-1 text-xs text-zinc-500">可联系线索指近 90 天、规则或人工判读提示需求，并有评论链接或已确认联系入口；仍需人工核实。</p><table className="mt-4 w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="py-2">搜索词</th><th>采集评论</th><th>近 90 天</th><th>优先线索</th><th>可联系线索</th></tr></thead><tbody>{quality.keywordResults.map(item => <tr key={item.keyword} className="border-b border-zinc-100"><td className="py-3"><Link href={`/evidence?keyword=${encodeURIComponent(item.keyword)}`} className="text-amber-700 underline">{item.keyword}</Link></td><td>{item.collected}</td><td>{item.recent}</td><td>{item.actionable}</td><td>{item.reachable}</td></tr>)}</tbody></table>{quality.keywordResults.length === 0 && <p className="py-6 text-sm text-zinc-500">暂无带来源搜索词的评论。</p>}</section>
  </main>;
}
