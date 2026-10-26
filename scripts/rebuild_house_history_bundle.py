"""Rebuild or verify historical House descendants as one reviewed bundle.

Default is read-only verification. --write is for an isolated development
checkout; publication still requires a coherent tested Git commit/PR.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import build_map_bridge
import build_house_two_cycle

ROOT = Path(__file__).resolve().parents[1]


def same_facts(actual, expected):
    # Builders have a wall-clock generation stamp, not an input fact.
    return {k: v for k, v in actual.items() if k != 'generated_at'} == {k: v for k, v in expected.items() if k != 'generated_at'}


def check_python_descendants():
    read = lambda name: json.loads((ROOT / 'data' / (name + '.json')).read_text(encoding='utf-8'))
    bridge = read('house_geography_bridge')
    expected = build_map_bridge.build(read('seat_universe'), read('house_history_2024_staging'))
    if not same_facts(bridge, expected):
        raise ValueError('House geography is stale relative to historical returns')
    context = read('house_two_cycle_context')
    expected = build_house_two_cycle.build(bridge, read('house_history_2022_staging'))
    if not same_facts(context, expected):
        raise ValueError('Paired House context is stale relative to historical returns')


def run(write=False):
    node = os.environ.get('HOUSE_HISTORY_NODE_BINARY', 'node')
    def py(script, *args):
        subprocess.run([sys.executable, str(ROOT / 'scripts' / script), *args], cwd=ROOT, check=True)
    def js(script, *args):
        subprocess.run([node, str(ROOT / 'scripts' / script), *args], cwd=ROOT, check=True)
    if write:
        # Prove the old enrichment matches its own committed provenance before
        # replacing any derived candidate evidence. Never reset manual facts.
        js('reconcile_house_historical_context.cjs', '--check')
        py('stage_house_history_2024.py')
        py('build_map_bridge.py')
        py('build_house_two_cycle.py')
        js('reconcile_house_historical_context.cjs')
        js('rebuild_house_persistence.cjs', '--write')
        py('build_new_york_house_county_baseline.py')
        js('audit_bottom_up_national_environment.cjs', '--write')
        js('audit_house_history_repair.cjs', '--write')
    py('stage_house_history_2024.py', '--check')
    check_python_descendants()
    js('reconcile_house_historical_context.cjs', '--check')
    js('rebuild_house_persistence.cjs')
    js('build_historical_candidate_strength.cjs', '--check', '--json')
    py('build_new_york_house_county_baseline.py', '--check')
    js('audit_house_history_repair.cjs', '--check')
    print('Coherent House historical bundle verified; no source-only publication permitted')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    run(parser.parse_args().write)
