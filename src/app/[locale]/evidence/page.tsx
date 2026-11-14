'use client';

import { useEffect, useState } from 'react';
import { isActionableEvidence, isPriorityEvidence, needSignals } from '@/lib/need-signals';
import { isRecentDate } from '@/lib/evidence-freshness';

type Row = { id: string; platform: string; text: string; sourceUrl: string; sourceTitle?: string; commentUrl?: string; contactUrl?: string; commentId?: string; authorLabel?: string; sourceKeyword?: string; sourceKeywords?: string[]; status: 'new' | 'verified' | 'contacted' | 'dismissed'; note: string; collectedAt: string; commentCreatedAt?: string; updatedAt?: string; verifiedAt?: string; contactedAt?: string; reviewVerdict?: 'need' | 'not-need' | 'unclear'; reviewedAt?: string };

export default function EvidencePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ platform: 'douyin', text: '', sourceUrl: '', sourceTitle: '', commentUrl: '', contactUrl: '', commentId: '', commentCreatedAt: '' });
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [signalFilter, setSignalFilter] = useState('priority');
  const [ageFilter, setAgeFilter] = useState('90');
  const [keywordFilter, setKeywordFilter] = useState('all');
  const [page, setPage] = useState(1);
  const refresh = async () => {
    const response = await fetch('/api/evidence', { cache: 'no-store' });
    if (!response.ok) { setError('证据加载失败，请刷新页面重试'); return; }
    setRows(await response.json());
  };
  useEffect(() => {
    const keyword = new URLSearchParams(window.location.search).get('keyword');
    if (keyword) {
      setKeywordFilter(keyword);
      setStatusFilter('all');
      setSignalFilter('all');
    }
    void refresh();
  }, []);

  async function save() {
    const response = await fetch('/api/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) { setError((await response.json()).error); return; }
    setError(''); setForm({ ...form, text: '', sourceUrl: '', sourceTitle: '', commentUrl: '', contactUrl: '', commentId: '', commentCreatedAt: '' }); await refresh();
  }
  async function update(row: Row, status: Row['status'], note: string) {
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status, note }) });
    if (!response.ok) { setError((await response.json()).error || '线索保存失败'); return; }
    setError('');
    await refresh();
  }
  async function saveCommentUrl(row: Row, commentUrl: string) {
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status: row.status, note: row.note, commentUrl }) });
    if (!response.ok) { setError((await response.json()).error || '评论链接保存失败'); return; }
    setError(''); await refresh();
  }
  async function saveContactUrl(row: Row, contactUrl: string) {
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status: row.status, note: row.note, contactUrl }) });
    if (!response.ok) { setError((await response.json()).error || '联系入口保存失败'); return; }
    setError(''); await refresh();
  }

  async function saveReview(row: Row, reviewVerdict: Row['reviewVerdict']) {
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status: row.status, note: row.note, reviewVerdict: reviewVerdict || null }) });
    if (!response.ok) { setError((await response.json()).error || '判读结果保存失败'); return; }
    setError(''); await refresh();
  }

  const recent = rows.filter(row => isRecentDate(row.commentCreatedAt));
  const reviewed = recent.filter(row => row.reviewVerdict);
  const pendingReview = recent.filter(row => !row.reviewVerdict);
  const reviewQueue = [
    ...pendingReview.filter(row => isPriorityEvidence(row.text)),
    ...pendingReview.filter(row => !isPriorityEvidence(row.text)).sort((a, b) => a.id.localeCompare(b.id))
  ].slice(0, 30);
  const reviewIds = new Set(reviewQueue.map(row => row.id));

  const filtered = rows.filter(row =>
    (statusFilter === 'all' || row.status === statusFilter) &&
    (keywordFilter === 'all' || (keywordFilter === 'unknown' ? !row.sourceKeyword && !row.sourceKeywords?.length : row.sourceKeyword === keywordFilter || row.sourceKeywords?.includes(keywordFilter))) &&
    (ageFilter === 'all' || (ageFilter === 'unknown' ? !row.commentCreatedAt : isRecentDate(row.commentCreatedAt, Number(ageFilter)))) &&
    (signalFilter === 'all' ||
      (signalFilter === 'priority' && isActionableEvidence(row.text, row.reviewVerdict)) ||
      (signalFilter === 'signals' && needSignals(row.text).length > 0) ||
      (signalFilter === 'missing-link' && isActionableEvidence(row.text, row.reviewVerdict) && !row.commentUrl) ||
      (signalFilter === 'verified-missing-link' && row.status === 'verified' && !row.commentUrl) ||
      (signalFilter === 'review-queue' && reviewIds.has(row.id))) &&
    (!query.trim() || `${row.text} ${row.sourceTitle || ''} ${row.note} ${row.platform} ${row.sourceKeywords?.join(' ') || row.sourceKeyword || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  );
  function exportFiltered() {
    const headers = ['平台', '来源搜索词', '原帖标题', '评论原文', '需求信号', '状态', '需求判读', '判读时间', '原帖链接', '评论分享链接', '联系入口', '评论ID', '备注', '评论发布时间', '采集时间', '核实时间', '联系时间', '最后修改时间'];
    const statusNames = { new: '待核实', verified: '已核实', contacted: '已联系', dismissed: '忽略' };
    const safeCell = (value: string) => {
      const protectedValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${protectedValue.replace(/"/g, '""')}"`;
    };
    const verdictNames = { need: '疑似真实需求', 'not-need': '非需求', unclear: '不确定' };
    const lines = [headers, ...filtered.map(row => [row.platform, row.sourceKeywords?.join('、') || row.sourceKeyword || '', row.sourceTitle || '', row.text, needSignals(row.text).join('、'), statusNames[row.status], row.reviewVerdict ? verdictNames[row.reviewVerdict] : '', row.reviewedAt || '', row.sourceUrl, row.commentUrl || '', row.contactUrl || '', row.commentId || '', row.note, row.commentCreatedAt || '', row.collectedAt, row.verifiedAt || '', row.contactedAt || '', row.updatedAt || ''])];
    const csv = '\uFEFF' + lines.map(line => line.map(safeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-radar-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  return <main className="mx-auto max-w-5xl px-5 py-10">
    <div className="mb-8"><p className="text-sm font-semibold text-amber-600">Business Radar</p><h1 className="mt-2 text-3xl font-semibold">需求证据库</h1><p className="mt-2 text-sm text-zinc-600">记录真实评论，核实需求，并跟踪联系进度。AI 离线时也可使用。</p></div>
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">添加线索</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input aria-label="平台" className="rounded-lg border border-zinc-300 p-3" placeholder="平台" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} />
        <input aria-label="原帖链接" className="rounded-lg border border-zinc-300 p-3" placeholder="原帖链接（必填）" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
        <input aria-label="原帖标题" className="rounded-lg border border-zinc-300 p-3" placeholder="原帖标题（可选，有助于理解短评论）" value={form.sourceTitle} onChange={e => setForm({ ...form, sourceTitle: e.target.value })} />
        <input aria-label="评论分享链接" className="rounded-lg border border-zinc-300 p-3" placeholder="评论分享链接（可选，确认可打开后填写）" value={form.commentUrl} onChange={e => setForm({ ...form, commentUrl: e.target.value })} />
        <input aria-label="联系入口" className="rounded-lg border border-zinc-300 p-3" placeholder="联系入口（可选，确认后填写作者主页等链接）" value={form.contactUrl} onChange={e => setForm({ ...form, contactUrl: e.target.value })} />
        <input aria-label="评论 ID" className="rounded-lg border border-zinc-300 p-3" placeholder="评论 ID（可选）" value={form.commentId} onChange={e => setForm({ ...form, commentId: e.target.value })} />
        <label className="text-sm text-zinc-600">评论发布时间（可选）<input aria-label="评论发布时间" type="datetime-local" className="mt-1 w-full rounded-lg border border-zinc-300 p-3" value={form.commentCreatedAt} onChange={e => setForm({ ...form, commentCreatedAt: e.target.value })} /></label>
        <textarea aria-label="需求原文" className="rounded-lg border border-zinc-300 p-3 md:col-span-2" placeholder="复制原帖或评论原文" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button onClick={save} className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-white">保存证据</button>
    </section>
    <section className="mt-8 space-y-4"><h2 className="text-lg font-semibold">已保存的线索 · {rows.length}</h2>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">人工校准 · 近 90 天</h3><p className="mt-1 text-sm text-zinc-700">已判读 {reviewed.length} 条：疑似需求 {reviewed.filter(row => row.reviewVerdict === 'need').length}、非需求 {reviewed.filter(row => row.reviewVerdict === 'not-need').length}、不确定 {reviewed.filter(row => row.reviewVerdict === 'unclear').length}。规则未提示但人工判为需求 {reviewed.filter(row => row.reviewVerdict === 'need' && !isPriorityEvidence(row.text)).length} 条。</p></div><button type="button" onClick={() => { setStatusFilter('all'); setSignalFilter('review-queue'); setAgeFilter('90'); setKeywordFilter('all'); setQuery(''); setPage(1); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">判读下一组 {reviewQueue.length} 条</button></div><p className="mt-2 text-xs text-zinc-600">队列包含规则提示和未提示的评论；判读只评价评论内容，核实原帖和联系进展仍用线索状态记录。新采集数据可能改变尚未判读的队列。</p></div>
      <div className="grid gap-3 sm:grid-cols-3">{([
        { label: '待核实', count: rows.filter(row => row.status === 'new' && isRecentDate(row.commentCreatedAt) && isActionableEvidence(row.text, row.reviewVerdict)).length, filter: 'new' },
        { label: '已核实', count: rows.filter(row => row.status === 'verified').length, filter: 'verified' },
        { label: '已联系', count: rows.filter(row => row.status === 'contacted').length, filter: 'contacted' }
      ] as const).map(item => <button key={item.filter} type="button" onClick={() => { setStatusFilter(item.filter); setSignalFilter(item.filter === 'new' ? 'priority' : 'all'); setAgeFilter(item.filter === 'new' ? '90' : 'all'); setPage(1); }} className="rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-amber-400"><span className="block text-sm text-zinc-500">{item.label}{item.filter === 'new' ? ' · 近 90 天优先' : ''}</span><strong className="mt-1 block text-2xl">{item.count}</strong></button>)}</div>
      <div className="flex flex-wrap gap-3">
        <input aria-label="搜索线索" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="搜索评论原文或备注" className="min-w-64 flex-1 rounded-lg border border-zinc-300 bg-white p-3" />
        <select aria-label="筛选线索状态" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); if (signalFilter === 'verified-missing-link' && e.target.value !== 'verified') setSignalFilter('all'); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="all">全部状态</option><option value="new">待核实</option><option value="verified">已核实</option><option value="contacted">已联系</option><option value="dismissed">忽略</option></select>
        <select aria-label="筛选需求信号" value={signalFilter} onChange={e => { setSignalFilter(e.target.value); if (e.target.value === 'verified-missing-link') { setStatusFilter('verified'); setAgeFilter('all'); } if (e.target.value === 'review-queue') { setStatusFilter('all'); setAgeFilter('90'); } setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="priority">优先核实</option><option value="review-queue">人工校准队列</option><option value="missing-link">优先核实 · 待补评论链接</option><option value="verified-missing-link">已核实 · 待补评论链接</option><option value="signals">所有需求提示</option><option value="all">全部评论</option></select>
        <select aria-label="筛选评论发布时间" value={ageFilter} onChange={e => { setAgeFilter(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="30">近 30 天</option><option value="90">近 90 天</option><option value="180">近 180 天</option><option value="365">近 365 天</option><option value="all">全部时间</option><option value="unknown">发布时间未知</option></select>
        <select aria-label="筛选来源搜索词" value={keywordFilter} onChange={e => { setKeywordFilter(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="all">全部搜索词</option>{[...new Set(rows.flatMap(row => row.sourceKeywords?.length ? row.sourceKeywords : row.sourceKeyword ? [row.sourceKeyword] : []))].sort().map(value => <option key={value} value={value}>{value}</option>)}<option value="unknown">来源搜索词未知</option></select>
      </div>
      <p className="text-sm text-zinc-500">找到 {filtered.length} 条 · 第 {Math.min(page, pageCount)} / {pageCount} 页。先打开来源核对评论，再标记核实状态；原帖链接不一定能直达评论。</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={filtered.length === 0} onClick={exportFiltered} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm disabled:opacity-40">导出当前筛选结果 CSV</button>
      {visible.map(row => <article key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500"><span>{row.platform}</span><span>搜索词：{row.sourceKeywords?.join('、') || row.sourceKeyword || '未知'}</span><span>评论：{row.commentCreatedAt ? new Date(row.commentCreatedAt).toLocaleString() : '发布时间未知'}</span><span>采集：{new Date(row.collectedAt).toLocaleString()}</span><span>{row.commentId ? `评论 ID：${row.commentId}` : '未记录评论 ID'}</span>{row.verifiedAt && <span>曾核实：{new Date(row.verifiedAt).toLocaleString()}</span>}{row.contactedAt && <span>曾联系：{new Date(row.contactedAt).toLocaleString()}</span>}</div>
        {row.sourceTitle && <p className="mb-2 text-sm text-zinc-600">原帖：{row.sourceTitle}</p>}
        <p className="whitespace-pre-wrap leading-7">{row.text}</p>
        {(needSignals(row.text).length > 0 || row.reviewVerdict === 'need') && <div className="mt-3 flex flex-wrap gap-2">{row.reviewVerdict === 'need' && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">人工判读：疑似需求</span>}{needSignals(row.text).map(label => <span key={label} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{label}</span>)}</div>}
        <div className="mt-4 flex flex-wrap items-center gap-4"><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-amber-700 underline">打开原帖</a>{row.commentUrl ? <a href={row.commentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-amber-700 underline">打开已保存的评论链接</a> : <span className="text-xs text-zinc-500">尚无直达评论链接</span>}{row.commentId && <button type="button" onClick={() => void navigator.clipboard.writeText(row.commentId!).catch(() => setError('复制失败，请手动选中评论 ID'))} className="text-xs text-amber-700 underline">复制评论 ID</button>}<select aria-label="线索状态" value={row.status} onChange={e => void update(row, e.target.value as Row['status'], row.note)} className="rounded-lg border border-zinc-300 p-2 text-sm"><option value="new">待核实</option><option value="verified">已核实</option><option value="contacted">已联系</option><option value="dismissed">忽略</option></select></div>
        <label className="mt-4 block text-sm text-zinc-700">人工判读评论是否提出工作需求<select aria-label="人工判读结果" value={row.reviewVerdict || ''} onChange={e => void saveReview(row, (e.target.value || undefined) as Row['reviewVerdict'])} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white p-2"><option value="">未判读</option><option value="need">疑似真实需求</option><option value="not-need">非需求</option><option value="unclear">不确定</option></select></label>
        <input aria-label="评论分享链接" key={`${row.id}:${row.commentUrl || ''}`} defaultValue={row.commentUrl || ''} onBlur={e => { if (e.target.value !== (row.commentUrl || '')) void saveCommentUrl(row, e.target.value.trim()); }} placeholder="可选：粘贴在抖音核实过的评论分享链接，离开输入框时保存" className="mt-4 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
        <div className="mt-3 flex flex-wrap items-center gap-4"><button type="button" onClick={() => void navigator.clipboard.writeText(row.text).catch(() => setError('复制失败，请手动选中评论原文'))} className="text-xs text-amber-700 underline">复制评论原文</button>{row.contactUrl && <a href={row.contactUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 underline">打开联系入口</a>}</div>
        <input aria-label="联系入口" key={`${row.id}:${row.contactUrl || ''}`} defaultValue={row.contactUrl || ''} onBlur={e => { if (e.target.value !== (row.contactUrl || '')) void saveContactUrl(row, e.target.value.trim()); }} placeholder="可选：人工确认后粘贴作者主页或其他联系入口，离开输入框时保存" className="mt-3 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
        <textarea aria-label="线索备注" defaultValue={row.note} onBlur={e => { if (e.target.value !== row.note) void update(row, row.status, e.target.value); }} placeholder="备注：需求背景、联系进展…" className="mt-4 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
      </article>)}
      {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">没有匹配的线索。换个关键词或状态试试。</p>}
      {pageCount > 1 && <div className="flex items-center justify-end gap-3"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 disabled:opacity-40">上一页</button><button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 disabled:opacity-40">下一页</button></div>}
    </section>
  </main>;
}
