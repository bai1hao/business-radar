'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isActionableEvidence, needSignals } from '@/lib/need-signals';
import { isRecentDate } from '@/lib/evidence-freshness';

type Evidence = { id: string; text: string; status: 'new' | 'verified' | 'contacted' | 'dismissed'; reviewVerdict?: 'need' | 'not-need' | 'unclear'; sourceUrl: string; commentUrl?: string; commentCreatedAt?: string; collectedAt: string; nextFollowUpAt?: string };
type Job = { jobId: string; status: string; progress: string; keywords: string[]; startTime: number };

export default function OverviewPage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([fetch('/api/evidence', { cache: 'no-store' }), fetch('/api/capture-jobs', { cache: 'no-store' })])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error('加载总览失败');
        setEvidence(await a.json()); setJobs(await b.json());
      }).catch(e => setError(e instanceof Error ? e.message : '加载失败'));
  }, []);
  const recent = evidence.filter(row => isRecentDate(row.commentCreatedAt));
  const signals = recent.filter(row => (row.status === 'new' || row.status === 'verified') && isActionableEvidence(row.text, row.reviewVerdict));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cards = [
    { label: '全部证据', value: evidence.length, detail: '已保存的原始评论', href: '/evidence' },
    { label: '近 90 天证据', value: recent.length, detail: '按评论发布时间计算', href: '/evidence' },
    { label: '近期优先线索', value: signals.length, detail: '规则提示与人工判读，仍需核实', href: '/evidence' },
    { label: '待跟进', value: evidence.filter(row => row.status !== 'dismissed' && row.nextFollowUpAt && row.nextFollowUpAt <= today).length, detail: '今天或更早到期', href: '/evidence?followUp=due' }
  ];
  return <main className="mx-auto max-w-6xl px-5 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-amber-700">Business Radar</p><h1 className="mt-2 text-3xl font-semibold">需求总览</h1><p className="mt-2 text-sm text-zinc-600">从原始评论出发，逐条核实真实需求。</p></div><div className="flex gap-3"><Link href="/quality" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm">采集质量</Link><Link href="/capture" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm">采集任务</Link><Link href="/opportunities" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm">需求主题</Link><Link href="/evidence" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">查看证据库</Link></div></div>
    {error && <p className="mt-5 text-red-600">{error}</p>}
    <section className="mt-7 rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="text-lg font-semibold">从哪里开始</h2><ol className="mt-3 grid gap-3 text-sm text-zinc-700 md:grid-cols-3"><li><strong>1. 采集具体场景</strong><p className="mt-1">搜索“工作动作＋卡点”，先小样本试词；避免只搜“自动生成”这类宽泛词。</p></li><li><strong>2. 核实原文</strong><p className="mt-1">在证据库筛选近期线索，打开原帖确认语境、发布时间和是否已有解决办法。</p></li><li><strong>3. 验证是否有人付费</strong><p className="mt-1">记录联系、回复和付费原话，再把同类证据归入需求主题；没有这些证据时只当假设。</p></li></ol><p className="mt-4 text-xs text-zinc-500">AI 分析与规则提示用于发现候选问题，不代表市场需求已获验证。</p></section>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => <Link href={card.href} key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{card.label}</p><p className="mt-3 text-3xl font-semibold">{card.value}</p><p className="mt-2 text-xs text-zinc-500">{card.detail}</p></Link>)}</section>
    <div className="mt-8 grid gap-6 lg:grid-cols-3"><section className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6"><div className="flex justify-between"><h2 className="text-lg font-semibold">近 90 天优先线索</h2><Link href="/evidence" className="text-sm text-amber-700 underline">查看全部</Link></div><div className="mt-4 divide-y divide-zinc-100">{signals.slice(0, 6).map(row => <div key={row.id} className="py-4"><div className="mb-2 flex gap-2">{needSignals(row.text).map(label => <span key={label} className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{label}</span>)}</div><p className="line-clamp-2 text-sm leading-6">{row.text}</p><p className="mt-2 text-xs text-zinc-500">评论发布于 {new Date(row.commentCreatedAt!).toLocaleDateString()}</p><a href={row.commentUrl || row.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-amber-700 underline">{row.commentUrl ? '打开评论链接' : '打开原帖'}</a></div>)}{signals.length === 0 && <p className="py-8 text-sm text-zinc-500">近 90 天暂无优先线索，可尝试新的搜索词。</p>}</div></section>
    <section className="rounded-2xl border border-zinc-200 bg-white p-6"><div className="flex justify-between"><h2 className="text-lg font-semibold">最近任务</h2><Link href="/capture" className="text-sm text-amber-700 underline">查看全部</Link></div><div className="mt-4 divide-y divide-zinc-100">{jobs.slice(0, 5).map(job => <Link key={job.jobId} href={`/jobs/${job.jobId}`} className="block py-4"><p className="line-clamp-1 text-sm font-medium">{job.keywords.join('、')}</p><p className="mt-1 text-xs text-zinc-500">{job.progress}</p></Link>)}{jobs.length === 0 && <p className="py-8 text-sm text-zinc-500">暂无任务。</p>}</div></section></div>
  </main>;
}
