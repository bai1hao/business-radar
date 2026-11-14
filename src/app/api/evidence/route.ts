import { NextRequest, NextResponse } from 'next/server';
import { addEvidence, listEvidence, updateEvidence, EvidenceStatus, ReviewVerdict } from '../../../../lib/services/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const statuses: EvidenceStatus[] = ['new', 'verified', 'contacted', 'dismissed'];
const verdicts: ReviewVerdict[] = ['need', 'not-need', 'unclear'];

function validWebUrl(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export async function GET() {
  return NextResponse.json(listEvidence(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== 'string' || !body.text.trim() || typeof body.platform !== 'string' || !body.platform.trim() || typeof body.sourceUrl !== 'string') {
    return NextResponse.json({ error: '请填写平台、原文和原帖地址' }, { status: 400 });
  }
  if (!validWebUrl(body.sourceUrl)) return NextResponse.json({ error: '原帖地址必须是有效的网页链接' }, { status: 400 });
  if (body.commentUrl !== undefined && (typeof body.commentUrl !== 'string' || (body.commentUrl && !validWebUrl(body.commentUrl)))) {
    return NextResponse.json({ error: '评论链接必须是有效的网页地址' }, { status: 400 });
  }
  let commentCreatedAt: string | undefined;
  if (body.commentCreatedAt) {
    const timestamp = typeof body.commentCreatedAt === 'string' ? Date.parse(body.commentCreatedAt) : NaN;
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 86400000) return NextResponse.json({ error: '评论发布时间无效' }, { status: 400 });
    commentCreatedAt = new Date(timestamp).toISOString();
  }
  return NextResponse.json(addEvidence({ platform: body.platform.trim(), text: body.text.trim(), sourceUrl: body.sourceUrl, commentUrl: body.commentUrl || undefined, commentId: body.commentId, contentId: body.contentId, authorLabel: body.authorLabel, commentCreatedAt }), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !statuses.includes(body.status) || typeof body.note !== 'string') {
    return NextResponse.json({ error: '无效的线索更新' }, { status: 400 });
  }
  if (body.commentUrl !== undefined) {
    if (typeof body.commentUrl !== 'string') return NextResponse.json({ error: '评论链接格式无效' }, { status: 400 });
    if (body.commentUrl) {
      if (!validWebUrl(body.commentUrl)) return NextResponse.json({ error: '评论链接必须是有效的网页地址' }, { status: 400 });
    }
  }
  if (body.reviewVerdict !== undefined && body.reviewVerdict !== null && !verdicts.includes(body.reviewVerdict)) {
    return NextResponse.json({ error: '需求判读结果无效' }, { status: 400 });
  }
  const row = updateEvidence(body.id, body.status, body.note, body.commentUrl, body.reviewVerdict);
  return row ? NextResponse.json(row) : NextResponse.json({ error: '线索不存在' }, { status: 404 });
}
