import json, os, re

base = r'c:\Users\csrni\OneDrive\Documents\Desktop\track mini'

# 1. Validate manifest JSON
with open(os.path.join(base, 'manifest.json')) as f:
    manifest = json.load(f)
print('MANIFEST OK')
print('  Name:', manifest['name'])
print('  MV:', manifest['manifest_version'])
print('  SW:', manifest['background']['service_worker'])
print('  Perms:', manifest['permissions'])

# 2. Check all manifest-referenced files exist
print('\nMANIFEST FILE REFERENCES')
refs = [
    manifest['background']['service_worker'],
    manifest['action']['default_popup'],
]
for script in manifest.get('content_scripts', []):
    refs.extend(script.get('js', []))
for size, path in manifest.get('icons', {}).items():
    refs.append(path)

ok = True
for ref in refs:
    full = os.path.join(base, ref.lstrip('/'))
    if '*' in ref:
        print('  SKIP (glob):', ref)
    elif os.path.exists(full):
        print('  OK:', ref)
    else:
        print('  MISSING:', ref)
        ok = False

# 3. Check for eval() in JS files
print('\nEVAL CHECK')
eval_found = False
for root, dirs, files in os.walk(base):
    for f in files:
        if not f.endswith('.js'): continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8', errors='ignore') as fp:
            content = fp.read()
        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if re.search(r'\beval\s*\(', stripped) and not stripped.startswith('//'):
                print('  FOUND:', path.replace(base,''), i, stripped[:80])
                eval_found = True
if not eval_found:
    print('  OK: No eval() found')

# 4. Count JS imports and verify they resolve
print('\nIMPORT RESOLUTION CHECK')
missing_imports = []
for root, dirs, files in os.walk(base):
    for f in files:
        if not f.endswith('.js'): continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8', errors='ignore') as fp:
            content = fp.read()
        for m in re.finditer(r"from\s+['\"](\.[^'\"]+)['\"]", content):
            rel_import = m.group(1)
            if not rel_import.endswith('.js'):
                rel_import += '.js'
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), rel_import))
            if not os.path.exists(resolved):
                missing_imports.append((path.replace(base,''), rel_import, resolved.replace(base,'')))

if missing_imports:
    print('  MISSING IMPORTS:')
    for src, imp, res in missing_imports:
        print('   ', src, '->', imp, '(resolved:', res, ')')
else:
    print('  OK: All imports resolve')

print('\nDone.')
