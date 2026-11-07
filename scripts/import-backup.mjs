import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const snapshot = process.argv[2] && path.resolve(process.argv[2]);
if (!snapshot || !fs.statSync(snapshot, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error('请传入 npm run import:data -- <备份目录>');
}

const cwd = process.cwd();
const dataRoot = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(cwd, '.business-radar'));
const jobsRoot = path.resolve(process.env.DEEPPOINT_JOB_DATA_DIR || path.join(cwd, '.deeppoint', 'jobs'));
const transfers = [];

for (const name of ['evidence.json', 'opportunities.json']) {
  const source = path.join(snapshot, name);
  if (fs.existsSync(source)) transfers.push({ source, target: path.join(dataRoot, name), kind: 'array' });
}

function collectJobs(directory, relative = '') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`备份中包含符号链接：${entry.name}`);
    const nextRelative = path.join(relative, entry.name);
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJobs(source, nextRelative);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      transfers.push({ source, target: path.join(jobsRoot, nextRelative), kind: 'job' });
    }
  }
}
collectJobs(path.join(snapshot, 'jobs'));

if (transfers.length === 0) throw new Error('备份目录中没有证据、主题或任务 JSON 文件');
for (const { source, target, kind } of transfers) {
  if (fs.existsSync(target)) throw new Error(`目标文件已存在，导入已取消：${target}`);
  const value = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (kind === 'array' && !Array.isArray(value)) throw new Error(`备份格式无效：${source}`);
  if (kind === 'job' && (!value || typeof value !== 'object' || typeof value.jobId !== 'string')) {
    throw new Error(`任务格式无效：${source}`);
  }
}

const created = [];
try {
  for (const { source, target } of transfers) {
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
} catch (error) {
  for (const target of created) fs.unlinkSync(target);
  throw error;
}
console.log(`已导入 ${transfers.length} 个数据文件。请启动服务查看证据库和任务记录。`);
