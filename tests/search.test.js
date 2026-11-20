import { assertEquals } from "jsr:@std/assert@1";
import { normalize, searchMovies, sortKey } from "../search.js";

const movie = (title, director = null, formats = []) => ({ id: title, title, director, formats });

const MOVIES = [
  movie("MISSION: IMPOSSIBLE - GHOST PROTOCOL (4K UHD)", "Brad Bird", ["4K UHD"]),
  movie("Santa Claus is Comin' to Town", null, ["DVD"]),
  movie("Amélie", "Jean-Pierre Jeunet", ["Blu-ray"]),
  movie("Psycho", "Alfred Hitchcock", ["Blu-ray"]),
  movie("Vertigo", "Alfred Hitchcock", []),
  movie("Skyfall", "Sam Mendes", ["Blu-ray"]),
];

const titles = (list) => list.map((m) => m.title);

Deno.test("normalize_punctuation", () => {
  assertEquals(normalize("MISSION: IMPOSSIBLE - GHOST PROTOCOL"), "mission impossible ghost protocol");
  assertEquals(normalize("Don’t Look Up"), "dont look up");
  assertEquals(normalize("Don't Look Up"), "dont look up");
  assertEquals(titles(searchMovies(MOVIES, { query: "comin to town" }).results), ["Santa Claus is Comin' to Town"]);
});

Deno.test("normalize_strips_diacritics", () => {
  assertEquals(normalize("Amélie"), "amelie");
  assertEquals(titles(searchMovies(MOVIES, { query: "amelie" }).results), ["Amélie"]);
});

Deno.test("word_order_and_partial", () => {
  const ghost = "MISSION: IMPOSSIBLE - GHOST PROTOCOL (4K UHD)";
  assertEquals(titles(searchMovies(MOVIES, { query: "protocol mission" }).results), [ghost]);
  assertEquals(titles(searchMovies(MOVIES, { query: "ghost prot" }).results), [ghost]);
});

Deno.test("director_search", () => {
  const r = searchMovies(MOVIES, { query: "hitchcock" });
  assertEquals(r.mode, "search");
  assertEquals(titles(r.results), ["Psycho", "Vertigo"]);
});

Deno.test("blank_query_is_browse", () => {
  for (const query of ["", "   ", "-"]) {
    const r = searchMovies(MOVIES, { query });
    assertEquals(r.mode, "browse");
    assertEquals(r.results.length, MOVIES.length);
  }
});

Deno.test("no_match", () => {
  const r = searchMovies(MOVIES, { query: "zzzz" });
  assertEquals(r.mode, "search");
  assertEquals(r.results, []);
  assertEquals(r.otherFormatResults, []);
});

Deno.test("format_filter", () => {
  assertEquals(titles(searchMovies(MOVIES, { format: "Blu-ray" }).results), ["Amélie", "Psycho", "Skyfall"]);
});

Deno.test("search_reports_other_format_matches", () => {
  const r = searchMovies(MOVIES, { query: "skyfall", format: "DVD" });
  assertEquals(r.results, []);
  assertEquals(titles(r.otherFormatResults), ["Skyfall"]);
});

Deno.test("sort_ignores_articles", () => {
  const list = [movie("The Zebra"), movie("Apple"), movie("A Mango")];
  assertEquals(titles(searchMovies(list, { sort: "title" }).results), ["Apple", "A Mango", "The Zebra"]);
  assertEquals(sortKey("The Zebra"), "zebra");
});

Deno.test("sort_director_nulls_last", () => {
  const list = [movie("B", null), movie("C", "Zed"), movie("A", "Abe"), movie("D", "Abe")];
  assertEquals(titles(searchMovies(list, { sort: "director" }).results), ["A", "D", "C", "B"]);
});

Deno.test("falls_back_to_collection_descriptions", () => {
  const boxSet = { ...movie("Bond 5-Film Collection", null, ["Blu-ray"]), description: "Includes Casino Royale, Skyfall, and Spectre." };
  const list = [...MOVIES.filter((m) => m.title !== "Skyfall"), boxSet];
  const r = searchMovies(list, { query: "skyfall" });
  assertEquals(r.results, []);
  assertEquals(titles(r.collectionResults), ["Bond 5-Film Collection"]);
  // Title matches win: no description fallback when the title is found.
  assertEquals(searchMovies([...list, movie("Skyfall")], { query: "skyfall" }).collectionResults, []);
  assertEquals(searchMovies(list, { query: "" }).collectionResults, []);
});

// --- Final-review fixes ---

const REVIEW = [
  movie("Cocoon", "Ron Howard", ["Blu-ray"]),
  movie("Spider-Man 2", "Sam Raimi", ["Blu-ray"]),
  movie("X-Men", null, ["DVD"]),
  movie("WALL-E", null, []),
  movie("Bill & Ted's Excellent Adventure", null, ["Blu-ray"]),
  { ...movie("The Dark Knight Rises", null, ["Blu-ray"]), description: "Upon the arrival of Bane, Batman returns." },
  { ...movie("Bond Collection", null, ["Blu-ray"]), description: "Includes Casino Royale, Skyfall and Spectre." },
  { ...movie("Night Gallery", null, []), description: "Jaws of death await." },
  movie("K-Pax", null, []),
];

Deno.test("review_spelling_variants_match", () => {
  for (const [query, title] of [["spiderman", "Spider-Man 2"], ["xmen", "X-Men"], ["walle", "WALL-E"], ["bill and ted", "Bill & Ted's Excellent Adventure"]]) {
    assertEquals(titles(searchMovies(REVIEW, { query }).results), [title], query);
  }
});

Deno.test("review_no_mid_word_matches", () => {
  const r = searchMovies(REVIEW, { query: "coco" });
  assertEquals(r.exact, false); // "Cocoon" is only a possible match
  assertEquals(searchMovies(REVIEW, { query: "cocoon" }).exact, true);
  assertEquals(searchMovies(REVIEW, { query: "ron" }).results.length, 1); // director word, not "Cocoon"/"Bond" inner text
  assertEquals(titles(searchMovies(REVIEW, { query: "man" }).results), ["Spider-Man 2"]);
});

Deno.test("review_fallback_only_for_collections_whole_words", () => {
  assertEquals(searchMovies(REVIEW, { query: "arrival" }).collectionResults, []);
  assertEquals(searchMovies(REVIEW, { query: "jaws" }).collectionResults, []);
  assertEquals(titles(searchMovies(REVIEW, { query: "skyfall" }).collectionResults), ["Bond Collection"]);
  assertEquals(searchMovies(REVIEW, { query: "skyf" }).collectionResults, []);
});

Deno.test("review_unknown_format_is_reported", () => {
  const r = searchMovies(REVIEW, { query: "k pax", format: "DVD" });
  assertEquals(r.results, []);
  assertEquals(titles(r.otherFormatResults), ["K-Pax"]);
});
