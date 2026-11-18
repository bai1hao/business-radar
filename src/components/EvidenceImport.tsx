'use client';

import { useState } from 'react';

type ImportRow = { platform: string; text: string; sourceUrl: string; commentUrl?: string; sourceTitle?: string; commentCreatedAt?: string; sourceKeyword?: string; commentId?: string };

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV 引号没有闭合');
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function toImportRows(csv: string): ImportRow[] {
  const [header, ...data] = parseCsv(csv);
  if (!header) throw new Error('CSV 文件为空');
  const column = (names: string[]) => names.map(name => header.indexOf(name)).find(index => index >= 0) ?? -1;
  const columns = {
    platform: column(['platform', '平台']), text: column(['text', '评论原文']), sourceUrl: column(['sourceUrl', '原帖链接']),
    commentUrl: column(['commentUrl', '评论分享链接']), sourceTitle: column(['sourceTitle', '原帖标题']),
    commentCreatedAt: column(['commentCreatedAt', '评论发布时间']), sourceKeyword: column(['sourceKeyword', '来源搜索词']), commentId: column(['commentId', '评论ID'])
  };
  if (columns.platform < 0 || columns.text < 0 || columns.sourceUrl < 0) throw new Error('CSV 必须包含 platform、text、sourceUrl 三列（或对应的中文列名）');
  if (data.length < 1 || data.length > 500) throw new Error('每个 CSV 文件需包含 1 到 500 条记录');
  return data.map(values => Object.fromEntries(Object.entries(columns).map(([key, index]) => [key, index < 0 ? '' : values[index]?.trim() || ''])) as ImportRow);
}

export default function EvidenceImport({ onImported }: { onImported: () => Promise<void> }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<{ total: number; added: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(dryRun: boolean, data = rows) {
    setBusy(true);
    try {
      const response = await fetch('/api/evidence/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: data, dryRun }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '导入失败');
      setPreview(result); setError('');
      if (!dryRun) { setRows([]); await onImported(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败'); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold">导入其他来源的评论 CSV</h2>
    <p className="mt-2 text-sm text-zinc-600">用于你有权保存的公开评论或访谈摘录。每行填写平台、原文、原帖链接；可补发布时间、评论链接和搜索词。先预览重复数量，再确认导入。不会自动覆盖已有线索。</p>
    <p className="mt-2 text-xs text-zinc-500">列名：platform,text,sourceUrl,commentUrl,sourceTitle,commentCreatedAt,sourceKeyword,commentId；也接受证据库导出文件中的对应中文列名。单次最多 500 条。</p>
    <input aria-label="选择评论 CSV" type="file" accept=".csv,text/csv" className="mt-4 block w-full text-sm" onChange={async event => {
      setPreview(null); setRows([]); setError('');
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 2_000_000) { setError('CSV 文件不能超过 2 MB'); return; }
      try { const data = toImportRows(await file.text()); setRows(data); await submit(true, data); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'CSV 解析失败'); }
    }} />
    {preview && <p className="mt-3 text-sm">预览：共 {preview.total} 条，可新增 {preview.added} 条，跳过重复 {preview.skipped} 条。</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={!rows.length || !preview || busy} onClick={() => void submit(false)} className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? '处理中…' : '确认导入'}</button>
  </section>;
}
