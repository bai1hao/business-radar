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
const agentRoot = path.resolve(process.env.BUSINESS_RADAR_AGENT_DIR || path.join(cwd, 'agent-workspace'));
const arrays = [];
const jobs = [];
const agentFiles = [];
const conflicts = [];
let jobFilesSeen = 0;
const comparedFields = {
  'evidence.json': ['text', 'sourceUrl', 'sourceTitle', 'commentUrl', 'contactUrl', 'commentCreatedAt', 'sourceKeyword', 'sourceKeywords', 'status', 'note', 'reviewVerdict', 'reviewedAt', 'verifiedAt', 'contactedAt', 'contactOutcome', 'contactPersonRef', 'currentWorkaround', 'trialInterest', 'paymentIntent', 'paymentEvidence', 'hoursLostPerMonth', 'currentSpendYuanPerMonth', 'nextFollowUpAt', 'updatedAt'],
  'opportunities.json': ['title', 'note', 'evidenceIds', 'decision', 'decisionReason', 'counterEvidence', 'openQuestions', 'decisionAt', 'decisionHistory', 'updatedAt']
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
const incomingAgentRoot = path.join(snapshot, 'agent-results');
if (fs.existsSync(incomingAgentRoot)) {
  for (const entry of fs.readdirSync(incomingAgentRoot, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || !entry.isDirectory() || !/^[a-f\d-]{36}$/i.test(entry.name)) throw new Error(`Agent 结果目录无效：${entry.name}`);
    const directory = path.join(incomingAgentRoot, entry.name);
    const input = path.join(directory, 'input.json');
    const result = path.join(directory, 'result.json');
    if (!fs.existsSync(input) || !fs.existsSync(result) || fs.lstatSync(input).isSymbolicLink() || fs.lstatSync(result).isSymbolicLink()) throw new Error(`Agent 结果不完整：${entry.name}`);
    const parsedInput = JSON.parse(fs.readFileSync(input, 'utf8'));
    const parsedResult = JSON.parse(fs.readFileSync(result, 'utf8'));
    const refs = new Set([...(parsedInput.comments || []), ...(parsedInput.videos || [])].map(row => row.ref));
    if (parsedInput.jobId !== entry.name || parsedResult.jobId !== entry.name || parsedResult.schemaVersion !== 1 || !Array.isArray(parsedResult.findings) || parsedResult.findings.some(item => !Array.isArray(item.evidenceRefs) || !item.evidenceRefs.length || item.evidenceRefs.some(ref => !refs.has(ref)))) throw new Error(`Agent 结果格式无效：${entry.name}`);
    const pending = [];
    const different = [];
    for (const name of ['input.json', 'result.json']) {
      const source = path.join(directory, name);
      const target = path.join(agentRoot, entry.name, name);
      if (fs.existsSync(target) && !merge) throw new Error(`目标 Agent 结果已存在，使用 --merge：${target}`);
      if (!fs.existsSync(target)) pending.push({ source, target });
      else if (fs.readFileSync(source, 'utf8') !== fs.readFileSync(target, 'utf8')) different.push(name);
    }
    if (different.length) conflicts.push({ type: 'agent-result', id: entry.name, fields: different });
    else agentFiles.push(...pending);
  }
}
const snapshotSource = path.join(snapshot, 'experiment-snapshots.json');
const snapshotTarget = path.join(dataRoot, 'experiment-snapshots.json');
let snapshotImport;
if (fs.existsSync(snapshotSource)) {
  const readSnapshots = file => {
    const items = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(items) || items.some(item => !item || typeof item.day !== 'string' || typeof item.experimentTag !== 'string')) throw new Error(`实验快照格式无效：${file}`);
    return items;
  };
  if (fs.existsSync(snapshotTarget) && !merge) throw new Error(`目标文件已存在，使用 --merge 才能增量导入：${snapshotTarget}`);
  const incoming = readSnapshots(snapshotSource);
  const current = fs.existsSync(snapshotTarget) ? readSnapshots(snapshotTarget) : [];
  const key = item => `${item.day}\u0000${item.experimentTag}`;
  const currentByKey = new Map(current.map(item => [key(item), item]));
  const added = incoming.filter(item => !currentByKey.has(key(item)));
  for (const item of incoming) {
    const existing = currentByKey.get(key(item));
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) conflicts.push({ type: 'experiment-snapshot', id: `${item.day}/${item.experimentTag}`, fields: ['content'] });
  }
  snapshotImport = { target: snapshotTarget, rows: [...current, ...added], added: added.length };
}
if (arrays.length === 0 && jobFilesSeen === 0 && !fs.existsSync(incomingAgentRoot) && !snapshotImport) throw new Error('备份目录中没有证据、主题、实验快照、Agent 结果或任务 JSON 文件');

console.log(`导入预览：新增证据 ${arrays.find(item => item.target.endsWith('evidence.json'))?.added || 0} 条，主题 ${arrays.find(item => item.target.endsWith('opportunities.json'))?.added || 0} 个，任务 ${jobs.length} 个；同 ID 差异 ${conflicts.length} 处。`);
console.log(`Agent 文件：可新增 ${agentFiles.length} 个；原有文件冲突时保留目标数据。`);
if (snapshotImport) console.log(`实验快照：可新增 ${snapshotImport.added} 条；同日期与标签的现有记录优先。`);
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
  for (const { source, target } of agentFiles) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    try { fs.linkSync(temporary, target); created.push(target); }
    finally { fs.unlinkSync(temporary); }
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
  if (snapshotImport?.added) {
    fs.mkdirSync(path.dirname(snapshotImport.target), { recursive: true });
    const temporary = `${snapshotImport.target}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshotImport.rows, null, 2));
    try { fs.renameSync(temporary, snapshotImport.target); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
} catch (error) {
  for (const target of created) fs.unlinkSync(target);
  throw error;
}

console.log(`导入完成：新增证据 ${arrays.find(item => item.target.endsWith('evidence.json'))?.added || 0} 条，主题 ${arrays.find(item => item.target.endsWith('opportunities.json'))?.added || 0} 个，任务 ${jobs.length} 个。`);
