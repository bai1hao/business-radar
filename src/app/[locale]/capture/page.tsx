'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Job = { jobId: string; status: string; progress: string; keywords: string[]; startTime: number; crawlStats?: { commentCount?: number; videoCount?: number }; error?: string };
type Readiness = { ready: boolean; provider: string; message: string; models?: string[] };

export default function CapturePage() {
  const [keywords, setKeywords] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const refresh = async () => setJobs(await (await fetch('/api/capture-jobs', { cache: 'no-store' })).json());
  const checkAi = async () => setReadiness(await (await fetch('/api/ai-readiness', { cache: 'no-store' })).json());
  useEffect(() => { void refresh(); void checkAi(); const timer = setInterval(() => { void refresh(); void checkAi(); }, 5000); return () => clearInterval(timer); }, []);
  async function capture() {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: keywords.split(',').map(x => x.trim()).filter(Boolean), dataSource: 'douyin_new', deepCrawl: true, captureOnly: true, douyinNewConfig: { enableComments: true, maxVideos: 15, maxCommentsPerVideo: 20, enableSubComments: false } }) });
    if (!response.ok) { setError((await response.json()).error || '创建任务失败'); return; }
    setError(''); setKeywords(''); await refresh();
  }
  async function analyze(jobId: string) {
    const response = await fetch('/api/capture-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) });
    if (!response.ok) setError((await response.json()).error || '启动分析失败');
    await refresh();
  }
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <p className="text-sm font-semibold text-amber-700">Business Radar</p><h1 className="mt-2 text-3xl font-semibold">采集与分析任务</h1>
    <p className="mt-2 text-sm text-zinc-600">先采集并保存评论，模型准备好后再手动分析。采集仍需在运行本应用的电脑上启动浏览器。</p>
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 text-sm"><strong>AI 状态：</strong>{readiness ? `${readiness.provider} · ${readiness.message}` : '正在检查…'}{readiness?.models && readiness.models.length > 0 && <p className="mt-2 text-zinc-600">服务可见模型：{readiness.models.join('、')}</p>}<p className="mt-2 text-zinc-500">LM Studio：启动本地 API 服务，加载聊天和 embedding 模型，再在 .env.local 中填写两个模型 ID。</p></div>
    <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
      <input aria-label="关键词" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="关键词，多个用逗号分隔" className="min-w-64 flex-1 rounded-lg border border-zinc-300 p-3" />
      <button disabled={!keywords.trim()} onClick={capture} className="rounded-lg bg-zinc-900 px-5 py-3 text-white disabled:opacity-40">只采集，稍后分析</button>
    </div>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-5"><Link href="/evidence" className="text-sm text-amber-700 underline">查看需求证据库</Link></div>
    <section className="mt-8 space-y-3"><h2 className="text-lg font-semibold">任务记录</h2>
      {jobs.map(job => <article key={job.jobId} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{job.keywords.join('、')}</strong><span className="text-sm text-zinc-500">{new Date(job.startTime).toLocaleString()}</span></div>
        <p className="mt-2 text-sm text-zinc-600">{job.progress}</p>
        {job.crawlStats && <p className="mt-1 text-sm text-zinc-500">视频 {job.crawlStats.videoCount || 0} · 评论 {job.crawlStats.commentCount || 0}</p>}
        {job.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
        {job.status === 'captured' && <button disabled={!readiness?.ready} onClick={() => void analyze(job.jobId)} className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-40">开始 AI 分析</button>}
        <Link href={`/jobs/${job.jobId}`} className="ml-3 inline-block text-sm text-amber-700 underline">查看任务详情</Link>
      </article>)}
      {jobs.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500">还没有任务。</p>}
    </section>
  </main>;
}
