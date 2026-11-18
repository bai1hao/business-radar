import { NextRequest, NextResponse } from 'next/server';
import { createOpportunity, listOpportunities, updateOpportunity, OpportunityDecision } from '../../../../lib/services/opportunity-store';
import { listEvidence } from '../../../../lib/services/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const decisions: OpportunityDecision[] = ['research', 'experiment', 'paused', 'rejected'];

export async function GET() {
  return NextResponse.json(listOpportunities(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) {
    return NextResponse.json({ error: '请输入不超过 120 字的需求主题' }, { status: 400 });
  }
  return NextResponse.json(createOpportunity(body.title.trim()), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string') return NextResponse.json({ error: '无效主题' }, { status: 400 });
  const changes: { title?: string; note?: string; decision?: OpportunityDecision; decisionReason?: string; addEvidenceId?: string; removeEvidenceId?: string } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) return NextResponse.json({ error: '主题名称无效' }, { status: 400 });
    changes.title = body.title.trim();
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string' || body.note.length > 4000) return NextResponse.json({ error: '备注过长' }, { status: 400 });
    changes.note = body.note;
  }
  if (body.decision !== undefined) {
    if (!decisions.includes(body.decision)) return NextResponse.json({ error: '主题决策无效' }, { status: 400 });
    changes.decision = body.decision;
  }
  if (body.decisionReason !== undefined) {
    if (typeof body.decisionReason !== 'string' || body.decisionReason.length > 2000) return NextResponse.json({ error: '判断理由不能超过 2000 字' }, { status: 400 });
    changes.decisionReason = body.decisionReason;
  }
  if (body.addEvidenceId !== undefined) {
    if (typeof body.addEvidenceId !== 'string' || !listEvidence().some(row => row.id === body.addEvidenceId)) return NextResponse.json({ error: '证据不存在' }, { status: 400 });
    changes.addEvidenceId = body.addEvidenceId;
  }
  if (body.removeEvidenceId !== undefined) {
    if (typeof body.removeEvidenceId !== 'string') return NextResponse.json({ error: '证据 ID 无效' }, { status: 400 });
    changes.removeEvidenceId = body.removeEvidenceId;
  }
  if (Object.keys(changes).length === 0) return NextResponse.json({ error: '没有需要更新的内容' }, { status: 400 });
  const row = updateOpportunity(body.id, changes);
  return row ? NextResponse.json(row) : NextResponse.json({ error: '主题不存在' }, { status: 404 });
}
