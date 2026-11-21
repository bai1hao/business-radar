import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { NO_STORE_HEADERS } from '../../../../../lib/services/http-headers';
import { jobManager } from '../../../../../lib/services/job-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^[a-f\d-]{36}$/i.test(jobId)) return NextResponse.json({ error: '无效任务' }, { status: 400, headers: NO_STORE_HEADERS });
  if (!jobManager.getJob(jobId)) return NextResponse.json({ error: '任务不存在' }, { status: 404, headers: NO_STORE_HEADERS });
  const dir = path.join(process.env.BUSINESS_RADAR_AGENT_DIR || path.join(process.cwd(), 'agent-workspace'), jobId);
  const inputPath = path.join(dir, 'input.json');
  const resultPath = path.join(dir, 'result.json');
  if (!fs.existsSync(inputPath) || !fs.existsSync(resultPath)) return NextResponse.json({ error: '尚无 Agent 分析结果' }, { status: 404, headers: NO_STORE_HEADERS });
  try {
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    if (input.jobId !== jobId || result.jobId !== jobId || result.schemaVersion !== 1 || !Array.isArray(result.findings)) throw new Error('结果结构不正确');
    const sources = new Map<string, { text: string; sourceUrl?: string | null; commentCreatedAt?: string | null }>(
      [...(input.comments || []), ...(input.videos || [])].map(row => [row.ref, row])
    );
    const findings = result.findings.map((item: Record<string, unknown>) => {
      if (typeof item.title !== 'string' || !item.title.trim() || !Array.isArray(item.evidenceRefs) || !item.evidenceRefs.length || item.evidenceRefs.some((ref: unknown) => typeof ref !== 'string' || !sources.has(ref)) || !['low', 'medium', 'high'].includes(String(item.confidence)) || ['agentAlternative', 'customerAdoptionBarrier', 'paymentEvidence', 'nextStep'].some(key => typeof item[key] !== 'string')) throw new Error('结果字段或证据引用无效');
      return {
        title: item.title,
        agentAlternative: item.agentAlternative,
        customerAdoptionBarrier: item.customerAdoptionBarrier,
        paymentEvidence: item.paymentEvidence,
        confidence: item.confidence,
        nextStep: item.nextStep,
        evidence: item.evidenceRefs.map((ref: string) => {
          const source = sources.get(ref)!;
          let sourceUrl: string | undefined;
          try { if (source.sourceUrl && ['http:', 'https:'].includes(new URL(source.sourceUrl).protocol)) sourceUrl = source.sourceUrl; } catch { /* omit unsafe URL */ }
          return { ref, text: source.text, sourceUrl, commentCreatedAt: source.commentCreatedAt };
        })
      };
    });
    return NextResponse.json({ jobId, findings }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Agent 结果格式有误，请先运行 agent:check' }, { status: 422, headers: NO_STORE_HEADERS });
  }
}
