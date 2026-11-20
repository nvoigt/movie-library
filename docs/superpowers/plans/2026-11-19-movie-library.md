# Movie Library Mobile Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2007 Delicious Library iPhone export with a search-first, mobile-friendly static page that answers "do I own this movie?" in seconds.

**Architecture:** A one-time Python importer scrapes the three old shelf pages into `movies.json` plus local `covers/`. A static page (`index.html` + `styles.css` + `app.js`) loads that JSON; all search/filter/sort logic lives in a pure ES module `search.js` so it can be unit-tested with Deno, and `app.js` only does DOM rendering.

**Tech Stack:** Python 3 stdlib (`urllib`, `html.parser`, `unittest`); vanilla HTML/CSS/JS (ES modules, native `<dialog>`); Deno for JS unit tests (`/opt/homebrew/bin/deno`); Python `http.server` + headless Chrome for visual checks.

**Spec:** `docs/superpowers/specs/2026-11-19-movie-library-design.md`

## Status (2026-11-19)

All four tasks are complete and live at https://nvoigt.github.io/movie-library/
(repo `nvoigt/movie-library`). The tasks below are kept as originally planned;
these changes came after them, and the spec's "Changes after approval" section
describes the current behavior:

- **Final review fixes:** prefix/whole-word search with "possible matches",
  `&`/joined-word matching, collection-only whole-word description fallback,
  "Also owned in other formats" section, "format unknown" wording, no results
  before data loads, 16px sort select, scroll to top on typing.
  Tests: `tests/search.test.js` (`review_*`).
- **Covers → WebP:** `to_webp()` in `scripts/extract.py`; covers are
  `covers/<id>.webp` (supersedes the `.png` paths in Task 1).
- **Amazon link → blu-ray.com search:** `links.js` (`searchTitle`,
  `blurayUrl`) with `tests/links.test.js` (supersedes the Amazon parts of
  Global Constraints and Task 4).
- **Git + GitHub Pages:** repo initialized after the WebP conversion so PNGs
  never entered history; Pages serves `main` from the root.
- **Test commands:** `deno test tests/` and
  `python3 -m unittest discover -s tests -p 'test_*.py'`.

## Global Constraints

- No build step, no npm/package install, no framework; must run as plain static files on any host.
- No runtime requests to uvpost.com or any Delicious Library asset; covers served from local `covers/`.
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`; zoom NOT disabled.
- Source URLs: `https://www.uvpost.com/MovieLibrary/deliciouslibrary/iphone/{index,bluraydisc,dvdversion}.html`; covers at `https://www.uvpost.com/MovieLibrary/deliciouslibrary/covers/<UUID>-140.png`.
- Expected counts: 746 entries total, 417 Blu-ray, 37 DVD.
- Format labels exactly: `Blu-ray`, `DVD`, `4K UHD`.
- Copy: match header `"<N> in your library"` (N=1 → `"1 in your library"`); no-match `"Not in your library"`.
- Amazon link: `https://www.amazon.com/dp/<ASIN>`, only when ASIN is non-null.
- Light + dark via `prefers-color-scheme`; no horizontal scroll at 375px.
- Working dir is not a git repo. Commit steps apply only if the owner runs `git init`; otherwise treat them as checkpoints.

## Review Focus

1. **Format filter hides a movie you own in another format** — searching "skyfall" with the DVD chip on must not say a flat "Not in your library" if it's owned on Blu-ray/4K; show "Not on DVD — you own it as: 4K UHD". (Task 2 test `search_reports_other_format_matches`, Task 3 render.)
2. **Punctuation / curly quotes / entities** — `Don't` vs `Don’t` vs `dont`, `&amp;`, `Mission: Impossible - 7` all match natural typing. (Task 1 `test_unescapes_entities`, Task 2 `normalize_*` tests.)
3. **Accents** — "amelie" finds "Amélie". (Task 2 `normalize_strips_diacritics`.)
4. **Whitespace/punctuation-only query** (e.g. `"  "`, `"-"`) is treated as empty → browse mode, never "Not in your library". (Task 2 `blank_query_is_browse`.)
5. **Sparse entries** — missing director/rating/description/ASIN or a cover that failed to download render without empty labels or broken images. (Task 1 `test_none_creator_is_null`, Task 3/4 manual checks.)

---

### Task 1: Importer — extract `movies.json` and covers

**Files:**
- Create: `scripts/extract.py`
- Create: `tests/test_extract.py`
- Output: `movies.json`, `covers/<UUID>.png`

