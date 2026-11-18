import { NextRequest, NextResponse } from 'next/server';
import { addEvidenceBatch, listEvidence } from '../../../../../lib/services/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ImportRow = { platform: string; text: string; sourceUrl: string; commentUrl?: string; sourceTitle?: string; commentCreatedAt?: string; sourceKeyword?: string; commentId?: string };

function webUrl(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function fingerprint(row: ImportRow): string {
  return row.commentId ? `${row.platform}:id:${row.commentId}` : `${row.platform}:text:${row.sourceUrl}:${row.text.replace(/\s+/g, ' ').toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 500 || typeof body.dryRun !== 'boolean') {
    return NextResponse.json({ error: '每次请提交 1 到 500 条记录并指定是否预览' }, { status: 400 });
  }
  const normalized: ImportRow[] = [];
  for (const [index, raw] of body.rows.entries()) {
    if (!raw || typeof raw !== 'object' || typeof raw.platform !== 'string' || typeof raw.text !== 'string' || typeof raw.sourceUrl !== 'string') return NextResponse.json({ error: `第 ${index + 1} 行缺少平台、原文或原帖链接` }, { status: 400 });
    const row: ImportRow = { platform: raw.platform.trim(), text: raw.text.trim(), sourceUrl: raw.sourceUrl.trim() };
    if (!row.platform || row.platform.length > 80 || !row.text || row.text.length > 10000 || !webUrl(row.sourceUrl)) return NextResponse.json({ error: `第 ${index + 1} 行内容或原帖链接无效` }, { status: 400 });
    for (const key of ['commentUrl', 'sourceTitle', 'commentCreatedAt', 'sourceKeyword', 'commentId'] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== 'string') return NextResponse.json({ error: `第 ${index + 1} 行的 ${key} 格式无效` }, { status: 400 });
      if (typeof raw[key] === 'string' && raw[key].trim()) row[key] = raw[key].trim();
    }
    if (row.commentUrl && !webUrl(row.commentUrl)) return NextResponse.json({ error: `第 ${index + 1} 行评论链接无效` }, { status: 400 });
    if (row.sourceTitle && row.sourceTitle.length > 500) return NextResponse.json({ error: `第 ${index + 1} 行标题过长` }, { status: 400 });
    if (row.sourceKeyword && row.sourceKeyword.length > 120) return NextResponse.json({ error: `第 ${index + 1} 行搜索词过长` }, { status: 400 });
    if (row.commentId && row.commentId.length > 200) return NextResponse.json({ error: `第 ${index + 1} 行评论 ID 过长` }, { status: 400 });
    if (row.commentCreatedAt) {
      const timestamp = Date.parse(row.commentCreatedAt);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() + 86400000) return NextResponse.json({ error: `第 ${index + 1} 行发布时间无效` }, { status: 400 });
      row.commentCreatedAt = new Date(timestamp).toISOString();
    }
    normalized.push(row);
  }
  const seen = new Set(listEvidence().map(fingerprint));
  const additions = normalized.filter(row => {
    const key = fingerprint(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const result = { total: normalized.length, added: additions.length, skipped: normalized.length - additions.length };
  if (body.dryRun) return NextResponse.json(result);
  addEvidenceBatch(additions);
  return NextResponse.json(result, { status: 201 });
}
