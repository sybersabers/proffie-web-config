/* =====================================================================
 * 操作表（Fett263 prop / ProffieOS 8.10）
 *   行の表示条件：c = 'swingon' など（ジェスチャー設定）、d = define 由来の条件
 *   標準構成：2ボタン = HOLD_BUTTON_LOCKUP あり / 1ボタン = SPIN_MODE あり
 * ===================================================================== */
const CTRL = {
  // [日本語の操作名, 英語の操作名, 日本語の操作, 英語の操作, 条件]
  b1off: [
    ['点灯', 'Ignite', 'クリック', 'Click'],
    ['__motion'],
    ['ミュート点灯', 'Ignite (muted)', 'クリック直後にロングクリック', 'Click, then long click'],
    ['プリセット切替', 'Change preset', 'ロングクリック（下向きで前へ）', 'Long click (pointing down = previous)'],
    ['プリセット一覧スクロール', 'Scroll presets', 'ホールド → ヒルト回転<br><small>決定：クリック／選んで点灯：ホールド／先頭へ：ロングクリック</small>', 'Hold → rotate hilt<br><small>Select: click / select & ignite: hold / first: long click</small>'],
    ['BGM 再生／停止', 'Play / stop track', 'ダブルクリック（真上に向けて）', 'Double click (pointing up)'],
    ['トラックプレイヤー', 'Track Player', 'ダブルクリック（平行または下向き）<br><small>複数BGM収録フォントのみ</small>', 'Double click (parallel or down)<br><small>Fonts with multiple tracks only</small>'],
    ['フォース／クォート', 'Force / Quote', 'トリプルクリック', 'Triple click'],
    ['バッテリーチェック', 'Battery check', 'ダブルクリック直後にロングクリック', 'Double click, then long click'],
    ['音量調整', 'Volume menu', 'ホールド＋クラッシュ（平行または上向き）<br><small>回転で増減／クリックで終了</small>', 'Hold + clash (parallel or up)<br><small>Rotate to adjust / click to exit</small>'],
    ['ジェスチャー ON／OFF', 'Gesture Sleep', 'ホールド＋クラッシュ（下向き）', 'Hold + clash (pointing down)'],
    ['スピンモード', 'Spin mode', 'ホールド＋スイング', 'Hold + swing', 'd:spin'],
    ['エディットセッティング', 'Edit settings', 'ダブルクリック＋ホールド', 'Double click and hold', 'd:editSettings']
  ],
  b1on: [
    ['消灯', 'Retract', 'ホールド', 'Hold'],
    ['モーション消灯', 'Twist Off', 'ツイスト', 'Twist', 'twistoff'],
    ['ブラスター', 'Blast', 'クリック<br><small>ダブル・トリプルクリックでも可</small>', 'Click<br><small>Double or triple click also works</small>'],
    ['マルチブラスト', 'Multi-blast', 'ホールド＋スイング<br><small>解除：クリックまたはクラッシュ</small>', 'Hold + swing<br><small>Exit: click or clash</small>'],
    ['クラッシュ', 'Clash', 'ブレードを当てる', 'Clash the blade'],
    ['スタブ', 'Stab', 'スラスト', 'Thrust', 'd:bcMelt'],
    ['スタブ', 'Stab', 'スタブ（先端に衝撃）', 'Stab (hit with the tip)', 'd:!bcMelt'],
    ['ロックアップ', 'Lockup', 'ホールド＋クラッシュ', 'Hold + clash'],
    ['ドラッグ／メルト', 'Drag / melt', 'スタブ（向きで自動切替）', 'Stab (by blade angle)', 'd:bcMelt'],
    ['ドラッグ', 'Drag', 'ホールド＋スタブ（真下に向けて）', 'Hold + stab (pointing down)', 'd:!bcMelt'],
    ['メルト', 'Melt', 'ホールド＋スタブ（平行または上向き）', 'Hold + stab (parallel or up)', 'd:!bcMelt'],
    ['ライトニングブロック', 'Lightning block', 'ダブルクリック＋ホールド', 'Double click + hold'],
    ['フォース／クォート', 'Force / Quote', 'ロングクリック', 'Long click'],
    ['フォースプッシュ', 'Force push', '押し出す動き', 'Push motion', 'forcepush'],
    ['BGM 停止', 'Stop track', 'ダブルクリック', 'Double click'],
    ['カラーチェンジ', 'Color change', '4クリック（平行または下向き）<br><small>回転で選択／クリックで決定</small>', '4 clicks (parallel or down)<br><small>Rotate to select / click to save</small>'],
    ['省電力モード', 'Power save', '4クリック（真上に向けて）', '4 clicks (pointing up)'],
    ['スタイル切替', 'Change style', 'トリプルクリック＋ロングクリック（下向きで前へ）', 'Triple click + long click (pointing down = previous)'],
    ['マルチフェーズ', 'Multi-phase', 'ホールド＋ツイスト（下向きで前へ）', 'Hold + twist (pointing down = previous)', 'd:multiPhase']
  ],
  b1battle: [
    ['バトルモード 切替', 'Battle Mode on / off', 'トリプルクリック＋ホールド（点灯中）', 'Triple click + hold (while on)']
  ],
  b2off: [
    ['点灯', 'Ignite', 'PWR クリック', 'Click PWR'],
    ['__motion'],
    ['ミュート点灯', 'Ignite (muted)', 'PWR ダブルクリック', 'Double click PWR'],
    ['プリセット切替', 'Change preset', 'AUX クリック（下向きで前へ）', 'Click AUX (pointing down = previous)'],
    ['プリセット一覧スクロール', 'Scroll presets', 'AUX ロングクリック → ヒルト回転<br><small>決定：PWR クリック／選んで点灯：PWR ホールド／先頭へ：AUX クリック</small>', 'Long click AUX → rotate hilt<br><small>Select: click PWR / select & ignite: hold PWR / first: click AUX</small>'],
    ['BGM 再生／停止', 'Play / stop track', 'PWR ロングクリック（真上に向けて）', 'Long click PWR (pointing up)'],
    ['トラックプレイヤー', 'Track Player', 'PWR ロングクリック（平行）<br><small>複数BGM収録フォントのみ</small>', 'Long click PWR (parallel)<br><small>Fonts with multiple tracks only</small>'],
    ['フォース／クォート', 'Force / Quote', 'PWR ホールド', 'Hold PWR'],
    ['ジェスチャー ON／OFF', 'Gesture Sleep', 'PWR ホールド＋クラッシュ', 'Hold PWR + clash'],
    ['音量調整', 'Volume menu', 'PWR ホールド＋AUX クリック<br><small>回転で増減／PWR か AUX クリックで決定</small>', 'Hold PWR + click AUX<br><small>Rotate to adjust / click to save</small>'],
    ['バッテリーチェック', 'Battery check', 'AUX ホールド＋PWR クリック', 'Hold AUX + click PWR'],
    ['スピンモード', 'Spin mode', 'PWR ホールド＋スイング', 'Hold PWR + swing', 'd:spin'],
    ['エディットセッティング', 'Edit settings', 'AUX ホールド＋PWR ホールド', 'Hold AUX + hold PWR', 'd:editSettings']
  ],
  b2on: [
    ['消灯', 'Retract', 'PWR クリック', 'Click PWR', '!powerlock&d:!holdOff'],
    ['消灯', 'Retract', 'PWR ホールド', 'Hold PWR', '!powerlock&d:holdOff'],
    ['消灯（パワーロック中）', 'Retract (power lock)', 'PWR ホールド＋AUX ホールド', 'Hold PWR + hold AUX', 'powerlock'],
    ['モーション消灯', 'Twist Off', 'ツイスト', 'Twist', 'twistoff'],
    ['ブラスター', 'Blast', 'AUX クリック', 'Click AUX'],
    ['マルチブラスト', 'Multi-blast', 'AUX ロングクリック<br><small>解除：AUX クリックまたはクラッシュ</small>', 'Long click AUX<br><small>Exit: click AUX or clash</small>'],
    ['クラッシュ', 'Clash', 'ブレードを当てる', 'Clash the blade'],
    ['スタブ', 'Stab', 'スラスト', 'Thrust', 'd:bcMelt'],
    ['スタブ', 'Stab', 'スタブ（先端に衝撃）', 'Stab (hit with the tip)', 'd:!bcMelt'],
    ['ロックアップ', 'Lockup', 'AUX ホールド', 'Hold AUX', 'd:hbl'],
    ['ロックアップ', 'Lockup', 'PWR ホールド＋クラッシュ', 'Hold PWR + clash', 'd:!hbl'],
    ['ドラッグ／メルト', 'Drag / melt', 'スタブ（向きで自動切替）', 'Stab (by blade angle)', 'd:bcMelt'],
    ['ドラッグ', 'Drag', 'AUX ホールド＋スタブ（真下に向けて）', 'Hold AUX + stab (pointing down)', 'd:!bcMelt'],
    ['メルト', 'Melt', 'AUX ホールド＋スタブ（平行または上向き）', 'Hold AUX + stab (parallel or up)', 'd:!bcMelt'],
    ['ライトニングブロック', 'Lightning block', 'PWR ホールド＋AUX クリック', 'Hold PWR + click AUX'],
    ['フォース／クォート', 'Force / Quote', 'PWR ロングクリック（平行または下向き）', 'Long click PWR (parallel or down)'],
    ['フォースプッシュ', 'Force push', '押し出す動き', 'Push motion', 'forcepush'],
    ['BGM 停止', 'Stop track', 'PWR ロングクリック（真上に向けて）', 'Long click PWR (pointing up)'],
    ['カラーチェンジ', 'Color change', 'AUX ホールド＋PWR クリック（平行または下向き）<br><small>回転で選択／PWR クリックで保存／AUX クリックで戻す</small>', 'Hold AUX + click PWR (parallel or down)<br><small>Rotate / click PWR to save / click AUX to revert</small>'],
    ['省電力モード', 'Power save', 'AUX ホールド＋PWR クリック（真上に向けて）', 'Hold AUX + click PWR (pointing up)'],
    ['スタイル切替', 'Change style', 'AUX ホールド＋PWR ロングクリック（下向きで前へ）', 'Hold AUX + long click PWR (pointing down = previous)'],
    ['マルチフェーズ', 'Multi-phase', 'AUX ホールド＋ツイスト（次）／PWR ホールド＋ツイスト（前）', 'Hold AUX + twist (next) / hold PWR + twist (prev)', 'd:multiPhase']
  ],
  b2battle: [
    ['バトルモード 切替', 'Battle Mode on / off', 'AUX ホールド＋スイング（点灯中）', 'Hold AUX + swing (while on)', 'd:hbl'],
    ['バトルモード 切替', 'Battle Mode on / off', 'AUX ホールド（点灯中）', 'Hold AUX (while on)', 'd:!hbl']
  ],

  /** 標準構成（SYBER SABERS 出荷時） */
  defaults(buttons){
    const common = {multiPhase: true, bcMelt: true, editSettings: true, holdOff: false};
    return buttons === 1 ? {...common, hbl: false, spin: true} : {...common, hbl: true, spin: false};
  },

  /** config(.h) の CONFIG_TOP から define を読む */
  parseConfig(text){
    const strip = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const a = strip.indexOf('CONFIG_TOP'), b = strip.indexOf('#endif', a);
    const top = a >= 0 ? strip.slice(a, b > a ? b : undefined) : strip;
    const has = n => new RegExp('^\\s*#define\\s+' + n + '\\b', 'm').test(top);
    const nb = /^\s*#define\s+NUM_BUTTONS\s+(\d+)/m.exec(top);
    const num = n => { const m = new RegExp('^\\s*#define\\s+' + n + '\\s+(\\d+)', 'm').exec(top); return m ? +m[1] : null; };
    return {
      buttons: nb ? +nb[1] : null,
      defs: {hbl: has('FETT263_HOLD_BUTTON_LOCKUP'), spin: has('FETT263_SPIN_MODE'), multiPhase: has('FETT263_MULTI_PHASE'),
        bcMelt: has('FETT263_USE_BC_MELT_STAB'), editSettings: has('FETT263_EDIT_SETTINGS_MENU') || has('FETT263_EDIT_MODE_MENU'), holdOff: has('FETT263_HOLD_BUTTON_OFF')},
      gestures: {swingon: has('FETT263_SWING_ON') ? 1 : 0, twiston: has('FETT263_TWIST_ON') ? 1 : 0, twistoff: has('FETT263_TWIST_OFF') ? 1 : 0,
        thruston: has('FETT263_THRUST_ON') ? 1 : 0, stabon: has('FETT263_STAB_ON') ? 1 : 0, forcepush: has('FETT263_FORCE_PUSH') ? 1 : 0,
        powerlock: has('FETT263_POWER_LOCK') ? 1 : 0, gestureon: 1, swingonspeed: num('FETT263_SWING_ON_SPEED')}
    };
  },

  /** 表示する行を条件で絞る */
  rows(list, g, d){
    // モーション点灯は1行にまとめ、有効なものだけ並べる
    list = list.flatMap(r => {
      if (r[0] !== '__motion') return [r];
      const on = [['swingon', 'mSwing'], ['twiston', 'mTwist'], ['thruston', 'mThrust'], ['stabon', 'mStab']].filter(([k]) => g[k]);
      if (!on.length) return [];
      const ja = on.map(([, k]) => LANG.ja[k]).join('／'), en = on.map(([, k]) => LANG.en[k]).join(' / ');
      return [[LANG.ja.motionIgnite, LANG.en.motionIgnite, ja + `<br><small>${LANG.ja.swingBattleShort}</small>`, en + `<br><small>${LANG.en.swingBattleShort}</small>`]];
    });
    const ok1 = c => {
      if (c.startsWith('d:')) { const k = c.slice(2); return k.startsWith('!') ? !d[k.slice(1)] : !!d[k]; }
      return c.startsWith('!') ? !g[c.slice(1)] : !!g[c];
    };
    return list.filter(r => !r[4] || r[4].split('&').every(ok1));
  }
};
