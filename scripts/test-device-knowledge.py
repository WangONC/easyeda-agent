import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('device_check', Path(__file__).with_name('check-device-knowledge.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class DeviceKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.d = m.load(m.DATA/'parts/tps5430ddar.json')

    def test_all_fifty_and_five_categories(self):
        self.assertEqual(m.validate()['devices'], 50)

    def test_missing_identity(self):
        self.d['mpn'] = ''
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_printed_page_is_not_pdf_page(self):
        for s in self.d['sources'].values():
            s['printed_page'] = s.pop('pdf_page')
        with self.assertRaisesRegex(ValueError, 'PDF page'): m.validate_device(self.d)

    def test_invalid_page_and_url(self):
        for value in [0, -1, True, '19']:
            d = copy.deepcopy(self.d)
            next(iter(d['sources'].values()))['pdf_page'] = value
            with self.assertRaises(ValueError): m.validate_device(d)
        next(iter(self.d['sources'].values()))['url'] = 'datasheet'
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_missing_fact_source(self):
        self.d['facts'][0]['source_refs'] = ['missing']
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_no_reference_without_source(self):
        self.d['reference_applications'][0]['source_refs'] = []
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_no_derived_fields(self):
        for field in ['recommended_peripherals','recommended_input_capacitor','推荐输出电容']:
            d = copy.deepcopy(self.d)
            d['facts'][0]['values'][field] = '10uF'
            with self.assertRaises(ValueError): m.validate_device(d)

    def test_unknown_conditions_require_topology_only(self):
        self.d['reference_applications'][0]['conditions'] = {}
        with self.assertRaises(ValueError): m.validate_device(self.d)
        self.d['reference_applications'][0]['scope'] = 'topology_only'
        m.validate_device(self.d)

    def test_invalid_net_endpoint(self):
        self.d['reference_applications'][0]['netlist']['nets']['BAD'] = ['UNDECLARED.1']
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_duplicate_net_endpoint(self):
        app = self.d['reference_applications'][0]
        app['netlist']['nets']['BAD'] = [next(iter(app['netlist']['nets'].values()))[0]]
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_identity_only_is_not_fact_qualified(self):
        self.d['availability'] = 'identity_only'
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_duplicate_json_key(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)/'bad.json'
            p.write_text('{"mpn":"a","mpn":"b"}', encoding='utf-8')
            with self.assertRaises(ValueError): m.load(p)

    def test_page_offset_is_explicit(self):
        d = m.load(m.DATA/'parts/rp2040.json')
        self.assertTrue(any(s['pdf_page']==10 and s['printed_page']==9 for s in d['sources'].values()))

    def test_mismatched_reference_is_not_imported(self):
        d = m.load(m.DATA/'parts/tps7a2033pdbvr.json')
        self.assertEqual(d['reference_applications'], [])
        self.assertTrue(any('2.8 V' in x['reason'] for x in d['unavailable']))

if __name__ == '__main__': unittest.main()
