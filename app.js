import { searchMovies } from "./search.js";
import { openDetails } from "./details.js";

const $ = (sel) => document.querySelector(sel);
const input = $("#q");
const sortSelect = $("#sort");
const statusEl = $("#status");
const resultsEl = $("#results");
const chips = [...document.querySelectorAll(".chip")];

let movies = [];
let format = "All";
let loaded = false;
const byId = new Map();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null && c !== ""));
  return node;
}

function cover(movie, cls) {
  const img = el("img", {
    class: cls, src: movie.cover, alt: "", loading: "lazy", decoding: "async",
    width: movie.coverWidth || 100, height: movie.coverHeight || 140,
  });
  img.addEventListener("error", () => {
    img.replaceWith(el("div", { class: `${cls} placeholder`, "aria-hidden": "true" }, movie.title));
  }, { once: true });
  return img;
}

const badges = (movie) =>
  movie.formats.length
    ? el("span", { class: "badges" }, ...movie.formats.map((f) => el("span", { class: "badge" }, f)))
    : null;

function tile(movie) {
  return el("button", { class: "movie tile", type: "button", "data-id": movie.id },
    cover(movie, "tile-cover"),
    el("span", { class: "tile-title" }, movie.title));
}

function row(movie) {
  return el("button", { class: "movie row", type: "button", "data-id": movie.id },
    cover(movie, "row-cover"),
    el("span", { class: "row-text" },
      el("span", { class: "row-title" }, movie.title),
      movie.director ? el("span", { class: "row-director" }, movie.director) : null,
      badges(movie)));
}

const formatList = (list) =>
  [...new Set(list.flatMap((m) => (m.formats.length ? m.formats : ["format unknown"])))].join(", ");

function render() {
  if (!loaded) return; // never answer "Not in your library" from an empty list
  const query = input.value;
  const { mode, results, otherFormatResults, collectionResults, exact } =
    searchMovies(movies, { query, format, sort: sortSelect.value });
  resultsEl.replaceChildren();
  statusEl.className = "status";
  resultsEl.className = mode === "browse" ? "grid" : "list";

  if (mode === "browse") {
    statusEl.textContent = format === "All"
      ? `${results.length} movies`
      : `${results.length} ${format} movies`;
    resultsEl.append(...results.map(tile));
    return;
  }

  if (results.length) {
    if (exact) {
      statusEl.textContent = `${results.length} in your library`;
      statusEl.className = "status yes";
    } else {
      statusEl.textContent = `${results.length} possible ${results.length === 1 ? "match" : "matches"} — keep typing`;
    }
    resultsEl.append(...results.map(row));
    if (otherFormatResults.length) {
      resultsEl.append(el("h2", { class: "list-heading" },
        `Also owned in other formats (${otherFormatResults.length})`), ...otherFormatResults.map(row));
    }
    return;
  }

  if (otherFormatResults.length) {
    statusEl.textContent = `Not marked as ${format} — you own: ${formatList(otherFormatResults)}`;
    statusEl.className = "status partial";
    resultsEl.append(...otherFormatResults.map(row));
    return;
  }

  if (collectionResults.length) {
    statusEl.textContent = `No title match — “${query.trim()}” appears in the description of:`;
    statusEl.className = "status partial";
    resultsEl.append(...collectionResults.map(row));
    return;
  }

  statusEl.textContent = "";
  resultsEl.append(el("div", { class: "nomatch", role: "status" },
    el("p", { class: "nomatch-title" }, "Not in your library"),
    el("p", {}, "Nothing matches “", el("strong", {}, query.trim()), "”. Try fewer words.")));
}

input.addEventListener("input", () => {
  scrollTo(0, 0); // keep the yes/no headline in view
  render();
});
sortSelect.addEventListener("change", render);
for (const chip of chips) {
  chip.addEventListener("click", () => {
    format = chip.dataset.format;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    render();
  });
}
resultsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".movie");
  if (btn) openDetails(byId.get(btn.dataset.id));
});

try {
  const res = await fetch("movies.json");
  if (!res.ok) throw new Error(res.status);
  movies = await res.json();
  movies.forEach((m) => byId.set(m.id, m));
  if (!input.value) input.value = new URLSearchParams(location.search).get("q") ?? "";
  loaded = true;
  $("#total").textContent = `${movies.length} titles`;
  render();
} catch {
  statusEl.textContent = "Couldn’t load the library. Check your connection and reload.";
}