**Interfaces:**
- Produces `parse_shelf(html: str) -> list[dict]` — one dict per `div.medium`: `{id, title, director, rating, asin, description, coverUrl, coverWidth, coverHeight}`; `id` = cover UUID (filename minus `-140.png`).
- Produces `build_movies(all_entries, bluray_ids: set[str], dvd_ids: set[str]) -> list[dict]` — adds `formats: list[str]` (order: `4K UHD`, `Blu-ray`, `DVD`), sets `cover = "covers/<id>.png"`, drops `coverUrl`; preserves export order.
- Produces `movies.json` schema (consumed by Tasks 2–4): `{id, title, director|null, rating: number|null, asin|null, description|null, cover, coverWidth: int, coverHeight: int, formats: string[]}`.
- `main()`: fetch 3 pages, parse, build, write `movies.json` (UTF-8, `ensure_ascii=False`, indent 2), download covers skipping existing files; print counts; exit 1 if counts ≠ 746/417/37 or any cover missing after download.

- [x] **Step 1: Write failing tests** in `tests/test_extract.py` (unittest) using an inline fixture of 3 `div.medium` blocks copied in the export's exact shape:
  - `test_parses_fields`: title, rating `4.6` → `4.6` (float), asin `"B00005MEUZ"`, `id` = UUID, width/height ints.
  - `test_unescapes_entities`: title `Tom &amp; Jerry` → `"Tom & Jerry"`.
  - `test_none_creator_is_null`: creator `"None"` → `None`; empty rating/asin/description → `None`.
  - `test_formats`: entry on blu-ray set + title containing `4K UHD` → `["4K UHD", "Blu-ray"]`; title `"Foo [UHD]"` → contains `4K UHD`; entry in no set and no 4K text → `[]`.
  - `test_cover_path`: `cover == "covers/<id>.png"`, no `coverUrl` key.
- [x] **Step 2: Run** `python3 -m unittest tests/test_extract.py -v` — expect FAIL (module missing).
- [x] **Step 3: Implement** `scripts/extract.py` with `html.parser.HTMLParser` (track depth inside `div.medium`; capture text of `.title`, `span.creator/.rating/.asin/.description`, and `img.coverimage` attrs). 4K test: `re.search(r'4K|UHD', title, re.I)`. Tests import via `sys.path.insert(0, 'scripts')`.
- [x] **Step 4: Run tests** — expect all PASS.
- [x] **Step 5: Run** `python3 scripts/extract.py` — expect `746 entries, 417 Blu-ray, 37 DVD, 746 covers` and exit 0; `ls covers | wc -l` → 746.
- [x] **Step 6: Commit** `feat: import Delicious Library export into movies.json`.

### Task 2: Search, filter, sort logic

**Files:**
- Create: `search.js` (ES module, no DOM)
- Create: `tests/search.test.js` (Deno)

**Interfaces:**
- Consumes: `movies.json` schema from Task 1.
- Produces:
  - `normalize(s: string): string` — NFD + strip combining marks, lowercase, delete apostrophes (`'` and `’`), replace any remaining non `[a-z0-9]` run with one space, trim.
  - `sortKey(title: string): string` — `normalize` then drop leading `the |a |an `.
  - `searchMovies(movies, { query = "", format = "All", sort = "title" }): { mode: "browse"|"search", results: Movie[], otherFormatResults: Movie[] }`
    - `mode = "browse"` when `normalize(query) === ""`.
    - Match: every query word is a substring of `normalize(title + " " + (director ?? ""))`.
    - `format !== "All"` keeps only movies whose `formats` includes it; `otherFormatResults` = text matches excluded by the format filter (empty in browse mode).
    - `sort`: `"title"` by `sortKey(title)`; `"director"` by `normalize(director)` with null directors last, ties by title. Use `localeCompare`.

- [x] **Step 1: Write failing tests** (`Deno.test`, `assertEquals` from `jsr:@std/assert`) with a small inline movie array:
  - `normalize_punctuation`: `normalize("MISSION: IMPOSSIBLE - GHOST PROTOCOL")` → `"mission impossible ghost protocol"`; `normalize("Don’t Look Up")` and `normalize("Don't Look Up")` both → `"dont look up"`; `"Santa Claus is Comin' to Town"` is found by query `"comin to town"`.
  - `normalize_strips_diacritics`: `normalize("Amélie")` → `"amelie"`.
  - `word_order_and_partial`: query `"protocol mission"` and `"ghost prot"` both find Ghost Protocol.
  - `director_search`: `"hitchcock"` returns only movies with director Alfred Hitchcock.
  - `blank_query_is_browse`: queries `""`, `"   "`, `"-"` → `mode === "browse"`, all movies returned.
  - `no_match`: `"zzzz"` → `mode "search"`, `results` `[]`, `otherFormatResults` `[]`.
  - `search_reports_other_format_matches`: movie with `formats ["Blu-ray"]`, query its title, `format "DVD"` → `results []`, `otherFormatResults` has it.
  - `sort_ignores_articles`: `["The Zebra", "Apple", "A Mango"]` sorted by title → `Apple, A Mango, The Zebra`.
  - `sort_director_nulls_last`.
