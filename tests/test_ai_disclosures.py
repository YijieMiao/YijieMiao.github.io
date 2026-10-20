import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('audit',Path(__file__).resolve().parents[1]/'scripts/check_ai_disclosures.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class DisclosureTests(unittest.TestCase):
    def classify(self,text): return audit.classify([(text,'paragraph-1')])
    def test_positive_writing_statement(self):
        result=self.classify('We used ChatGPT to polish the writing of this manuscript.')
        self.assertEqual(result['status'],'explicit'); self.assertIn('writing',result['roles'])
    def test_research_disclosure(self):
        result=self.classify('Both the idea and an initial proof of this lemma are developed by a Large Language Model.')
        self.assertEqual(result['status'],'explicit');self.assertIn('research',result['roles']);self.assertNotIn('writing',result['roles'])
    def test_subject_not_usage(self):
        self.assertEqual(self.classify('Large language models have interesting theoretical limitations.')['status'],'candidate')
    def test_negation_not_positive(self):
        self.assertEqual(self.classify('We did not use ChatGPT in this paper.')['status'],'candidate')
        self.assertEqual(self.classify('No generative AI was used by the authors.')['status'],'candidate')
    def test_model_release_does_not_imply_use(self):
        result=self.classify('Prior to the release of GPT-5.6, the authors had developed a preliminary manuscript containing their proofs.')
        self.assertEqual(result['status'],'candidate')
    def test_passive_use_and_proof_disclosures(self):
        self.assertEqual(self.classify('ChatGPT was used to perform literature review.')['status'],'explicit')
        self.assertEqual(self.classify('The initial proof of this lemma was found by ChatGPT.')['status'],'explicit')
    def test_plain_math_is_not_a_disclosure(self):
        self.assertEqual(self.classify('We establish a curvature estimate for all A_i.')['status'],'not_found')
    def test_html_excludes_site_footer(self):
        parser=audit.PaperHTML();parser.feed('<article><p id="a">We prove a theorem.</p></article><footer><p>We used ChatGPT.</p></footer>')
        self.assertEqual(audit.classify(parser.blocks)['status'],'not_found')
    def test_excerpt_is_short(self):
        result=self.classify('We used ChatGPT to polish this manuscript and '+ 'improve '*100)
        self.assertLessEqual(len(result['excerpt'].replace('…','').split()),24)
if __name__=='__main__':unittest.main()
