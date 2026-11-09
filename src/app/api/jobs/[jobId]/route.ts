import { NextRequest, NextResponse } from 'next/server';
import { jobManager, RawVideoData, RawCommentData, ClusteredDataGroup } from '../../../../../lib/services/job-manager';
import { ClusterResult } from '../../../../../lib/services/clustering-service';
import { NO_STORE_HEADERS } from '../../../../../lib/services/http-headers';
import { listEvidence } from '../../../../../lib/services/evidence-store';
import { isRecentDate } from '@/lib/evidence-freshness';

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
      results?: ClusterResult[];
      rawData?: {
        videos: RawVideoData[];
        comments: RawCommentData[];
        rawTexts: string[];
      };
      clusteredData?: ClusteredDataGroup[];
      error?: string;
      sourceDateSummary?: { totalComments: number; datedComments: number; recent90: number; newestCommentAt?: string };
    } = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      keywords: job.keywords
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
      response.results = job.results;
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
