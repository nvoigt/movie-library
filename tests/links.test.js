import { assertEquals } from "jsr:@std/assert@1";
import { blurayUrl, searchTitle } from "../links.js";

Deno.test("search_title_strips_format_tags", () => {
  assertEquals(searchTitle("MISSION: IMPOSSIBLE - GHOST PROTOCOL (4K UHD)"), "MISSION: IMPOSSIBLE - GHOST PROTOCOL");
  assertEquals(searchTitle("Mission: Impossible - 7: RECKONING PT1 [4K UHD]"), "Mission: Impossible - 7: RECKONING PT1");
  assertEquals(searchTitle("The Birds - (4K Ultra HD)"), "The Birds");
  assertEquals(searchTitle("Dark Knight Trilogy Collection (UHD/BD) (4K Ultra HD)"), "Dark Knight Trilogy Collection");
  assertEquals(searchTitle("3:10 to Yuma (The Criterion Collection) [Blu-ray]"), "3:10 to Yuma");
  assertEquals(searchTitle("Bond 5-Film Collection (4KUHD)"), "Bond 5-Film Collection");
  assertEquals(searchTitle("Wait Until Dark (1967)"), "Wait Until Dark");
  assertEquals(searchTitle("The Avengers Assembled: Complete 4-Movie Collection (2012-2019)"), "The Avengers Assembled: Complete 4-Movie Collection");
  assertEquals(searchTitle("Inception (Two-Disc) [Blu-ray]"), "Inception");
  assertEquals(searchTitle("Zulu (50th Anniversary) (1964)"), "Zulu");
  assertEquals(searchTitle("Man of Steel (4K Ultra HD"), "Man of Steel");
  assertEquals(searchTitle("The Quiller Memorandum Blu Ray ( TwilightT Time )"), "The Quiller Memorandum");
});

Deno.test("search_title_keeps_real_titles", () => {
  assertEquals(searchTitle("Bond 5-Film Collection"), "Bond 5-Film Collection");
  assertEquals(searchTitle("Santa Claus is Comin' to Town (3-DVD Gift Collection)"), "Santa Claus is Comin' to Town");
  assertEquals(searchTitle("The Abyss (Special Edition)"), "The Abyss");
  assertEquals(searchTitle("(500) Days of Summer"), "(500) Days of Summer");
  assertEquals(searchTitle("Night Gallery (Season 3)"), "Night Gallery (Season 3)");
  assertEquals(searchTitle("[4K UHD]"), "[4K UHD]"); // never search for an empty string
});

Deno.test("bluray_url", () => {
  assertEquals(
    blurayUrl({ title: "Tom & Jerry [4K UHD]" }),
    "https://www.blu-ray.com/search/?quicksearch=1&quicksearch_country=US&quicksearch_keyword=Tom%20%26%20Jerry&section=bluraymovies",
  );
});
