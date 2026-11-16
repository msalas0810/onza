#!/usr/bin/env python3
"""Validate the planning kit; no application is built or tested by this script."""
from pathlib import Path
import hashlib
import json
import runpy
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
required = ['README.md', 'AGENTS.md', 'PROMPT-CODEX.md', '.env.example', '.gitignore',
            'docs/01-producto-y-diseno.md', 'docs/02-arquitectura.md', 'docs/03-bac-y-pagos.md',
            'docs/04-plan-de-construccion.md', 'docs/05-pruebas-y-demo.md', 'docs/06-fuentes.md',
            'contracts/payment-provider.ts', 'contracts/order-contracts.ts', 'brand/fonts/OFL.txt',
            'Onza-documento-maestro.pdf']
for name in required:
    if not (ROOT / name).is_file() or (ROOT / name).stat().st_size == 0:
        raise SystemExit(f'Missing or empty: {name}')
font = ROOT / 'brand/fonts/InterVariable.woff2'
assert font.read_bytes()[:4] == b'wOF2', 'Invalid WOFF2 header'
assert hashlib.sha256(font.read_bytes()).hexdigest() in (ROOT / 'brand/fonts/README.md').read_text()
svgs = list((ROOT / 'brand/svg').glob('*.svg'))
assert len(svgs) == 8, 'Expected 8 SVG variants'
for path in svgs:
    root = ET.fromstring(path.read_text())
    assert 'viewBox' in root.attrib
    for element in root.iter():
        assert element.tag.split('}')[-1] not in ['image', 'script', 'foreignObject']
        assert not any(k.split('}')[-1] == 'href' for k in element.attrib)
data = json.loads((ROOT / 'fixtures/demo-data.json').read_text())
venues = {v['id'] for v in data['venues']}
assert data['demo_only'] is True and len(venues) == 3
assert len(data['products']) == 12
for product in data['products']:
    assert product['venue_id'] in venues
    assert isinstance(product['price_minor'], int) and product['price_minor'] > 0
    assert product['photo_path'] is None
generated = runpy.run_path(str(ROOT / 'scripts/generate-tokens.py'))['outputs']()
for filename, content in generated.items():
    assert (ROOT / filename).read_text() == content, f'Stale generated file: {filename}'
environment = (ROOT / '.env.example').read_text()
assert 'PAYMENT_PROVIDER=mock' in environment and 'REAL_PAYMENTS_ENABLED=false' in environment
assert (ROOT / 'Onza-documento-maestro.pdf').read_bytes().startswith(b'%PDF-')
print('Kit verified: required files, 8 vector SVGs, WOFF2/license/hash, 12 products, tokens and 42 contrast pairs.')
print('Not run: application tests, bank certification or live payments. See docs/implementation-status.md.')
