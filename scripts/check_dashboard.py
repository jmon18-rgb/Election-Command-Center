#!/usr/bin/env python3
"""Fail refresh runs if the dashboard regresses to duplicated or inert sections."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
must_have = (
    'id="modelBoard"',
    'id="seatHouseCount"',
    'id="seatHistoricalCount"',
    'id="seatTwoCycleNote"',
    'id="modelHistoryContext"',
    'function renderHouseGeographyBridge(data)',
    'function renderSeatUniverse(data)',
    'function renderModelRaceDetail()',
    "data/house_geography_bridge.json",
    "data/house_two_cycle_context.json",
    'id="seatSenateCount"',
    'function renderSeatUniverse(data)',
    "data/seat_universe.json",
    'SEAT_MODEL.md',

    "blue-waves-hero.jpg",
    'In Search of <em>Blue Waves</em>',
    'id="racePulse"',
    'function pollPostedStamp(p)',
    "pollPostedStamp(b).localeCompare(pollPostedStamp(a))",
    "data/model_history.json",
    "function renderRacePulse(data",
    "Polling leader changed",
    "Biggest polling movement",
    "No meaningful movement",
    "The four endings",
    "RED DAWN",

    'id="pollLeadSummary"',
    'function renderPollLeadSeats(kind,matching)',
    "label==='governors'?'governor':label",
    'function renderFreshPolls(d)',
    'First seen ',
    'Field end ',
    'model_sensitivity',
    'id="modelDetail"',
    'id="modelChart"',
    'id="modelPollRows"',
    'data-model-scope="senate"',
    'data-model-scope="house"',
    'data-model-scope="governor"',
    'data-model-scope="generic"',
    'function modelRows(data)',
    '🐑 HERDING?',
    'function enLeadInfo(r)',
    'en-margin-badge',
    'party-d',
    'party-r',
    'function renderModelGenericHeadline()',
    'function modelPollEntries(estimate)',
    'function renderModelRaceDetail()',
    'function renderModelOverview(data)',
    'renderModelOverview(data);',
    'id="newPolls"',
    'function renderFreshPolls(d)',
    'renderFreshPolls(d);',
    'id="jackRadar"',
    'function renderJackRadar()',
    'renderJackRadar();',
    'id="senateEstimateCards"',
    'Bullshittery Index',
    'id="bullScoreStates"',
    'function bullMonitoringPoints(caseRecord)',
    'id="electionNight"',
    'id="enMode2026"',
    'id="enMode2024"',
    'id="enOfficeGovernor"',
    'function renderBullStateScores()',
    'id="enRaceList"',
    'function enLoad(manual=false)',
)
must_not_have = (
    'Election integrity snapshot',
    'Key battlegrounds',
    'id="briefPolls"',
    'id="genericPollCount"',
    'id="genericPollContext"',
    'id="genericDeltaNote"',
    'id="modelState"',
    'id="modelHalf"',
    'id="modelDays"',
    'id="war"',
    'id="senatePaths"',
    'data-page="senatePaths"',
    'data-page="war"',
    'Ridiculous name. Real math.',
    'Methodology, data quality and sources',
    'THE DAILY DAMAGE REPORT',
    'Polling. Senate math. Whatever happens next.',
    "R leads national vote",
    "D +5 to +10",
    "National House vote · experimental",
    "Largest Democratic lead",
    "Largest Republican lead",
    "const mean=g.dem_minus_rep,sigma=4.0",
    "assets/blue-waves-hero.jpg",
    'Now with receipts.',
)
for term in must_have:
    assert term in html, f"Required dashboard feature missing: {term}"
for term in must_not_have:
    assert term not in html, f"Removed or redundant panel returned: {term}"
for identifier in ('racePulse', 'newPolls', 'jackRadar', 'senateEstimateCards', 'modelBoard', 'modelRaceTotal', 'modelCloseTotal', 'modelThinTotal', 'modelDetail', 'modelChart', 'modelPollRows', 'modelPollIncluded', 'modelPollAll', 'bullScoreStates', 'electionNight', 'enMode2026', 'enMode2024', 'enOfficeGovernor', 'enRaceList', 'jointHomeCards', 'jointHomeSummary'):
    assert len(re.findall(rf'id="{identifier}"', html)) == 1, identifier
scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.S)
assert scripts, "No inline dashboard script found"
for script in scripts:
    subprocess.run(["node", "--check", "--input-type=commonjs"], input=script, text=True, check=True)
print("Dashboard smoke check passed: required features, no duplicate panels, valid JavaScript")
