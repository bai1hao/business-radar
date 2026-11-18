import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const snapshot = process.argv[2] && path.resolve(process.argv[2]);
const flags = process.argv.slice(3);
const merge = flags.includes('--merge');
const dryRun = flags.includes('--dry-run');
if (!snapshot || !fs.statSync(snapshot, { throwIfNoEntry: false })?.isDirectory() || flags.some(flag => !['--merge', '--dry-run'].includes(flag))) {
  throw new Error('用法：npm run import:data -- <备份目录> [--merge] [--dry-run]');
}

const cwd = process.cwd();
const dataRoot = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(cwd, '.business-radar'));
const jobsRoot = path.resolve(process.env.DEEPPOINT_JOB_DATA_DIR || path.join(cwd, '.deeppoint', 'jobs'));
const arrays = [];
const jobs = [];
const conflicts = [];
let jobFilesSeen = 0;
const comparedFields = {
  'evidence.json': ['text', 'sourceUrl', 'sourceTitle', 'commentUrl', 'contactUrl', 'commentCreatedAt', 'sourceKeyword', 'sourceKeywords', 'status', 'note', 'reviewVerdict', 'reviewedAt', 'verifiedAt', 'contactedAt', 'contactOutcome', 'currentWorkaround', 'trialInterest', 'nextFollowUpAt', 'updatedAt'],
  'opportunities.json': ['title', 'note', 'evidenceIds', 'decision', 'decisionReason', 'decisionAt', 'decisionHistory', 'updatedAt']
};

function readRows(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id)) {
    throw new Error(`数据格式无效：${file}`);
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`数据包含重复 ID：${file}`);
  return rows;
}

for (const name of ['evidence.json', 'opportunities.json']) {
  const source = path.join(snapshot, name);
  if (!fs.existsSync(source)) continue;
  const target = path.join(dataRoot, name);
  const incoming = readRows(source);
  if (fs.existsSync(target) && !merge) throw new Error(`目标文件已存在，使用 --merge 才能增量导入：${target}`);
  const current = fs.existsSync(target) ? readRows(target) : [];
  const currentById = new Map(current.map(row => [row.id, row]));
  for (const row of incoming) {
    const existing = currentById.get(row.id);
    if (!existing) continue;
    const fields = comparedFields[name].filter(field => JSON.stringify(existing[field]) !== JSON.stringify(row[field]));
    if (fields.length) conflicts.push({ type: name, id: row.id, fields });
  }
  const known = new Set(current.map(row => row.id));
  const added = incoming.filter(row => !known.has(row.id));
  arrays.push({ target, rows: [...current, ...added], added: added.length });
}

function collectJobs(directory, relative = '') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`备份中包含符号链接：${entry.name}`);
    const nextRelative = path.join(relative, entry.name);
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJobs(source, nextRelative);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      jobFilesSeen++;
      const target = path.join(jobsRoot, nextRelative);
      const job = JSON.parse(fs.readFileSync(source, 'utf8'));
      if (!job || typeof job !== 'object' || typeof job.jobId !== 'string') throw new Error(`任务格式无效：${source}`);
      if (fs.existsSync(target) && !merge) throw new Error(`目标任务已存在，使用 --merge 才能增量导入：${target}`);
      if (!fs.existsSync(target)) jobs.push({ source, target });
      else if (fs.readFileSync(source, 'utf8') !== fs.readFileSync(target, 'utf8')) conflicts.push({ type: 'job', id: job.jobId, fields: ['content'] });
    }
  }
}
collectJobs(path.join(snapshot, 'jobs'));
if (arrays.length === 0 && jobFilesSeen === 0) throw new Error('备份目录中没有证据、主题或任务 JSON 文件');

console.log(`导入预览：新增证据 ${arrays.find(item => item.target.endsWith('evidence.json'))?.added || 0} 条，主题 ${arrays.find(item => item.target.endsWith('opportunities.json'))?.added || 0} 个，任务 ${jobs.length} 个；同 ID 差异 ${conflicts.length} 处。`);
if (conflicts.length) {
  console.log('同 ID 差异（现有数据优先，以下字段不会被覆盖）：');
  for (const conflict of conflicts) console.log(`${conflict.type} ${conflict.id}: ${conflict.fields.join(', ')}`);
}
if (dryRun) {
  console.log('预览完成，未修改目标数据。');
  process.exit(0);
}

const created = [];
try {
  for (const { source, target } of jobs) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    try {
      fs.linkSync(temporary, target);
      created.push(target);
    } finally {
      fs.unlinkSync(temporary);
    }
  }
  for (const { target, rows, added } of arrays) {
    if (added === 0) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(rows, null, 2));
    try {
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
} catch (error) {
  for (const target of created) fs.unlinkSync(target);
  throw error;
}

console.log(`导入完成：新增证据 ${arrays.find(item => item.target.endsWith('evidence.json'))?.added || 0} 条，主题 ${arrays.find(item => item.target.endsWith('opportunities.json'))?.added || 0} 个，任务 ${jobs.length} 个。`);
