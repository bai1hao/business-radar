"""Recover a search term for evidence when raw CSV has an unambiguous source."""

import csv
import json
import os
import pathlib
import sys


root = pathlib.Path.cwd()
evidence_root = pathlib.Path(os.getenv("BUSINESS_RADAR_DATA_DIR", root / ".business-radar"))
evidence_file = evidence_root / "evidence.json"
csv_root = root / "lib" / "crawlers" / "douyin_new" / "data" / "douyin" / "csv"
if not evidence_file.exists() or not csv_root.exists():
    raise SystemExit("未找到证据文件或原始 CSV")

video_keywords = {}
for csv_file in sorted(csv_root.glob("search_contents_*.csv")):
    with csv_file.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            video_id = row.get("aweme_id")
            keyword = row.get("source_keyword")
            if video_id and keyword:
                video_keywords.setdefault(video_id, set()).add(keyword)

comment_videos = {}
for csv_file in sorted(csv_root.glob("search_comments_*.csv")):
    with csv_file.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if row.get("comment_id") and row.get("aweme_id"):
                comment_videos[row["comment_id"]] = row["aweme_id"]

rows = json.loads(evidence_file.read_text(encoding="utf-8"))
updated = 0
ambiguous = 0
for row in rows:
    if row.get("sourceKeyword"):
        continue
    keywords = video_keywords.get(comment_videos.get(row.get("commentId")), set())
    if len(keywords) == 1:
        row["sourceKeyword"] = next(iter(keywords))
        updated += 1
    elif len(keywords) > 1:
        ambiguous += 1

print(f"可回填 {updated} / {len(rows)} 条；多关键词来源不明 {ambiguous} 条")
if "--dry-run" not in sys.argv and updated:
    temp = evidence_file.with_suffix(".json.tmp")
    temp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(evidence_file)
