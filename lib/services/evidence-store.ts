import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type EvidenceStatus = 'new' | 'verified' | 'contacted' | 'dismissed';
export interface Evidence {
  id: string;
  platform: string;
  text: string;
  sourceUrl: string;
  commentId?: string;
  contentId?: string;
  authorLabel?: string;
  status: EvidenceStatus;
  note: string;
  collectedAt: string;
}

const root = process.env.BUSINESS_RADAR_DATA_DIR || path.join(process.cwd(), '.business-radar');
const file = path.join(root, 'evidence.json');

function read(): Evidence[] {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Evidence[];
}

function write(rows: Evidence[]): void {
  fs.mkdirSync(root, { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(rows, null, 2));
  fs.renameSync(temp, file);
}

export function listEvidence(): Evidence[] {
  return read().sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

export function addEvidence(input: Pick<Evidence, 'platform' | 'text' | 'sourceUrl'> & Partial<Evidence>): Evidence {
  const rows = read();
  const existing = input.commentId && rows.find(row => row.platform === input.platform && row.commentId === input.commentId);
  if (existing) return existing;
  const row: Evidence = {
    id: randomUUID(), platform: input.platform, text: input.text, sourceUrl: input.sourceUrl,
    commentId: input.commentId, contentId: input.contentId, authorLabel: input.authorLabel,
    status: 'new', note: '', collectedAt: input.collectedAt || new Date().toISOString()
  };
  rows.push(row);
  write(rows);
  return row;
}

export function updateEvidence(id: string, status: EvidenceStatus, note: string): Evidence | null {
  const rows = read();
  const row = rows.find(item => item.id === id);
  if (!row) return null;
  row.status = status;
  row.note = note;
  write(rows);
  return row;
}
