import { NextResponse } from 'next/server';
import { getAiReadiness } from '../../../../lib/services/ai-readiness';
import { isWebOnlyMode } from '../../../../lib/services/deployment-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (isWebOnlyMode()) {
    return NextResponse.json({ ready: false, webOnly: true, provider: '本地电脑', message: '云端只展示数据，采集与 AI 分析请在本地电脑运行。' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ...await getAiReadiness(), webOnly: false }, { headers: { 'Cache-Control': 'no-store' } });
}
