'use client';

import { useEffect, useState } from 'react';
import { needSignals } from '@/lib/need-signals';

type Row = { id: string; platform: string; text: string; sourceUrl: string; commentUrl?: string; commentId?: string; authorLabel?: string; status: 'new' | 'verified' | 'contacted' | 'dismissed'; note: string; collectedAt: string };

export default function EvidencePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ platform: 'douyin', text: '', sourceUrl: '', commentId: '' });
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [signalFilter, setSignalFilter] = useState('all');
  const [page, setPage] = useState(1);
  const refresh = async () => setRows(await (await fetch('/api/evidence', { cache: 'no-store' })).json());
  useEffect(() => { void refresh(); }, []);

  async function save() {
    const response = await fetch('/api/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) { setError((await response.json()).error); return; }
    setError(''); setForm({ ...form, text: '', sourceUrl: '', commentId: '' }); await refresh();
  }
  async function update(row: Row, status: Row['status'], note: string) {
    await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status, note }) });
    await refresh();
  }
  async function saveCommentUrl(row: Row, commentUrl: string) {
    const response = await fetch('/api/evidence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status: row.status, note: row.note, commentUrl }) });
    if (!response.ok) { setError((await response.json()).error || '评论链接保存失败'); return; }
    setError(''); await refresh();
  }

  const filtered = rows.filter(row =>
    (statusFilter === 'all' || row.status === statusFilter) &&
    (signalFilter === 'all' || needSignals(row.text).length > 0) &&
    (!query.trim() || `${row.text} ${row.note} ${row.platform}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  );
  function exportFiltered() {
    const headers = ['平台', '评论原文', '需求信号', '状态', '原帖链接', '评论分享链接', '评论ID', '备注', '采集时间'];
    const statusNames = { new: '待核实', verified: '已核实', contacted: '已联系', dismissed: '忽略' };
    const safeCell = (value: string) => {
      const protectedValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${protectedValue.replace(/"/g, '""')}"`;
    };
    const lines = [headers, ...filtered.map(row => [row.platform, row.text, needSignals(row.text).join('、'), statusNames[row.status], row.sourceUrl, row.commentUrl || '', row.commentId || '', row.note, row.collectedAt])];
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
        <input aria-label="原帖链接" className="rounded-lg border border-zinc-300 p-3" placeholder="原帖或评论分享链接" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
        <input aria-label="评论 ID" className="rounded-lg border border-zinc-300 p-3" placeholder="评论 ID（可选）" value={form.commentId} onChange={e => setForm({ ...form, commentId: e.target.value })} />
        <textarea aria-label="需求原文" className="rounded-lg border border-zinc-300 p-3 md:col-span-2" placeholder="复制原帖或评论原文" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button onClick={save} className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-white">保存证据</button>
    </section>
    <section className="mt-8 space-y-4"><h2 className="text-lg font-semibold">已保存的线索 · {rows.length}</h2>
      <div className="flex flex-wrap gap-3">
        <input aria-label="搜索线索" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="搜索评论原文或备注" className="min-w-64 flex-1 rounded-lg border border-zinc-300 bg-white p-3" />
        <select aria-label="筛选线索状态" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="all">全部状态</option><option value="new">待核实</option><option value="verified">已核实</option><option value="contacted">已联系</option><option value="dismissed">忽略</option></select>
        <select aria-label="筛选需求信号" value={signalFilter} onChange={e => { setSignalFilter(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white p-3"><option value="all">全部评论</option><option value="signals">仅看需求信号</option></select>
      </div>
      <p className="text-sm text-zinc-500">找到 {filtered.length} 条 · 第 {Math.min(page, pageCount)} / {pageCount} 页</p>
      <button type="button" disabled={filtered.length === 0} onClick={exportFiltered} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm disabled:opacity-40">导出当前筛选结果 CSV</button>
      {visible.map(row => <article key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500"><span>{row.platform}</span><span>{new Date(row.collectedAt).toLocaleString()}</span><span>{row.commentId ? `评论 ID：${row.commentId}` : '未记录评论 ID'}</span></div>
        <p className="whitespace-pre-wrap leading-7">{row.text}</p>
        {needSignals(row.text).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{needSignals(row.text).map(label => <span key={label} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{label}</span>)}</div>}
        <div className="mt-4 flex flex-wrap items-center gap-4"><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-amber-700 underline">打开原帖</a>{row.commentUrl && <a href={row.commentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-amber-700 underline">打开已保存的评论分享链接</a>}<select aria-label="线索状态" value={row.status} onChange={e => void update(row, e.target.value as Row['status'], row.note)} className="rounded-lg border border-zinc-300 p-2 text-sm"><option value="new">待核实</option><option value="verified">已核实</option><option value="contacted">已联系</option><option value="dismissed">忽略</option></select></div>
        <input aria-label="评论分享链接" key={`${row.id}:${row.commentUrl || ''}`} defaultValue={row.commentUrl || ''} onBlur={e => { if (e.target.value !== (row.commentUrl || '')) void saveCommentUrl(row, e.target.value.trim()); }} placeholder="可选：粘贴在抖音核实过的评论分享链接，离开输入框时保存" className="mt-4 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
        <textarea aria-label="线索备注" defaultValue={row.note} onBlur={e => { if (e.target.value !== row.note) void update(row, row.status, e.target.value); }} placeholder="备注：需求背景、联系进展…" className="mt-4 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
      </article>)}
      {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">没有匹配的线索。换个关键词或状态试试。</p>}
      {pageCount > 1 && <div className="flex items-center justify-end gap-3"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 disabled:opacity-40">上一页</button><button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 disabled:opacity-40">下一页</button></div>}
    </section>
  </main>;
}
