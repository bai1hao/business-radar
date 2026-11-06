import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const cwd = process.cwd();
const evidenceRoot = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(cwd, '.business-radar'));
const jobsRoot = path.resolve(process.env.DEEPPOINT_JOB_DATA_DIR || path.join(cwd, '.deeppoint', 'jobs'));
const backupRoot = path.resolve(process.env.BUSINESS_RADAR_BACKUP_DIR || path.join(cwd, '.business-radar-backups'));
const snapshot = path.join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);

fs.mkdirSync(snapshot, { recursive: true });
const files = [
  { source: path.join(evidenceRoot, 'evidence.json'), destination: 'evidence.json' },
  { source: path.join(evidenceRoot, 'opportunities.json'), destination: 'opportunities.json' }
];
function addJobs(directory, prefix = 'jobs') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) addJobs(source, path.join(prefix, entry.name));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push({ source, destination: path.join(prefix, entry.name) });
  }
}
addJobs(jobsRoot);

let count = 0;
for (const { source, destination } of files) {
  if (!fs.existsSync(source)) continue;
  const target = path.join(snapshot, destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (fs.statSync(source).size !== fs.statSync(target).size) throw new Error(`备份校验失败：${destination}`);
  count++;
}
if (count === 0) {
  throw new Error('未找到可备份的证据或任务数据');
}
console.log(`已备份 ${count} 个文件到 ${snapshot}`);
