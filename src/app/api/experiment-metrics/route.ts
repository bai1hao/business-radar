import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { NO_STORE_HEADERS } from '../../../../lib/services/http-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const root = process.env.BUSINESS_RADAR_DATA_DIR || path.join(process.cwd(), '.business-radar');
  const file = path.join(root, 'experiment-snapshots.json');
  try {
    const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    if (!Array.isArray(rows)) throw new Error('invalid metrics format');
    return NextResponse.json(rows.slice(-90), { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: '实验快照读取失败' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
