import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceFile = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(root, '.business-radar'), 'evidence.json');
const csvDir = path.join(root, 'lib', 'crawlers', 'douyin_new', 'data', 'douyin', 'csv');
if (!fs.existsSync(evidenceFile)) throw new Error('未找到证据数据文件');
if (!fs.existsSync(csvDir)) throw new Error('未找到原始评论 CSV');

const commentTimes = new Map();
for (const name of fs.readdirSync(csvDir).filter(name => /^search_comments_.*\.csv$/.test(name))) {
  const content = fs.readFileSync(path.join(csvDir, name), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = /^"(\d+)","(\d{10})",/.exec(line);
    if (!match) continue;
    const timestamp = Number(match[2]) * 1000;
    if (timestamp > Date.UTC(2000, 0, 1) && timestamp <= Date.now() + 86400000) {
      commentTimes.set(match[1], new Date(timestamp).toISOString());
    }
  }
}

const rows = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
let updated = 0;
for (const row of rows) {
  const publishedAt = commentTimes.get(row.commentId);
  if (!row.commentCreatedAt && publishedAt) {
    row.commentCreatedAt = publishedAt;
    updated++;
  }
}
console.log(`匹配到 ${commentTimes.size} 条原始评论；可回填 ${updated} / ${rows.length} 条证据`);
if (process.argv.includes('--dry-run') || updated === 0) process.exit(0);
const temp = `${evidenceFile}.tmp`;
fs.writeFileSync(temp, JSON.stringify(rows, null, 2));
fs.renameSync(temp, evidenceFile);
