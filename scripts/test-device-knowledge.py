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
        self.assertNotIn('reference_applications', d)

    def test_all_builtin_entries_have_real_knowledge(self):
        for path in (m.DATA/'parts').glob('*.json'):
            d = m.load(path)
            self.assertEqual(d['availability'], 'scoped_facts', path.name)
            self.assertTrue(d['facts'] or d['pins'] or d['constraints'], path.name)
            self.assertNotIn('unavailable', d)

    def test_reference_is_optional(self):
        self.d.pop('reference_applications')
        m.validate_device(self.d)

    def test_empty_knowledge_rejected_even_with_sources(self):
        for k in ['facts','pins','constraints']: self.d[k] = []
        self.d.pop('reference_applications')
        with self.assertRaisesRegex(ValueError, 'usable knowledge'): m.validate_device(self.d)

    def test_placeholder_rejected(self):
        self.d['unavailable'] = []
        with self.assertRaises(ValueError): m.validate_device(self.d)

    def test_replacement_has_distinct_identity(self):
        d = m.load(m.DATA/'parts/bq24040dsqr.json')
        self.assertEqual(d['provenance']['replaces'], 'tp4054')
        self.assertEqual(d['mpn'], 'BQ24040DSQR')
        self.assertFalse((m.DATA/'parts/tp4054.json').exists())
        m.validate_device(d)

    def test_pin_columns_not_interchanged(self):
        d = m.load(m.DATA/'parts/xc6206p332mr-g.json')
        self.assertEqual(d['pins'][0]['values']['2'], 'VOUT (Output)')
        self.assertEqual(d['sources'][d['pins'][0]['source_refs'][0]]['pdf_page'], 3)

if __name__ == '__main__': unittest.main()
