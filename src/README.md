# ソース

`index.html` はこのフォルダの部品から組み立てたものです。直接編集せず、ここを直してから組み立ててください。

```
python3 src/build.py
```

| ファイル | 中身 |
|---|---|
| `shell.html` | 画面の骨組みと CSS（HUD テーマ） |
| `fonts.css` | 埋め込みフォント（Chakra Petch / Share Tech Mono、OFL） |
| `i18n.js` | 日本語・英語の文言 |
| `core.js` | 共通処理、シリアル通信（Web Serial）、応答の解析 |
| `preview.js` | ブレードのプレビュー |
| `controls.js` | 操作表（Fett263） |
| `app.js` | 画面と各機能 |
