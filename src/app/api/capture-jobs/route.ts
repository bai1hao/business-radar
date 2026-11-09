import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '../../../../lib/services/job-manager';
import { getAiReadiness } from '../../../../lib/services/ai-readiness';
import { isAnalysisEnabled, webOnlyResponse } from '../../../../lib/services/deployment-mode';
import { getAIProviderName, isAIProviderName } from '../../../../lib/services/ai-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(jobManager.listJobs().map(job => ({
    jobId: job.jobId, status: job.status, progress: job.progress,
    keywords: job.keywords, startTime: job.startTime, crawlStats: job.crawlStats, error: job.error, aiProvider: job.aiProvider
  })), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!isAnalysisEnabled()) return webOnlyResponse();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.jobId !== 'string') return NextResponse.json({ error: '无效任务' }, { status: 400 });
  const provider = body.aiProvider === undefined ? getAIProviderName() : body.aiProvider;
  if (!isAIProviderName(provider)) return NextResponse.json({ error: '不支持的模型来源' }, { status: 400 });
  const readiness = await getAiReadiness(provider);
  if (!readiness.ready) return NextResponse.json({ error: readiness.message }, { status: 503 });
  return jobManager.analyzeCapturedJob(body.jobId, provider)
    ? NextResponse.json({ status: 'processing' }, { status: 202 })
    : NextResponse.json({ error: '任务不存在或当前状态无法分析' }, { status: 409 });
}
