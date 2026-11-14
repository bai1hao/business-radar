import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const evidenceFile = path.join(path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(cwd, '.business-radar')), 'evidence.json');
const jobsDir = path.join(path.resolve(process.env.DEEPPOINT_JOB_DATA_DIR || path.join(cwd, '.deeppoint', 'jobs')), 'analysis');
if (!fs.existsSync(evidenceFile)) throw new Error('未找到证据数据文件');
if (!fs.existsSync(jobsDir)) throw new Error('未找到历史采集任务');

const titles = new Map();
for (const name of fs.readdirSync(jobsDir).filter(name => name.endsWith('.json'))) {
  const job = JSON.parse(fs.readFileSync(path.join(jobsDir, name), 'utf8'));
  for (const comment of job.rawData?.comments || []) {
    if (comment.comment_id && comment.video_title?.trim()) {
      titles.set(String(comment.comment_id), comment.video_title.trim().slice(0, 500));
    }
  }
}

const rows = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
let updated = 0;
for (const row of rows) {
  const title = titles.get(String(row.commentId));
  if (!row.sourceTitle && title) {
    row.sourceTitle = title;
    updated++;
  }
}
console.log(`历史任务找到 ${titles.size} 个评论标题；可回填 ${updated} / ${rows.length} 条证据`);
if (process.argv.includes('--dry-run') || updated === 0) process.exit(0);
const temporary = `${evidenceFile}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(rows, null, 2));
fs.renameSync(temporary, evidenceFile);
