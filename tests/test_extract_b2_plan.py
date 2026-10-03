import tempfile
import unittest
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
SOURCE=ROOT/'case'/'inputs'/'plan'/'2024-07-14-Model(1).pdf'

@unittest.skipUnless(SOURCE.exists(), 'original user PDF must be materialized under case/inputs/plan')
class ExtractB2PlanTest(unittest.TestCase):
    def test_extracts_vector_evidence_and_w3_calibration(self):
        from tools.extract_b2_plan import extract_plan
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)
            result=extract_plan(SOURCE,out)
            self.assertEqual(result['pageCount'],1)
            self.assertGreater(result['selectedDrawingCount'],100)
            self.assertIn('B2-11F',result['text'])
            self.assertEqual(result['transform']['scaleClaim'],'1/60')
            self.assertAlmostEqual(result['transform']['w3Calibration']['targetWidthM'],2.68,places=6)
            self.assertAlmostEqual(result['transform']['w3Calibration']['measuredWidthM'],2.6797,places=4)
            self.assertTrue((out/'plan-vector-full.json').exists())
            self.assertGreater((out/'plan-vector-full.json').stat().st_size,10000)
            self.assertTrue((out/'plan-overlay-full.svg').exists())
            self.assertGreater((out/'plan-overlay-full.svg').stat().st_size,10000)

if __name__=='__main__': unittest.main()
