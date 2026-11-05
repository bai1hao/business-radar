import { NextRequest, NextResponse } from 'next/server';
import { addEvidence, listEvidence, updateEvidence, EvidenceStatus } from '../../../../lib/services/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const statuses: EvidenceStatus[] = ['new', 'verified', 'contacted', 'dismissed'];

export async function GET() {
  return NextResponse.json(listEvidence(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== 'string' || !body.text.trim() || typeof body.platform !== 'string' || !body.platform.trim() || typeof body.sourceUrl !== 'string') {
    return NextResponse.json({ error: '请填写平台、原文和原帖地址' }, { status: 400 });
  }
  try {
    const url = new URL(body.sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad URL');
  } catch { return NextResponse.json({ error: '原帖地址必须是有效的网页链接' }, { status: 400 }); }
  return NextResponse.json(addEvidence({ platform: body.platform.trim(), text: body.text.trim(), sourceUrl: body.sourceUrl, commentId: body.commentId, contentId: body.contentId, authorLabel: body.authorLabel }), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !statuses.includes(body.status) || typeof body.note !== 'string') {
    return NextResponse.json({ error: '无效的线索更新' }, { status: 400 });
  }
  if (body.commentUrl !== undefined) {
    if (typeof body.commentUrl !== 'string') return NextResponse.json({ error: '评论链接格式无效' }, { status: 400 });
    if (body.commentUrl) {
      try {
        const url = new URL(body.commentUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      } catch { return NextResponse.json({ error: '评论链接必须是有效的网页地址' }, { status: 400 }); }
    }
  }
  const row = updateEvidence(body.id, body.status, body.note, body.commentUrl);
  return row ? NextResponse.json(row) : NextResponse.json({ error: '线索不存在' }, { status: 404 });
}
