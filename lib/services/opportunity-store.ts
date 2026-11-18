import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type OpportunityDecision = 'research' | 'experiment' | 'paused' | 'rejected';
export interface Opportunity {
  id: string;
  title: string;
  note: string;
  evidenceIds: string[];
  decision?: OpportunityDecision;
  decisionReason?: string;
  counterEvidence?: string;
  openQuestions?: string;
  decisionAt?: string;
  decisionHistory?: Array<{ decision: OpportunityDecision; reason: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

const root = process.env.BUSINESS_RADAR_DATA_DIR || path.join(process.cwd(), '.business-radar');
const file = path.join(root, 'opportunities.json');

function read(): Opportunity[] {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Opportunity[] : [];
}

function write(rows: Opportunity[]): void {
  fs.mkdirSync(root, { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(rows, null, 2));
  fs.renameSync(temporary, file);
}

export function listOpportunities(): Opportunity[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createOpportunity(title: string): Opportunity {
  const rows = read();
  const now = new Date().toISOString();
  const row = { id: randomUUID(), title, note: '', evidenceIds: [], createdAt: now, updatedAt: now };
  rows.push(row);
  write(rows);
  return row;
}

export function updateOpportunity(id: string, changes: { title?: string; note?: string; decision?: OpportunityDecision; decisionReason?: string; counterEvidence?: string; openQuestions?: string; addEvidenceId?: string; removeEvidenceId?: string }): Opportunity | null {
  const rows = read();
  const row = rows.find(item => item.id === id);
  if (!row) return null;
  if (changes.title !== undefined) row.title = changes.title;
  if (changes.note !== undefined) row.note = changes.note;
  if (changes.decision !== undefined && changes.decision !== (row.decision || 'research')) {
    row.decisionHistory = [...(row.decisionHistory || []), {
      decision: row.decision || 'research',
      reason: row.decisionReason || '',
      at: row.decisionAt || row.createdAt
    }];
    row.decision = changes.decision;
    row.decisionAt = new Date().toISOString();
    if (changes.decisionReason === undefined) row.decisionReason = '';
  }
  if (changes.decisionReason !== undefined) row.decisionReason = changes.decisionReason;
  if (changes.counterEvidence !== undefined) row.counterEvidence = changes.counterEvidence;
  if (changes.openQuestions !== undefined) row.openQuestions = changes.openQuestions;
  if (changes.addEvidenceId && !row.evidenceIds.includes(changes.addEvidenceId)) row.evidenceIds.push(changes.addEvidenceId);
  if (changes.removeEvidenceId) row.evidenceIds = row.evidenceIds.filter(evidenceId => evidenceId !== changes.removeEvidenceId);
  row.updatedAt = new Date().toISOString();
  write(rows);
  return row;
}
