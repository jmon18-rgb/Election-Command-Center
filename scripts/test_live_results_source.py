#!/usr/bin/env python3
"""Verify Open America's election endpoint is ACTUALLY browser compatible.

Run on CI before advertising live results. The dedicated results API contract
documents CORS, a versioned state-derived JSON schema and direct personal use.
No collection, repackaging, or proxying of this third-party feed is performed.
"""
import json
import urllib.request

SOURCE="https://openamerica.io/elections/results.json"
ORIGIN="https://jmon18-rgb.github.io"

def fetch(year,office,opener=urllib.request.urlopen):
    url=f"{SOURCE}?year={year}&office={office}"
    request=urllib.request.Request(url,headers={
        "Origin":ORIGIN,
        "Accept":"application/json",
        "Accept-Encoding":"gzip",
        "User-Agent":"InSearchOfBlueWaves/1.0 (+https://jmon18-rgb.github.io/Election-Command-Center/)"
    })
    with opener(request,timeout=25) as response:
        status=response.status
        acao=response.headers.get("Access-Control-Allow-Origin","")
        content_type=response.headers.get("Content-Type","")
        body=response.read(2_500_001)
        encoding=response.headers.get("Content-Encoding","")
    if status!=200 or len(body)>2_500_000:
        raise AssertionError(f"Open America source HTTP {status} or oversize payload")
    if acao not in ("*",ORIGIN):
        raise AssertionError(f"Results feed is NOT browser CORS enabled; Access-Control-Allow-Origin={acao!r}")
    if "json" not in content_type.lower():
        raise AssertionError("Results endpoint did not return JSON")
    if encoding.lower()=="gzip":
        import gzip
        body=gzip.decompress(body)
    result=json.loads(body)
    if result.get("api")!=1 or result.get("year")!=year or result.get("office")!=office:
        raise AssertionError("Unrecognized Open America results schema, office or year")
    if not isinstance(result.get("races"),dict) or not isinstance(result.get("counts"),dict):
        raise AssertionError("Results payload missing races/counts")
    if result["counts"].get("races")!=len(result["races"]):
        raise AssertionError("Race count failed provider data contract")
    if not all(type(result.get(x)) is bool for x in ("live","stale","counting","final")):
        raise AssertionError("Missing counting/live/stale/final source flags")
    for seat,r in result["races"].items():
        if not isinstance(r.get("total"),int) or r["total"]<0 or r.get("called") is not False:
            raise AssertionError("Unexpected source vote/call schema: "+seat)
        if r.get("winner"):
            raise AssertionError("Unexpected called winner from state-derived provider: "+seat)
    print(f"CORS-enabled, contract verified: {year} {office}, {len(result['races'])} source races")
    return result

def main():
    archived=fetch(2024,"House")
    if len(archived["races"])<10:
        raise AssertionError("Historical Open America rehearsal too sparse to verify client")
    fetch(2024,"Senate")
    # Pre-election zero-vote JSON may be empty; do not assert invented 2026 races.
    for office in ("House","Senate","Governor"):
        obj=fetch(2026,office)
        if obj.get("counting") and not obj.get("as_of"):
            raise AssertionError("2026 counting without source timestamp")

if __name__=="__main__":
    main()
