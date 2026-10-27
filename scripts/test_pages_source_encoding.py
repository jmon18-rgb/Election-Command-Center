"""Reject Markdown bytes that would stop GitHub Pages before deployment."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
paths = subprocess.check_output(
    ["git", "ls-files", "-z", "--", "*.md"], cwd=ROOT
).decode("utf-8").split("\0")
failures = []
for name in filter(None, paths):
    try:
        (ROOT / name).read_bytes().decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        failures.append(f"{name}: invalid UTF-8 at byte {error.start}")
if failures:
    raise SystemExit("Save Pages Markdown as UTF-8:\n" + "\n".join(failures))
print("PASS: all tracked Pages Markdown decodes strictly as UTF-8")
