/* =====================================================================
 * 共通部品
 * ===================================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
function stamp(d = new Date()){ return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function fmtDate(d = new Date()){ return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
/** "Nov 14 2026 05:46:34"（ファームウェアのビルド日時）→ "2026/11/14 05:46:34" */
function fmtBuildDate(s){
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})\s+(\d{2}:\d{2}:\d{2})$/.exec((s || '').trim());
  if (!m) return s || '';
  const mon = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[1]) / 3 + 1;
  return mon > 0 ? `${m[3]}/${pad(mon)}/${pad(m[2])} ${m[4]}` : s;
}
function downloadText(name, text, bom = true){
  const blob = new Blob([bom ? '﻿' : '', text.replace(/\r?\n/g, '\r\n')], {type: 'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const store = {
  get(k, d){ try { const v = localStorage.getItem('pwc.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem('pwc.' + k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem('pwc.' + k); } catch {} },
  keys(prefix){ try { return Object.keys(localStorage).filter(k => k.startsWith('pwc.' + prefix)).map(k => k.slice(4)); } catch { return []; } }
};
function showDialog(title, body){ $('dlgTitle').textContent = title; $('dlgBody').textContent = body; $('dlg').showModal(); }
function toast(msg){
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/** 音量の上限（標準 1500、上限を外すと 3000） */
/** ツールの版（お問い合わせメールに入れる） */
const APP_VER = '1.0 (2026-11-15)';
/** お店の情報 */
const SHOP = {name: 'SYBER SABERS', url: 'https://sybersabers.com/', mail: ['info', 'sybersabers.com'], utm: 'utm_source=webconfig&utm_medium=referral&utm_campaign=proffie_web_config'};
const shopUrl = (path = '') => SHOP.url + path + (path.includes('?') ? '&' : '?') + SHOP.utm;
/** おすすめ商品（Amazon）。日本語表示のときだけ出す（Amazon.co.jp は海外から使えないため）。
 *  アソシエイトのリンクに差し替えたら AFFILIATE を true にすると「PR」表示とフッターの定型文が出る */
const AFFILIATE = false;
const REC = {sd: 'https://amzn.asia/d/0aTY8NEH', cable: 'https://amzn.asia/d/0aAqD7d0'};
const recLink = (key, label) => lang === 'ja'
  ? `<a class="reclink" href="${REC[key]}" target="_blank" rel="noopener${AFFILIATE ? ' sponsored' : ''}">${label}${AFFILIATE ? '<span class="pr">PR</span>' : ''}</a>`
  : '';
/** SD チェックの目安（同時に鳴らせる音の数）。仮の値：実測で調整する */
const SD_GOOD = 8, SD_OK = 4;
const VOL_SAFE = 1500, VOL_HARD = 3000;
function volColor(v){
  // 色は上限ではなく音量の値で決める：〜1000 通常、1500 でオレンジ、3000 で赤
  if (v == null || v <= 1000) return '';
  const hue = v <= 1500 ? 48 - 18 * (v - 1000) / 500 : 30 - 30 * Math.min(1, (v - 1500) / 1500);
  return `hsl(${Math.round(hue)}, 92%, 56%)`;
}

/** 電池残量％（ProffieOS の battery_percent と同じ式：4.1V=100%、2.85V=0%、電圧の2乗に比例） */
function battPct(v){
  if (v == null) return null;
  const lo = 2.85, hi = 4.1;
  return Math.round(100 * Math.max(0, Math.min(1, (v * v - lo * lo) / (hi * hi - lo * lo))));
}
/** 電池の目盛り（0〜4）。測定のむらで行ったり来たりしないよう、直近の中央値＋境目の余裕で決める */
const Batt = {
  hist: [], level: null,
  push(v){
    if (v == null) return;
    this.hist.push(v); if (this.hist.length > 5) this.hist.shift();
    const med = [...this.hist].sort((x, y) => x - y)[Math.floor(this.hist.length / 2)];
    const p = battPct(med), cuts = [10, 25, 50, 75], M = 5;
    const lv = x => cuts.filter(c => x > c).length;
    if (this.level == null) this.level = lv(p);
    else if (p > cuts[this.level] + M && this.level < 4) this.level = lv(p - M);    // 上がるのは境目を5%以上越えたとき
    else if (this.level > 0 && p < cuts[this.level - 1] - M) this.level = lv(p + M); // 下がるのも同様
    this.v = med;
  },
  reset(){ this.hist = []; this.level = null; }
};
/** スマートフォン風の4目盛り電池アイコン（％は出さない。電圧はマウスを乗せると表示） */
function battHtml(){
  if (Batt.level == null) return '―';
  const n = Batt.level, col = n >= 3 ? 'var(--ok)' : n === 2 ? 'var(--warn)' : 'var(--bad)';
  return `<span class="batt" title="${Batt.v.toFixed(2)} V"><span class="batt-body">${[0, 1, 2, 3].map(i =>
    `<i style="background:${i < n ? col : 'transparent'}"></i>`).join('')}</span><span class="batt-tip"></span></span>`;
}

/* =====================================================================
 * セーバーとの通信（Web Serial）
 *   Proffieboard: VID 0x1209
 *   返答の終わりは「#目印」行のエコーで判定（ProffieOS は # で始まる行をそのまま返す）
 * ===================================================================== */
const Proffie = {
  port: null, reader: null, writer: null, buf: '', readLoopDone: null, cancel: false, _seq: 0, _chain: Promise.resolve(),
  onChange: () => {},
  get connected(){ return !!this.port; },

  async connect(){
    let port;
    try { port = await navigator.serial.requestPort({filters: [{usbVendorId: 0x1209}]}); }
    catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
    await this.open(port);
    return true;
  },
  async open(port){
    try { await port.open({baudRate: 115200, bufferSize: 65536}); }
    catch (e) { const er = new Error(t('openFailBody')); er.title = t('openFail'); throw er; }
    try { await port.setSignals({dataTerminalReady: true, requestToSend: true}); } catch {}
    this.port = port; this.buf = '';
    this.writer = port.writable.getWriter();
    this.readLoopDone = this._readLoop();
    this.onChange();
  },
  async _readLoop(){
    const dec = new TextDecoder();
    while (this.port && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        while (true) {
          const {value, done} = await this.reader.read();
          if (done) break;
          this.buf += dec.decode(value, {stream: true});
          if (this._wake) { const w = this._wake; this._wake = null; w(); }   // 返事を待っている query をすぐ起こす
        }
      } catch { break; }
      finally { try { this.reader.releaseLock(); } catch {} this.reader = null; }
    }
  },
  async disconnect(){
    const port = this.port; if (!port) return;
    this.port = null;
    try { if (this.reader) await this.reader.cancel(); } catch {}
    try { await Promise.race([this.readLoopDone, sleep(1500)]); } catch {}   // 読み取りが止まらなくても先へ進む
    try { this.writer.releaseLock(); } catch {}
    this.writer = null;
    try { await port.close(); } catch {}
    this.onChange();
  },
  async write(s){
    if (!this.writer) throw new Error(t('lost'));
    await this.writer.write(new TextEncoder().encode(s));
  },
  /** シリアルを使う処理を1つずつ順番に実行 */
  run(fn){ const p = this._chain.then(fn, fn); this._chain = p.catch(() => {}); return p; },
  /** コマンドを送り、直後に送った #目印 が返るまでを返答とする */
  async query(cmd, {timeoutMs = 8000} = {}){
    const tag = `#PWC${(++this._seq).toString(36)}${Date.now().toString(36).slice(-4)}`;
    const mark = this.buf.length;
    await this.write(`${cmd}\n${tag}\n`);
    const start = Date.now();
    let text, timedOut = false;
    while (true) {
      if (!this.port) throw new Error(t('lost'));
      const i = this.buf.indexOf(tag, mark);
      if (i >= 0) { text = this.buf.slice(mark, i); this.buf = this.buf.slice(i + tag.length).replace(/^\r?\n/, ''); break; }
      if (Date.now() - start > timeoutMs) { text = this.buf.slice(mark); this.buf = ''; timedOut = true; break; }
      // 受信したらすぐ続きへ（決まった間隔で待たない）。切断などに備えて 50ms で見直す
      await Promise.race([new Promise(r => { this._wake = r; }), sleep(50)]);
    }
    text = text.replace(/\r/g, '').replace(/^-\+=(BEGIN|END)_OUTPUT=\+-\n?/gm, '').replace(/^Style RAM = \d+\n?/gm, '');
    return {text, whut: /^Whut\? :/m.test(text), timedOut};
  },
  /** 受信が静かになるまで待つ */
  async settle(quietMs = 400){
    let len = this.buf.length, since = Date.now();
    while (Date.now() - since < quietMs) { await sleep(50); if (this.buf.length !== len) { len = this.buf.length; since = Date.now(); } }
    this.buf = '';
  }
};

/* =====================================================================
 * 返答の解析
 * ===================================================================== */
const PP = {
  unescape(v){ return v.replace(/\\(.)/g, (m, c) => c === 'n' ? '\n' : c === 't' ? '\t' : c); },
  presets(text){
    const out = []; let cur = null;
    for (const line of text.split('\n')) {
      const m = /^([A-Z]+\d*)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const [, k, raw] = m, v = this.unescape(raw);
      if (k === 'FONT') { cur = {font: v, track: '', styles: [], name: '', variation: 0}; out.push(cur); }
      if (!cur) continue;
      if (k === 'TRACK') cur.track = v;
      else if (/^STYLE\d+$/.test(k)) cur.styles[+k.slice(5) - 1] = v;
      else if (k === 'NAME') cur.name = v;
      else if (k === 'VARIATION') cur.variation = +v || 0;
    }
    return out;
  },
  version(text){
    const r = {version: '', config: '', prop: '', buttons: '', installed: ''};
    for (const l of text.split('\n').map(s => s.trim()).filter(Boolean)) {
      let m;
      if ((m = /^prop:\s*(.*)$/.exec(l))) r.prop = m[1];
      else if ((m = /^buttons:\s*(.*)$/.exec(l))) r.buttons = m[1];
      else if ((m = /^installed:\s*(.*)$/.exec(l))) r.installed = m[1];
      else if (/\.h$/.test(l)) r.config = l;
      else if (!r.version) r.version = l;
    }
    return r;
  },
  /** 数値だけの行（最後のもの）を採用。途中に別メッセージが混ざっても読み違えない */
  number(res){
    if (res.whut || res.timedOut) return null;
    const ls = res.text.split('\n').map(x => x.trim()).filter(x => /^-?\d+(\.\d+)?$/.test(x));
    return ls.length ? +ls[ls.length - 1] : null;
  },
  lines(res){ return res.whut || res.timedOut ? null : res.text.split('\n').map(s => s.trim()).filter(Boolean); },
  style(s){
    const w = (s || '').trim().split(/\s+/);
    if (w[0] !== 'builtin') return {builtin: null, args: [], raw: s};
    return {builtin: {preset: +w[1], blade: +w[2]}, args: [null, ...w.slice(3)], raw: s};
  },
  buildStyle(s, changes){
    const st = this.style(s), args = st.args.slice(1);
    for (const [k, v] of Object.entries(changes)) { while (args.length < +k) args.push('~'); args[+k - 1] = v; }
    while (args.length && args[args.length - 1] === '~') args.pop();
    return ['builtin', st.builtin.preset, st.builtin.blade, ...args].join(' ');
  },
  /** describe_named_style → [, {type, def}, ...]。引数の行（COLOR / INT / VOID）だけ拾う */
  describe(text){
    const lines = text.split('\n').map(l => l.trim()).filter(l => /^(COLOR|INT|VOID)( |$)/.test(l));
    if (lines.length < 2) return null;
    const items = lines.map(l => { const i = l.indexOf(' '); return i < 0 ? {type: l, def: ''} : {type: l.slice(0, i), def: l.slice(i + 1).trim()}; });
    return [null, ...items.slice(2)];
  },
  color16(v){
    const m = /^(\d+),(\d+),(\d+)$/.exec(v || '');
    if (!m) return null;
    const c = x => Math.max(0, Math.min(255, Math.round(+x / 257)));
    return {r: c(m[1]), g: c(m[2]), b: c(m[3])};
  },
  hex(v){ const c = this.color16(v); return c ? '#' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('') : '#000000'; },
  from8(r, g, b){ return [r, g, b].map(x => x * 257).join(','); },
  fromHex(h){ const n = parseInt(h.slice(1), 16); return this.from8((n >> 16) & 255, (n >> 8) & 255, n & 255); }
};
