'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Result = { id: string; size: number; source_type?: 'video' | 'comment'; representative_texts: string[]; source_refs?: Array<{ url: string; directComment: boolean; createdAt?: string; evidenceId?: string } | null>; analysis: { one_line_pain: string; rationale: string; potential_product: string; paid_interest: string } };
type Job = { jobId: string; status: string; progress: string; keywords?: string[]; aiProvider?: string; crawlStats?: { videoCount?: number; commentCount?: number; textCount?: number }; sourceDateSummary?: { totalComments: number; datedComments: number; recent90: number; newestCommentAt?: string }; clusteredData?: Array<{ videos: Array<{ title: string }>; comments: Array<{ comment_text: string }> }>; results?: Result[]; error?: string };

function resultSource(result: Result, job: Job): 'video' | 'comment' | undefined {
  if (result.source_type) return result.source_type;
  const sample = new Set(result.representative_texts);
  const group = job.clusteredData?.find(item => item.videos.some(video => sample.has(video.title)) || item.comments.some(comment => sample.has(comment.comment_text)));
  return group?.videos.length ? 'video' : group?.comments.length ? 'comment' : undefined;
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!jobId) return;
    const refresh = async () => {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      if (response.ok) {
        setJob(await response.json());
        setError('');
      } else {
        setError(response.status === 404 ? '任务不存在' : '加载任务失败，请稍后重试');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [jobId]);
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <Link href="/capture" className="text-sm text-amber-700 underline">返回任务记录</Link>
    <h1 className="mt-5 text-3xl font-semibold">任务详情</h1>
    {error && <p className="mt-6 text-red-600">{error}</p>}
    {job && <>
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-500">{job.keywords?.join('、')}</p>
        <p className="mt-3 font-medium">{job.progress}</p>
        {job.aiProvider && <p className="mt-2 text-sm text-zinc-600">分析模型来源：{job.aiProvider}</p>}
        {job.crawlStats && <p className="mt-2 text-sm text-zinc-600">视频 {job.crawlStats.videoCount || 0} · 评论 {job.crawlStats.commentCount || 0} · 文本 {job.crawlStats.textCount || 0}</p>}
        {job.sourceDateSummary && <p className="mt-2 text-sm text-zinc-600">评论时间：近 90 天 {job.sourceDateSummary.recent90} / {job.sourceDateSummary.totalComments} 条 · 已知发布时间 {job.sourceDateSummary.datedComments} 条{job.sourceDateSummary.newestCommentAt ? ` · 最新 ${new Date(job.sourceDateSummary.newestCommentAt).toLocaleDateString()}` : ''}</p>}
        {job.sourceDateSummary && job.sourceDateSummary.recent90 === 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">这份任务没有近 90 天的评论证据，分析结果只能作为历史线索；建议重新采集后再判断当前需求。</p>}
        {job.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
        <Link href="/evidence" className="mt-4 inline-block text-sm text-amber-700 underline">查看已保存的原始证据</Link>
      </section>
      {job.status === 'captured' && <p className="mt-6 text-sm text-zinc-600">采集数据已保存。请在任务记录页启动 AI 分析。</p>}
      {job.status === 'completed' && <section className="mt-8 space-y-4"><h2 className="text-xl font-semibold">分析结果 · {job.results?.length || 0}</h2>
        {job.results?.map(result => <article key={result.id} className="rounded-2xl border border-zinc-200 bg-white p-6">
          {resultSource(result, job) && <p className="mb-3 text-xs font-medium text-zinc-600">{resultSource(result, job) === 'video' ? '来源：视频标题 · 仅是话题线索，不能直接证明有人需要购买' : '来源：用户评论 · 请核对原文与发布时间'}</p>}
          <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold">{result.analysis.one_line_pain}</h3><span className="shrink-0 text-sm text-zinc-500">{result.size} 条相似文本</span></div>
          <p className="mt-3 text-sm text-zinc-700">{result.analysis.rationale}</p>
          <p className="mt-3 text-sm"><strong>可能的产品方向：</strong>{result.analysis.potential_product}</p>
          <div className="mt-4 rounded-xl bg-zinc-50 p-4"><p className="text-xs font-semibold text-zinc-500">代表性原文</p>{result.representative_texts.map((text, index) => <div key={`${result.id}-${index}`} className="mt-2 border-t border-zinc-200 pt-2 text-sm"><p>{text}</p>{result.source_refs?.[index] && <p className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">{result.source_refs[index]?.createdAt && <span>发布于 {new Date(result.source_refs[index]!.createdAt!).toLocaleDateString()}</span>}<a href={result.source_refs[index]!.url} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline">{result.source_refs[index]?.directComment ? '打开原评论' : '打开原帖'}</a>{result.source_refs[index]?.evidenceId && <Link href={`/evidence?id=${encodeURIComponent(result.source_refs[index]!.evidenceId!)}`} className="text-amber-700 underline">在证据库判读</Link>}</p>}</div>)}</div>
        </article>)}
      </section>}
    </>}
  </main>;
}
