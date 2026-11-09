import { NextResponse } from 'next/server';
import { getAiReadiness } from '../../../../lib/services/ai-readiness';
import { isAnalysisEnabled, isWebOnlyMode } from '../../../../lib/services/deployment-mode';
import { isAIProviderName } from '../../../../lib/services/ai-provider';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAnalysisEnabled()) {
    return NextResponse.json({ ready: false, webOnly: true, provider: '本地电脑', message: '云端只展示数据，采集与 AI 分析请在本地电脑运行。' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const requested = request.nextUrl.searchParams.get('provider');
  const provider = requested && isAIProviderName(requested) ? requested : undefined;
  if (requested && !provider) return NextResponse.json({ error: '不支持的模型来源' }, { status: 400 });
  return NextResponse.json({ ...await getAiReadiness(provider), webOnly: isWebOnlyMode() }, { headers: { 'Cache-Control': 'no-store' } });
}
