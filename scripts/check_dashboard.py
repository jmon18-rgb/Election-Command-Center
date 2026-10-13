#!/usr/bin/env python3
"""Fail refresh runs if the dashboard regresses to duplicated or inert sections."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
must_have = (
    'The JackStradamus model',
    'id="newPolls"',
    'function renderFreshPolls(d)',
    'renderFreshPolls(d);',
    'id="jackRadar"',
    'function renderJackRadar()',
    'renderJackRadar();',
    'id="senateEstimateCards"',
    'Bullshittery Index',
)
must_not_have = (
    'Election integrity snapshot',
    'Key battlegrounds',
    'id="briefPolls"',
    'id="genericPollCount"',
    'id="genericPollContext"',
    'id="genericDeltaNote"',
)
for term in must_have:
    assert term in html, f"Required dashboard feature missing: {term}"
for term in must_not_have:
    assert term not in html, f"Removed or redundant panel returned: {term}"
for identifier in ('newPolls', 'jackRadar', 'senateEstimateCards'):
    assert len(re.findall(rf'id="{identifier}"', html)) == 1, identifier
scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.S)
assert scripts, "No inline dashboard script found"
for script in scripts:
    subprocess.run(["node", "--check", "--input-type=commonjs"], input=script, text=True, check=True)
print("Dashboard smoke check passed: required features, no duplicate panels, valid JavaScript")
