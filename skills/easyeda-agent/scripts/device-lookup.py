#!/usr/bin/env python3
"""Exact, post-selection Device Knowledge lookup. No candidate browsing."""
import argparse
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'data/devices'

def lookup(mpn=None, lcsc=None, data=DATA):
    if not mpn and not lcsc:
        raise ValueError('A selected exact MPN or LCSC ID is required')
    query = {k: v for k, v in [('mpn', mpn), ('lcsc', lcsc)] if v is not None}
    if any(not isinstance(v, str) or not v.strip() or len(v) > 200 for v in query.values()):
        raise ValueError('Invalid exact identity')
    index = json.loads((data / 'index.json').read_text(encoding='utf-8'))
    matches = [d for d in index['devices'] if all(d.get(k) == v for k, v in query.items())]
    if not matches:
        return {'found': False, 'query': query}
    if len(matches) != 1:
        raise ValueError('Ambiguous exact identity; specify both MPN and LCSC ID')
    item = matches[0]
    path = (data / item['path']).resolve()
    if path.parent != (data / 'parts').resolve() or path.suffix != '.json':
        raise ValueError('Invalid internal index path')
    device = json.loads(path.read_text(encoding='utf-8'))
    if any(device.get(k) != v for k, v in query.items()):
        raise ValueError('Internal index identity mismatch')
    return {'found': True, 'device': device}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mpn', help='Already selected exact manufacturer part number')
    parser.add_argument('--lcsc', help='Already selected exact LCSC identifier')
    args = parser.parse_args()
    try:
        print(json.dumps(lookup(args.mpn, args.lcsc), ensure_ascii=False))
    except (ValueError, OSError, KeyError) as error:
        parser.exit(2, str(error) + '\n')
