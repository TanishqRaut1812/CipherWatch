#!/usr/bin/env python3
"""Diagnostic: report what the agent's filesystem monitor will actually watch."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.config import AgentConfig
from agent.monitors.filesystem import is_excluded, classify_folder_category

config = AgentConfig()

# Support WATCH_SCOPE override from environment
env_scope = os.environ.get("WATCH_SCOPE")
if env_scope:
    config.watch_scope = env_scope

print("=" * 70)
print("CipherWatch Filesystem Watch Scope Diagnostic")
print("=" * 70)
print(f"\nWatch scope mode: {config.watch_scope}")

# inotify limit
inotify_limit = "N/A"
try:
    with open("/proc/sys/fs/inotify/max_user_watches", "r") as f:
        inotify_limit = int(f.read().strip())
except Exception:
    pass
print(f"inotify max_user_watches: {inotify_limit}")

# Resolve targets
print(f"\n--- Watch Targets ({config.watch_scope} mode) ---")
total_dirs = 0
total_dirs_excluded = 0

if config.watch_scope == "full_home":
    targets = [(os.path.expanduser("~"), True)]
else:
    targets = []
    seen = set()
    for raw_path, recursive in config.watch_paths:
        abs_path = os.path.abspath(os.path.expanduser(raw_path))
        if abs_path in seen:
            continue
        seen.add(abs_path)
        if os.path.isdir(abs_path):
            targets.append((abs_path, recursive))
        else:
            print(f"  SKIP (not found): {abs_path}")

for path, recursive in targets:
    dir_count = 0
    excluded_count = 0
    if recursive:
        for root, dirs, files in os.walk(path, followlinks=False):
            if is_excluded(root, config.watch_exclude_dirs):
                excluded_count += 1
                dirs[:] = []  # Don't descend into excluded dirs
                continue
            dir_count += 1
    else:
        dir_count = 1
    total_dirs += dir_count
    total_dirs_excluded += excluded_count
    scope = "recursive" if recursive else "top-level"
    print(f"  ✓ {path} ({scope}) — {dir_count} dirs watched, {excluded_count} excluded")

print(f"\nTotal directories to watch: {total_dirs}")
print(f"Total directories excluded: {total_dirs_excluded}")
if isinstance(inotify_limit, int):
    usage_pct = (total_dirs / inotify_limit) * 100
    status = "✓ OK" if usage_pct < 80 else "⚠ WARNING: approaching limit"
    print(f"inotify usage: {usage_pct:.1f}% of {inotify_limit} — {status}")

# Tier classification test
print(f"\n--- Sensitive Folder & File Tier Classification ---")
test_paths = [
    ("~/Downloads/report.pdf", "Standard Downloads folder file"),
    ("~/Documents/memo.docx", "Standard Documents folder file"),
    ("~/Desktop/screenshot.png", "Standard Desktop folder file"),
    ("~/Finance/q4_budget.xlsx", "Dedicated Finance folder file"),
    ("~/HR/personnel/salary.csv", "Dedicated HR folder file"),
    ("~/src/main.py", "Dedicated SourceCode folder file"),
    ("~/Pictures/vacation.jpg", "Standard Pictures folder file"),
    ("~/random_folder/stuff.txt", "Unmatched folder, non-sensitive file"),
    ("~/Desktop/salary_export.csv", "Sensitive keyword ('salary') in Desktop folder"),
    ("~/Downloads/employee_ssn_list.xlsx", "Sensitive keyword ('ssn') in Downloads folder"),
    ("~/Desktop/budget_2026_draft.pdf", "Sensitive keyword ('budget') in Desktop folder"),
    ("~/random_folder/private_key.pem", "Sensitive keyword ('private_key') in random folder"),
]
for raw_p, desc in test_paths:
    p = os.path.expanduser(raw_p)
    tier = classify_folder_category(
        p, config.sensitive_folder_tiers, config.sensitive_file_keywords
    )
    print(f"  {raw_p:<38} → {tier:<12} ({desc})")

# Exclude filter test
print(f"\n--- Exclude Filter Verification ---")
test_excluded = [
    os.path.expanduser("~/project/.git/objects/abc"),
    os.path.expanduser("~/app/node_modules/lodash/index.js"),
    os.path.expanduser("~/code/__pycache__/mod.cpython-311.pyc"),
    os.path.expanduser("~/.cache/thumbnails/img.png"),
    os.path.expanduser("~/.venv/lib/python3.11/site.py"),
    os.path.expanduser("~/.mozilla/firefox/profile/cookies.sqlite"),
    os.path.expanduser("~/Desktop/app/.next/cache/SWC"),
    os.path.expanduser("~/Desktop/proj/dist/bundle.js"),
    os.path.expanduser("~/Downloads/important.zip"),  # should NOT be excluded
    os.path.expanduser("~/Documents/contract.pdf"),   # should NOT be excluded
]
for p in test_excluded:
    excluded = is_excluded(p, config.watch_exclude_dirs)
    label = "EXCLUDED" if excluded else "PASSED"
    print(f"  [{label}] {p}")

print("\n" + "=" * 70)
