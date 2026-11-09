import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type EvidenceStatus = 'new' | 'verified' | 'contacted' | 'dismissed';
export interface Evidence {
  id: string;
  platform: string;
  text: string;
  sourceUrl: string;
  commentUrl?: string;
  commentId?: string;
  contentId?: string;
  authorLabel?: string;
  status: EvidenceStatus;
  note: string;
  collectedAt: string;
  commentCreatedAt?: string;
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
  return read().sort((a, b) => (b.commentCreatedAt || '').localeCompare(a.commentCreatedAt || '') || b.collectedAt.localeCompare(a.collectedAt));
}

export function addEvidence(input: Pick<Evidence, 'platform' | 'text' | 'sourceUrl'> & Partial<Evidence>): Evidence {
  return addEvidenceBatch([input])[0];
}

export function addEvidenceBatch(inputs: Array<Pick<Evidence, 'platform' | 'text' | 'sourceUrl'> & Partial<Evidence>>): Evidence[] {
  if (inputs.length === 0) return [];
  const rows = read();
  const byComment = new Map(rows.filter(row => row.commentId).map(row => [`${row.platform}:${row.commentId}`, row]));
  const result: Evidence[] = [];
  let changed = false;
  for (const input of inputs) {
    const existing = input.commentId ? byComment.get(`${input.platform}:${input.commentId}`) : undefined;
    if (existing) { result.push(existing); continue; }
  const row: Evidence = {
    id: randomUUID(), platform: input.platform, text: input.text, sourceUrl: input.sourceUrl,
    commentUrl: input.commentUrl, commentId: input.commentId, contentId: input.contentId, authorLabel: input.authorLabel,
    status: 'new', note: '', collectedAt: input.collectedAt || new Date().toISOString(),
    commentCreatedAt: input.commentCreatedAt
  };
  rows.push(row);
    if (row.commentId) byComment.set(`${row.platform}:${row.commentId}`, row);
    result.push(row);
    changed = true;
  }
  if (changed) write(rows);
  return result;
}

export function updateEvidence(id: string, status: EvidenceStatus, note: string, commentUrl?: string): Evidence | null {
  const rows = read();
  const row = rows.find(item => item.id === id);
  if (!row) return null;
  row.status = status;
  row.note = note;
  if (commentUrl !== undefined) row.commentUrl = commentUrl;
  write(rows);
  return row;
}
