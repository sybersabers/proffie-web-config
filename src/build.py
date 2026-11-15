#!/usr/bin/env python3
"""src/ の部品を組み立てて、公開用の index.html を作る。
使い方：python3 src/build.py   （リポジトリのどこから実行してもよい）"""
from pathlib import Path
src = Path(__file__).resolve().parent
parts = ['i18n.js', 'core.js', 'preview.js', 'controls.js', 'app.js']
js = "'use strict';\n" + "\n".join((src / f).read_text(encoding='utf-8') for f in parts)
html = (src / 'shell.html').read_text(encoding='utf-8')
html = html.replace('/*__FONTS__*/', (src / 'fonts.css').read_text(encoding='utf-8')).replace('/*__SCRIPTS__*/', js)
(src.parent / 'index.html').write_text(html, encoding='utf-8')
print('built', src.parent / 'index.html', len(html), 'bytes')
