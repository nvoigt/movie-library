# Movie Library — Mobile Rebuild (Prototype) — Design

Date: 2026-11-19
Status: Draft, awaiting approval

## Intent and the why

The owner's movie collection is published as a 2007-era Delicious Library
"iPhone" export at
https://www.uvpost.com/MovieLibrary/deliciouslibrary/iphone/index.html.
It is close to unusable on modern phones: a viewport hard-coded to 320px
with zoom disabled, 746 covers on one page, no search, Prototype.js-era
scripts, and a dead Amazon "Search Inside" link.

The owner and their family use it for one job: **"Do I already own this
movie?"**, typically on a phone (e.g. standing in a store). This rebuild is
also a **prototype to make the case for moving away from Delicious Library**
(discontinued software), so it should visibly show that the collection can
live on without it.

Success: someone opens the page on a phone, types part of a title, and gets
an unambiguous yes/no within a couple of seconds.

## Goals

- Search-first, mobile-first page that answers "do I own X?" fast.
- Forgiving search: case-, punctuation- and word-order-insensitive; matches
  partial words; searches title and director.
- Clear outcome states: matches show "In your library" with format(s); no
  match shows an explicit "Not in your library" message.
- Browse mode when the search box is empty: cover grid, format filter
  chips, sort.
- Tap a movie for details: large cover, title, director, rating, formats,
  description, and a "Find on Blu-ray.com" search link (title with release
  notes like "(4K UHD)" stripped).
- Collection data extracted into a standalone, human-readable `movies.json`
  — the new source of truth, independent of Delicious Library.
- Self-contained: covers copied locally; no runtime dependency on
  uvpost.com or Delicious Library assets.

## Non-goals

- Adding/editing movies in the UI (later step; see "Future").
- Accounts, backend, database, sync.
- Barcode scanning.
- Offline service worker.

## Anti-goals (failure even if it "works")

- Anything that makes the yes/no check slower than: open page → type.
- Requiring a build step, package install, or framework to view or deploy.
- Ambiguous results (e.g. an empty screen that could mean "loading" or
  "no match").

## Constraints

- Source data exists only as the exported HTML: three pages
  (`index.html` = all 746 entries / 720 unique titles; `bluraydisc.html` =
  417; `dvdversion.html` = 37 — both subsets of `index.html`).
- Per-entry fields in the export: title, creator (director; sometimes
  empty or literal "None"), rating (often empty), ASIN (often empty),
  description (often empty), cover image `../covers/<UUID>-140.png` with
  width/height.
- Must work as plain static files on any host (including uvpost.com) and
  when opened via a local static server.
- Modern evergreen mobile browsers (iOS Safari, Chrome Android).

## Approaches considered

- **A. Static page + JSON data, vanilla HTML/CSS/JS — CHOSEN.** No build
  step, fastest load, deployable anywhere, and the JSON file doubles as the
  new movie list. Trade-off: adding movies means editing JSON for now.
- **B. Same, using a framework (React/Svelte + Vite).** Same result for
  users, plus a build chain and dependencies to maintain. Rejected as
  unnecessary at this size.
- **C. Spreadsheet-backed app (Google Sheets / Airtable).** Easiest
  ongoing editing, strongest long-term replacement, but needs accounts and
  setup before anything is demonstrable. Deferred; A can migrate to C later
  by swapping the data source.

The owner picked A.

## Design

### File layout (in `/Users/durandal/temp_movie_website`)

```
index.html          # the app shell
styles.css
app.js
movies.json         # generated, then hand-editable
covers/<UUID>.png   # local copies of the 140px covers
manifest.webmanifest + icon  # "Add to Home Screen"
scripts/extract.py  # one-time importer from the old site
```

### Data extraction (`scripts/extract.py`)

- Python 3, standard library only. Downloads the three shelf pages,
  parses each `div.medium`, and downloads every referenced cover.
- Entry identity = cover UUID (unique per entry; duplicate titles are
  distinct editions and are kept as separate entries).
- Formats: `Blu-ray` if the entry appears on the Blu-ray shelf, `DVD` if on
  the DVD shelf, `4K UHD` if the title matches `/4K|UHD/i`. Entries with
  none of these get no format badge.
- Cleanup: unescape HTML entities; treat creator `"None"`/empty as null;
  rating → number or null; empty strings → null.
- Output `movies.json`: array of
  `{ id, title, director, rating, asin, description, cover, coverWidth,
  coverHeight, formats: [] }`, in original export order.
- Idempotent: re-running overwrites `movies.json` and skips covers already
  downloaded.

### Page behavior

- **Header (sticky):** title, search input (autofocus not forced on iOS
  since it pops the keyboard — focus on tap; large tap target), collection
  count.
- **Searching (input non-empty):** debounce-free filtering on each
  keystroke (746 items is trivial). Normalize query and haystack: lowercase,
  strip diacritics and punctuation, collapse whitespace. Every query word
  must appear as a substring of title+director (any order). Results render
  as a compact list (thumbnail, title, director, format badges), headed by
  "N in your library". Zero results → prominent "Not in your library" with
  the query echoed and a hint to try fewer words.
- **Browsing (input empty):** responsive cover grid (≈3 columns on phones,
  more on wider screens), with format chips (All / Blu-ray / DVD / 4K UHD)
  and sort (Title A–Z ignoring leading "The/A/An"; Director A–Z). Chips and
  sort also apply while searching.
- **Details:** tapping an item opens a native `<dialog>` (bottom sheet on
  phones, centered on desktop): cover, title, director, rating, formats,
  description; "Find on Blu-ray.com" → blu-ray.com quick search for the
  cleaned title (`links.js`). Replaced the original Amazon link on 2026-11-19
  at the owner's request. Closes via button, backdrop tap, or Escape/back.
- **Performance:** covers use `loading="lazy"` with explicit width/height
  to avoid layout shift.
- **Look:** clean, modern, light and dark mode via `prefers-color-scheme`;
  proper `width=device-width` viewport with zoom allowed; safe-area insets.
- **Accessibility:** labeled search input, results count in an
  `aria-live` region, buttons for interactive items, visible focus.

### Verification

- Extraction: counts match the source (746 entries, 417 Blu-ray, 37 DVD),
  every cover file present.
- Spot-check searches: "mission impossible" finds the Ghost Protocol
  entry; "hitchcock" returns the Hitchcock films; a nonsense query shows
  "Not in your library".
- View at phone width (≈375px) and desktop in a browser; no horizontal
  scroll.

## Calls made by the designer (owner may override)

- Covers copied locally rather than hot-linked from uvpost.com.
- 4K UHD format inferred from title text (no explicit field exists).
- Duplicate titles kept as separate editions.
- "Add to Home Screen" manifest included; no offline service worker.
- Default order: Title A–Z (export order isn't documented as meaningful).

## Left to the builder

- Exact visual styling, spacing, typography.
- Parser implementation details (regex vs `html.parser`).

## Future (out of scope)

- A way for the owner to add movies without editing JSON (e.g. move data
  to a Google Sheet — approach C).
- Hosting/sharing the prototype with family.
