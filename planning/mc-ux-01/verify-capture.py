"""Verify the captured bytes and explicit design-manifest file references."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
capture = json.loads((Path(__file__).parent / 'capture.json').read_text())
bundle = root / capture['bundle_path']
expected = {entry['path']: entry for entry in capture['files']}
actual = {path.relative_to(bundle).as_posix() for path in bundle.rglob('*') if path.is_file()}
assert actual == set(expected), f'File inventory differs: {actual ^ set(expected)}'
for relative, entry in expected.items():
    data = (bundle / relative).read_bytes()
    assert len(data) == entry['bytes'], f'Byte count differs: {relative}'
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], f'SHA-256 differs: {relative}'
digest = hashlib.sha256(''.join(f"{e['path']}\0{e['sha256']}\0{e['bytes']}\n" for e in capture['files']).encode()).hexdigest()
assert digest == capture['inventory_sha256'], 'Inventory digest differs'
assert len(expected) == capture['file_count']
assert sum(e['bytes'] for e in expected.values()) == capture['total_bytes']
design = bundle / 'design'
handoff = design / 'handoff'
manifest = json.loads((handoff / 'index.json').read_text())
refs = [(design, manifest['brief']), (design, manifest['data']['file']), (design, manifest['design_system']['file'])]
for value in manifest['deliverables'].values():
    refs.extend((handoff, item) for item in (value if isinstance(value, list) else [value]))
for sheet in manifest['sheets']:
    refs.append((handoff, sheet['file']))
    if sheet['spec']:
        refs.append((handoff, sheet['spec']))
refs.extend((handoff, issue['file']) for issue in manifest['issues'])
refs.extend((handoff, manifest[key]) for key in ['open_questions', 'decisions'])
for base, relative in refs:
    path = (base / relative).resolve()
    assert path.is_relative_to(bundle.resolve()), f'Reference escapes capture: {relative}'
    assert path.is_file(), f'Missing design-manifest reference: {relative}'
print(f"PASS: {len(expected)} source files, {capture['total_bytes']} bytes, {len(refs)} manifest references; inventory SHA-256 {digest}")
print('LIMIT: integrity and file references only; browser interactions and production behavior remain unverified. See CAPTURE.md for known export gaps.')
