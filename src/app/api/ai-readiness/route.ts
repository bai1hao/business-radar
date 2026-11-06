import { NextResponse } from 'next/server';
import { getAiReadiness } from '../../../../lib/services/ai-readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getAiReadiness(), { headers: { 'Cache-Control': 'no-store' } });
}
