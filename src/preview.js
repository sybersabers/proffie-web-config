/* =====================================================================
 * セーバーのプレビュー（イメージ表示）
 *   色・点灯/消灯時間・各エフェクトの色から、ブレードの様子を描く
 * ===================================================================== */
const Preview = {
  cv: null, ctx: null, raf: 0, on: true, ext: 1, extFrom: 1, extTo: 1, extStart: 0, extDur: 300,
  fx: [], lockType: null, getColors: () => null,

  attach(cv, getColors){
    this.cv = cv; this.getColors = getColors;
    this.ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!this.ctx) return;
    cancelAnimationFrame(this.raf);
    const loop = () => { if (!this.cv || !this.cv.isConnected) return; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  LOCKUPS: ['lock', 'drag', 'lb', 'melt'],
  /** そのボタンが今効くか（ProffieOS の動きに合わせる） */
  canDo(cmd){
    if (cmd === 'on' || cmd === 'off' || cmd === 'quote' || cmd === 'force') return true;
    if (!this.on) return false;
    if (cmd === 'clash' || cmd === 'stab') return !this.lockType;   // ロックアップ中はクラッシュ・スタブが効かない
    return true;
  },
  trigger(cmd){
    const now = performance.now(), c = this.getColors() || {};
    if (cmd === 'on') { if (!this.on) { this.on = true; this.anim(1, c.ign || 300); } }
    else if (cmd === 'off') { if (this.on) { this.on = false; this.lockType = null; this.anim(0, c.ret || 500); } }
    else if (this.LOCKUPS.includes(cmd)) {
      // 同時に1つだけ。発動中にどれかを押すと、今の効果が終わるだけ
      if (this.on) this.lockType = this.lockType ? null : cmd;
    }
    else if (cmd === 'clash' || cmd === 'stab') { if (this.canDo(cmd)) this.fx.push({type: cmd, t: now}); }
    else if (cmd === 'blast') { if (this.on) this.fx.push({type: cmd, t: now, pos: 0.25 + Math.random() * 0.6}); }
    // force / quote は音だけ（光り方はスタイルによるので描かない）
  },
  /** 実機の点灯状態に合わせる */
  setState(on){ this.on = !!on; this.ext = this.extFrom = this.extTo = on ? 1 : 0; this.lockType = null; this.fx = []; },
  anim(to, dur){ this.extFrom = this.ext; this.extTo = to; this.extStart = performance.now(); this.extDur = Math.max(50, dur); },

  draw(){
    const cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height, now = performance.now();
    const c = this.getColors() || {};
    ctx.clearRect(0, 0, W, H);
    // 伸び縮み
    const k = Math.min(1, (now - this.extStart) / this.extDur);
    this.ext = this.extFrom + (this.extTo - this.extFrom) * (this.extTo > this.extFrom ? k : 1 - Math.pow(1 - k, 2));
    const L = Math.round(W * 0.21), hx = 14, cy = H / 2, x0 = hx + L - 2, len = W - x0 - 18, bw = Math.max(12, H * 0.13);
    // スイッチの色：アクセントブレードがあればその色、なければメインカラー。消灯中は消える
    const acc = (c.accents || []).find(Boolean) || c.base || [200, 200, 200];
    const lvl = Math.max(0, Math.min(1, this.ext * 1.5));
    this.drawHilt(ctx, hx, cy, L, acc, lvl);
    if (this.ext <= 0.001) return;
    // ブレードの色（区間ごと）
    const N = 72, lit = Math.round(N * this.ext), base = c.base || [200, 200, 200];
    const flick = 0.92 + 0.08 * Math.sin(now / 37) * Math.sin(now / 53);
    const seg = [];
    for (let i = 0; i < lit; i++) {
      let col = base.map(v => v * flick), p = i / (N - 1);
      for (const f of this.fx) {
        const age = now - f.t;
        if (f.type === 'clash' && age < 260) col = this.mix(col, c.clash || [255, 255, 255], 1 - age / 260);
        if (f.type === 'blast' && age < 500) col = this.mix(col, c.blast || [255, 255, 255], Math.exp(-Math.pow((p - f.pos) / 0.05, 2)) * (1 - age / 500));
        if (f.type === 'stab' && age < 350) col = this.mix(col, c.stab || [255, 120, 0], Math.max(0, (p - 0.75) / 0.25) * (1 - age / 350));
      }
      const lp = c.lockPos ?? 0.5, lt = this.lockType;
      if (lt === 'lock') col = this.mix(col, c.lockup || [255, 255, 255], Math.exp(-Math.pow((p - lp) / 0.12, 2)) * (0.6 + 0.4 * Math.random()));
      if (lt === 'lb') col = this.mix(col, c.lb || [200, 220, 255], (Math.random() < 0.35 ? 0.9 : 0.2) * (0.5 + 0.5 * Math.sin(p * 40 + now / 30)));
      if (lt === 'drag') col = this.mix(col, c.drag || [255, 255, 255], Math.max(0, (p - 0.85) / 0.15) * (0.5 + 0.5 * Math.random()));
      if (lt === 'melt') col = this.mix(col, c.stab || [255, 120, 0], Math.max(0, (p - 0.8) / 0.2) * (0.8 + 0.2 * Math.sin(now / 90)));
      seg.push(col.map(v => Math.max(0, Math.min(255, Math.round(v)))));
    }
    this.fx = this.fx.filter(f => now - f.t < 700);
    // 外側の光
    const tipX = x0 + len * this.ext;
    for (let i = 0; i < seg.length; i++) {
      const x = x0 + (i / N) * len, w = len / N + 1, col = `rgb(${seg[i].join(',')})`;
      ctx.shadowColor = col; ctx.shadowBlur = bw * 1.6;
      ctx.fillStyle = col; ctx.fillRect(x, cy - bw / 2, w, bw);
    }
    ctx.shadowBlur = 0;
    // 芯（白っぽく）
    const core = ctx.createLinearGradient(0, cy - bw / 2, 0, cy + bw / 2);
    core.addColorStop(0, 'rgba(255,255,255,0)'); core.addColorStop(0.5, 'rgba(255,255,255,.75)'); core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core; ctx.fillRect(x0, cy - bw * 0.3, tipX - x0, bw * 0.6);
    // 先端を丸く
    const last = seg.length ? `rgb(${seg[seg.length - 1].join(',')})` : '#fff';
    ctx.beginPath(); ctx.arc(tipX, cy, bw / 2, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = last; ctx.shadowColor = last; ctx.shadowBlur = bw * 1.6; ctx.fill(); ctx.shadowBlur = 0;
  },
  /** 柄（案A：クラシック。銀の本体＋黒いリブのグリップ＋ベント付きエミッター） */
  drawHilt(ctx, x, cy, L, acc, lvl){
    const H = 34, y = cy - H / 2;
    const metal = (yy, hh, st) => { const g = ctx.createLinearGradient(0, yy, 0, yy + hh); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const SILVER = [[0, '#7d858f'], [0.22, '#eef1f4'], [0.5, '#b9c0c8'], [0.8, '#6c737c'], [1, '#3e444b']];
    // ポンメル
    ctx.fillStyle = metal(y - 2, H + 4, SILVER); this.rr(ctx, x, y - 2, L * 0.07, H + 4, 6); ctx.fill();
    ctx.fillStyle = '#2b2f34'; ctx.fillRect(x + L * 0.07, y + 4, 4, H - 8);
    // 本体
    ctx.fillStyle = metal(y, H, SILVER); ctx.fillRect(x + L * 0.07 + 4, y, L * 0.86, H);
    // グリップ（黒いリブ）
    const gx = x + L * 0.14, gw = L * 0.42;
    ctx.fillStyle = metal(y - 1, H + 2, [[0, '#1b1d20'], [0.35, '#4a4f55'], [1, '#0e0f11']]); ctx.fillRect(gx, y - 1, gw, H + 2);
    for (let i = 0; i < 11; i++) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(gx + 4 + i * gw / 11, y - 1, 3, H + 2); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(gx + 7 + i * gw / 11, y - 1, 2, H + 2); }
    // スイッチ（点灯中だけ光る）
    const sx = x + L * 0.66;
    ctx.fillStyle = metal(y - 7, 9, SILVER); this.rr(ctx, sx - 9, y - 7, 18, 9, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, y - 7, 5, Math.PI, 0);
    const off = [55, 60, 66], col = off.map((v, i) => Math.round(v + (acc[i] - v) * lvl));
    ctx.fillStyle = `rgb(${col.join(',')})`;
    if (lvl > 0.05) { ctx.shadowColor = `rgb(${acc.join(',')})`; ctx.shadowBlur = 12 * lvl; }
    ctx.fill(); ctx.shadowBlur = 0;
    // 細い溝
    ctx.fillStyle = 'rgba(0,0,0,.45)'; [0.6, 0.62, 0.78].forEach(p => ctx.fillRect(x + L * p, y, 2, H));
    // エミッター（少し太い＋スリット）
    const ex = x + L * 0.86;
    ctx.fillStyle = metal(y - 5, H + 10, SILVER); this.rr(ctx, ex, y - 5, L * 0.14, H + 10, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < 3; i++) ctx.fillRect(ex + 8 + i * 10, y - 5, 4, 10);
  },
  mix(a, b, k){ k = Math.max(0, Math.min(1, k)); return a.map((v, i) => v + (b[i] - v) * k); },
  rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
};
