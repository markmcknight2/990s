#!/usr/bin/env python3
"""Integrity check for the published site. Standard library only.

Runs in two places: `build_site.py` runs it against the staging folder before
anything reaches `../site/`, and the site repository runs it on every push
(`.github/workflows/check.yml`, where this file is `.github/check_site.py`).

It checks what a broken publish would actually look like to a reader:

  * every org page parses, carries no peer data of its own, no draft figures,
    and every asset it loads exists;
  * the shared peer table rebuilds, for a sample of pages, exactly the cohort
    the build recorded (`.github/site-fixtures.json`) - the same computation
    `assets/peers-shim.*.js` does in the browser;
  * every local link on the hub, directory and 404 pages resolves;
  * no file is over GitHub's 100 MB limit, and the site is under Pages' 1 GB.

Usage:
    python3 check_site.py [SITE_DIR]      (defaults to the repository root)
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

PAGE_MARK = "<script>window.__PAGE="
PAGE_END = ";</script>"
BASE_PATH = "/990s/"
FILE_MAX_BYTES = 95 * 1024 * 1024
SITE_MAX_BYTES = 900 * 1024 * 1024
LINKED = re.compile(r'(?:src|href)="([^"#?]+)[^"]*"')


def dumps(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def js_payload(text: str, prefix: str) -> object:
    start = text.index(prefix) + len(prefix)
    end = text.rindex(";")
    return json.loads(text[start:end].replace("<\\/", "</"))


def clip(first: Optional[int], values: list,
         span: Optional[Tuple[int, int]]) -> Tuple[Optional[int], list]:
    if first is None or span is None:
        return (None, [])
    start, end = max(first, span[0]), min(first + len(values) - 1, span[1])
    if start > end:
        return (None, [])
    out = values[start - first:end - first + 1]
    while out and out[-1] is None:
        out.pop()
    lead = 0
    while lead < len(out) and out[lead] is None:
        lead += 1
    return (None, []) if lead == len(out) else (start + lead, out[lead:])


def rebuild_peers(page: dict, table: dict) -> List[list]:
    bit = {}
    for i, tag in enumerate(page.get("tags") or []):
        bit[tag["name"]] = 2 ** i

    def span(years: Sequence[int]) -> Optional[Tuple[int, int]]:
        return (years[0], years[-1]) if years else None

    fin, bd, en = (span(page.get("years") or []),
                   span(page.get("boardYears") or []),
                   span(page.get("endowYears") or []))
    rows = []
    for i, p in enumerate(table["o"]):
        if i == page.get("peerSelf"):
            continue
        mask = 0
        for ti in p[0]:
            mask |= bit.get(table["tags"][ti], 0)
        r, b = clip(p[1], p[2], fin), clip(p[3], p[4], bd)
        a, li = clip(p[5], p[6], fin), clip(p[7], p[8], fin)
        e = clip(p[9], p[10], en)
        if all(x[0] is None for x in (r, b, a, li, e)):
            continue
        rows.append([mask, r[0], r[1], b[0], b[1], a[0], a[1],
                     li[0], li[1], e[0], e[1]])
    return rows


def resolve(site: Path, page: Path, link: str) -> Optional[Path]:
    """The file a local link points at, or None for an external one."""
    if re.match(r"^[a-z]+:", link) or link.startswith("//"):
        return None
    if link.startswith(BASE_PATH):
        target = site / link[len(BASE_PATH):]
    elif link.startswith("/"):
        return site / "__outside_the_site__"
    else:
        target = page.parent / link
    if link.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


def main(argv: List[str]) -> int:
    site = Path(argv[1] if len(argv) > 1 else Path(__file__).resolve().parent.parent)
    problems: List[str] = []

    def problem(msg: str) -> None:
        if len(problems) < 50:
            print(f"  FAIL {msg}")
        problems.append(msg)

    peers_files = sorted(site.glob("assets/peers.*.js"))
    if len(peers_files) != 1:
        problem(f"expected one assets/peers.*.js, found {len(peers_files)}")
        return 1
    table = js_payload(peers_files[0].read_text(encoding="utf-8"), "window.__PEERS=")
    fixtures_path = site / ".github" / "site-fixtures.json"
    fixtures = json.loads(fixtures_path.read_text(encoding="utf-8"))

    pages = sorted(p for p in (site / "org-pages").glob("*.html")
                   if p.name != "index.html")
    if len(pages) != fixtures["pages"]:
        problem(f"{len(pages)} org pages, but the build wrote {fixtures['pages']}")

    checked = 0
    for path in pages:
        text = path.read_text(encoding="utf-8")
        try:
            page = js_payload(text[:text.index(PAGE_END, text.index(PAGE_MARK)) + 1],
                              PAGE_MARK)
        except ValueError as exc:
            problem(f"{path.name}: payload does not parse ({exc})")
            continue
        if page.get("peers") is not None:
            problem(f"{path.name}: carries its own peer data")
        if page.get("draftYears"):
            problem(f"{path.name}: carries draft figures")
        if not isinstance(page.get("peerSelf"), int) or \
                not -1 <= page["peerSelf"] < len(table["o"]):
            problem(f"{path.name}: peerSelf out of range")
        for link in LINKED.findall(text):
            target = resolve(site, path, link)
            if target is not None and not target.is_file():
                problem(f"{path.name}: {link} does not exist")
        want = fixtures["fixtures"].get(path.stem)
        if want:
            got = dumps(rebuild_peers(page, table))
            if hashlib.sha256(got.encode("utf-8")).hexdigest() != want["sha256"]:
                problem(f"{path.name}: cohort does not rebuild "
                        f"({len(json.loads(got))} peers, expected {want['peers']})")
            checked += 1

    for rel in ("index.html", "org-pages/index.html", "404.html"):
        path = site / rel
        if not path.is_file():
            problem(f"{rel} is missing")
            continue
        for link in LINKED.findall(path.read_text(encoding="utf-8")):
            target = resolve(site, path, link)
            if target is not None and not target.is_file():
                problem(f"{rel}: {link} does not exist")

    total = 0
    for path in site.rglob("*"):
        if path.is_file() and ".git" not in path.relative_to(site).parts[:1]:
            size = path.stat().st_size
            total += size
            if size > FILE_MAX_BYTES:
                problem(f"{path.relative_to(site)} is {size/1_048_576:.0f} MB")
    if total > SITE_MAX_BYTES:
        problem(f"site is {total/1_048_576:.0f} MB")

    if checked != len(fixtures["fixtures"]):
        problem(f"only {checked} of {len(fixtures['fixtures'])} fixture pages found")

    print(f"{len(pages):,} org pages, {checked} cohorts rebuilt, "
          f"{total/1_048_576:.0f} MB: "
          + ("OK" if not problems else f"{len(problems)} problem(s)"))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
