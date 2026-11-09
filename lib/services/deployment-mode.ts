import { NextResponse } from 'next/server';

export function isWebOnlyMode(): boolean {
  return process.env.BUSINESS_RADAR_WEB_ONLY === 'true';
}

export function isAnalysisEnabled(): boolean {
  return !isWebOnlyMode() || process.env.BUSINESS_RADAR_ALLOW_AI_ANALYSIS === 'true';
}

export function webOnlyResponse() {
  return NextResponse.json(
    { error: '当前服务器仅提供看板与证据库。请在本地电脑运行采集和 AI 分析。' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
