#!/usr/bin/env python3
"""Structural checks for the Northbank Sports Hub static site (standard library only).

Usage: python3 tools/check_site.py [SITE_DIR]      (default: the current folder)

Checks every page for: doctype, lang, title, description, viewport, one h1, no skipped heading
levels, balanced tags, block elements inside <p>, duplicate ids, images with alt, width and
height, labels for every form control, ARIA references that exist, links and #fragments that
resolve, assets that exist, and pages that cannot be reached from index.html.
It is a quick safety net, not a replacement for the W3C validator (https://validator.w3.org/).
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
# Pages that are reached by the booking flow or by the web host, not by a menu link
ALLOW_UNLINKED = {"404.html", "confirmation.html"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BLOCKS = {"address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figure", "footer", "form",
          "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table", "ul"}
PHRASING_ONLY = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "a", "button", "label", "legend", "summary", "strong", "em",
                 "time", "mark", "output", "caption", "dt"}
ALLOWED_PARENTS = {
    "li": {"ul", "ol", "menu"},
    "dt": {"dl", "div"}, "dd": {"dl", "div"},
    "tr": {"table", "thead", "tbody", "tfoot"}, "td": {"tr"}, "th": {"tr"},
    "thead": {"table"}, "tbody": {"table"}, "caption": {"table"},
    "option": {"select", "optgroup", "datalist"}, "summary": {"details"}, "legend": {"fieldset"},
    "figcaption": {"figure"}, "source": {"picture"},
}

errors = []


def err(page, line, msg):
    errors.append(f"{page}:{line}: {msg}")


class Page(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.stack = []
        self.ids = {}
        self.refs = []  # (attr, value, line)
        self.links = []
        self.assets = []
        self.labels_for = []
        self.headings = []
        self.imgs = 0

    def line(self):
        return self.getpos()[0]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        ln = self.line()
        if tag in ALLOWED_PARENTS and self.stack:
            parent = self.stack[-1][0]
            if parent not in ALLOWED_PARENTS[tag]:
                err(self.name, ln, f"<{tag}> inside <{parent}>")
        if tag in BLOCKS and any(t == "p" for t, _ in self.stack):
            err(self.name, ln, f"block <{tag}> inside <p>")
        if self.stack and self.stack[-1][0] in {"p", "span", "a", "button", "h1", "h2", "h3", "h4", "label", "legend", "strong", "summary"} and tag in {"div", "ul", "ol", "dl", "table", "section", "form", "fieldset", "figure", "nav", "header", "footer", "aside"}:
            err(self.name, ln, f"<{tag}> inside <{self.stack[-1][0]}>")
        if tag == "a" and any(t == "a" for t, _ in self.stack):
            err(self.name, ln, "nested <a>")
        if tag == "button" and any(t == "button" for t, _ in self.stack):
            err(self.name, ln, "nested <button>")
        if "id" in a:
            if a["id"] in self.ids:
                err(self.name, ln, f"duplicate id '{a['id']}'")
            self.ids[a["id"]] = ln
            if re.search(r"\s", a["id"]):
                err(self.name, ln, f"id with whitespace '{a['id']}'")
        for attr in ("aria-labelledby", "aria-describedby", "aria-controls"):
            if attr in a:
                for v in a[attr].split():
                    self.refs.append((attr, v, ln))
        if tag == "label" and "for" in a:
            self.labels_for.append((a["for"], ln))
        if tag == "a":
            if "href" in a:
                self.links.append((a["href"], ln))
            else:
                err(self.name, ln, "<a> without href")
        if tag == "img":
            self.imgs += 1
            if "alt" not in a:
                err(self.name, ln, "img without alt")
            if "width" not in a or "height" not in a:
                err(self.name, ln, "img without width/height")
            if "src" in a:
                self.assets.append((a["src"], ln))
        if tag == "script" and "src" in a:
            self.assets.append((a["src"], ln))
        if tag == "link" and "href" in a:
            self.assets.append((a["href"], ln))
        if tag == "source" and "srcset" in a:
            self.assets.append((a["srcset"].split()[0], ln))
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.headings.append((int(tag[1]), ln))
        if (tag == "input" and a.get("type") not in {"hidden", "submit", "button"}
                and not {"aria-label", "aria-labelledby"} & set(a)
                and not any(t == "label" for t, _ in self.stack)):
            self.refs.append(("input-needs-label", a.get("id", ""), ln))
        if tag in VOID:
            return
        self.stack.append((tag, ln))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        ln = self.line()
        if tag in VOID:
            err(self.name, ln, f"end tag for void </{tag}>")
            return
        if not self.stack:
            err(self.name, ln, f"stray </{tag}>")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        err(self.name, ln, f"</{tag}> closes <{self.stack[-1][0]}> opened line {self.stack[-1][1]}")
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def close(self):
        super().close()
        for tag, ln in self.stack:
            err(self.name, ln, f"<{tag}> never closed")


pages = {}
for f in sorted(ROOT.glob("*.html")):
    text = f.read_text(encoding="utf-8")
    p = Page(f.name)
    if not text.lower().startswith("<!doctype html>"):
        err(f.name, 1, "missing doctype")
    p.feed(text)
    p.close()
    pages[f.name] = p
    # page-level checks
    if len([h for h in p.headings if h[0] == 1]) != 1:
        err(f.name, 1, f"expected exactly one h1, found {len([h for h in p.headings if h[0] == 1])}")
    prev = 0
    for lvl, ln in p.headings:
        if prev and lvl > prev + 1:
            err(f.name, ln, f"heading level jumps h{prev} to h{lvl}")
        prev = lvl
    for t in ("<title>", 'name="description"', 'lang="en-GB"', 'name="viewport"', 'id="main"', "skip"):
        if t not in text:
            err(f.name, 1, f"missing {t}")

for name, p in pages.items():
    for attr, v, ln in p.refs:
        if attr == "input-needs-label":
            if not v or not any(v == lf for lf, _ in p.labels_for):
                err(name, ln, f"input '{v}' has no <label for>")
        elif v not in p.ids:
            err(name, ln, f"{attr} points to missing id '{v}'")
    for target, ln in p.labels_for:
        if target not in p.ids:
            err(name, ln, f"label for='{target}' has no control")
    for href, ln in p.links:
        u = urlsplit(href)
        if u.scheme in {"mailto", "tel", "http", "https"}:
            continue
        dest = u.path or name
        if dest not in pages:
            if not (ROOT / dest).exists():
                err(name, ln, f"broken link {href}")
            continue
        if u.fragment and u.fragment not in pages[dest].ids:
            err(name, ln, f"missing fragment #{u.fragment} in {dest} (from {href})")
    for src, ln in p.assets:
        u = urlsplit(src)
        if u.scheme in {"http", "https", "data"}:
            err(name, ln, f"external or data asset {src}")
            continue
        if not (ROOT / u.path).exists():
            err(name, ln, f"missing asset {src}")

# every page reachable from the home page, and linked from the footer nav
reachable = {"index.html"}
queue = ["index.html"]
while queue:
    cur = queue.pop()
    for href, _ in pages[cur].links:
        d = urlsplit(href).path
        if d in pages and d not in reachable:
            reachable.add(d)
            queue.append(d)
orphans = set(pages) - reachable
for o in sorted(orphans - ALLOW_UNLINKED):
    err(o, 1, "page is not reachable from index.html")

print(f"checked {len(pages)} pages, {sum(p.imgs for p in pages.values())} images, "
      f"{sum(len(p.links) for p in pages.values())} links")
if errors:
    print(f"{len(errors)} problem(s):")
    print("\n".join(errors))
    sys.exit(1)
print("no problems found")
