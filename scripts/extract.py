"""One-time importer: turns the old Delicious Library iPhone export into movies.json + covers/.

Covers are stored as WebP (needs `cwebp`, e.g. `brew install webp`).

Usage: python3 scripts/extract.py   (run from the project root)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser

BASE = "https://www.uvpost.com/MovieLibrary/deliciouslibrary"
SHELVES = {"all": "index.html", "bluray": "bluraydisc.html", "dvd": "dvdversion.html"}
EXPECTED = {"all": 746, "bluray": 417, "dvd": 37}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

FIELD_CLASSES = {"title": "title", "creator": "director", "rating": "rating",
                 "asin": "asin", "description": "description"}


class _ShelfParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.entries = []
        self.current = None
        self.depth = 0          # nesting depth inside the current div.medium
        self.field = None       # field whose text we are collecting

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if self.current is None:
            if tag == "div" and "medium" in classes:
                self.current = {k: "" for k in FIELD_CLASSES.values()}
                self.depth = 1
            return
        if tag == "div":
            self.depth += 1
        if tag == "img":
            src = a.get("src", "")
            self.current["coverUrl"] = BASE + "/" + src.replace("../", "", 1)
            self.current["id"] = os.path.basename(src).removesuffix("-140.png")
            self.current["coverWidth"] = int(a.get("width") or 0)
            self.current["coverHeight"] = int(a.get("height") or 0)
            return
        for cls in classes:
            if cls in FIELD_CLASSES:
                self.field = FIELD_CLASSES[cls]

    def handle_endtag(self, tag):
        if self.current is None:
            return
        if tag in ("div", "span"):
            self.field = None
        if tag == "div":
            self.depth -= 1
            if self.depth == 0:
                self.entries.append(_clean(self.current))
                self.current = None

    def handle_data(self, data):
        if self.current is not None and self.field:
            self.current[self.field] += data


def _clean(raw):
    def text(v):
        v = (v or "").strip()
        return v or None

    director = text(raw["director"])
    if director == "None":
        director = None
    rating = text(raw["rating"])
    return {
        "id": raw["id"],
        "title": text(raw["title"]) or "",
        "director": director,
        "rating": float(rating) if rating else None,
        "asin": text(raw["asin"]),
        "description": text(raw["description"]),
        "coverUrl": raw["coverUrl"],
        "coverWidth": raw["coverWidth"],
        "coverHeight": raw["coverHeight"],
    }


def parse_shelf(html):
    parser = _ShelfParser()
    parser.feed(html)
    parser.close()
    return parser.entries


def build_movies(all_entries, bluray_ids, dvd_ids):
    movies = []
    for e in all_entries:
        formats = []
        if re.search(r"4K|UHD", e["title"], re.I):
            formats.append("4K UHD")
        if e["id"] in bluray_ids:
            formats.append("Blu-ray")
        if e["id"] in dvd_ids:
            formats.append("DVD")
        movie = {k: v for k, v in e.items() if k != "coverUrl"}
        movie["cover"] = f"covers/{e['id']}.webp"
        movie["formats"] = formats
        movies.append(movie)
    return movies


def to_webp(png_path, quality=80):
    """Convert a PNG to a WebP next to it, delete the PNG, and return the WebP path."""
    webp_path = os.path.splitext(png_path)[0] + ".webp"
    subprocess.run(["cwebp", "-quiet", "-q", str(quality), "-m", "6", png_path, "-o", webp_path],
                   check=True)
    os.remove(png_path)
    return webp_path


def _fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def main():
    shelves = {k: parse_shelf(_fetch(f"{BASE}/iphone/{page}").decode("utf-8"))
               for k, page in SHELVES.items()}
    counts = {k: len(v) for k, v in shelves.items()}
    movies = build_movies(shelves["all"],
                          {e["id"] for e in shelves["bluray"]},
                          {e["id"] for e in shelves["dvd"]})

    with open(os.path.join(ROOT, "movies.json"), "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)

    os.makedirs(os.path.join(ROOT, "covers"), exist_ok=True)
    missing = []
    for e in shelves["all"]:
        png = os.path.join(ROOT, "covers", f"{e['id']}.png")
        if os.path.exists(os.path.splitext(png)[0] + ".webp"):
            continue
        try:
            if not os.path.exists(png):  # an earlier run may have left the PNG behind
                data = _fetch(e["coverUrl"])
                with open(png, "wb") as f:
                    f.write(data)
            to_webp(png)
        except Exception as exc:  # keep going; report at the end
            missing.append((e["title"], str(exc)))

    have = sum(os.path.exists(os.path.join(ROOT, m["cover"])) for m in movies)
    print(f"{counts['all']} entries, {counts['bluray']} Blu-ray, {counts['dvd']} DVD, {have} covers")
    for title, err in missing:
        print(f"  missing cover: {title} ({err})", file=sys.stderr)
    if counts != EXPECTED or have != len(movies):
        sys.exit(1)


if __name__ == "__main__":
    main()
