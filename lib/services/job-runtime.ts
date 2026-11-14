import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger';

type RuntimeJobStatus = 'processing' | 'captured' | 'completed' | 'failed';

export interface RuntimeJob {
  jobId: string;
  status: RuntimeJobStatus;
  progress: string;
  startTime: number;
  error?: string;
  rawData?: { rawTexts: string[] };
}

const DEFAULT_MAX_CONCURRENT_JOBS = 1;
const DEFAULT_JOB_TIMEOUT_MS = 15 * 60 * 1000;

function readPositiveInteger(name: string, defaultValue: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function getJobDataRoot(): string {
  return process.env.DEEPPOINT_JOB_DATA_DIR || path.join(process.cwd(), '.deeppoint', 'jobs');
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getJobTimeoutMs(): number {
  return readPositiveInteger('DEEPPOINT_JOB_TIMEOUT_MS', DEFAULT_JOB_TIMEOUT_MS);
}

export function logJobEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown>
): void {
  logger[level]({
    component: 'job-runtime',
    event,
    ...fields
  });
}

export class JsonJobStore<TJob extends RuntimeJob> {
  private readonly directory: string;

  constructor(namespace: string) {
    this.directory = path.join(getJobDataRoot(), sanitizePathPart(namespace));
  }

  loadAll(limit = 100): Map<string, TJob> {
    const jobs = new Map<string, TJob>();
    for (const filePath of this.recentPaths(limit)) {
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TJob;
        if (!job.jobId || !job.startTime || !job.status) {
          continue;
        }

        this.recoverInterrupted(job);
        jobs.set(job.jobId, job);
      } catch (error) {
        logJobEvent('warn', 'job_store_load_failed', {
          filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return jobs;
  }

  load(jobId: string): TJob | null {
    const filePath = this.getJobPath(jobId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const job = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TJob;
      if (job.jobId !== jobId || !job.startTime || !job.status) return null;
      this.recoverInterrupted(job);
      return job;
    } catch (error) {
      logJobEvent('warn', 'job_store_load_failed', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  listSaved(limit = 100): TJob[] {
    const jobs: TJob[] = [];
    for (const filePath of this.recentPaths(limit)) {
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TJob;
        if (job.jobId && job.startTime && job.status) jobs.push(job);
      } catch (error) {
        logJobEvent('warn', 'job_store_load_failed', {
          filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return jobs;
  }

  private recentPaths(limit: number): string[] {
    if (!fs.existsSync(this.directory)) return [];
    return fs.readdirSync(this.directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => {
        const filePath = path.join(this.directory, entry.name);
        try { return { filePath, modified: fs.statSync(filePath).mtimeMs }; }
        catch { return null; }
      })
      .filter((entry): entry is { filePath: string; modified: number } => entry !== null)
      .sort((a, b) => b.modified - a.modified)
      .slice(0, limit)
      .map(entry => entry.filePath);
  }

  private recoverInterrupted(job: TJob): void {
    if (job.status !== 'processing') return;
    job.status = job.rawData?.rawTexts?.length ? 'captured' : 'failed';
    job.progress = job.status === 'captured' ? '服务重启，已保存采集数据，可重新分析' : '服务重启，采集任务已停止';
    job.error = job.status === 'failed' ? '采集任务未完成，请重新提交' : undefined;
    this.save(job);
  }

  save(job: TJob): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const filePath = this.getJobPath(job.jobId);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(job, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  delete(jobId: string): void {
    const filePath = this.getJobPath(jobId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private getJobPath(jobId: string): string {
    return path.join(this.directory, `${sanitizePathPart(jobId)}.json`);
  }
}

class JobQueue {
  private readonly maxConcurrentJobs: number;
  private runningJobs = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrentJobs: number) {
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  run<T>(
    jobId: string,
    jobType: string,
    task: () => Promise<T>,
    onStart: () => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runTask = async () => {
        this.runningJobs += 1;
        onStart();
        logJobEvent('info', 'job_started', {
          jobId,
          jobType,
          runningJobs: this.runningJobs,
          queuedJobs: this.queue.length
        });

        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        } finally {
          this.runningJobs -= 1;
          this.pump();
        }
      };

      this.queue.push(runTask);
      logJobEvent('info', 'job_queued', {
        jobId,
        jobType,
        runningJobs: this.runningJobs,
        queuedJobs: this.queue.length,
        maxConcurrentJobs: this.maxConcurrentJobs
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.runningJobs < this.maxConcurrentJobs) {
      const nextJob = this.queue.shift();
      if (!nextJob) {
        return;
      }

      void nextJob();
    }
  }
}

export const jobQueue = new JobQueue(
  readPositiveInteger('DEEPPOINT_MAX_CONCURRENT_JOBS', DEFAULT_MAX_CONCURRENT_JOBS)
);

export function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([task, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}
