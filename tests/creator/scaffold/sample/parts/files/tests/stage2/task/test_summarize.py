import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "scripts"))
import summarize  # noqa: E402


class Summarize(unittest.TestCase):
    def test_REQ_101_two_headings_are_always_present(self):
        sections = summarize.split_sections("")
        self.assertEqual(list(sections), ["今週やったこと", "来週やること"])


if __name__ == "__main__":
    unittest.main()
