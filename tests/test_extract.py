import os
import shutil
import struct
import sys
import tempfile
import unittest
import zlib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from extract import build_movies, parse_shelf, to_webp  # noqa: E402

FIXTURE = (
    '<table><tr id="collection"><td>'
    '<div class="medium"><div class="title">Santa Claus is Comin\' to Town (3-DVD Gift Collection)</div>'
    '<span class="creator"></span><span class="rating">4.6</span><span class="asin">B00005MEUZ</span>'
    '<span class="description"></span><div class="cover coverimage" onclick="showDetails(this, event)">'
    '<img class="coverimage" src="../covers/5C4B1DFC-6744-11D9-9A64-000A95A07FD4-140.png" width="99" height="140"></div></div>'
    '<div class="medium"><div class="title">Tom &amp; Jerry [4K UHD]</div>'
    '<span class="creator">None</span><span class="rating"></span><span class="asin"></span>'
    '<span class="description">Cat &amp; mouse.</span><div class="cover coverimage" onclick="showDetails(this, event)">'
    '<img class="coverimage" src="../covers/AAAA-BBBB-140.png" width="110" height="140"></div></div>'
    '<div class="medium"><div class="title">Psycho</div>'
    '<span class="creator">Alfred Hitchcock</span><span class="rating">5</span><span class="asin"></span>'
    '<span class="description"></span><div class="cover coverimage" onclick="showDetails(this, event)">'
    '<img class="coverimage" src="../covers/CCCC-DDDD-140.png" width="100" height="140"></div></div>'
    '</td></tr></table>'
)


class ParseShelfTests(unittest.TestCase):
    def setUp(self):
        self.entries = parse_shelf(FIXTURE)

    def test_parses_fields(self):
        self.assertEqual(len(self.entries), 3)
        santa = self.entries[0]
        self.assertEqual(santa["id"], "5C4B1DFC-6744-11D9-9A64-000A95A07FD4")
        self.assertEqual(santa["title"], "Santa Claus is Comin' to Town (3-DVD Gift Collection)")
        self.assertEqual(santa["rating"], 4.6)
        self.assertEqual(santa["asin"], "B00005MEUZ")
        self.assertEqual(santa["coverWidth"], 99)
        self.assertEqual(santa["coverHeight"], 140)
        self.assertEqual(self.entries[2]["director"], "Alfred Hitchcock")
        self.assertEqual(self.entries[2]["rating"], 5.0)

    def test_unescapes_entities(self):
        self.assertEqual(self.entries[1]["title"], "Tom & Jerry [4K UHD]")
        self.assertEqual(self.entries[1]["description"], "Cat & mouse.")

    def test_none_creator_is_null(self):
        tom = self.entries[1]
        self.assertIsNone(tom["director"])
        self.assertIsNone(tom["rating"])
        self.assertIsNone(tom["asin"])
        self.assertIsNone(self.entries[0]["director"])
        self.assertIsNone(self.entries[0]["description"])


class BuildMoviesTests(unittest.TestCase):
    def setUp(self):
        entries = parse_shelf(FIXTURE)
        self.movies = build_movies(entries, bluray_ids={"AAAA-BBBB"}, dvd_ids={"5C4B1DFC-6744-11D9-9A64-000A95A07FD4"})

    def test_formats(self):
        self.assertEqual(self.movies[0]["formats"], ["DVD"])
        self.assertEqual(self.movies[1]["formats"], ["4K UHD", "Blu-ray"])
        self.assertEqual(self.movies[2]["formats"], [])
        uhd_only = build_movies([dict(parse_shelf(FIXTURE)[2], title="Foo [UHD]")], set(), set())
        self.assertIn("4K UHD", uhd_only[0]["formats"])

    def test_cover_path(self):
        for m in self.movies:
            self.assertEqual(m["cover"], f"covers/{m['id']}.webp")
            self.assertNotIn("coverUrl", m)

    def test_preserves_order(self):
        self.assertEqual([m["title"] for m in self.movies][2], "Psycho")


def _tiny_png(path, w=4, h=6):
    raw = b"".join(b"\x00" + bytes([200, 60, 30]) * w for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@unittest.skipUnless(shutil.which("cwebp"), "cwebp not installed")
class ToWebpTests(unittest.TestCase):
    def test_converts_and_removes_png(self):
        with tempfile.TemporaryDirectory() as d:
            png = os.path.join(d, "ABC.png")
            _tiny_png(png)
            out = to_webp(png)
            self.assertEqual(out, os.path.join(d, "ABC.webp"))
            with open(out, "rb") as f:
                head = f.read(12)
            self.assertEqual((head[:4], head[8:12]), (b"RIFF", b"WEBP"))
            self.assertFalse(os.path.exists(png))


if __name__ == "__main__":
    unittest.main()
