import { NextRequest, NextResponse } from 'next/server';
import { addEvidence, listEvidence, updateEvidence, EvidenceStatus, ReviewVerdict, ContactOutcome, TrialInterest, PaymentIntent } from '../../../../lib/services/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const statuses: EvidenceStatus[] = ['new', 'verified', 'contacted', 'dismissed'];
const verdicts: ReviewVerdict[] = ['need', 'not-need', 'unclear'];
const contactOutcomes: ContactOutcome[] = ['no-reply', 'replied', 'declined'];
const trialInterests: TrialInterest[] = ['yes', 'no', 'unknown'];
const paymentIntents: PaymentIntent[] = ['yes', 'no', 'unknown'];

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
  if (body.sourceTitle !== undefined && (typeof body.sourceTitle !== 'string' || body.sourceTitle.length > 500)) return NextResponse.json({ error: '原帖标题格式无效' }, { status: 400 });
  if (body.commentUrl !== undefined && (typeof body.commentUrl !== 'string' || (body.commentUrl && !validWebUrl(body.commentUrl)))) {
    return NextResponse.json({ error: '评论链接必须是有效的网页地址' }, { status: 400 });
  }
  if (body.contactUrl !== undefined && (typeof body.contactUrl !== 'string' || (body.contactUrl && !validWebUrl(body.contactUrl)))) {
    return NextResponse.json({ error: '联系入口必须是有效的网页地址' }, { status: 400 });
  }
  if (body.sourceKeyword !== undefined && (typeof body.sourceKeyword !== 'string' || body.sourceKeyword.length > 120)) return NextResponse.json({ error: '来源搜索词格式无效' }, { status: 400 });
  let commentCreatedAt: string | undefined;
  if (body.commentCreatedAt) {
    const timestamp = typeof body.commentCreatedAt === 'string' ? Date.parse(body.commentCreatedAt) : NaN;
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 86400000) return NextResponse.json({ error: '评论发布时间无效' }, { status: 400 });
    commentCreatedAt = new Date(timestamp).toISOString();
  }
  return NextResponse.json(addEvidence({ platform: body.platform.trim(), text: body.text.trim(), sourceUrl: body.sourceUrl, sourceTitle: body.sourceTitle?.trim() || undefined, commentUrl: body.commentUrl || undefined, contactUrl: body.contactUrl || undefined, commentId: body.commentId, contentId: body.contentId, authorLabel: body.authorLabel, sourceKeyword: body.sourceKeyword?.trim() || undefined, commentCreatedAt }), { status: 201 });
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
  if (body.contactUrl !== undefined && (typeof body.contactUrl !== 'string' || (body.contactUrl && !validWebUrl(body.contactUrl)))) {
    return NextResponse.json({ error: '联系入口必须是有效的网页地址' }, { status: 400 });
  }
  if (body.reviewVerdict !== undefined && body.reviewVerdict !== null && !verdicts.includes(body.reviewVerdict)) {
    return NextResponse.json({ error: '需求判读结果无效' }, { status: 400 });
  }
  if (body.contactOutcome !== undefined && body.contactOutcome !== '' && !contactOutcomes.includes(body.contactOutcome)) return NextResponse.json({ error: '联系结果无效' }, { status: 400 });
  if (body.contactPersonRef !== undefined && (typeof body.contactPersonRef !== 'string' || body.contactPersonRef.length > 120)) return NextResponse.json({ error: '联系人标识不能超过 120 字' }, { status: 400 });
  if (body.trialInterest !== undefined && body.trialInterest !== '' && !trialInterests.includes(body.trialInterest)) return NextResponse.json({ error: '试用意愿无效' }, { status: 400 });
  if (body.paymentIntent !== undefined && body.paymentIntent !== '' && !paymentIntents.includes(body.paymentIntent)) return NextResponse.json({ error: '付费意愿无效' }, { status: 400 });
  if (body.paymentEvidence !== undefined && (typeof body.paymentEvidence !== 'string' || body.paymentEvidence.length > 2000)) return NextResponse.json({ error: '付费表态原话不能超过 2000 字' }, { status: 400 });
  for (const key of ['hoursLostPerMonth', 'currentSpendYuanPerMonth'] as const) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] < 0 || body[key] > 1000000)) return NextResponse.json({ error: '时间或费用数值无效' }, { status: 400 });
  }
  if (body.currentWorkaround !== undefined && (typeof body.currentWorkaround !== 'string' || body.currentWorkaround.length > 2000)) return NextResponse.json({ error: '现有解决办法不能超过 2000 字' }, { status: 400 });
  if (body.nextFollowUpAt !== undefined && (typeof body.nextFollowUpAt !== 'string' || (body.nextFollowUpAt && (!/^\d{4}-\d{2}-\d{2}$/.test(body.nextFollowUpAt) || !Number.isFinite(Date.parse(body.nextFollowUpAt)) || new Date(body.nextFollowUpAt).toISOString().slice(0, 10) !== body.nextFollowUpAt)))) return NextResponse.json({ error: '跟进日期无效' }, { status: 400 });
  const followUp = Object.fromEntries((['contactOutcome', 'contactPersonRef', 'currentWorkaround', 'trialInterest', 'nextFollowUpAt', 'paymentIntent', 'paymentEvidence', 'hoursLostPerMonth', 'currentSpendYuanPerMonth'] as const).filter(key => body[key] !== undefined).map(key => [key, body[key] === '' || body[key] === null ? undefined : body[key]]));
  const row = updateEvidence(body.id, body.status, body.note, body.commentUrl, body.reviewVerdict, body.contactUrl, followUp);
  return row ? NextResponse.json(row) : NextResponse.json({ error: '线索不存在' }, { status: 404 });
}
