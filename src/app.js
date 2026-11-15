/** エフェクトを別のプリセットから選ぶ欄。ややこしいため、いったん非表示（true で復活） */
const SHOW_FX_SELECT = false;

/* =====================================================================
 * アプリ本体
 * ===================================================================== */
const App = {
  data: null, raw: [], busy: false, tab: 'presets', sel: 0, checked: new Set(), descCache: {},
  openDetails: new Set(), cfgOverride: null, sheetPresets: true, backedUp: false, advanced: false, form: null, dirty: false, linkBlades: true, volUnlocked: false, batTimer: null, live: false,

  /* ---------------- 起動 ---------------- */
  init(){
    lang = store.get('lang', (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en');
    // 上級者モードは非公開。URL の末尾に #advanced を付けて開いたときだけ使える（お店のサポート用）
    const advOk = /advanced/i.test(location.hash + location.search);
    this.advanced = advOk && store.get('advanced', false);
    $('advLabel').style.display = advOk ? '' : 'none';
    $('langSel').value = lang;
    $('langSel').onchange = () => { lang = $('langSel').value; store.set('lang', lang); this.renderAll(); };
    $('advToggle').checked = this.advanced;
    $('advToggle').onchange = () => { this.advanced = $('advToggle').checked; store.set('advanced', this.advanced); this.renderAll(); };
    $('btnConnect').onclick = () => this.connect();
    $('btnDisconnect').onclick = () => Proffie.disconnect();
    $('dlgOk').onclick = () => $('dlg').close();
    $('mailLink').onclick = e => { e.preventDefault(); this.openMail(); };
    Proffie.onChange = () => { if (!Proffie.connected) { this.live = false; clearInterval(this.batTimer); } this.renderAll(); };
    window.addEventListener('beforeunload', e => { if (this.busy) { e.preventDefault(); e.returnValue = t('leaveWarn'); } });
    this.renderAll();
    if ('serial' in navigator) {
      navigator.serial.addEventListener('disconnect', e => {
        if (Proffie.port === e.target) { Proffie.port = null; this.live = false; clearInterval(this.batTimer); this.renderAll(); if (!this.rebooting) toast(t('unplugged')); }
      });
      // 以前に許可したセーバーがつながっていれば、自動で接続して読み込む
      navigator.serial.getPorts().then(async ports => {
        const p = ports.find(x => x.getInfo().usbVendorId === 0x1209);
        if (p && !Proffie.connected) { try { await Proffie.open(p); await this.readWithBoot(); } catch { this.bootEnd(false); } }
      }).catch(() => {});
    }
  },

  async connect(){
    try {
      if (!(await Proffie.connect())) { this.openTrouble(); showDialog(t('noBoard'), t('noBoardBody')); return; }
      await this.readWithBoot();
    } catch (e) { this.bootEnd(false); this.openTrouble(); showDialog(e.title || t('error'), e.message); }
  },
  openTrouble(){ const d = $('trouble'); if (d) d.open = true;
  },

  async q(cmd, opt){
    if (Proffie.cancel) throw new Error('__cancel__');
    const t0 = performance.now();
    const r = await Proffie.query(cmd, opt);
    this.raw.push({cmd, text: r.text, whut: r.whut, timedOut: r.timedOut, at: Date.now(), ms: Math.round(performance.now() - t0)});
    if (this.raw.length > 600) this.raw.splice(0, this.raw.length - 600);
    return r;
  },

  /* ---------------- 処理中の表示 ---------------- */
  setBusy(on){ this.busy = on; document.body.classList.toggle('is-busy', on); if (!on) $('progress').hidden = true; this.renderHeader(); },
  progress(label, i, n){
    if (this.boot) this.bootUpdate(label, i, n);
    $('progress').hidden = false;
    $('progLabel').textContent = n ? `${label}… ${i} / ${n}` : `${label}…`;
    $('progBar').style.width = n ? `${Math.round(i / n * 100)}%` : '100%';
    $('progress').classList.toggle('indeterminate', !n);
  },

  /* ---------------- 初回接続のロード画面 ---------------- */
  async readWithBoot(){
    const first = !this.data;
    if (first) this.bootStart();
    await this.read();
    await this.bootEnd(first && this.live && !!this.data);
  },
  bootStart(){
    this.boot = {pct: 0};
    document.body.classList.add('booting');
    $('bootFill').style.width = '0%'; $('bootPct').textContent = '0'; $('bootStep').textContent = 'LINK ESTABLISHED'; $('bootSub').textContent = '';
    const el = $('boot'); el.classList.remove('out'); el.classList.add('on');
  },
  /** 読み込みの段階 → 進み具合（%）と表示する英字 */
  bootUpdate(label, i, n){
    if (!this.boot) return;
    const M = [['waiting', 4, 'LINK ESTABLISHED'], ['reading', 10, 'READ VERSION'], ['waitingSd', 14, 'WAITING FOR SD CARD'], ['readingPresets', 28, 'SYNC PRESETS'],
      ['readingSettings', 44, 'READ SETTINGS'], ['readingSd', 58, 'SCAN FONTS / TRACKS'], ['readingStyles', 66, 'READ STYLES'], ['reloadingFont', 96, 'RELOAD FONT']];
    const m = M.find(x => label === t(x[0]) || label.startsWith(t(x[0])));
    if (!m) return;
    let pct = m[1], step = m[2];
    if (m[0] === 'readingStyles' && n) { pct = 66 + Math.round(28 * i / n); step += ` ${String(i).padStart(2, '0')}/${String(n).padStart(2, '0')}`; }
    if (m[0] === 'readingPresets' && this.boot.n) step += ` ${String(this.boot.n).padStart(2, '0')}`;
    this.boot.pct = Math.max(this.boot.pct, pct);
    $('bootFill').style.width = this.boot.pct + '%'; $('bootPct').textContent = this.boot.pct; $('bootStep').textContent = step;
  },
  async bootEnd(ok){
    if (!this.boot) return;
    const el = $('boot');
    if (ok) {
      $('bootFill').style.width = '100%'; $('bootPct').textContent = '100'; $('bootStep').textContent = 'READY';
      await sleep(380);
      document.body.classList.add('reveal');
      setTimeout(() => document.body.classList.remove('reveal'), 600);
    }
    el.classList.add('out'); el.classList.remove('on');
    document.body.classList.remove('booting');
    this.boot = null;
    setTimeout(() => el.classList.remove('out'), 400);
  },

  /* ---------------- 読み込み ---------------- */
  async read(){
    if (this.busy) return;
    this.setBusy(true); Proffie.cancel = false; this.backedUp = false;
    const d = {readAt: fmtDate(), board: null, settings: {}, presets: [], fonts: null, tracks: null, blades: [], gestures: null, battery: null};
    try {
      await Proffie.run(async () => {
        this.progress(t('waiting'));
        const tRead = performance.now();
        await Proffie.settle(200);
        this.progress(t('reading'));
        const ver = await this.q('version', {timeoutMs: 5000});
        if (ver.timedOut || !ver.text.trim()) { const e = new Error(t('noReplyBody')); e.title = t('noReply'); throw e; }
        d.board = PP.version(ver.text);
        if (this.boot) $('bootSub').textContent = `${(d.board.config || '').split('/').pop()} // ProffieOS ${d.board.version}`;
        const sd = await this.waitSd(), sdWaited = sd.waited;
        this.progress(t('readingPresets'));
        await this.readPresets(d);
        this.progress(t('readingSettings'));
        const s = d.settings;
        s.volume = PP.number(await this.q('get_volume'));
        const pending = store.get('pendingVolume', null);
        if (pending > 0 && s.volume === 0) { await this.q(`set_volume ${Math.min(pending, VOL_SAFE)}`); s.volume = Math.min(pending, VOL_SAFE); toast(t('volRestored', {v: s.volume})); }
        store.set('pendingVolume', null);
        s.clash = PP.number(await this.q('get_clash_threshold'));
        s.dimming = PP.number(await this.q('get_blade_dimming'));
        d.battery = PP.number(await this.q('battery_voltage'));
        Batt.reset(); Batt.push(d.battery);
        const nb = Math.max(0, ...d.presets.map(p => p.styles.length));
        for (let b = 1; b <= nb; b++) d.blades.push({blade: b, length: PP.number(await this.q(`get_blade_length ${b}`)), max: PP.number(await this.q(`get_max_blade_length ${b}`))});
        const g0 = await this.q(`get_gesture ${GESTURES[0].key}`);
        if (!g0.whut) {
          d.gestures = {[GESTURES[0].key]: PP.number(g0)};
          for (const g of GESTURES.slice(1)) d.gestures[g.key] = PP.number(await this.q(`get_gesture ${g.key}`));
        }
        this.progress(t('readingSd'));
        d.fonts = PP.lines(sd.fonts);                 // SD の確認で読んだ一覧をそのまま使う（2回読まない）
        d.tracks = PP.lines(await this.q('list_tracks', {timeoutMs: 30000}));
        // スタイルの既定値はファームウェアで決まるので、同じファームなら前回読んだものを使う
        this.descKey = 'desc.' + (d.board.config || '') + '|' + (d.board.installed || '');
        this.descCache = store.get(this.descKey, null) || {};
        await this.loadDescribes(d);
        d.on = PP.number(await this.q('get_on'));
        this.note(`read: ${Math.round(performance.now() - tRead)} ms`);
        // 起動時に SD を読めなかった場合、今のプリセットのフォントが読み込まれていないので読み込み直す
        if (sdWaited && d.settings.preset >= 0) {
          this.progress(t('reloadingFont'));
          await this.q(`set_preset ${d.settings.preset}`);
          await sleep(2500);
        }
      });
      this.data = d; this.live = true;
      if (d.on != null) Preview.setState(d.on === 1);
      this.sel = Math.min(d.settings.preset ?? 0, d.presets.length - 1); this.checked.clear();
      this.loadForm();
      this.startBattery();
      this.renderAll();
      this.setStatus(() => t('readDone', {t: d.readAt.slice(11)}));
    } catch (e) {
      if (e.message === '__cancel__') toast(t('cancelled'));
      else showDialog(e.title || t('error'), e.message);
    } finally { this.setBusy(false); this.renderAll(); }
  },
  /** SD カードが使えるまで待つ（再起動直後はパソコンが SD をドライブとして読みにいくため、しばらく使えない） */
  /** 終わりの時間がわからない待ち用のゲージ（最初は速く、だんだんゆっくり。95% で止まる） */
  gauge(label){
    const t0 = Date.now(), bar = $('progBar');
    const draw = p => { if (this.boot) this.bootUpdate(label); $('progress').hidden = false; $('progress').classList.remove('indeterminate'); bar.style.width = p + '%'; $('progLabel').textContent = `${label}… ${p}%`; };
    const tick = () => draw(Math.min(95, Math.round(100 * (1 - Math.exp(-(Date.now() - t0) / 25000)))));
    tick();
    const id = setInterval(tick, 200);
    return async done => { clearInterval(id); if (done) { draw(100); await sleep(500); } };
  },
  async waitSd(maxMs = 120000){
    const t0 = Date.now();
    let stop = null;
    try {
      while (true) {
        const r = await this.q('list_fonts', {timeoutMs: 30000});
        if (!/Failed to mount SD card|SD card is busy/i.test(r.text)) { if (stop) await stop(true); return {waited: !!stop, fonts: r}; }
        if (!stop) stop = this.gauge(t('waitingSd'));
        if (Date.now() - t0 > maxMs) { const e = new Error(t('sdBusyBody')); e.title = t('sdBusy'); throw e; }
        // 確認が続くと SD の初期化が終わらず回復しないため、間を十分にあける
        await sleep(12000);
      }
    } finally { if (stop) stop(false); }
  },
  async readPresets(d){
    const lp = await this.q('list_presets', {timeoutMs: 30000});
    if (lp.timedOut) throw new Error(t('stopTimeout'));
    d.presets = PP.presets(lp.text);
    d.settings.preset = PP.number(await this.q('get_preset'));
    d.settings.variation = PP.number(await this.q('get_variation'));
  },
  async loadDescribes(d){
    const keys = [];
    for (const p of d.presets) for (const s of p.styles) {
      const st = PP.style(s);
      if (st.builtin) { const k = `${st.builtin.preset} ${st.builtin.blade}`; if (!(k in this.descCache) && !keys.includes(k)) keys.push(k); }
    }
    for (let i = 0; i < keys.length; i++) {
      this.progress(t('readingStyles'), i + 1, keys.length);
      const r = await this.q(`describe_named_style builtin ${keys[i]}`);
      this.descCache[keys[i]] = r.whut ? null : PP.describe(r.text);
    }
    if (keys.length && this.descKey) {
      for (const k of store.keys('desc.')) if (k !== this.descKey) store.del(k);   // 古いファームの分は消す
      store.set(this.descKey, this.descCache);
    }
  },
  startBattery(){
    clearInterval(this.batTimer);
    this.batTimer = setInterval(async () => {
      if (!this.live || this.busy) return;
      try {
        const v = PP.number(await Proffie.run(() => Proffie.query('battery_voltage', {timeoutMs: 2000})));
        if (v != null && this.data) { this.data.battery = v; Batt.push(v); const el = $('batVal'); if (el) el.innerHTML = battHtml(); }
      } catch {}
    }, 15000);
  },

  /* ---------------- 変更（共通） ---------------- */
  backupSig(){ const d = this.data; return JSON.stringify([d.board.config, d.presets, d.settings.volume, d.settings.clash, d.settings.dimming, d.blades, d.gestures]); },
  backupText(memo){
    const d = this.data;
    let x = `# Proffie Web Config backup\n# saved: ${fmtDate()}\n# config: ${d.board.config} / ProffieOS: ${d.board.version}\n` + (memo ? `# memo: ${memo.replace(/\n/g, ' ')}\n` : '');
    x += `\n## settings\nvolume=${d.settings.volume}\nclash_threshold=${d.settings.clash}\nblade_dimming=${d.settings.dimming}\n` +
      d.blades.map(b => `blade_length${b.blade}=${b.length}`).join('\n') + '\n' +
      (d.gestures ? Object.entries(d.gestures).map(([k, v]) => `gesture.${k}=${v}`).join('\n') + '\n' : '');
    x += `\n## presets (${d.presets.length})\n` + d.presets.map(p =>
      `FONT=${p.font}\nTRACK=${p.track}\n${p.styles.map((s, i) => `STYLE${i + 1}=${s}`).join('\n')}\nNAME=${p.name.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')}\nVARIATION=${p.variation}`).join('\n') + '\n';
    return x;
  },
  fileBase(){ return `${(this.data.board.config || 'proffie').split('/').pop().replace(/\.h$/, '').replace(/[\\/:*?"<>|\s]/g, '_')}_${stamp()}`; },
  backups(){ return store.get('backups', []); },
  storeBackups(list){ let a = 0; store.set('backups', list.filter(b => b.manual || ++a <= 5).slice(0, 40)); },
  autoBackup(){
    if (this.backedUp) return;
    this.backedUp = true;
    const sig = this.backupSig(), list = this.backups();
    if (list.length && list[0].sig === sig) return;
    list.unshift({at: fmtDate(), config: this.data.board.config, count: this.data.presets.length, sig, text: this.backupText(), file: `backup_auto_${this.fileBase()}.txt`});
    this.storeBackups(list);
  },
  manualBackup(){
    const memo = prompt(t('memoPrompt'), '');
    if (memo === null) return;
    const text = this.backupText(memo.trim());
    const safe = memo.trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
    const file = `backup_${this.fileBase()}${safe ? '_' + safe : ''}.txt`;
    const list = this.backups();
    list.unshift({at: fmtDate(), config: this.data.board.config, count: this.data.presets.length, sig: this.backupSig(), text, file, memo: memo.trim(), manual: true});
    this.storeBackups(list);
    downloadText(file, text);
    this.render();
  },

  /** コマンド列を実行してプリセットを読み直す。切り替えを伴う場合は処理中だけ音量0（font.wav のノイズ防止） */
  async change(label, cmdsFn, {reload = true, backup = true} = {}){
    if (!this.live || this.busy) return false;
    this.setBusy(true); Proffie.cancel = false;
    let ok = false;
    try {
      if (backup) this.autoBackup();
      const bad = [];
      await Proffie.run(async () => {
        const cmds = await cmdsFn();
        const vol = this.data.settings.volume;
        const mute = vol > 0 && cmds.some(c => /^(change_preset|set_preset|move_preset|duplicate_preset) /.test(c) || c === 'delete_preset');
        if (mute) { store.set('pendingVolume', vol); await this.q('set_volume 0'); }
        try {
          for (let k = 0; k < cmds.length; k++) {
            this.progress(label, k, cmds.length);
            if (cmds[k].startsWith('@expect ')) {
              const want = +cmds[k].slice(8), got = PP.number(await this.q('get_preset'));
              if (got !== want) throw new Error(t('stopWrong'));
              continue;
            }
            const r = await this.q(cmds[k], {timeoutMs: 20000});
            if (r.timedOut) throw new Error(t('stopTimeout'));
            if (/Failed to mount SD card/i.test(r.text)) { const e = new Error(t('sdBusyBody')); e.title = t('sdBusy'); throw e; }
            if (r.whut) bad.push(cmds[k].split(' ')[0]);
          }
          if (reload) {
            this.progress(t('readingPresets'));
            await this.readPresets(this.data);
            await this.loadDescribes(this.data);
          }
        } finally {
          if (mute) {
            const sv = cmds.filter(c => c.startsWith('set_volume ')).pop();
            const back = sv ? +sv.slice(11) : vol;
            await this.q(`set_volume ${back}`).catch(() => {});
            this.data.settings.volume = back;
            store.set('pendingVolume', null);
          }
        }
      });
      ok = true;
      const at = fmtDate().slice(11);
      this.setStatus(() => bad.length ? `${t('someUnsupported')}${P().l}${bad.join(', ')}${P().r}` : t('savedAt', {t: at}));
    } catch (e) {
      showDialog(e.title || t('error'), e.message === '__cancel__' ? t('cancelled') : e.message);
    } finally {
      this.setBusy(false);
      this.loadForm();
      this.render();
    }
    return ok;
  },
  sel_(i){ return [`change_preset ${i}`, `@expect ${i}`]; },

  /* ---------------- プリセット操作 ---------------- */
  selectPreset(i){
    if (i === this.sel) return;
    if (this.dirty && !confirm(t('confirmUnsaved'))) return;
    this.sel = i; this.loadForm(); this.render();
  },
  async switchTo(i){
    if (!this.live || this.busy) return;
    if (i !== this.sel && !this.dirty) { this.sel = i; this.loadForm(); }
    this.setBusy(true);
    try {
      await Proffie.run(async () => {
        this.progress(t('opSwitch'));
        const r = await this.q(`set_preset ${i}`);
        if (/Failed to mount SD card/i.test(r.text)) { const e = new Error(t('sdBusyBody')); e.title = t('sdBusy'); throw e; }
        await sleep(2500);                          // font.wav が鳴り終わるまで重い通信をしない
        this.data.settings.preset = PP.number(await this.q('get_preset'));
        this.data.settings.variation = PP.number(await this.q('get_variation'));
        const on = PP.number(await this.q('get_on'));
        if (on != null) Preview.setState(on === 1);
      });
    } catch (e) { showDialog(e.title || t('error'), e.message); }
    finally { this.setBusy(false); this.render(); }
  },
  moveTo(from, to){
    const n = this.data.presets.length;
    to = Math.max(0, Math.min(n - 1, to));            // 範囲外だと ProffieOS がプリセットを消すので必ず範囲内
    if (to === from) return;
    if (this.dirty && !confirm(t('confirmUnsaved'))) return;
    this.sel = to;
    return this.change(t('opMove'), async () => [...this.sel_(from), `move_preset ${to}`]);
  },
  duplicate(i){
    if (this.dirty && !confirm(t('confirmUnsaved'))) return;
    this.sel = i + 1;
    return this.change(t('opDup'), async () => [...this.sel_(i), `duplicate_preset ${i + 1}`, `set_preset ${i + 1}`]);
  },
  deletePresets(list){
    const d = this.data, n = d.presets.length;
    const del = [...new Set(list)].filter(i => i < n).sort((a, b) => b - a);
    if (!del.length) return;
    if (del.length >= n) { showDialog(t('error'), t('cantDeleteAll')); return; }
    const names = del.slice().reverse().map(i => `${i + 1}. ${d.presets[i].name}`);
    if (!confirm(t('confirmDelete', {n: del.length, list: names.slice(0, 15).join('\n') + (names.length > 15 ? '\n…' : '')}))) return;
    const cur = d.settings.preset ?? 0, below = del.filter(i => i < cur).length;
    const newCur = Math.max(0, Math.min(cur - below, n - del.length - 1));
    this.checked.clear(); this.sel = Math.min(this.sel, n - del.length - 1);
    return this.change(t('opDelete'), async () => [...del.flatMap(i => [...this.sel_(i), 'delete_preset']), `set_preset ${newCur}`]);
  },
  unnamed(){ return this.data.presets.map((p, i) => ({p, i})).filter(({p}) => !p.name || p.name === '0' || /^Preset: \d+$/.test(p.name)); },
  fontLabel(p){ return (p.font || '').split(';')[0].split('/').pop(); },
  autoName(){
    const list = this.unnamed();
    if (!confirm(t('confirmAutoName', {n: list.length, ex: list.slice(0, 3).map(({p}) => this.fontLabel(p)).join(', ')}))) return;
    const back = this.data.settings.preset ?? 0;
    return this.change(t('opAutoName'), async () => [...list.flatMap(({p, i}) => [...this.sel_(i), `set_name ${this.fontLabel(p) || 'Preset ' + (i + 1)}`]), `set_preset ${back}`]);
  },

  /* ---------------- ブレードの名前 ---------------- */
  /** Fett263：フォント（と common）の tracks フォルダに曲があると、トラックプレイヤーはそちらを使う。
   *  プリセットの BGM が鳴るのは「BGM 再生」（真上に向けて）のときだけ */
  trackNote(font){
    const d = this.data;
    if (!d.tracks || !/fett263/i.test(d.board.prop || '')) return '';
    const dirs = (font || '').split(';').filter(Boolean).map(x => x.toLowerCase() + '/tracks/');
    const n = d.tracks.filter(x => dirs.some(p => x.toLowerCase().startsWith(p))).length;
    return n ? t('trackNote', {n}) : '';
  },

  bladeName(b){   // b は 1 始まり：LED1、LED2 …
    const bl = this.data.blades.find(x => x.blade === b), n = bl && bl.max;
    return t('blade', {n: b}) + (n ? `${P().l}${n} LED${P().r}` : '');
  },

  /* ---------------- 編集フォーム ---------------- */
  descOf(p, b){ const st = PP.style(p.styles[b]); return st.builtin ? this.descCache[`${st.builtin.preset} ${st.builtin.blade}`] : null; },
  /** ブレード b の引数一覧：{no, type, value(今の値), def(既定値), set(明示指定されているか)} */
  argsOf(p, b){
    const st = PP.style(p.styles[b]), desc = this.descOf(p, b);
    if (!st.builtin || !desc) return [];
    const out = [];
    for (let k = 1; k < desc.length; k++) {
      const dd = desc[k];
      if (!dd || dd.type === 'VOID') continue;
      const set = st.args[k] != null && st.args[k] !== '~' ? st.args[k] : null;
      out.push({no: k, type: dd.type, value: set ?? dd.def, def: dd.def, set: set != null});
    }
    return out;
  },
  loadForm(){
    const p = this.data && this.data.presets[this.sel];
    if (!p) { this.form = null; this.dirty = false; return; }
    this.form = {name: p.name, font: p.font, track: p.track, variation: this.sel === this.data.settings.preset ? (this.data.settings.variation ?? p.variation) : p.variation,
      args: p.styles.map((_, b) => Object.fromEntries(this.argsOf(p, b).map(a => [a.no, a.set ? a.value : '~']))), raw: p.styles.slice(), fx: p.styles.map(() => null)};
    this.dirty = false;
  },
  setDirty(){ this.dirty = true; const bar = $('saveBar'); if (bar) bar.classList.add('dirty'); ['btnSave', 'btnRevert'].forEach(id => { const el = $(id); if (el) el.disabled = false; }); },
  /** 色・数値の変更をフォームに反映（全ブレード連動ならほかのブレードにも） */
  setArg(b, k, v){
    const p = this.data.presets[this.sel];
    const targets = this.linkBlades ? p.styles.map((_, x) => x) : [b];
    for (const x of targets) if (x === b || this.argsOf(p, x).some(a => a.no === k)) this.form.args[x][k] = v;
    this.setDirty();
  },
  /** LED b のエフェクトを key（"P B" ＝ ファーム内の builtin スタイル）に変える。色（COLOR）は今の見た目のまま引き継ぐ */
  fxStyle(p, b, key){
    const [P, B] = key.split(' ').map(Number), desc = this.descCache[key], ch = {};
    if (desc) for (const a of this.argsOf(p, b)) {
      if (a.type !== 'COLOR' || !desc[a.no] || desc[a.no].type !== 'COLOR') continue;
      ch[a.no] = this.effective(b, a.no);
    }
    return PP.buildStyle(`builtin ${P} ${B}`, ch);
  },
  /** LED b で選べるエフェクトの一覧。名前は「そのエフェクトを使っているプリセット」で表す */
  fxSources(p, b){
    const keys = new Map(), blade = (PP.style(p.styles[b]).builtin || {}).blade ?? b + 1;
    const add = k => { if (!keys.has(k)) keys.set(k, []); };
    this.data.presets.forEach((q, j) => {
      const st = PP.style(q.styles[b]).builtin;
      if (st && st.blade === blade) { add(`${st.preset} ${st.blade}`); keys.get(`${st.preset} ${st.blade}`).push(`${j + 1}. ${q.name}`); }
    });
    // 今はどのプリセットも使っていないが、ファームに入っているエフェクト（読み込み済みのもの）
    for (const k of Object.keys(this.descCache)) if (this.descCache[k] && +k.split(' ')[1] === blade) add(k);
    return [...keys].sort((x, y) => +x[0].split(' ')[0] - +y[0].split(' ')[0])
      .map(([key, users]) => ({key, label: users.length ? users.join(' / ') : t('fxUnused', {n: +key.split(' ')[0] + 1})}));
  },
  effective(b, k){ const p = this.data.presets[this.sel], a = this.argsOf(p, b).find(x => x.no === k); const v = this.form.args[b][k]; return v === '~' || v == null ? (a ? a.def : '') : v; },
  buildSaveCmds(){
    const i = this.sel, p = this.data.presets[i], f = this.form, cmds = [];
    if (f.name.trim() && f.name.trim() !== p.name) cmds.push(`set_name ${f.name.trim()}`);
    if (f.font !== p.font) cmds.push(`set_font ${f.font}`);
    if (f.track !== p.track && f.track) cmds.push(`set_track ${f.track}`);
    p.styles.forEach((s, b) => {
      let ns = s;
      const rawEdited = this.advanced && f.raw[b].replace(/\s+/g, ' ').trim() !== s.trim();
      if (rawEdited) ns = f.raw[b].replace(/\s+/g, ' ').trim();
      else if (f.fx[b] != null) ns = this.fxStyle(p, b, f.fx[b]);
      else if (PP.style(s).builtin) {
        const ch = {};
        for (const a of this.argsOf(p, b)) {
          const v = f.args[b][a.no];
          const cur = a.set ? a.value : '~';
          if (v !== cur && !(v !== '~' && !a.set && v === a.def)) ch[a.no] = v;
        }
        if (Object.keys(ch).length) ns = PP.buildStyle(s, ch);
      }
      if (ns && ns !== s) cmds.push(`set_style${b + 1} ${ns}`);
    });
    const reload = cmds.some(c => /^set_(font|track|style)/.test(c));
    if (this.advanced && +f.variation !== +(this.sel === this.data.settings.preset ? this.data.settings.variation : p.variation)) cmds.push(`variation ${parseInt(f.variation, 10) || 0}`);
    if (!cmds.length) return [];
    return [...this.sel_(i), ...cmds, ...(reload ? [`set_preset ${i}`] : [])];
  },
  async save(){
    const cmds = this.buildSaveCmds();
    if (!cmds.length) { toast(t('noChanges')); this.loadForm(); this.render(); return; }
    await this.change(t('opSave'), async () => cmds);
  },

  /* ---------------- 操作・設定 ---------------- */
  async action(cmd){
    if (!this.live || this.busy) return;
    try {
      const r = await Proffie.run(() => Proffie.query(cmd));
      if (r.whut) toast(t('notAvailable'));
    } catch (e) { showDialog(t('error'), e.message); }
  },
  async setVolume(v){
    if (!this.live) return;
    v = Math.max(0, Math.min(this.volUnlocked ? VOL_HARD : VOL_SAFE, Math.round(v)));
    await Proffie.run(() => Proffie.query(`set_volume ${v}`)).catch(() => {});
    this.data.settings.volume = v;
  },
  async saveSettings(){
    const d = this.data, s = d.settings, cmds = [];
    const c = parseFloat(($('setClash') || {}).value);
    if (s.clash != null && c > 0 && Math.abs(c - s.clash) > 1e-6) cmds.push(`set_clash_threshold ${c}`);
    const dm = $('setDim');
    if (s.dimming != null && dm) { const v = Math.round(Math.max(5, Math.min(100, +dm.value)) / 100 * 16384); if (Math.abs(v - s.dimming) > 82) cmds.push(`set_blade_dimming ${v}`); }
    document.querySelectorAll('.setLen').forEach(el => {
      const b = d.blades.find(x => x.blade === +el.dataset.b), v = parseInt(el.value, 10);
      const cur = b.length == null || b.length < 0 ? b.max : b.length;
      if (v > 0 && v !== cur) cmds.push(`set_blade_length ${b.blade} ${Math.min(v, b.max ?? v)}`);
    });
    document.querySelectorAll('.setG').forEach(el => {
      const k = el.dataset.k, v = el.type === 'checkbox' ? (el.checked ? 1 : 0) : parseInt(el.value, 10);
      if (!isNaN(v) && v !== d.gestures[k]) cmds.push(`set_gesture ${k} ${v}`);
    });
    if (!cmds.length) { toast(t('noChanges')); return; }
    const ok = await this.change(t('opSettings'), async () => cmds, {reload: false});
    if (ok) await this.refreshSettings();
  },
  async refreshSettings(){
    const d = this.data, s = d.settings;
    await Proffie.run(async () => {
      s.volume = PP.number(await this.q('get_volume'));
      s.clash = PP.number(await this.q('get_clash_threshold'));
      s.dimming = PP.number(await this.q('get_blade_dimming'));
      for (const b of d.blades) b.length = PP.number(await this.q(`get_blade_length ${b.blade}`));
      if (d.gestures) for (const g of GESTURES) d.gestures[g.key] = PP.number(await this.q(`get_gesture ${g.key}`));
    }).catch(() => {});
    this.render();
  },

  /* ---------------- バックアップから戻す ---------------- */
  parseBackup(text){
    text = text.replace(/\r/g, '');
    const num = k => { const m = new RegExp('^' + k.replace('.', '\\.') + '=(-?[\\d.]+)$', 'm').exec(text); return m ? +m[1] : null; };
    const b = {presets: PP.presets(text), volume: num('volume'), clash: num('clash_threshold'), dimming: num('blade_dimming'), gestures: {}, lengths: {}};
    for (const g of GESTURES) { const v = num('gesture.' + g.key); if (v != null) b.gestures[g.key] = v; }
    for (const m of text.matchAll(/^blade_length(\d+)=(-?\d+)$/gm)) b.lengths[+m[1]] = +m[2];
    const c = /^# config: (.*?) \//m.exec(text); b.config = c ? c[1] : '';
    return b;
  },
  planRestore(b){
    const d = this.data, T = b.presets, C = JSON.parse(JSON.stringify(d.presets)), cmds = [];
    const ident = p => p.styles.map(x => x.trim().split(/\s+/).slice(0, 3).join(' ')).join('|');
    const same = (x, y) => x.font === y.font && x.track === y.track && x.name === y.name && x.variation === y.variation && x.styles.join('\n') === y.styles.join('\n');
    for (let k = 0; k < T.length; k++) {
      const tp = T[k];
      let j = C.findIndex((c, x) => x >= k && same(c, tp));
      if (j < 0) j = C.findIndex((c, x) => x >= k && ident(c) === ident(tp));
      if (j < 0) {
        let src = C.findIndex(c => ident(c) === ident(tp)); if (src < 0) src = 0;
        cmds.push(...this.sel_(src), `duplicate_preset ${k}`, `@expect ${k}`);
        C.splice(k, 0, JSON.parse(JSON.stringify(C[src])));
      } else if (j !== k) {
        cmds.push(...this.sel_(j), `move_preset ${k}`, `@expect ${k}`);
        C.splice(k, 0, C.splice(j, 1)[0]);
      } else if (!same(C[k], tp)) cmds.push(...this.sel_(k));
      const c = C[k];
      if (c.font !== tp.font) cmds.push(`set_font ${tp.font}`);
      if (c.track !== tp.track && tp.track) cmds.push(`set_track ${tp.track}`);
      if (c.name !== tp.name && tp.name) cmds.push(`set_name ${tp.name}`);
      tp.styles.forEach((st, x) => { if (c.styles[x] !== st) cmds.push(`set_style${x + 1} ${st}`); });
      if (c.variation !== tp.variation) cmds.push(`variation ${tp.variation}`);
      C[k] = JSON.parse(JSON.stringify(tp));
    }
    while (C.length > T.length) { cmds.push(...this.sel_(T.length), 'delete_preset'); C.splice(T.length, 1); }
    if (cmds.length) cmds.push(`set_preset ${Math.min(d.settings.preset ?? 0, T.length - 1)}`);
    const s = d.settings;
    const bv = b.volume != null ? Math.min(b.volume, VOL_SAFE) : null;
    if (bv != null && s.volume != null && bv !== s.volume) cmds.push(`set_volume ${bv}`);
    if (b.clash != null && s.clash != null && b.clash !== s.clash) cmds.push(`set_clash_threshold ${b.clash}`);
    if (b.dimming != null && s.dimming != null && b.dimming !== s.dimming) cmds.push(`set_blade_dimming ${b.dimming}`);
    for (const bl of d.blades) {
      const want = b.lengths[bl.blade];
      if (want == null || bl.length == null || want === bl.length) continue;
      const v = want > 0 ? want : bl.max;
      if (v > 0) cmds.push(`set_blade_length ${bl.blade} ${v}`);
    }
    if (d.gestures) for (const [k, v] of Object.entries(b.gestures)) if (d.gestures[k] != null && d.gestures[k] !== v) cmds.push(`set_gesture ${k} ${v}`);
    return cmds;
  },
  async restore(text, label){
    if (!this.live || this.busy) return;
    const b = this.parseBackup(text), d = this.data;
    if (!b.presets.length) { showDialog(t('error'), t('restoreBad')); return; }
    if (b.presets[0].styles.length !== d.presets[0].styles.length) { showDialog(t('error'), t('restoreBladeMismatch')); return; }
    const cmds = this.planRestore(b), real = cmds.filter(c => !c.startsWith('@'));
    if (!real.length) { showDialog(t('restoreThis'), t('restoreSame')); return; }
    if (!confirm(t('confirmRestore', {label, bn: b.presets.length, bc: b.config, cn: d.presets.length, cc: d.board.config, n: real.length,
      warn: b.config && b.config !== d.board.config ? t('restoreOtherConfig') : ''}))) return;
    this.backedUp = false;
    if (!(await this.change(t('opRestore'), async () => cmds))) return;
    await this.refreshSettings();
    const key = p => [p.font, p.track, p.name, p.styles.join('|')].join('\n');
    const ok = this.data.presets.length === b.presets.length && this.data.presets.every((p, i) => key(p) === key(b.presets[i]));
    if (ok) { const n = b.presets.length; this.setStatus(() => t('restoreOk', {n})); }
    else showDialog(t('restoreThis'), t('restoreCheck'));
  },
  async factoryReset(){
    if (!this.live || this.busy) return;
    const w = {presets: $('frP').checked, global: $('frG').checked, gesture: $('frX') ? $('frX').checked : false};
    const files = [];
    if (w.presets) files.push('presets.ini', 'presets.tmp', 'curstate.ini', 'curstate.tmp');
    if (w.global) files.push('global.ini', 'global.tmp');
    if (w.gesture) files.push('gesture.ini', 'gesture.tmp');
    if (!files.length) return;
    const items = [w.presets && t('frPresets'), w.global && t('frGlobal'), w.gesture && t('frGesture')].filter(Boolean);
    if (!confirm(t('confirmFactory', {items: items.map(x => P().b + x).join('\n')}))) return;
    this.backedUp = false; this.autoBackup();
    this.setBusy(true);
    try {
      await Proffie.run(async () => { for (let k = 0; k < files.length; k++) { this.progress(t('opFactory'), k, files.length); await this.q(`del ${files[k]}`); } });
    } catch (e) { showDialog(t('error'), e.message); }
    finally { this.setBusy(false); }
    // ProffieOS は読み込んだ presets.ini の場所をメモリに覚えているので、消したら必ず再起動する（しないと空のプリセットを読む）
    await this.reboot();
  },

  /** 診断用：通信ログにメモを残す */
  note(msg){ this.raw.push({cmd: '# ' + msg, text: '', whut: false, timedOut: false, at: Date.now()}); },
  /** reset を送って再接続する（1回分） */
  async resetOnce(){
    try { await Proffie.write('reset\n'); } catch {}
    await sleep(400);
    await Proffie.disconnect().catch(() => {});
    await sleep(2500);
    for (let i = 0; i < 25; i++) {
      const p = (await navigator.serial.getPorts()).find(x => x.getInfo().usbVendorId === 0x1209);
      if (p) { try { await Proffie.open(p); await sleep(1500); await Proffie.settle(); return true; } catch {} }
      await sleep(600);
    }
    return false;
  },
  async sdOk(){ const r = await this.q('list_fonts', {timeoutMs: 30000}); return !/Failed to mount SD card|SD card is busy/i.test(r.text); },
  /** セーバーを再起動して、自動で再接続・読み込み。再起動後に SD を読めなければ、もう一度再起動を試す */
  async reboot(){
    if (!Proffie.connected) return;
    this.rebooting = true; this.live = false;
    this.setBusy(true);
    try {
      this.progress(t('rebooting'));
      // ボードが SD を手放す（Unmounting SD Card）のを待ってから再起動する
      const mark = Proffie.buf.length, t0 = Date.now();
      await sleep(2000);
      while (Date.now() - t0 < 15000 && !/Unmounting SD Card/i.test(Proffie.buf.slice(mark))) await sleep(200);
      this.note(`pre-reset wait ${Date.now() - t0}ms, unmount seen=${/Unmounting SD Card/i.test(Proffie.buf.slice(mark))}`);
      let connected = false, sd = false;
      for (let n = 1; n <= 3 && !sd; n++) {
        this.note(`reset #${n}`);
        this.progress(t('rebooting'), n, 3);
        connected = await this.resetOnce();
        if (!connected) break;
        sd = await this.sdOk();
        this.note(`after reset #${n}: sd ok=${sd}`);
      }
      this.setBusy(false);
      if (connected) { await this.read(); if (this.live) toast(t('rebooted')); }
      else showDialog(t('powerCycle'), t('reconnectBody'));
    } finally { this.rebooting = false; this.setBusy(false); this.renderAll(); }
  },

  /* =====================================================================
   * 表示
   * ===================================================================== */
  /** タイトル横の状態表示。言語を切り替えたら作り直せるように、文章ではなく作り方を覚えておく */
  setStatus(fn){ this.statusFn = fn; $('status').textContent = fn ? fn() : ''; },
  renderAll(){ document.documentElement.lang = lang; this.renderStatic(); this.renderHeader(); this.render(); if (this.statusFn) this.setStatus(this.statusFn); },
  renderStatic(){
    document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = t(el.dataset.t); });
    const s = $('shopLink'); if (s) s.href = shopUrl();
    const a = $('affNote'); if (a) { a.hidden = !(AFFILIATE && lang === 'ja'); a.textContent = t('affNote'); }
  },
  /** お問い合わせ：アドレスはページに文字で置かず、押したときに組み立てる（収集対策） */
  openMail(){
    const d = this.data, b = d && d.board, ua = navigator.userAgentData;
    const browser = ua && ua.brands ? ua.brands.filter(x => !/Not/.test(x.brand)).map(x => `${x.brand} ${x.version}`).join(', ') + ` / ${ua.platform}` : navigator.userAgent;
    const info = ['', '', '----', `Proffie Web Config ${APP_VER}`, `ProffieOS: ${b ? b.version : '-'}`, `Config: ${b ? b.config : '-'}`, `Prop: ${b ? b.prop : '-'}`, `Browser: ${browser}`, `Language: ${lang}`];
    location.href = `mailto:${SHOP.mail.join('@')}?subject=${encodeURIComponent(t('mailSubject'))}&body=${encodeURIComponent(t('mailBody') + info.join('\n'))}`;
  },
  renderHeader(){
    const on = Proffie.connected;
    $('connDot').classList.toggle('on', on);
    $('connLabel').textContent = on ? t('connected') : t('notConnected');
    $('btnConnect').hidden = on || !this.data; $('btnDisconnect').hidden = !on;
    $('btnDisconnect').disabled = this.busy;
  },

  render(){
    const main = $('main');
    if (!('serial' in navigator)) { main.innerHTML = `<section class="card warn-card"><h2>${t('unsupported')}</h2><p class="pre">${esc(t('unsupportedBody'))}</p></section>`; return; }
    if (!this.data) { main.innerHTML = this.welcomeHtml(); const b = $('btnConnect2'); if (b) b.onclick = () => this.connect(); return; }
    const d = this.data, tabs = [['presets', t('tabPresets')], ['settings', t('tabSettings')], ['controls', t('tabControls')], ['sd', t('tabSd')], ['backup', t('tabBackup')]];
    let h = '';
    if (!this.live) h += `<div class="banner">${esc(Proffie.connected ? t('needReboot') : t('lost'))} <button class="btn small" id="btnReconnect">${Proffie.connected ? t('reboot') : t('connect')}</button></div>`;
    h += `<section class="board"><div><b>${esc(d.board.config.split('/').pop() || 'Proffieboard')}</b><span>${esc(d.board.version)} · ${esc(d.board.prop)} · ${t('buttonsN', {n: esc(d.board.buttons)})}</span></div>
      <div class="board-r"><span>${t('built')} ${esc(fmtBuildDate(d.board.installed))}</span><span>${t('battery')} <span id="batVal">${battHtml()}</span></span>
      <button class="btn small" id="btnReload" ${this.live && !this.busy ? '' : 'disabled'}>${t('reload')}</button>
      <button class="btn small" id="btnReboot" ${Proffie.connected && !this.busy ? '' : 'disabled'} title="${t('rebootHint')}">⟳ ${t('reboot')}</button></div></section>`;
    h += `<nav class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${this.tab === k ? 'active' : ''}">${l}</button>`).join('')}</nav>`;
    h += `<div class="tabbody ${this.live || this.tab === 'controls' ? '' : 'locked'}">` + ({presets: () => this.presetsHtml(), settings: () => this.settingsHtml(), controls: () => this.controlsHtml(), sd: () => this.sdHtml(), backup: () => this.backupHtml()}[this.tab])() + '</div>';
    main.innerHTML = h;
    this.bind();
  },

  stepsHtml(){ return `<ol class="steps">${['step2', 'step3', 'step4'].map(k => `<li><span>${t(k)}</span></li>`).join('')}</ol>`; },
  troubleHtml(){ return `<ul class="trouble"><li>${t('trouble1')} ${recLink('cable', t('recCable'))}</li><li>${t('trouble2')}</li><li>${t('trouble4')}</li><li>${t('trouble3')}</li></ul>`; },
  welcomeHtml(){
    return `<section class="welcome">
      <div class="w-left">
        <div class="mono hint">AWAITING DEVICE // USB SERIAL</div>
        <div class="w-ring">
          <svg viewBox="0 0 420 420" aria-hidden="true" fill="none">
            <circle cx="210" cy="210" r="205" stroke="rgba(55,226,255,.15)"/>
            <circle class="r1" cx="210" cy="210" r="190" stroke="#37e2ff" stroke-opacity=".35" stroke-dasharray="2 8"/>
            <circle class="r2" cx="210" cy="210" r="168" stroke="#37e2ff" stroke-width="3" stroke-dasharray="120 40 30 40 200 60"/>
            <circle class="r1" cx="210" cy="210" r="146" stroke="#2a8cff" stroke-opacity=".6" stroke-width="10" stroke-dasharray="4 10"/>
            <circle cx="210" cy="210" r="124" fill="rgba(6,16,28,.7)" stroke="rgba(55,226,255,.4)"/>
            <circle class="r3" cx="210" cy="210" r="132" stroke="#ff9a3c" stroke-width="2" stroke-dasharray="26 800"/>
            <path d="M210 0v30M210 390v30M0 210h30M390 210h30" stroke="#37e2ff" stroke-opacity=".6"/>
            <text x="210" y="104" text-anchor="middle" font-family="PWC Mono, monospace" font-size="11" letter-spacing="2" fill="#7fa8bf">SCAN 0x1209</text>
            <text x="210" y="330" text-anchor="middle" font-family="PWC Mono, monospace" font-size="11" letter-spacing="2" fill="#7fa8bf">PROFFIEBOARD V2 / V3</text>
          </svg>
          <button class="cta" id="btnConnect2">CONNECT</button>
        </div>
        <p class="presented mono">PRESENTED BY <a href="${shopUrl()}" target="_blank" rel="noopener">${SHOP.name}</a></p>
      </div>
      <div class="w-right">
        <div><div class="mono w-kick">PROFFIEBOARD // WEB SERIAL</div><h1 class="w-title">${t('wTitle')}</h1><p class="w-sub">${t('wSub')}</p></div>
        <div class="mono hint">SETUP SEQUENCE</div>
        <div class="hud">${this.stepsHtml()}</div>
        <details class="hud trouble-card" id="trouble"><summary class="tt">${t('troubleTitle')}</summary>${this.troubleHtml()}</details>
      </div></section>`;
  },
  swatch(v, cls = ''){ const c = PP.color16(v); return c ? `<span class="sw ${cls}" style="background:rgb(${c.r},${c.g},${c.b})"></span>` : `<span class="sw sw-none ${cls}"></span>`; },
  mainColors(p){ return p.styles.map((_, b) => { const a = this.argsOf(p, b).find(x => x.no === 1); return this.swatch(a ? a.value : null); }).join(''); },

  presetsHtml(){
    const d = this.data, cur = d.settings.preset, un = this.unnamed().length;
    let h = '';
    if (un) h += `<div class="notice">${t('unnamedN', {n: un})} <button class="btn small" id="btnAutoName">${t('autoName')}</button></div>`;
    h += `<div class="pgrid"><div class="plist-wrap"><div class="plist-head"><b>${t('presetCount', {n: d.presets.length})}</b><span class="hint">${t('presetsHint')}</span></div>`;
    if (this.checked.size) h += `<div class="bulk"><b>${t('selectedN', {n: this.checked.size})}</b><button class="btn small danger" id="btnBulkDel">${t('deleteSelected')}</button><button class="btn small" id="btnBulkClr">${t('clearSel')}</button></div>`;
    h += '<div class="plist">' + d.presets.map((p, i) => `<div class="pitem${i === this.sel ? ' sel' : ''}${this.checked.has(i) ? ' chk' : ''}" data-i="${i}" draggable="${this.live}">
        <input type="checkbox" class="pchk" data-i="${i}" ${this.checked.has(i) ? 'checked' : ''}><span class="num">${i + 1}</span>${this.mainColors(p)}
        <span class="nm">${esc(p.name)}</span>${i === cur ? `<span class="badge" title="${t('nowPlaying')}">${t('current')}</span>` : `<button class="rowplay" data-play="${i}" title="${t('playOnSaber')}">▶</button>`}</div>`).join('') + '</div></div>';
    h += `<div class="rightcol">${this.previewHtml()}<div class="editor">${this.editorHtml()}</div></div></div>`;
    return h;
  },

  editorHtml(){
    const d = this.data, i = this.sel, p = d.presets[i], f = this.form;
    if (!p || !f) return '';
    const n = d.presets.length, parts = (f.font || '').split(';');
    const fontOpts = [...new Set([parts[0], ...(d.fonts || [])])].filter(Boolean);
    const trackOpts = [...new Set([f.track, ...(d.tracks || [])])].filter(Boolean);
    const fontOk = !d.fonts || parts[0].includes('/') || d.fonts.some(x => x.toLowerCase() === parts[0].toLowerCase());
    const trackOk = !d.tracks || !f.track || d.tracks.some(x => x.toLowerCase() === f.track.toLowerCase());
    const AN = ARG_NAMES[lang] || ARG_NAMES.ja;
    let h = `<div class="ed-head"><h2><span class="num">${i + 1}</span>${esc(p.name)}</h2>
      ${i === d.settings.preset ? `<span class="badge">${t('current')}</span>` : ''}</div>
      <div class="ed-tools">
        <button class="btn small" id="btnUp" ${i === 0 ? 'disabled' : ''}>↑ ${t('moveUp')}</button>
        <button class="btn small" id="btnDown" ${i === n - 1 ? 'disabled' : ''}>↓ ${t('moveDown')}</button>
        <span class="moveto"><input type="number" id="moveNum" min="1" max="${n}" value="${i + 1}"><button class="btn small" id="btnMove">${t('moveTo')}</button></span>
        <span class="sp"></span>
        <button class="btn small" id="btnDup">${t('duplicate')}</button>
        <button class="btn small danger" id="btnDel" ${n <= 1 ? 'disabled' : ''}>${t('delete')}</button></div>
      <div class="fields">
        <label>${t('name')}<input type="text" id="fName" value="${esc(f.name)}" maxlength="40"></label>
        <label>${t('font')}<select id="fFont">${fontOpts.map(x => `<option${x === parts[0] ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
          ${fontOk ? '' : `<small class="warn">${t('notOnSd')}</small>`}</label>
        <label>${t('track')}<select id="fTrack">${trackOpts.map(x => `<option${x === f.track ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
          ${trackOk ? '' : `<small class="warn">${t('notOnSd')}</small>`}<small class="hint" id="fTrackNote">${this.trackNote(f.font)}</small></label>
        ${this.advanced ? `<label>${t('variation')}<input type="number" id="fVar" value="${esc(f.variation)}" step="1"><small>${t('variationHint')}</small></label>` : ''}
      </div>
      <h3>${t('bladeColors')}</h3>`;
    if (p.styles.length > 1) h += `<label class="chk"><input type="checkbox" id="fLink" ${this.linkBlades ? 'checked' : ''}> ${t('linkBlades')}</label>`;
    p.styles.forEach((s, b) => {
      const args = this.argsOf(p, b), main = args.find(a => a.no === 1 && a.type === 'COLOR');
      const fx = args.filter(a => a.type === 'COLOR' && a.no !== 1), ints = args.filter(a => a.type === 'INT');
      const bl = this.data.blades.find(x => x.blade === b + 1);
      h += `<div class="blade"><div class="blade-h"><b>${esc(t('blade', {n: b + 1}))}</b>${bl && bl.max ? `<span class="hint">${bl.max} LED</span>` : ''}</div>`;
      const cur = PP.style(s).builtin, curKey = cur ? `${cur.preset} ${cur.blade}` : '', srcs = cur ? this.fxSources(p, b) : [];
      const selKey = f.fx[b] ?? curKey;
      if (SHOW_FX_SELECT && srcs.length > 1) h += `<div class="fxrow"><span class="k">${t('fxFrom')}</span><select class="fFx" data-b="${b}">${srcs.map(o => `<option value="${o.key}"${o.key === selKey ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        ${selKey !== curKey ? `<small class="hint">${t('fxNote')}</small>` : ''}</div>`;
      if (!PP.style(s).builtin || (!args.length && !this.descOf(p, b))) h += `<p class="hint">${PP.style(s).builtin ? t('needStyles') : t('noColor')}</p>`;
      else if (!main && !fx.length) h += `<p class="hint">${t('noColor')}</p>`;
      if (main) h += this.colorRow(b, main, t('mainColor'), true);
      const op = k => this.openDetails.has(k) ? ' open' : '';
      if (fx.length) h += `<details class="fx" data-key="fx${b}"${op('fx' + b)}><summary>${t('effectColors')}</summary>${fx.map(a => this.colorRow(b, a, (COLOR_SHORT[lang] || COLOR_SHORT.ja)[a.no] || AN[a.no] || `#${a.no}`, false)).join('')}</details>`;
      if (this.advanced && ints.length) h += `<details class="fx" data-key="int${b}"${op('int' + b)}><summary>${t('otherArgs')}</summary><div class="ints">${ints.map(a =>
        `<label>${esc(AN[a.no] || '#' + a.no)}<input type="number" class="fInt" data-b="${b}" data-k="${a.no}" value="${esc(this.effective(b, a.no))}"></label>`).join('')}</div></details>`;
      if (this.advanced) h += `<details class="fx" data-key="raw${b}"${op('raw' + b)}><summary>${t('rawStyle')}</summary><textarea class="fRaw" data-b="${b}">${esc(f.raw[b])}</textarea></details>`;
      h += '</div>';
    });
    h += `<div class="savebar${this.dirty ? ' dirty' : ''}" id="saveBar"><span class="unsaved">${t('unsaved')}</span>
      <button class="btn" id="btnRevert" ${this.dirty ? '' : 'disabled'}>${t('revert')}</button>
      <button class="btn primary" id="btnSave" ${this.dirty ? '' : 'disabled'}>${t('saveChanges')}</button></div>`;
    return h;
  },
  colorRow(b, a, label, big){
    const v = this.effective(b, a.no), isDef = this.form.args[b][a.no] === '~' || v === a.def;
    return `<div class="crow${big ? ' big' : ''}"><span class="clabel">${esc(label)}</span>
      ${true ? `<span class="pal${big ? '' : ' sm'}">${PALETTE.map(c => { const v16 = PP.from8(...c.rgb); return `<button class="pchip${v16 === v ? ' on' : ''}" data-b="${b}" data-k="${a.no}" data-v="${v16}" title="${esc(L(c))}" style="background:rgb(${c.rgb})"></button>`; }).join('')}</span>` : ''}
      <label class="cpick" title="${t('custom')}"><input type="color" class="fColor" data-b="${b}" data-k="${a.no}" value="${PP.hex(v)}"></label>
      ${isDef ? '' : `<button class="btn tiny fDef" data-b="${b}" data-k="${a.no}" title="${t('resetDefault')}">↺</button>`}</div>`;
  },

  /** プレビュー＋エフェクト＋音量＋BGM（プリセット画面の上部） */
  previewHtml(){
    const d = this.data, s = d.settings, max = this.volUnlocked ? VOL_HARD : VOL_SAFE, active = this.sel === s.preset;
    const acts = [['on', 'actOn'], ['off', 'actOff'], ['clash', 'actClash'], ['blast', 'actBlast'], ['stab', 'actStab'], ['force', 'actForce'],
      ['lock', 'actLock', 1], ['drag', 'actDrag', 1], ['lb', 'actLb', 1], ['melt', 'actMelt', 1], ['quote', 'actQuote']];
    return `<section class="pv card"><div class="pv-head"><h3>${t('previewTitle')}</h3>
        <button class="btn small ${active ? '' : 'primary'}" id="btnFontSound">${active ? t('fontSound') : t('switchHere')}</button></div>
      <div class="cvwrap"><span class="cv-l mono">BLADE.SIM // LED1</span><canvas id="saberCv" width="900" height="110"></canvas></div>
      <div class="acts" id="actsBox">${acts.map(([c, k, tg]) => `<button class="btn small act" data-act="${c}">${t(k)}${tg ? ` <small>${lang === 'ja' ? '(入/切)' : '(on/off)'}</small>` : ''}</button>`).join('')}</div>
      <p class="hint">${active ? t('activeHint') : `<span class="warn">${t('notActiveHint')}</span>`}　${t('previewNote')}</p>
      <div class="pv-row">
        <div class="vol"><span class="k">${t('volume')}</span>${s.volume == null ? `<span class="hint">${t('notAvailable')}</span>` :
          `<input type="range" id="vol" min="0" max="${max}" step="50" value="${Math.min(s.volume, max)}" style="accent-color:${volColor(s.volume, max) || 'var(--accent)'}"><b id="volVal" style="color:${volColor(s.volume, max)}">${s.volume}</b><span class="hint">/ ${max}</span>`}</div>
        <div class="bgm"><span class="k">${t('track')}</span><select id="trackSel">${(d.tracks || []).map(x => `<option${x === (d.presets[this.sel] || {}).track ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
          <button class="btn small" id="btnPlay">${t('play')}</button><button class="btn small" id="btnStopT">${t('stop')}</button></div>
      </div>
      ${s.volume != null ? `<label class="chk small"><input type="checkbox" id="volUnlock" ${this.volUnlocked ? 'checked' : ''}> ${t('volUnlock')}</label>` : ''}
      ${s.volume > VOL_SAFE && !this.volUnlocked ? `<p class="warn">${t('volOver', {v: s.volume})}</p>` : ''}</section>`;
  },
  /** エフェクトボタンの見た目を今の状態に合わせる（点灯中・消灯中・入/切中を光らせる） */
  updateActs(){
    document.querySelectorAll('#actsBox [data-act]').forEach(b => {
      const c = b.dataset.act, on = Preview.on;
      let active = false, dim = false;
      if (c === 'on') active = on;
      else if (c === 'off') active = !on;
      else if (Preview.LOCKUPS.includes(c)) { active = Preview.lockType === c; dim = !on; }
      else dim = !Preview.canDo(c);
      b.classList.toggle('act-on', active); b.classList.toggle('act-dim', dim);
    });
  },
  /** プレビュー用の色（編集中の値をそのまま反映） */
  previewColors(){
    const p = this.data && this.data.presets[this.sel];
    if (!p || !this.form) return null;
    const rgb = v => { const c = PP.color16(v); return c ? [c.r, c.g, c.b] : null; };
    const val = (b, k) => { const a = this.argsOf(p, b).find(x => x.no === k); return a ? rgb(this.effective(b, k)) : null; };
    const num = (b, k, def) => { const a = this.argsOf(p, b).find(x => x.no === k); const v = a ? parseInt(this.effective(b, k), 10) : NaN; return isNaN(v) || v <= 0 ? def : v; };
    return {base: val(0, 1), clash: val(0, 10), blast: val(0, 9), lockup: val(0, 11), drag: val(0, 13), lb: val(0, 15), stab: val(0, 16),
      ign: num(0, 5, 300), ret: num(0, 26, 500), lockPos: num(0, 12, 16384) / 32768, accents: p.styles.slice(1).map((_, x) => val(x + 1, 1) || [180, 180, 180])};
  },

  settingsHtml(){
    const d = this.data, s = d.settings;
    const any = s.clash != null || s.dimming != null || d.blades.some(b => b.max != null) || d.gestures;
    if (!any) return `<section class="card"><p>${t('settingsUnavailable')}</p></section>`;
    const oneBtn = +d.board.buttons === 1;
    const G = g => GESTURES.filter(x => x.g === g && !x.hide && d.gestures && d.gestures[x.key] != null && !(oneBtn && x.key === 'powerlock'));
    const gnum = g => `<label class="gnum">${esc(L(g))}<input type="number" class="setG" data-k="${g.key}" min="${g.min}" max="${g.max}" value="${d.gestures[g.key] ?? ''}"><small>${esc(lang === 'ja' ? g.hja : g.hen)}</small></label>`;
    const ring = (id, v, min, max, unit) => {
      const p = Math.max(0, Math.min(1, ((+v || 0) - min) / (max - min))), arc = 283, full = 377;
      return `<svg class="ring" data-ring-for="${id}" width="140" height="140" viewBox="0 0 150 150" aria-hidden="true">
        <circle cx="75" cy="75" r="70" fill="none" stroke="rgba(55,226,255,.15)"/>
        <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(55,226,255,.12)" stroke-width="8" stroke-dasharray="${arc} ${full - arc}" transform="rotate(135 75 75)"/>
        <circle class="rbar" cx="75" cy="75" r="60" fill="none" stroke="#37e2ff" stroke-width="8" stroke-dasharray="${(arc * p).toFixed(1)} ${full}" transform="rotate(135 75 75)" style="filter:drop-shadow(0 0 6px #37e2ff)"/>
        <circle class="rspin" cx="75" cy="75" r="46" fill="none" stroke="#37e2ff" stroke-opacity=".4" stroke-dasharray="3 6"/>
        <text class="rv" x="75" y="80" text-anchor="middle" font-size="28" fill="#fff">${esc(v)}</text>
        <text class="ru" x="75" y="99" text-anchor="middle" font-size="11" fill="#7fa8bf">${unit}</text></svg>`;
    };
    let h = `<section class="card"><h3>${t('secBasic')}</h3><div class="sgrid">`;
    if (s.clash != null) { const c1 = (+s.clash).toFixed(1); h += `<label class="gauge">${ring('setClash', c1, 0.5, 10, 'G')}<b>${t('clash')}</b><span class="inl"><input type="number" id="setClash" data-ring data-dec="1" step="0.1" min="0.5" max="10" value="${c1}"> G</span><small>${t('clashHint')}</small></label>`; }
    if (s.dimming != null) { const v = Math.round(s.dimming / 16384 * 100); h += `<label class="gauge">${ring('setDim', v, 5, 100, '%')}<b>${t('brightness')}</b><span class="inl"><input type="number" id="setDim" data-ring min="5" max="100" step="5" value="${v}"> %</span><small>${t('brightnessHint')}</small></label>`; }
    if (d.blades.some(b => b.max != null)) h += `<div class="lbl"><b>${t('bladeLength')}</b>${d.blades.map(b => `<span class="inl"><span class="ledn">${esc(t('blade', {n: b.blade}))}</span><input type="number" class="setLen" data-b="${b.blade}" min="1" max="${b.max ?? 999}" value="${b.length == null || b.length < 0 ? (b.max ?? '') : b.length}"> / ${b.max ?? '?'}</span>`).join('')}<small>${t('bladeLengthHint')}</small></div>`;
    h += G('basic').map(gnum).join('') + '</div></section>';
    if (d.gestures) {
      const gs = G('gesture');
      h += `<section class="card"><h3>${t('secGestures')}</h3><div class="gestures">${gs.filter(g => g.type === 'bool').map(g =>
          `<label class="chk"><input type="checkbox" class="setG" data-k="${g.key}" ${d.gestures[g.key] ? 'checked' : ''}> ${esc(L(g))}</label>`).join('')}</div>
        <div class="gestures nums">${gs.filter(g => g.type !== 'bool').map(gnum).join('')}</div><p class="hint">${t('gesturesHint')}</p></section>`;
      const bm = G('battle');
      if (bm.length) h += `<section class="card"><h3>${t('secBattle')}</h3><div class="gestures">${bm.map(gnum).join('')}</div></section>`;
    }
    return h + `<div class="savebar solo"><button class="btn primary" id="btnSaveSet">${t('saveSettings')}</button></div>`;
  },

  /** 操作表（印刷すると A4 で表だけが出る） */
  controlsHtml(){
    const d = this.data, o = this.cfgOverride;
    const buttons = (o && o.buttons) || (+d.board.buttons === 1 ? 1 : 2);
    const defs = (o && o.defs) || CTRL.defaults(buttons);
    const g = d.gestures || (o && o.gestures) || {swingon: 1, twistoff: 1, forcepush: 1, gestureon: 1};
    const J = lang === 'ja', k = buttons === 1 ? 'b1' : 'b2';
    const tbl = (list, title) => `<table class="ctl"><tr><th colspan="2">${title}</th></tr>${CTRL.rows(list, g, defs).map(r =>
      `<tr><td>${J ? r[0] : r[1]}</td><td>${J ? r[2] : r[3]}</td></tr>`).join('')}</table>`;
    let h = `<div class="sheet-tools"><button class="btn primary" id="btnPrint">${t('printBtn')}</button>
      <span class="hint">${o ? t('srcCfg', {f: esc(o.name)}) : t('srcStd')}${d.gestures ? P().s : ''}${d.gestures ? t('srcBoard') : ''}</span>
      ${this.advanced ? `<span class="sp"></span><button class="btn small" id="btnCfg">${t('loadCfg')}</button><input type="file" id="cfgFile" accept=".h,.txt" hidden>
        ${o ? `<button class="btn small" id="btnCfgClr">${t('clearCfg')}</button>` : ''}` : ''}</div>`;
    h += `<div class="sheet"><div class="sh-head"><div><b>${t('sheetTitle')}</b>　${esc(d.board.config.split('/').pop().replace(/\.h$/, ''))}</div>
        <div class="sh-meta">${t('buttonsN', {n: buttons})}${P().d}ProffieOS ${esc(d.board.version.replace(/^v/, ''))}${P().d}${t('made')} ${fmtDate().slice(0, 10)}</div></div>
      <p class="sh-legend">${t('legend')}</p>
      ${/fett263/i.test(d.board.prop) ? '' : `<p class="sh-warn">${t('notFett', {p: esc(d.board.prop)})}</p>`}
      ${g.gestureon === 0 ? `<p class="sh-warn">${t('gestOff')}</p>` : ''}
      ${o && o.name.replace(/\.h$/i, '').toLowerCase() !== d.board.config.split('/').pop().replace(/\.h$/i, '').toLowerCase() ? `<p class="sh-warn">${t('cfgMismatch', {f: esc(o.name), c: esc(d.board.config.split('/').pop())})}</p>` : ''}
      <div class="sh-cols">${tbl(CTRL[k + 'off'], t('offTitle'))}${tbl(CTRL[k + 'on'], t('onTitle'))}</div>
      ${buttons !== 1 && g.powerlock ? `<p class="sh-warn">${t('plOnNote')}</p>` : ''}
      <div class="sh-battle">${tbl(CTRL[k + 'battle'], t('battleTitle'))}<p>${t('battleNote')}</p></div></div>`;
    return h;
  },

  /* ---------------- SD チェック（ボードの sdtest を使う） ---------------- */
  sdHtml(){
    const r = this.sdResult, font = (this.data.presets[this.data.settings.preset] || {}).font || '';
    let h = `<section class="card"><h3>${t('sdTitle')}</h3><p class="hint">${t('sdIntro')}</p>
      <div class="row"><button class="btn primary" id="btnSdTest" ${this.live && !this.busy ? '' : 'disabled'}>${t('sdRun')}</button><span class="hint">${t('sdFont', {f: esc(font.split(';')[0])})}</span></div></section>`;
    if (!r) return h;
    if (r.unsupported) return h + `<section class="card"><p class="warn">${t('sdUnsupported')}</p></section>`;
    const s = r.streams, lv = s >= SD_GOOD ? 'good' : s >= SD_OK ? 'ok' : 'bad';
    const col = {good: '#37e2ff', ok: '#ff9a3c', bad: '#ff5a6a'}[lv];
    const p = Math.max(0, Math.min(1, s / 20)), arc = 283;
    h += `<section class="card sdres"><h3>${t('sdResult')}</h3><div class="sdgrid">
      <div class="sdring"><svg width="190" height="190" viewBox="0 0 150 150" role="img" aria-label="${t('sdStreams')} ${s.toFixed(1)}">
        <circle cx="75" cy="75" r="70" fill="none" stroke="rgba(55,226,255,.15)"/>
        <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(55,226,255,.12)" stroke-width="8" stroke-dasharray="${arc} 94" transform="rotate(135 75 75)"/>
        <circle cx="75" cy="75" r="60" fill="none" stroke="${col}" stroke-width="8" stroke-dasharray="${(arc * p).toFixed(1)} 377" transform="rotate(135 75 75)" style="filter:drop-shadow(0 0 6px ${col})"/>
        <circle class="rspin" cx="75" cy="75" r="46" fill="none" stroke="#37e2ff" stroke-opacity=".4" stroke-dasharray="3 6"/>
        <text x="75" y="80" text-anchor="middle" font-family="PWC Display, sans-serif" font-weight="700" font-size="30" fill="${col}">${s.toFixed(1)}</text>
        <text x="75" y="99" text-anchor="middle" font-family="PWC Mono, monospace" font-size="9" fill="#7fa8bf">STREAMS</text></svg>
        <b>${t('sdStreams')}</b></div>
      <div class="sdinfo">
        <div class="sdverdict sd-${lv}">${t('sdV_' + lv)}</div>
        <table class="kv"><tr><th>${t('sdSpeed')}</th><td>${Math.round(r.kbps).toLocaleString()} KB/s</td></tr>
        ${r.minStreams != null ? `<tr><th>${t('sdWorst')}</th><td>${r.minStreams}</td></tr>` : ''}
        ${r.openMs != null ? `<tr><th>${t('sdOpen')}</th><td>${r.openMs.toFixed(1)} ms</td></tr>` : ''}
        <tr><th>${t('sdFiles')}</th><td>${r.files}</td></tr></table>
        <p class="hint">${t('sdGuide', {g: SD_GOOD, o: SD_OK})}</p>
        ${lv !== 'good' ? `<p>${lang === 'ja' ? recLink('sd', t('sdShop')).replace('class="reclink"', 'class="btn reclink"') : `<a class="btn" href="${shopUrl()}" target="_blank" rel="noopener">${t('sdShop')}</a>`}</p>` : ''}
      </div></div></section>`;
    return h;
  },
  async sdTest(){
    const d = this.data;
    if (d.on === 1) { showDialog(t('sdTitle'), t('sdTurnOff')); return; }
    this.setBusy(true); this.progress(t('sdRunning'));
    try {
      const r = await this.q('sdtest', {timeoutMs: 180000});
      if (r.whut || !/Average speed/i.test(r.text)) { this.sdResult = {unsupported: true}; return; }
      const sp = /Average speed:\s*([\d.]+)\s*kb\/s,\s*([\d.]+)\s*simultaneous/i.exec(r.text);
      const op = /Time to open files:\s*Average time:\s*([\d.]+)\s*us/i.exec(r.text);
      // ファイルごとの行：32KB ごとに「同時に鳴らせる音の数」を 1 文字で出す（0〜9、A=10…Z=35、!=36 以上）
      const lines = r.text.split(/\r?\n/).map(x => x.trim()).filter(x => /^[0-9A-Z!]+$/.test(x));
      const val = c => c === '!' ? 36 : c <= '9' ? +c : c.charCodeAt(0) - 55;
      let min = null;
      for (const l of lines) for (const c of l) { const v = val(c); if (min == null || v < min) min = v; }
      this.sdResult = {kbps: sp ? +sp[1] : 0, streams: sp ? +sp[2] : 0, openMs: op ? +op[1] / 1000 : null, minStreams: min, files: lines.length};
    } catch (e) { showDialog(t('error'), e.message); }
    finally { this.setBusy(false); this.render(); }
  },

  backupHtml(){
    const d = this.data, list = this.backups();
    const has = list.some(b => b.manual && b.config === d.board.config);
    let h = has ? '' : `<div class="notice">${t('firstBackup')}</div>`;
    h += `<section class="card"><button class="btn primary" id="btnBackup">💾 ${t('backupNow')}</button><p class="hint">${t('backupHint')}</p></section>
      <section class="card"><h3>${t('history')}</h3><p class="hint">${t('historyHint')}</p>${list.length ? `<div class="tw"><table><tr><th>${t('colAt')}</th><th>${t('colMemo')}</th><th>config</th><th>${t('colPresets')}</th><th></th></tr>` +
        list.map((b, i) => `<tr class="${b.manual ? 'manual' : ''}"${i >= 5 && !this.showAllBk ? ' hidden' : ''}><td>${esc(b.at)}</td><td>${b.manual ? '★ ' + esc(b.memo || t('manualMemo')) : t('autoMemo')}</td><td>${esc((b.config || '').split('/').pop())}</td><td>${b.count ?? ''}</td>
          <td class="nowrap"><button class="btn tiny" data-bk="${i}">${t('saveFile')}</button> <button class="btn tiny" data-rs="${i}">${t('restoreThis')}</button> <button class="btn tiny" data-rm="${i}" title="${t('removeIt')}">✕</button></td></tr>`).join('') + '</table></div>' + `<div class="row">${list.length > 5 && !this.showAllBk ? `<button class="btn tiny" id="btnMoreBk">${t('showMoreBk', {n: list.length - 5})}</button>` : ''}<span style="flex:1"></span><button class="btn tiny danger" id="btnClearBk">${t('clearHistory')}</button></div>`
        : `<p class="hint">${t('noHistory')}</p>`}
        <div class="row"><button class="btn" id="btnRestoreFile">${t('restoreFile')}</button><input type="file" id="restoreFile" accept=".txt" hidden><span class="hint">${t('restoreFileHint')}</span></div></section>`;
    h += `<section class="card danger-card"><h3>${t('factory')}</h3><p class="hint">${t('factoryHint')}</p>
        <label class="chk"><input type="checkbox" id="frP" checked> ${t('frPresets')}</label>
        <label class="chk"><input type="checkbox" id="frG" checked> ${t('frGlobal')}</label>
        ${d.gestures ? `<label class="chk"><input type="checkbox" id="frX" checked> ${t('frGesture')}</label>` : ''}
        <div class="row"><button class="btn danger" id="btnFactory">${t('factory')}</button></div></section>`;
    if (this.advanced) h += `<section class="card"><div class="row"><button class="btn" id="btnJson">${t('exportJson')}</button></div>
        <details><summary>${t('log')}</summary><pre class="log">${esc(this.raw.slice(-60).map(r => `> ${r.cmd}${r.ms != null ? `  (${r.ms} ms)` : ''}${r.whut ? '  [Whut]' : ''}${r.timedOut ? '  [timeout]' : ''}\n${r.text.trimEnd()}`).join('\n'))}</pre></details></section>`;
    return h;
  },

  /* ---------------- イベント ---------------- */
  bind(){
    const on = (id, f, ev = 'onclick') => { const el = $(id); if (el) el[ev] = f; };
    const all = (sel, f) => document.querySelectorAll(sel).forEach(f);
    on('btnMoreBk', () => { this.showAllBk = true; this.render(); });
    on('btnClearBk', () => { if (confirm(t('clearHistoryConfirm', {n: this.backups().length}))) { store.set('backups', []); toast(t('clearHistoryDone')); this.render(); } });
    on('btnReload', () => { this.note('button: reload'); this.read(); });
    on('btnReboot', () => { if (confirm(t('rebootConfirm'))) { this.note('button: reboot'); this.reboot(); } });
    on('btnReconnect', () => Proffie.connected ? this.reboot() : this.connect());
    all('.tabs button', b => b.onclick = () => {
      if (this.tab === 'presets' && b.dataset.tab !== 'presets' && this.dirty && !confirm(t('confirmUnsaved'))) return;
      if (this.tab === 'presets' && b.dataset.tab !== 'presets') this.loadForm();
      this.tab = b.dataset.tab; this.render();
    });
    if (this.tab === 'presets') this.bindPresets(on, all);
    if (this.tab === 'settings') on('btnSaveSet', () => this.saveSettings());
    document.querySelectorAll('input[data-ring]').forEach(el => el.addEventListener('input', () => {
      const r = document.querySelector(`svg[data-ring-for="${el.id}"]`); if (!r) return;
      const min = +el.min, max = +el.max, p = Math.max(0, Math.min(1, ((+el.value || 0) - min) / (max - min)));
      r.querySelector('.rbar').setAttribute('stroke-dasharray', `${(283 * p).toFixed(1)} 377`); r.querySelector('.rv').textContent = el.dataset.dec ? (+el.value || 0).toFixed(+el.dataset.dec) : el.value;
    }));
    if (this.tab === 'controls') {
      on('btnPrint', () => window.print());
      on('btnCfg', () => $('cfgFile').click());
      on('cfgFile', async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        const c = CTRL.parseConfig(await f.text());
        if (!c.buttons && !Object.values(c.defs).some(Boolean)) { showDialog(t('error'), t('cfgBad')); return; }
        this.cfgOverride = {name: f.name, ...c}; this.render();
      }, 'onchange');
      on('btnCfgClr', () => { this.cfgOverride = null; this.render(); });
    }
    if (this.tab === 'sd') on('btnSdTest', () => this.sdTest());
    if (this.tab === 'backup') {
      const list = this.backups();
      on('btnBackup', () => this.manualBackup());
      all('[data-bk]', b => b.onclick = () => { const x = list[+b.dataset.bk]; downloadText(x.file || `backup_${stamp()}.txt`, x.text); });
      all('[data-rs]', b => b.onclick = () => { const x = list[+b.dataset.rs]; this.restore(x.text, x.at); });
      all('[data-rm]', b => b.onclick = () => { list.splice(+b.dataset.rm, 1); store.set('backups', list); this.render(); });
      on('btnRestoreFile', () => $('restoreFile').click());
      on('restoreFile', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.restore(await f.text(), f.name); }, 'onchange');
      on('btnFactory', () => this.factoryReset());
      on('btnJson', () => downloadText(`diagnostic_${this.fileBase()}.json`, JSON.stringify({tool: 'Proffie Web Config', exportedAt: fmtDate(), userAgent: navigator.userAgent, ...this.data, descCache: this.descCache, raw: this.raw.slice(-400)}, null, 2), false));
    }
  },

  bindPresets(on, all){
    const d = this.data;
    if ($('saberCv') && Preview.cv !== $('saberCv')) Preview.attach($('saberCv'), () => this.previewColors());
    const v = $('vol');
    if (v) {
      v.oninput = () => { const x = +v.value, c = volColor(x, +v.max); $('volVal').textContent = x; $('volVal').style.color = c; v.style.accentColor = c || 'var(--accent)'; };
      v.onchange = () => this.setVolume(+v.value);
    }
    on('volUnlock', e => { this.volUnlocked = e.target.checked; this.render(); }, 'onchange');
    all('[data-act]', b => b.onclick = async () => {
      const c = b.dataset.act;
      if (this.busy) return;
      // 選んでいるプリセットがセーバーで使われていなければ、先にセーバーを切り替える（切り替えないと音が鳴らない）
      if (this.sel !== this.data.settings.preset) {
        await this.switchTo(this.sel);
        if (this.sel !== this.data.settings.preset) return;      // 切り替えに失敗
      }
      if (!Preview.canDo(c) && !Preview.LOCKUPS.includes(c)) return;          // 効かないボタンは何もしない
      if (Preview.LOCKUPS.includes(c) && !Preview.on) return;
      Preview.trigger(c); this.updateActs();
      this.action(c);
    });
    this.updateActs();
    on('btnPlay', () => this.action(`play_track ${$('trackSel').value}`));
    on('btnStopT', () => this.action('stop_track'));
    on('btnFontSound', () => this.switchTo(this.sel));
    all('.rowplay', b => b.onclick = e => { e.stopPropagation(); this.switchTo(+b.dataset.play); });
    on('btnAutoName', () => this.autoName());
    on('btnBulkDel', () => this.deletePresets([...this.checked]));
    on('btnBulkClr', () => { this.checked.clear(); this.render(); });
    all('.pchk', cb => { cb.onclick = e => e.stopPropagation(); cb.onchange = () => { const k = +cb.dataset.i; cb.checked ? this.checked.add(k) : this.checked.delete(k); this.render(); }; });
    all('.pitem', el => {
      el.onclick = () => {
        // ダブルクリックでセーバーをそのプリセットに切り替える（1回目のクリックで描き直されるので自前で判定）
        const i = +el.dataset.i, now = Date.now();
        if (this._lastClick && this._lastClick.i === i && now - this._lastClick.t < 400) { this._lastClick = null; this.switchTo(i); return; }
        this._lastClick = {i, t: now};
        this.selectPreset(i);
      };
      el.ondragstart = e => { this.dragFrom = +el.dataset.i; el.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', el.dataset.i); } catch {} };
      el.ondragend = () => { el.classList.remove('dragging'); all('.pitem', x => x.classList.remove('dropa', 'dropb')); };
      el.ondragover = e => {
        if (this.dragFrom == null) return; e.preventDefault();
        const to = +el.dataset.i; all('.pitem', x => x.classList.remove('dropa', 'dropb'));
        if (to !== this.dragFrom) el.classList.add(to < this.dragFrom ? 'dropa' : 'dropb');
      };
      el.ondrop = e => { e.preventDefault(); const from = this.dragFrom; this.dragFrom = null; if (from != null) this.moveTo(from, +el.dataset.i); };
    });
    const i = this.sel;
    on('btnUp', () => this.moveTo(i, i - 1));
    on('btnDown', () => this.moveTo(i, i + 1));
    on('btnMove', () => { const n = parseInt($('moveNum').value, 10); if (n >= 1) this.moveTo(i, n - 1); });
    on('btnDup', () => this.duplicate(i));
    on('btnDel', () => this.deletePresets([i]));
    on('fName', e => { this.form.name = e.target.value; this.setDirty(); }, 'oninput');
    on('fFont', e => { const parts = (this.form.font || '').split(';'); parts[0] = e.target.value; this.form.font = parts.join(';'); this.setDirty(); const el = $('fTrackNote'); if (el) el.textContent = this.trackNote(this.form.font); }, 'onchange');
    on('fTrack', e => { this.form.track = e.target.value; this.setDirty(); }, 'onchange');
    on('fVar', e => { this.form.variation = e.target.value; this.setDirty(); }, 'oninput');
    on('fLink', e => { this.linkBlades = e.target.checked; }, 'onchange');
    const rerenderEditor = () => { const ed = document.querySelector('.editor'); ed.innerHTML = this.editorHtml(); this.bindPresets(on, all); };
    all('.pchip', b => b.onclick = () => { this.setArg(+b.dataset.b, +b.dataset.k, b.dataset.v); rerenderEditor(); });
    all('.fColor', el => {
      el.oninput = () => { this.setArg(+el.dataset.b, +el.dataset.k, PP.fromHex(el.value)); };
      el.onchange = () => rerenderEditor();
    });
    all('.fDef', b => b.onclick = () => { this.setArg(+b.dataset.b, +b.dataset.k, '~'); rerenderEditor(); });
    all('.fInt', el => el.oninput = () => { this.form.args[+el.dataset.b][+el.dataset.k] = String(parseInt(el.value, 10)); this.setDirty(); });
    all('.fFx', el => el.onchange = () => {
      const p = this.data.presets[this.sel], b0 = +el.dataset.b, P = el.value.split(' ')[0];
      const targets = this.linkBlades ? p.styles.map((_, x) => x) : [b0];
      for (const x of targets) {
        const cur = PP.style(p.styles[x]).builtin;
        if (!cur) continue;
        const key = x === b0 ? el.value : `${P} ${cur.blade}`;                 // ほかの LED は同じプリセット番号の同じ LED
        if (x !== b0 && !this.fxSources(p, x).some(o => o.key === key)) continue;
        this.form.fx[x] = key === `${cur.preset} ${cur.blade}` ? null : key;
      }
      this.setDirty(); rerenderEditor();
    });
    all('.fRaw', el => el.oninput = () => { this.form.raw[+el.dataset.b] = el.value; this.setDirty(); });
    all('details[data-key]', el => el.ontoggle = () => { el.open ? this.openDetails.add(el.dataset.key) : this.openDetails.delete(el.dataset.key); });
    on('btnRevert', () => { this.loadForm(); this.render(); });
    on('btnSave', () => this.save());
  }
};
