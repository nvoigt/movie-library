// Pure search / filter / sort logic for the movie library (no DOM).

export function normalize(s) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sortKey(title) {
  return normalize(title).replace(/^(the|a|an) /, "");
}

// Words of the text plus each adjacent pair run together, so "spiderman",
// "xmen" and "walle" find "Spider-Man", "X-Men" and "WALL-E".
function tokens(text) {
  const words = normalize(text).split(" ").filter(Boolean);
  const joined = words.slice(1).map((w, i) => words[i] + w);
  return [...words, ...joined];
}

const COLLECTION_TITLE = /collection|trilogy|box set|\bset\b|\d+\s*-?\s*(film|movie|disc)/i;

const byTitle = (a, b) => sortKey(a.title).localeCompare(sortKey(b.title));

function byDirector(a, b) {
  const da = normalize(a.director);
  const db = normalize(b.director);
  if (!da !== !db) return da ? -1 : 1; // movies without a director go last
  return da.localeCompare(db) || byTitle(a, b);
}

export function searchMovies(movies, { query = "", format = "All", sort = "title" } = {}) {
  const words = normalize(query).split(" ").filter(Boolean);
  const mode = words.length ? "search" : "browse";
  const inFormat = (m) => format === "All" || m.formats.includes(format);

  // Each query word must start a word of the title/director (no mid-word hits).
  const prefixMatch = (toks) => words.every((w) => toks.some((t) => t.startsWith(w)));
  const wholeMatch = (toks) => words.every((w) => toks.includes(w));

  const textMatches = mode === "browse"
    ? movies
    : movies.filter((m) => prefixMatch(tokens(`${m.title} ${m.director ?? ""}`)));

  const compare = sort === "director" ? byDirector : byTitle;
  const results = textMatches.filter(inFormat).sort(compare);
  const otherFormatResults = mode === "search"
    ? textMatches.filter((m) => !inFormat(m)).sort(compare)
    : [];

  // A confident "yes" needs every query word as a whole word in some result.
  const exact = mode === "search" &&
    [...results, ...otherFormatResults].some((m) => wholeMatch(tokens(`${m.title} ${m.director ?? ""}`)));

  // Box sets often list their films only in the description ("…Skyfall, Spectre…").
  const collectionResults = mode === "search" && textMatches.length === 0
    ? movies.filter((m) => COLLECTION_TITLE.test(m.title) && m.description && wholeMatch(tokens(m.description)))
      .sort(compare)
    : [];

  return { mode, results, otherFormatResults, collectionResults, exact };
}
