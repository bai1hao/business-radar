import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(process.cwd(), '.business-radar'));
const evidenceFile = path.join(root, 'evidence.json');
const snapshotFile = path.join(root, 'experiment-snapshots.json');
const rows = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, 'utf8')) : [];
if (!Array.isArray(rows)) throw new Error('证据文件格式无效');
const now = new Date();
const timeZone = process.env.BUSINESS_RADAR_TIME_ZONE || 'Asia/Shanghai';
const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDay = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const day = localDay(now);
const recentCutoff = Date.now() - 90 * 86400000;
const isRecent = row => {
  const time = Date.parse(row.commentCreatedAt || '');
  return Number.isFinite(time) && time >= recentCutoff && time <= Date.now() + 86400000;
};
const isContactable = row => Boolean(row.commentUrl || row.contactUrl);
const isPaid = row => row.paymentIntent === 'yes' && Boolean(row.paymentEvidence?.trim());
const count = predicate => rows.filter(predicate).length;
const seen = new Set();
let duplicates = 0;
for (const row of rows) {
  const key = row.commentId ? `${row.platform}:id:${row.commentId}` : `${row.platform}:text:${row.sourceUrl}:${String(row.text || '').trim().replace(/\s+/g, ' ').toLowerCase()}`;
  if (seen.has(key)) duplicates++; else seen.add(key);
}
const keywords = [...new Set(rows.flatMap(row => row.sourceKeywords?.length ? row.sourceKeywords : row.sourceKeyword ? [row.sourceKeyword] : []))].sort();
const byKeyword = keywords.map(keyword => {
  const group = rows.filter(row => row.sourceKeyword === keyword || row.sourceKeywords?.includes(keyword));
  return {
    keyword,
    collected: group.length,
    addedToday: group.filter(row => localDay(row.collectedAt) === day).length,
    recent: group.filter(isRecent).length,
    reviewedNeed: group.filter(row => row.reviewVerdict === 'need').length,
    contactable: group.filter(isContactable).length,
    replied: group.filter(row => row.contactOutcome === 'replied').length,
    trialYes: group.filter(row => row.trialInterest === 'yes').length,
    explicitPaid: group.filter(isPaid).length
  };
});
const snapshot = {
  day,
  recordedAt: now.toISOString(),
  experimentTag: process.env.BUSINESS_RADAR_EXPERIMENT_TAG?.trim().slice(0, 120) || '',
  definitionsVersion: 1,
  total: rows.length,
  addedToday: count(row => localDay(row.collectedAt) === day),
  dated: count(row => Number.isFinite(Date.parse(row.commentCreatedAt || ''))),
  directComment: count(row => Boolean(row.commentUrl)),
  duplicates,
  recent: count(isRecent),
  reviewedNeed: count(row => row.reviewVerdict === 'need'),
  verified: count(row => row.status === 'verified' || row.status === 'contacted'),
  contactable: count(isContactable),
  contacted: count(row => row.status === 'contacted'),
  replied: count(row => row.contactOutcome === 'replied'),
  trialYes: count(row => row.trialInterest === 'yes'),
  explicitPaid: count(isPaid),
  byKeyword
};
const history = fs.existsSync(snapshotFile) ? JSON.parse(fs.readFileSync(snapshotFile, 'utf8')) : [];
if (!Array.isArray(history)) throw new Error('实验快照文件格式无效');
const index = history.findIndex(item => item.day === day && item.experimentTag === snapshot.experimentTag);
if (index >= 0) history[index] = snapshot; else history.push(snapshot);
history.sort((a, b) => a.day.localeCompare(b.day) || a.experimentTag.localeCompare(b.experimentTag));
fs.mkdirSync(root, { recursive: true });
const temporary = `${snapshotFile}.${randomUUID()}.tmp`;
try {
  fs.writeFileSync(temporary, JSON.stringify(history, null, 2));
  fs.renameSync(temporary, snapshotFile);
} finally {
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
}
console.log(`已记录 ${day} 的实验快照：证据 ${snapshot.total}，今日新增 ${snapshot.addedToday}，已回复 ${snapshot.replied}，明确付费原话 ${snapshot.explicitPaid}`);
