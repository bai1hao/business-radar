import { isRecentDate } from './evidence-freshness';
import { isActionableEvidence, needSignals } from './need-signals';

export interface QualityEvidence {
  platform: string;
  text: string;
  sourceUrl: string;
  commentId?: string;
  commentUrl?: string;
  contactUrl?: string;
  commentCreatedAt?: string;
  sourceKeyword?: string;
  sourceKeywords?: string[];
  reviewVerdict?: 'need' | 'not-need' | 'unclear';
  status: string;
}

export function getSourceQuality(rows: QualityEvidence[]) {
  const duplicateKey = (row: QualityEvidence) => row.commentId
    ? `${row.platform}:id:${row.commentId}`
    : `${row.platform}:text:${row.sourceUrl}:${row.text.trim().replace(/\s+/g, ' ').toLowerCase()}`;
  const duplicateCount = rows.length - new Set(rows.map(duplicateKey)).size;
  const dated = rows.filter(row => row.commentCreatedAt && Number.isFinite(Date.parse(row.commentCreatedAt)));
  const direct = rows.filter(row => Boolean(row.commentUrl));
  const platforms = [...new Set(rows.map(row => row.platform))].sort().map(platform => ({
    platform, count: rows.filter(row => row.platform === platform).length
  }));
  const keywords = [...new Set(rows.flatMap(row => row.sourceKeywords?.length ? row.sourceKeywords : row.sourceKeyword ? [row.sourceKeyword] : []))].sort();
  const keywordResults = keywords.map(keyword => {
    const group = rows.filter(row => row.sourceKeyword === keyword || row.sourceKeywords?.includes(keyword));
    const recent = group.filter(row => isRecentDate(row.commentCreatedAt));
    const actionable = recent.filter(row => row.status !== 'dismissed' && isActionableEvidence(row.text, row.reviewVerdict));
    const reachable = actionable.filter(row => Boolean(row.commentUrl || row.contactUrl));
    const purchaseQuestions = actionable.filter(row => needSignals(row.text).includes('购买询问')).length;
    return { keyword, collected: group.length, recent: recent.length, actionable: actionable.length, reachable: reachable.length, purchaseQuestions };
  });
  return { total: rows.length, dated: dated.length, direct: direct.length, duplicateCount, platforms, keywordResults };
}
