#!/usr/bin/env python3
"""Offline, standard-library checks for the small bundled Device Knowledge dataset."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import tarfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'skills/easyeda-agent/data/devices'
CATEGORIES = {'LDO', 'DC-DC', 'MCU', 'Battery Management', 'MOSFET'}
FORBIDDEN = re.compile(r'recommend|recommended_peripherals|建议|推荐', re.I)

def require(ok, message):
    if not ok:
        raise ValueError(message)

def load(path):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            require(key not in out, f'{path}: duplicate JSON key {key}')
            out[key] = value
        return out
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique)

def refs(value, sources):
    require(isinstance(value, list) and value and len(set(value)) == len(value), 'source_refs must be nonempty and unique')
    require(all(isinstance(x, str) and x in sources for x in value), 'unresolved source reference')

def no_recommendations(value):
    if isinstance(value, dict):
        for key, item in value.items():
            require(not FORBIDDEN.search(key), f'forbidden derived field: {key}')
            no_recommendations(item)
    elif isinstance(value, list):
        for item in value:
            no_recommendations(item)

def validate_device(d):
    required = {'schema_version','id','manufacturer','mpn','lcsc','category','availability','provenance','sources','facts','pins','constraints'}
    require(isinstance(d, dict) and required <= set(d) <= required | {'reference_applications'}, 'unexpected or missing device fields')
    require(d['schema_version'] == '0.1', 'unsupported schema version')
    require(all(isinstance(d[k], str) and d[k].strip() for k in ['id','manufacturer','mpn','lcsc','category']), 'missing identity')
    require(re.fullmatch(r'[a-z0-9][a-z0-9_.+-]*', d['id']), 'invalid id')
    require(re.fullmatch(r'C[0-9]+', d['lcsc']), 'invalid LCSC identifier')
    require(d['category'] in CATEGORIES, 'unknown category')
    require(d['availability'] == 'scoped_facts', 'invalid availability')
    sources = d['sources']
    require(isinstance(sources, dict) and bool(sources), 'sources must be an object')
    for s in sources.values():
        require(isinstance(s, dict), 'source must be an object')
        require(set(s) <= {'url','document','revision','pdf_page','printed_page','section','figure','document_sha256'}, 'unknown source fields')
        u = urlsplit(s.get('url', ''))
        require(u.scheme in {'http','https'} and bool(u.netloc), 'invalid source URL')
        require(type(s.get('pdf_page')) is int and s['pdf_page'] > 0, 'source needs positive PDF page; printed page is not a substitute')
        require(isinstance(s.get('document'), str) and s['document'].strip(), 'source needs document name')
        if 'printed_page' in s:
            require(type(s['printed_page']) in {str,int} and str(s['printed_page']).strip(), 'invalid printed page')
        if 'document_sha256' in s:
            require(re.fullmatch('[0-9a-f]{64}', s['document_sha256']), 'invalid document hash')
    count = 0
    for field in ['facts','pins','constraints']:
        require(isinstance(d[field], list), f'{field} must be an array')
        for group in d[field]:
            require(isinstance(group, dict) and {'values','source_refs'} <= set(group) <= {'values','source_refs','coverage'}, 'invalid fact group')
            require(isinstance(group['values'], dict) and bool(group['values']), 'empty fact group')
            no_recommendations(group['values'])
            refs(group['source_refs'], sources)
            count += 1
    require(isinstance(d.get('reference_applications', []), list), 'references must be an array')
    names = set()
    for app in d.get('reference_applications', []):
        require(set(app) == {'name','conditions','scope','source_refs','netlist','coverage'}, 'invalid reference application')
        require(isinstance(app['name'], str) and app['name'] and app['name'] not in names, 'duplicate/empty reference name')
        names.add(app['name'])
        refs(app['source_refs'], sources)
        require(isinstance(app['conditions'], dict), 'conditions must be an object')
        require(app['scope'] == ('documented_example' if app['conditions'] else 'topology_only'), 'unknown conditions require topology_only')
        require(isinstance(app['coverage'], str) and app['coverage'], 'reference needs scope boundary')
        no_recommendations(app['netlist'])
        no_recommendations(app['conditions'])
        net = app['netlist']
        require(set(net) == {'components','nets'}, 'netlist must contain components and nets')
        require(isinstance(net['components'], list) and net['components'], 'empty components')
        ids = [c['id'] for c in net['components']]
        require(len(set(ids)) == len(ids), 'duplicate component identity')
        require(isinstance(net['nets'], dict) and net['nets'], 'empty nets')
        endpoints = set()
        for members in net['nets'].values():
            require(isinstance(members, list) and members, 'empty net')
            for ep in members:
                require(isinstance(ep, str) and '.' in ep and ep.split('.',1)[0] in ids, 'unknown component endpoint')
                require(ep not in endpoints, 'duplicate endpoint across nets')
                endpoints.add(ep)
        count += 1
    require(count > 0, 'built-in entry must contain source-backed usable knowledge')
    p = d['provenance']
    require(isinstance(p, dict), 'invalid provenance')
    if 'replaces' in p:
        require(set(p) == {'identity_status','original_datasheet_url','identity_url','replaces'}, 'invalid replacement provenance')
        require(p['replaces'] and urlsplit(p['identity_url']).scheme == 'https', 'invalid replacement identity')
    else:
        require(set(p) == {'archive_sha256','member','identity_status','original_datasheet_url'}, 'invalid provenance')
        require(re.fullmatch('[0-9a-f]{64}', p['archive_sha256']), 'missing import hash')

def validate(data=DATA, archive=None):
    index = load(data / 'index.json')
    load(data / 'schema.json')
    require(index['schema_version'] == '0.1' and index['count'] == 50 and len(index['devices']) == 50, 'expected 50 indexed entries')
    ids, paths, counts = set(), set(), Counter()
    for item in index['devices']:
        require(item['id'] not in ids, 'duplicate index id')
        ids.add(item['id'])
        path = item['path']
        require(path == 'parts/' + item['id'] + '.json', 'unsafe/noncanonical entry path')
        d = load(data / path)
        validate_device(d)
        for key in ['id','mpn','manufacturer','lcsc','category','availability']:
            require(item[key] == d[key], f'index mismatch: {key}')
        paths.add(path)
        counts[d['category']] += 1
    require(counts == {c:10 for c in CATEGORIES} and dict(counts) == index['category_counts'], 'expected 10 per category')
    require(paths == {p.relative_to(data).as_posix() for p in (data/'parts').glob('*.json')}, 'unindexed/missing part')
    if archive:
        with tarfile.open(archive, 'r:gz') as tar:
            members = tar.getnames()
            require(len(members) == len(set(members)), 'duplicate archive members')
            for relative in paths | {'index.json','schema.json'}:
                f = tar.extractfile('easyeda-agent/data/devices/' + relative)
                require(f is not None and f.read() == (data/relative).read_bytes(), f'package mismatch: {relative}')
    return {'devices':50,'categories':dict(counts),'identity_only':sum(x['availability']=='identity_only' for x in index['devices'])}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(validate(archive=args.archive), ensure_ascii=False))
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f'Device Knowledge validation failed: {error}\n')
