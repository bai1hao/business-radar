'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isRecentDate } from '@/lib/evidence-freshness';
import { isPriorityEvidence } from '@/lib/need-signals';

type Job = { jobId: string; status: string; progress: string; keywords: string[]; startTime: number; crawlStats?: { commentCount?: number; videoCount?: number }; error?: string };
type Readiness = { ready: boolean; webOnly?: boolean; provider: string; message: string; models?: string[] };
type Evidence = { sourceKeyword?: string; sourceKeywords?: string[]; commentCreatedAt?: string; text: string; status: string };
const keywordExamples = ['财务 每月报表 手工汇总', '跨表核对 数据 太麻烦', '客户信息 每天重复录入', '固定网页 每天手动下载数据'];

export default function CapturePage() {
  const [keywords, setKeywords] = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState<30 | 90 | 180>(90);
  const [sampleMode, setSampleMode] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const refresh = async () => setJobs(await (await fetch('/api/capture-jobs', { cache: 'no-store' })).json());
  const refreshEvidence = async () => { const response = await fetch('/api/evidence', { cache: 'no-store' }); if (response.ok) setEvidence(await response.json()); };
  const checkAi = async () => setReadiness(await (await fetch('/api/ai-readiness', { cache: 'no-store' })).json());
  useEffect(() => { void refresh(); void checkAi(); void refreshEvidence(); const timer = setInterval(() => { void refresh(); void checkAi(); }, 5000); const evidenceTimer = setInterval(() => void refreshEvidence(), 30000); return () => { clearInterval(timer); clearInterval(evidenceTimer); }; }, []);
  async function capture() {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: keywords.split(',').map(x => x.trim()).filter(Boolean), dataSource: 'douyin_new', deepCrawl: true, captureOnly: true, douyinNewConfig: { enableComments: true, maxVideos: sampleMode ? 10 : 15, maxCommentsPerVideo: sampleMode ? 10 : 20, enableSubComments: false, maxAgeDays } }) });
    if (!response.ok) { setError((await response.json()).error || '创建任务失败'); return; }
    setError(''); setKeywords(''); await refresh();
  }
  async function analyze(jobId: string) {
    const response = await fetch('/api/capture-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) });
    if (!response.ok) setError((await response.json()).error || '启动分析失败');
    await refresh();
  }
  const byKeyword = new Map<string, { total: number; recent: number; priority: number; verified: number }>();
  for (const row of evidence) {
    for (const keyword of new Set(row.sourceKeywords?.length ? row.sourceKeywords : row.sourceKeyword ? [row.sourceKeyword] : [])) {
      const item = byKeyword.get(keyword) || { total: 0, recent: 0, priority: 0, verified: 0 };
      item.total++;
      if (isRecentDate(row.commentCreatedAt)) {
        item.recent++;
        if (isPriorityEvidence(row.text)) item.priority++;
        if (row.status === 'verified' || row.status === 'contacted') item.verified++;
      }
      byKeyword.set(keyword, item);
    }
  }
  const keywordStats = [...byKeyword].sort((a, b) =>
    b[1].verified - a[1].verified || b[1].priority - a[1].priority ||
    (b[1].recent ? b[1].priority / b[1].recent : 0) - (a[1].recent ? a[1].priority / a[1].recent : 0) ||
    b[1].recent - a[1].recent
  );
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <p className="text-sm font-semibold text-amber-700">Business Radar</p><h1 className="mt-2 text-3xl font-semibold">采集与分析任务</h1>
    <p className="mt-2 text-sm text-zinc-600">{readiness?.webOnly ? '当前是服务器网页模式。采集与 AI 分析请在本地电脑运行；此处可查看已同步的任务记录。' : '先采集并保存评论，模型准备好后再手动分析。采集仍需在运行本应用的电脑上启动浏览器。'}</p>
    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 text-sm"><strong>AI 状态：</strong>{readiness ? `${readiness.provider} · ${readiness.message}` : '正在检查…'}{readiness?.models && readiness.models.length > 0 && <p className="mt-2 text-zinc-600">服务可见模型：{readiness.models.join('、')}</p>}<p className="mt-2 text-zinc-500">LM Studio：启动本地 API 服务，加载聊天和 embedding 模型，再在 .env.local 中填写两个模型 ID。</p></div>
    {!readiness?.webOnly && <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">先选搜索词</h2><p className="mt-2 text-sm text-zinc-600">用“工作场景＋具体动作＋卡点”描述问题。每轮先试 1～3 个短语，查看近 90 天优先线索，再调整词语。</p><div className="mt-3 flex flex-wrap gap-2">{keywordExamples.map(example => <button key={example} type="button" onClick={() => setKeywords(example)} className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100">{example}</button>)}</div><p className="mt-2 text-xs text-zinc-500">点击示例会填入搜索框；示例不是已核实的需求。</p></section>}
    {!readiness?.webOnly && <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
      <input aria-label="关键词" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="关键词，多个用逗号分隔" className="min-w-64 flex-1 rounded-lg border border-zinc-300 p-3" />
      <select aria-label="采集时间范围" value={maxAgeDays} onChange={e => setMaxAgeDays(Number(e.target.value) as 30 | 90 | 180)} className="rounded-lg border border-zinc-300 bg-white p-3"><option value={30}>最近 30 天</option><option value={90}>最近 90 天</option><option value={180}>最近 180 天</option></select>
      <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={sampleMode} onChange={e => setSampleMode(e.target.checked)} />小样本试词（10 个视频，每视频最多 10 条评论）</label>
      <button disabled={!keywords.trim()} onClick={capture} className="rounded-lg bg-zinc-900 px-5 py-3 text-white disabled:opacity-40">{sampleMode ? '试采集，稍后分析' : '完整采集，稍后分析'}</button>
    </div>}
    {!readiness?.webOnly && <p className="mt-2 text-xs text-zinc-500">按视频和评论的发布时间筛选；缺失发布时间的内容不会进入新任务。</p>}
    <p className="mt-5 text-xs text-zinc-500">同一评论可能由多个搜索词找到，下面各行的数量不能直接相加。</p>
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">关键词效果</h2><p className="mt-2 text-sm text-zinc-600">只统计有明确搜索词来源的评论。采集量不等于需求量；“优先提示”和提示率由规则初筛，仍需阅读原文核实。</p>{keywordStats.length > 0 ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500"><tr><th className="py-2 pr-3 font-medium">搜索词</th><th className="py-2 pr-3 font-medium">全部评论</th><th className="py-2 pr-3 font-medium">近 90 天</th><th className="py-2 pr-3 font-medium">近期优先提示</th><th className="py-2 pr-3 font-medium">提示率</th><th className="py-2 font-medium">近期已核实</th></tr></thead><tbody>{keywordStats.map(([keyword, item]) => <tr key={keyword} className="border-b border-zinc-100"><td className="py-3 pr-3 font-medium">{keyword}</td><td className="py-3 pr-3">{item.total}</td><td className="py-3 pr-3">{item.recent}</td><td className="py-3 pr-3">{item.priority}</td><td className="py-3 pr-3">{item.recent ? `${(item.priority / item.recent * 100).toFixed(1)}%` : '—'}</td><td className="py-3">{item.verified}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-zinc-500">完成一次采集后，这里会显示各搜索词的结果。</p>}<Link href="/evidence" className="mt-4 inline-block text-sm text-amber-700 underline">到证据库核实原文</Link></section>
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
