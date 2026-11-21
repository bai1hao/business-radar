import { NextRequest, NextResponse } from 'next/server';
import { jobManager, RawVideoData, RawCommentData, ClusteredDataGroup } from '../../../../../lib/services/job-manager';
import { ClusterResult } from '../../../../../lib/services/clustering-service';
import { NO_STORE_HEADERS } from '../../../../../lib/services/http-headers';
import { listEvidence } from '../../../../../lib/services/evidence-store';
import { isRecentDate } from '@/lib/evidence-freshness';

type SourceRef = { url: string; directComment: boolean; createdAt?: string; evidenceId?: string } | null;
type LinkedResult = ClusterResult & { source_refs: SourceRef[] };

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return ['http:', 'https:'].includes(new URL(value).protocol) ? value : undefined; } catch { return undefined; }
}

function linkResults(results: ClusterResult[], job: { rawData?: { videos: RawVideoData[]; comments: RawCommentData[] }; clusteredData?: ClusteredDataGroup[] }): LinkedResult[] {
  const evidenceByText = new Map<string, ReturnType<typeof listEvidence>>();
  for (const row of listEvidence()) evidenceByText.set(row.text, [...(evidenceByText.get(row.text) || []), row]);
  const videosByTitle = new Map<string, RawVideoData[]>();
  const rawComments = job.rawData?.comments ?? job.clusteredData?.flatMap(group => group.comments) ?? [];
  const commentsByText = new Map<string, RawCommentData[]>();
  for (const comment of rawComments) {
    const matches = commentsByText.get(comment.comment_text) ?? [];
    matches.push(comment);
    commentsByText.set(comment.comment_text, matches);
  }
  for (const video of job.rawData?.videos || []) videosByTitle.set(video.title, [...(videosByTitle.get(video.title) || []), video]);
  return results.map(result => {
    const group = job.clusteredData?.find(group =>
      group.videos.some(video => result.representative_texts.includes(video.title)) ||
      group.comments.some(comment => result.representative_texts.includes(comment.comment_text))
    );
    const sourceType = result.source_type || (group?.videos.length ? 'video' : 'comment');
    return {
      ...result,
      source_refs: result.representative_texts.map(text => {
        if (sourceType === 'video') {
          const matches = videosByTitle.get(text);
          const url = matches?.length === 1 ? safeUrl(matches[0].video_url) : undefined;
          return url ? { url, directComment: false, createdAt: matches?.[0].publish_time } : null;
        }
        const captured = commentsByText.get(text);
        const matches = evidenceByText.get(text)?.filter(row => captured?.some(comment =>
          comment.comment_id
            ? row.commentId === comment.comment_id && (comment.platform ? row.platform === comment.platform : row.sourceUrl === comment.video_url)
            : Boolean(comment.video_url && row.sourceUrl === comment.video_url)
        ));
        if (matches?.length !== 1) return null;
        const row = matches[0];
        const commentUrl = safeUrl(row.commentUrl);
        const url = commentUrl || safeUrl(row.sourceUrl);
        return url ? { url, directComment: Boolean(commentUrl), createdAt: row.commentCreatedAt, evidenceId: row.id } : null;
      })
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "任务ID是必需的" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 从任务管理器获取任务状态
    const job = jobManager.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: "任务不存在" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    // 构造响应
    const response: {
      jobId: string;
      status: string;
      progress: string;
      keywords?: string[];
      crawlStats?: { videoCount?: number; commentCount?: number; textCount?: number };
      results?: LinkedResult[];
      rawData?: {
        videos: RawVideoData[];
        comments: RawCommentData[];
        rawTexts: string[];
      };
      clusteredData?: ClusteredDataGroup[];
      error?: string;
      aiProvider?: string;
      sourceDateSummary?: { totalComments: number; datedComments: number; recent90: number; newestCommentAt?: string };
    } = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      keywords: job.keywords,
      aiProvider: job.aiProvider
    };
    response.crawlStats = job.crawlStats;
    if (job.rawData?.comments.length) {
      const evidenceDates = new Map(listEvidence().filter(row => row.commentId).map(row => [`${row.platform}:${row.commentId}`, row.commentCreatedAt]));
      const dates = job.rawData.comments.map(comment => comment.comment_time || evidenceDates.get(`${comment.platform || 'douyin'}:${comment.comment_id}`)).filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)));
      response.sourceDateSummary = {
        totalComments: job.rawData.comments.length,
        datedComments: dates.length,
        recent90: dates.filter(value => isRecentDate(value)).length,
        newestCommentAt: dates.sort().at(-1)
      };
    }

    // 如果任务完成，包含结果
    if (job.status === "completed" && job.results) {
      response.results = linkResults(job.results, job);
      // 包含原始数据
      if (job.rawData) {
        response.rawData = job.rawData;
      }
      // 包含聚类数据
      if (job.clusteredData) {
        response.clusteredData = job.clusteredData;
      }
    }

    // 如果任务失败，包含错误信息
    if (job.status === "failed") {
      response.error = job.error || "任务执行失败";
    }

    return NextResponse.json(response, { headers: NO_STORE_HEADERS });

  } catch {
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
