import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const cwd = process.cwd();
const evidenceRoot = path.resolve(process.env.BUSINESS_RADAR_DATA_DIR || path.join(cwd, '.business-radar'));
const jobsRoot = path.resolve(process.env.DEEPPOINT_JOB_DATA_DIR || path.join(cwd, '.deeppoint', 'jobs'));
const backupRoot = path.resolve(process.env.BUSINESS_RADAR_BACKUP_DIR || path.join(cwd, '.business-radar-backups'));
const agentRoot = path.resolve(process.env.BUSINESS_RADAR_AGENT_DIR || path.join(cwd, 'agent-workspace'));
const snapshot = path.join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);

fs.mkdirSync(snapshot, { recursive: true });
const files = [
  { source: path.join(evidenceRoot, 'evidence.json'), destination: 'evidence.json' },
  { source: path.join(evidenceRoot, 'opportunities.json'), destination: 'opportunities.json' },
  { source: path.join(evidenceRoot, 'experiment-snapshots.json'), destination: 'experiment-snapshots.json' }
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
if (fs.existsSync(agentRoot)) {
  for (const entry of fs.readdirSync(agentRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f\d-]{36}$/i.test(entry.name)) continue;
    const directory = path.join(agentRoot, entry.name);
    const input = path.join(directory, 'input.json');
    const result = path.join(directory, 'result.json');
    if (!fs.existsSync(input) || !fs.existsSync(result) || fs.lstatSync(input).isSymbolicLink() || fs.lstatSync(result).isSymbolicLink()) continue;
    const parsedInput = JSON.parse(fs.readFileSync(input, 'utf8'));
    const parsedResult = JSON.parse(fs.readFileSync(result, 'utf8'));
    if (parsedInput.jobId !== entry.name || parsedResult.jobId !== entry.name || parsedResult.schemaVersion !== 1 || !Array.isArray(parsedResult.findings)) continue;
    files.push({ source: input, destination: path.join('agent-results', entry.name, 'input.json') });
    files.push({ source: result, destination: path.join('agent-results', entry.name, 'result.json') });
  }
}

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
