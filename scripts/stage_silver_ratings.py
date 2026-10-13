#!/usr/bin/env python3
"""Stage, never automatically deploy, the Jan 2026 Silver Bulletin pollster file.

Uses the published public XLSX (with attribution) and Python standard library.
If headers cannot be validated, exit nonzero without touching the live 538 ratings.
"""
import datetime as dt
import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/silver_ratings_staging.json"
CURRENT = ROOT / "data/pollster_quality.json"
PAGE = "https://www.natesilver.net/p/pollster-ratings-silver-bulletin"
URL = "https://www.natesilver.net/api/v1/file/7bd65470-3e0d-4c0f-a658-22ca23b216ae.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold()).strip()

def workbook_tables(raw):
    """Read shared strings and worksheet text; formulas are never executed."""
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                strings.append("".join(t.text or "" for t in item.findall(".//m:t", NS)))
        sheets = sorted(
            n for n in archive.namelist()
            if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)
        )
        for name in sheets:
            root = ET.fromstring(archive.read(name))
            rows = []
            for row in root.findall(".//m:sheetData/m:row", NS):
                record = {}
                for cell in row.findall("m:c", NS):
                    ref = cell.attrib.get("r", "")
                    letters = re.match(r"[A-Z]+", ref)
                    if not letters:
                        continue
                    column = 0
                    for ch in letters.group():
                        column = column * 26 + ord(ch) - ord("A") + 1
                    value = cell.find("m:v", NS)
                    inline = cell.find("m:is", NS)
                    kind = cell.attrib.get("t")
                    if kind == "s" and value is not None:
                        text = strings[int(value.text)]
                    elif kind == "inlineStr" and inline is not None:
                        text = "".join((x.text or "") for x in inline.findall(".//m:t", NS))
                    elif value is not None:
                        text = value.text or ""
                    else:
                        continue
                    record[column - 1] = text.strip()
                if record:
                    rows.append(record)
            yield name, rows

def find_columns(headers):
    labels = {col: norm(v) for col, v in headers.items()}
    def get(test):
        return next((col for col, v in labels.items() if test(v)), None)
    pollster = get(lambda v: v in {"pollster", "pollster name", "pollster pollster"})
    plusminus = get(lambda v: "predictive" in v and "plus" in v and "minus" in v)
    bias = get(lambda v: ("mean" in v and "revert" in v and "bias" in v))
    grade = get(lambda v: v in {"grade", "rating", "overall grade", "letter grade"})
    history = get(lambda v: v in {"number of polls", "polls", "poll count", "n polls"})
    if pollster is not None and plusminus is not None and bias is not None:
        return dict(name=pollster,predictive_plus_minus=plusminus,
                    mean_reverted_bias=bias,grade=grade,history_count=history)
    return None

def main():
    request=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0",
              "Accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"})
    with urllib.request.urlopen(request,timeout=50) as response:
        raw=response.read(3_000_000)
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError("Silver download did not return a valid XLSX file")
    tables=list(workbook_tables(raw))
    valid=[]
    for sheet, rows in tables:
        for i,headers in enumerate(rows[:40]):
            columns=find_columns(headers)
            if not columns:
                continue
            found={}
            for rec in rows[i+1:]:
                name=rec.get(columns["name"],"").strip()
                pm=rec.get(columns["predictive_plus_minus"],"").strip()
                if not name or not pm or norm(name) in {"total", "pollster", "average"}:
                    continue
                entry={"pollster":name,
                       "predictive_plus_minus_raw":pm,
                       "mean_reverted_bias_raw":rec.get(columns["mean_reverted_bias"],""),
                       "grade_raw":rec.get(columns["grade"],"") if columns["grade"] is not None else None,
                       "history_count_raw":rec.get(columns["history_count"],"") if columns["history_count"] is not None else None}
                try:
                    float(pm.replace("−","-").replace(",",""))
                except ValueError:
                    continue
                found.setdefault(norm(name),entry)
            valid.append((len(found),sheet,headers,columns,found))
    if not valid:
        raise ValueError("Could not validate pollster / predictive plus-minus / bias headers. No output written.")
    count,sheet,header,columns,records=max(valid,key=lambda x:x[0])
    if count < 100:
        raise ValueError(f"Only {count} pollster records detected; refusing incomplete import")
    old=json.loads(CURRENT.read_text(encoding="utf-8"))
    matches={}
    for firm,entry in old["entries"].items():
        opts=[firm,entry.get("reference_pollster")]
        key=next((norm(o) for o in opts if norm(o) in records),None)
        if key:matches[firm]=records[key]["pollster"]
    staged={
        "status":"staged_not_used_in_live_model",
        "source_name":"Silver Bulletin Pollster Stats Full 2026",
        "source_page":PAGE,
        "source_download":URL,
        "source_publication_date":"2026-01-14",
        "fetched_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "attribution":"Nate Silver and Eli McKown-Dawson / Silver Bulletin",
        "worksheet":sheet,
        "source_header":header,
        "field_columns":columns,
        "rows_parsed":count,
        "matched_to_older_538_aliases":len(matches),
        "matches":matches,
        "entries":records,
        "caveats":[
            "No new pollster accuracy score or signed bias correction has been deployed.",
            "All sheet columns are raw source values and need verified unit/sign conventions.",
            "Exact/archived aliases may miss renamed organizations; review before using.",
            "Grade, predictive plus-minus and signed mean-reverted bias have different units."
        ]
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(staged,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Staged {count} pollster rows from {sheet}; matched {len(matches)} archived firm names. NOT DEPLOYED.")

if __name__=="__main__":
    main()
