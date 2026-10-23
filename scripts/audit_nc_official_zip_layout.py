#!/usr/bin/env python3
"""Read-only audit of a REAL published official 2024 NC election ZIP.
2024 records are RESEARCH ONLY; never substitute for 2026 live county votes.
"""
import csv,hashlib,io,json,urllib.request,zipfile
URL="https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip"
EXPECTED_SHA="2fab44e9b12e03c0d88ef832c2e6dc8c569e2b020d64df06a8b551b62bbdb426"
def inspect(payload):
 if hashlib.sha256(payload).hexdigest()!=EXPECTED_SHA:raise ValueError("official ZIP hash mismatch")
 with zipfile.ZipFile(io.BytesIO(payload)) as z:
  entries=[]
  for info in z.infolist():
   if info.is_dir():continue
   if info.file_size>150_000_000:raise ValueError("oversize archive member")
   with z.open(info) as file: head=file.read(10000)
   sample=head.decode("utf-8-sig",errors="replace").splitlines()[:3]
   entries.append({"name":info.filename,"size":info.file_size,
                   "sample_lines":sample})
 return {"archive_sha256":EXPECTED_SHA,"files":entries,"role":"RESEARCH_ONLY",
         "verified_2026_live_source":False,"may_move_needle":False}
def main():
 req=urllib.request.Request(URL,headers={"User-Agent":"ElectionCommandCenter/1.0"})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read(95_000_000)
 print(json.dumps(inspect(data),indent=2))
if __name__=="__main__":main()
