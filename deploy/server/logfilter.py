#!/usr/bin/env python3
"""Prints the warnings and errors of the Kasra containers with personal data removed.

GitHub Actions logs of this public repository are readable by anyone, so nothing printed there may
contain visitor addresses, phone numbers, postal codes, query strings or order details. Only the
level, time, service, message, request method/path and error type survive; IP-like strings and long
digit runs are masked. Usage: logfilter.py [--since 2026-01-01T00:00:00Z | 30m | 2h] [--limit 40 per service] [--all]
(--all keeps routine lines too, still cleaned: used right after a failed deployment.)
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter

IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
IPV6 = re.compile(r"(?<![\w:])(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?![\w:])")
DIGITS = re.compile(r"\d{5,}")
QUERY = re.compile(r"\?\S*")
LEVELS = {10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal"}
TEXT_PROBLEM = re.compile(r"\b(error|warn|warning|fatal|panic|exception|unhandled)\b", re.I)


def clean(text, limit=240):
    text = IPV4.sub("<ip>", QUERY.sub("?…", str(text)))
    # Times such as 06:20:00 also have two colons; addresses have "::" or at least three.
    text = IPV6.sub(lambda m: "<ip>" if "::" in m.group(0) or m.group(0).count(":") >= 3 else m.group(0), text)
    text = DIGITS.sub("#", text)
    return text if len(text) <= limit else text[:limit] + "…"


def parse(service, raw, everything=False):
    """Returns (level, summary) for warning/error lines (every line with everything=True), else None."""
    try:
        entry = json.loads(raw)
    except ValueError:
        entry = None
    if isinstance(entry, dict) and "level" in entry:
        level = entry.get("level")
        if not isinstance(level, int) or (level < 40 and not everything):
            return None
        parts = [str(entry.get("msg", ""))]
        request = entry.get("req") or {}
        if isinstance(request, dict) and request.get("method"):
            parts.append(f"{request.get('method')} {request.get('url', '')}")
        error = entry.get("err") or entry.get("error")
        if isinstance(error, dict):
            parts.append(f"{error.get('type', 'Error')}: {error.get('message', '')}")
        elif error:
            parts.append(str(error))
        return LEVELS.get(level, str(level)), clean(" | ".join(p for p in parts if p))
    if service == "postgres":
        match = re.search(r"\b(ERROR|FATAL|PANIC|WARNING|LOG):\s*(.*)", raw)
        if match and (everything or match.group(1) != "LOG"):
            return match.group(1).lower(), clean(match.group(2))
        return None
    return ("text", clean(raw)) if raw and (everything or TEXT_PROBLEM.search(raw)) else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="2h")
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--dir", default="/opt/kasra")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"\d+[smh]|\d{4}-\d\d-\d\dT[\d:]+Z?", args.since):
        sys.exit("--since must look like 30m, 2h or 2026-01-01T00:00:00Z")
    command = ["docker", "compose", "--project-directory", args.dir, "-f", args.dir + "/compose.yaml",
               "logs", "--no-color", "--no-log-prefix", "--since", args.since]
    counts, shown = Counter(), {}
    for service in ("backend", "frontend", "postgres", "redis"):
        result = subprocess.run(command + [service], capture_output=True, text=True, check=False)
        for raw in result.stdout.splitlines():
            parsed = parse(service, raw.strip(), args.all)
            if parsed:
                counts[(service, parsed[0])] += 1
                shown.setdefault(service, []).append(f"{service:8} {parsed[0]:5} {parsed[1]}")
    print(f"{'Log lines' if args.all else 'Warnings/errors'} since {args.since}: " +
          (", ".join(f"{s} {l}={n}" for (s, l), n in sorted(counts.items())) or "none"))
    for lines in shown.values():  # the newest lines of each service
        for line in lines[-args.limit:]:
            print("  " + line)


if __name__ == "__main__":
    main()