- [x] **Step 2: Run** `deno test tests/search.test.js` — expect FAIL (module missing).
- [x] **Step 3: Implement** `search.js` per the Interfaces block.
- [x] **Step 4: Run** `deno test tests/search.test.js` — expect all PASS.
- [x] **Step 5: Commit** `feat: add search/filter/sort module`.

### Task 3: Page shell, search UI and browse grid

**Files:**
- Create: `index.html`, `styles.css`, `app.js`

**Interfaces:**
- Consumes: `searchMovies`, from `./search.js`; `movies.json` via `fetch("movies.json")`.
- Produces (for Task 4): each rendered item is a `<button class="movie" data-id="<id>">`; `app.js` exports nothing but calls `openDetails(movie)` from `./details.js` (stub in this task: `export function openDetails() {}`).

- [x] **Step 1: Build `index.html`**: viewport per Global Constraints; sticky header with `<h1>Movie Library</h1>`, `<label>`led `<input type="search" id="q" autocomplete="off" enterkeyhint="search">`, total count; chip row (`All / Blu-ray / DVD / 4K UHD` as `aria-pressed` buttons); sort `<select>` (Title / Director); `<p id="status" aria-live="polite">`; `<main id="results">`; `<script type="module" src="app.js">`.
- [x] **Step 2: Implement `app.js`**: load JSON (show "Loading…" until done; on fetch failure show "Couldn't load the library"); re-render on `input`/chip/sort change. Browse mode → cover grid (`<img loading="lazy" width height alt="">` + title). Search mode → compact list rows (thumbnail, title, director if any, format badges). Status copy: browse → `"<N> movies"`; matches → `"<N> in your library"`; none + `otherFormatResults` non-empty → `"Not on <format> — you own it as: <formats>"` and render those rows; none at all → large `"Not in your library"` block echoing the query with "Try fewer words." Image `onerror` swaps to a CSS placeholder showing the title. Omit director/badge elements when empty.
- [x] **Step 3: Implement `styles.css`**: CSS custom properties for colors with dark-mode overrides; grid `repeat(auto-fill, minmax(105px, 1fr))`; ≥44px tap targets; `env(safe-area-inset-*)` padding; 16px input font (prevents iOS zoom-on-focus).
- [x] **Step 4: Verify**: `python3 -m http.server 8000` in project root; headless Chrome screenshots of `http://localhost:8000/` at 375×812 and 1280×800, then interactively in Chrome check: "mission impossible" → several results incl. Ghost Protocol; "hitchcock" → Hitchcock films; "qwxyz" → "Not in your library"; DVD chip + "skyfall" → other-format message; no horizontal scroll at 375px; dark mode readable.
- [x] **Step 5: Commit** `feat: search-first page with browse grid`.

### Task 4: Details sheet, Amazon link, home-screen manifest

**Files:**
- Create: `details.js` (replaces Task 3 stub), `manifest.webmanifest`, `icon-180.png`, `icon-512.png`
- Modify: `index.html` (add `<dialog id="details">`, manifest + `apple-touch-icon` links), `styles.css`

**Interfaces:**
- Consumes: `.movie[data-id]` buttons and `openDetails(movie)` call from Task 3.
- Produces: `export function openDetails(movie: Movie): void`.

- [x] **Step 1: Implement `openDetails`**: fill dialog with cover (larger), title, director, rating (`★ 4.5`), format badges, description — each element omitted when its value is null; "View on Amazon" `<a target="_blank" rel="noopener">` only when `asin`. `showModal()`; close on close button, backdrop click, Escape (native). Push a history state on open and close on `popstate` so the phone back gesture dismisses it.
- [x] **Step 2: Style** dialog as a bottom sheet (`max-height: 85dvh`, scrollable body, rounded top) below 600px width, centered card above.
- [x] **Step 3: Add manifest** (`name: "Movie Library"`, `display: "standalone"`, theme/background colors matching CSS, icons) and a simple generated icon (Python stdlib-written PNG or hand-made; any clean film/library glyph).
- [x] **Step 4: Verify** in Chrome at 375px: tap a fully populated movie (e.g. Mission: Impossible 7) → all fields; tap a sparse one (e.g. "Bugs Bunny Superstar") → no empty labels, no Amazon link; back button closes sheet; Amazon link for an ASIN entry opens `amazon.com/dp/<ASIN>`; Lighthouse/DevTools shows manifest installable.
- [x] **Step 5: Final check** against spec Verification section (counts, three spot-check searches, phone + desktop widths). Re-run `python3 -m unittest tests/test_extract.py` and `deno test tests/`.
- [x] **Step 6: Commit** `feat: details sheet and home-screen support`.
