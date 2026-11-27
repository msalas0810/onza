#!/usr/bin/env python3
"""Regenerate Onza CSS and the mathematical contrast audit (stdlib only)."""
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]


def outputs():
    tokens = json.loads((ROOT / 'design/tokens.json').read_text())
    def rules(theme):
        return '\n'.join(f'  --onza-{k}: {v};' for k, v in tokens['color'][theme].items())
    css = '/* Generated from tokens.json. Update JSON and run python3 scripts/generate-tokens.py. */\n'
    css += ':root {\n' + rules('light') + '\n'
    for key, value in tokens.get('access', {}).items():
        css += f'  --onza-access-{key}: {value};\n'
    for key, value in tokens.get('fixed', {}).items():
        css += f'  --onza-fixed-{key}: {value};\n'
    for group in ['space', 'radius', 'size']:
        for key, value in tokens[group].items():
            css += f'  --onza-{group}-{key}: {value}px;\n'
    for key, value in tokens.get('layout', {}).items():
        css += f'  --onza-layout-{key}: {value};\n'
    for key, values in tokens['type'].items():
        for field, value in values.items():
            unit = 'px' if field in ['size', 'line'] else ''
            css += f'  --onza-type-{key}-{field}: {value}{unit};\n'
    for key, value in tokens['motion'].items():
        unit = 'ms' if key != 'ease' else ''
        css += f'  --onza-motion-{key}: {value}{unit};\n'
    css += '  --onza-font: "InterVariable", ' + tokens['font']['fallback'] + ';\n  color-scheme: light;\n}\n'
    css += '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]):not([data-theme="dark"]) {\n' + rules('dark') + '\n  color-scheme: dark;\n  }\n}\n'
    css += ':root[data-theme="dark"] {\n' + rules('dark') + '\n  color-scheme: dark;\n}\n'
    css += ':root[data-theme="light"] { color-scheme: light; }\n'
    css += '@media (prefers-reduced-motion: reduce) {\n :root { --onza-motion-press: 0ms; --onza-motion-state: 0ms; --onza-motion-sheet: 0ms; --onza-motion-confirm: 0ms; --onza-motion-celebrate: 0ms; }\n}\n'
    def luminance(value):
        rgb = [int(value[i:i+2], 16) / 255 for i in [1, 3, 5]]
        linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in rgb]
        return sum(x * w for x, w in zip(linear, [.2126, .7152, .0722]))
    rows = []
    for theme, colors in tokens['color'].items():
        pairs = [(fg, bg, 4.5) for fg in ['text', 'text-muted', 'brand-text', 'success-text', 'warning-text', 'danger-text'] for bg in ['bg', 'surface', 'surface-raised']]
        pairs += [('on-brand', 'brand', 4.5), ('control-border', 'bg', 3), ('control-border', 'surface-raised', 3)]
        for fg, bg, minimum in pairs:
            low, high = sorted([luminance(colors[fg]), luminance(colors[bg])])
            ratio = (high + .05) / (low + .05)
            if ratio < minimum:
                raise ValueError(f'Insufficient contrast: {theme}/{fg}/{bg}: {ratio:.2f}')
            rows.append((theme, fg, bg, ratio, minimum))
    audit = '# Contraste de tokens\n\nAuditoría sRGB matemática; no sustituye revisión de la interfaz real.\n\n| Tema | Texto/control | Fondo | Ratio | Mínimo |\n| --- | --- | --- | --- | --- |\n'
    audit += ''.join(f'| {t} | {f} | {b} | {v:.2f}:1 | {m}:1 |\n' for t, f, b, v, m in rows)
    return {'design/tokens.css': css, 'design/contrast-audit.md': audit}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for filename, content in outputs().items():
        path = ROOT / filename
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit(f'Out of date: {filename}; run python3 scripts/generate-tokens.py')
        else:
            path.write_text(content)
    print('Tokens/CSS synchronized; 42 contrast pairs pass. This is not an application accessibility audit.')
