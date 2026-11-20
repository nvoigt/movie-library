// Outbound links for a movie (no DOM).

const RELEASE_WORDS = String.raw`(4k|uhd|ultra ?hd|blu[\s-]?ray|\bbd\b|dvd|digital|criterion|edition|disc|anniversary|steelbook|widescreen|twilight)`;

const RELEASE_STRIPS = [
  // Bracketed notes about the release rather than the film: "(4K UHD)", "[Blu-ray]",
  // "(The Criterion Collection)", "(Two-Disc)", "(50th Anniversary)"…
  new RegExp(String.raw`\s*[([][^)\]]*${RELEASE_WORDS}[^)\]]*[)\]]`, "gi"),
  // Release years: "(1967)", "(2012-2019)".
  /\s*[([]\s*\d{4}(\s*[-–]\s*\d{4})?\s*[)\]]/g,
  // An unclosed note at the end: "Man of Steel (4K Ultra HD".
  new RegExp(String.raw`\s*[([][^)\]]*${RELEASE_WORDS}[^)\]]*$`, "i"),
  // A bare format at the end: "… Blu Ray".
  /\s+blu[\s-]?ray\s*$/i,
];

// The title to search for: release notes and leftover trailing separators removed.
export function searchTitle(title) {
  let cleaned = title;
  for (const re of RELEASE_STRIPS) cleaned = cleaned.replace(re, "");
  cleaned = cleaned.replace(/[\s:–—-]+$/, "").trim();
  return cleaned || title;
}

export function blurayUrl(movie) {
  return "https://www.blu-ray.com/search/?quicksearch=1&quicksearch_country=US" +
    `&quicksearch_keyword=${encodeURIComponent(searchTitle(movie.title))}&section=bluraymovies`;
}
