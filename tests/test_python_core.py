from __future__ import annotations

import unittest

from truthlayer import BenchmarkRunner, TruthLayerPipeline


class TruthLayerCoreTest(unittest.TestCase):
    def test_numeric_contradiction_rejects_claim(self) -> None:
        result = TruthLayerPipeline().verify(
            "Mount Everest is 6848 meters tall.",
            "Mount Everest is Earths highest mountain above sea level, with an elevation of 8,849 meters.",
        )

        self.assertEqual(result.decision, "REJECT")
        self.assertEqual(result.status, "UNSUPPORTED")
        self.assertGreaterEqual(result.contradiction_score, 0.78)
        self.assertTrue(any(signal.name == "NUMERIC_CONTRADICTION" for signal in result.signals))

    def test_supported_claim_can_accept(self) -> None:
        result = TruthLayerPipeline().verify(
            "Mount Everest is 8849 meters tall.",
            "Mount Everest is Earths highest mountain above sea level, with an elevation of 8,849 meters. Mount Everest is located in the Himalayas.",
        )

        self.assertIn(result.decision, {"ACCEPT", "REVISE", "ABSTAIN"})
        self.assertNotEqual(result.decision, "REJECT")

    def test_benchmark_runner_counts_cases(self) -> None:
        cases = [
            {
                "claim": "Mount Everest is 6848 meters tall.",
                "evidence": "Mount Everest has an elevation of 8,849 meters.",
                "expected": "UNSUPPORTED",
            },
            {
                "claim": "Mount Everest is 8849 meters tall.",
                "evidence": "Mount Everest has an elevation of 8,849 meters.",
                "expected": "SUPPORTED",
            },
        ]

        summary = BenchmarkRunner().run(cases)
        self.assertEqual(summary.cases, 2)
        self.assertEqual(summary.supported, 1)
        self.assertEqual(summary.unsupported, 1)


if __name__ == "__main__":
    unittest.main()
