import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '../../../../lib/services/job-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(jobManager.listJobs().map(job => ({
    jobId: job.jobId, status: job.status, progress: job.progress,
    keywords: job.keywords, startTime: job.startTime, crawlStats: job.crawlStats, error: job.error
  })), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.jobId !== 'string') return NextResponse.json({ error: '无效任务' }, { status: 400 });
  return jobManager.analyzeCapturedJob(body.jobId)
    ? NextResponse.json({ status: 'processing' }, { status: 202 })
    : NextResponse.json({ error: '任务不存在或当前状态无法分析' }, { status: 409 });
}
