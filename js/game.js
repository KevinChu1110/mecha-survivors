'use strict';
// ───────── 基礎 ─────────
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, Z = 1, VW = 0, VH = 0, DPR = 1;
const COARSE = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, COARSE ? 1.5 : 2);
  W = innerWidth; H = innerHeight;
  Z = Math.max(.62, Math.min(1, Math.min(W, H) / 640)); VW = W / Z; VH = H / Z;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
addEventListener('resize', resize); resize();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const fmt = t => String((t / 60) | 0).padStart(2, '0') + ':' + String((t | 0) % 60).padStart(2, '0');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('mecha:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mecha:' + k, JSON.stringify(v)); } catch {} },
};

// ───────── 素材 ─────────
const IMG = {};
const HERO_ANIM = { Idle: 10, Run: 8, RunShoot: 9, Dead: 10, Slide: 10 };
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src; }); }
const PACK = 'assets/custom/';
// 選用的素材外掛包：assets/custom/pack.json（不進版控，沒有就略過）
async function loadPack() {
  let cfg; try { const r = await fetch(PACK + 'pack.json', { cache: 'no-store' }); if (!r.ok) return; cfg = await r.json(); } catch { return; }
  for (const e of cfg.chars || []) {
    const base = CHARS.find(c => c.id === e.base); if (!base || !e.frames || !e.id) continue;
    const ch = { ...base, ...e.info, id: e.id, kit: base.kit, h: e.height || 96 };
    const sets = {};
    for (const [k, list] of Object.entries(e.frames)) sets[k] = await Promise.all(list.map(f => loadImg(PACK + f)));
    if (!sets.Idle || !sets.Idle.length) continue;
    sets.Run = sets.Run && sets.Run.length ? sets.Run : sets.Idle; sets.RunShoot = sets.RunShoot && sets.RunShoot.length ? sets.RunShoot : sets.Run;
    IMG.char[ch.id] = sets; ch.flipArt = !!e.facesLeft;
    const at = CHARS.findIndex(c => c.id === e.replace); if (at >= 0) CHARS[at] = ch; else CHARS.push(ch);
  }
}
async function loadAll() {
  IMG.hero = {};
  const jobs = [];
  for (const [n, c] of Object.entries(HERO_ANIM)) {
    IMG.hero[n] = [];
    for (let i = 1; i <= c; i++) jobs.push(loadImg(`assets/hero/${n}_${i}.png`).then(im => IMG.hero[n][i - 1] = im));
  }
  for (const k of ['robot', 'zombie', 'soldier']) jobs.push(loadImg(`assets/enemy/${k}.png`).then(im => IMG[k] = im));
  await Promise.all(jobs);
  // 色相變體（像素運算，Safari 也能用）
  IMG.tint = {}; IMG.char = {};
  IMG.tint.robot200 = tintImg(IMG.robot, 200, 1);
  for (const c of CHARS) { c.kit = c.id; IMG.char[c.id] = {}; for (const set of ['Idle', 'Run', 'RunShoot']) IMG.char[c.id][set] = IMG.hero[set].map(f => c.hue || c.br !== 1 ? tintImg(f, c.hue, c.br) : f); }
  await loadPack();
}
function tintImg(im, hue, br) {
  const c = document.createElement('canvas'); c.width = im.width || 1; c.height = im.height || 1;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data, r = hue * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
  const m = [.213 + .787 * co - .213 * si, .715 - .715 * co - .715 * si, .072 - .072 * co + .928 * si,
             .213 - .213 * co + .143 * si, .715 + .285 * co + .140 * si, .072 - .072 * co - .283 * si,
             .213 - .213 * co - .787 * si, .715 - .715 * co + .715 * si, .072 + .928 * co + .072 * si];
  for (let k = 0; k < a.length; k += 4) {
    const R = a[k], G = a[k + 1], B = a[k + 2];
    a[k] = Math.min(255, (m[0] * R + m[1] * G + m[2] * B) * br); a[k + 1] = Math.min(255, (m[3] * R + m[4] * G + m[5] * B) * br); a[k + 2] = Math.min(255, (m[6] * R + m[7] * G + m[8] * B) * br);
  }
  x.putImageData(d, 0, 0); return c;
}

// ───────── 音效（WebAudio 合成）＋音樂 ─────────
let AC = null, muted = store.get('muted', false), music = null;
const lastSfx = {};
function sfx(kind) {
  if (muted) return;
  const now = performance.now(); if (now - (lastSfx[kind] || 0) < 45) return; lastSfx[kind] = now;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const P = {
      shot: [820, .07, 'square', .035, -500], zap: [1400, .12, 'sawtooth', .04, -1000], hit: [200, .05, 'square', .03, -80],
      kill: [420, .08, 'triangle', .04, -250], gem: [900, .06, 'sine', .035, 500], hurt: [140, .2, 'sawtooth', .08, -90],
      level: [520, .35, 'square', .06, 700], boom: [90, .35, 'sawtooth', .09, -60], dash: [300, .14, 'triangle', .05, 600],
      giga: [60, .8, 'sawtooth', .12, 400], flame: [260, .12, 'sawtooth', .03, -120], ice: [1100, .2, 'sine', .04, -700],
      bossdie: [70, 1.0, 'sawtooth', .13, -40], card: [660, .1, 'square', .05, 330],
    }[kind]; if (!P) return;
    const [f, d, t, v, s] = P, o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime;
    o.type = t; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(Math.max(30, f + s), n + d);
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d);
  } catch {}
}
function startMusic() {
  if (!music) { music = new Audio('assets/audio/boss-fight-2.ogg'); music.loop = true; music.volume = .32; }
  music.muted = muted; music.play().catch(() => {});
}
function setMuted(m) { muted = m; store.set('muted', m); if (music) music.muted = m; }

// ───────── 輸入 ─────────
const keys = new Set(); let joy = null;
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (keys.has(k)) return; keys.add(k);
  if (S.mode === 'cards') { if (['1', '2', '3'].includes(k)) chooseCard(+k - 1); if (k === 'r' && S.cards.reroll) rerollCards(); return; }
  if (k === 'm') setMuted(!muted);
  if (S.mode === 'play') {
    if (k === ' ' || k === 'shift') dash();
    if (k === 'e') giga();
    if (k === 'p' || k === 'escape') setMode('paused');
  } else if (S.mode === 'paused' && (k === 'p' || k === 'escape')) setMode('play');
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); if (S.mode === 'play') setMode('paused'); });
const jEl = $('#joy'), jKnob = $('#joyKnob'), JR = 54;
function joyShow(on) { jEl.hidden = !on; }
cv.addEventListener('touchstart', e => {
  e.preventDefault(); if (joy || S.mode !== 'play') return; const t = e.changedTouches[0];
  joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: 0, y: 0 }; jEl.style.left = t.clientX + 'px'; jEl.style.top = t.clientY + 'px'; jKnob.style.transform = 'translate(-50%,-50%)'; joyShow(true);
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault(); if (!joy) return;
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    let dx = t.clientX - joy.x0, dy = t.clientY - joy.y0; const l = Math.hypot(dx, dy);
    if (l > JR) { joy.x0 += dx / l * (l - JR); joy.y0 += dy / l * (l - JR); dx = t.clientX - joy.x0; dy = t.clientY - joy.y0; jEl.style.left = joy.x0 + 'px'; jEl.style.top = joy.y0 + 'px'; }
    joy.x = dx; joy.y = dy; jKnob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }
}, { passive: false });
const endTouch = e => { if (joy) for (const t of e.changedTouches) if (t.identifier === joy.id) { joy = null; joyShow(false); } };
cv.addEventListener('touchend', endTouch); cv.addEventListener('touchcancel', endTouch);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') setMode('paused'); });
const tap = (id, fn) => $(id).addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
tap('#tDash', () => S.mode === 'play' && dash()); tap('#tGiga', () => S.mode === 'play' && giga()); tap('#tPause', () => S.mode === 'play' && setMode('paused'));

// ───────── 狀態 ─────────
const S = { mode: 'title', cards: null };
let G = null;
function newGame(charId) {
  const ch = CHARS.find(c => c.id === charId) || CHARS[0];
  G = {
    ch, shotN: 0, shieldOn: false, bcd: 0, burstAng: 0, dashHit: new Set(),
    t: 0, kills: 0, spawnAcc: 0, nextBoss: 0, bossIdx: 0, boss: null,
    p: { x: 0, y: 0, hp: ch.hp, maxHp: ch.hp, lv: 1, xp: 0, face: 1, inv: 0, dashT: 0, dashCd: 0, dashDx: 1, dashDy: 0, anim: 0, shoot: 0, moving: false },
    pas: {}, wp: Object.fromEntries(ch.start.map(id => [id, 1])), brk: {}, wcd: {}, amp: 0, giga: 0, unlocked: new Set(Object.keys(WEAPONS).filter(id => WEAPONS[id].base)),
    en: [], pb: [], eb: [], gems: [], fx: [], txt: [], orbs: 0, orbAng: 0, orbHit: new WeakMap(),
    shake: 0, rerolls: 2, pendingLevels: 0, done: false,
  };
  for (const [id, w] of Object.entries(WEAPONS)) if (w.boss != null && store.get('unlock_' + id, false)) G.unlocked.add(id); // 永久解鎖
  hudRebuild();
}
function setMode(m) {
  S.mode = m;
  $('#title').hidden = m !== 'title'; $('#cards').hidden = m !== 'cards';
  $('#pause').hidden = m !== 'paused'; $('#over').hidden = m !== 'over';
  $('#hud').hidden = m === 'title'; $('#touch').hidden = !(m === 'play' && COARSE); if (m !== 'play') { joy = null; joyShow(false); }
}

// ───────── 能力值 ─────────
const wmax = id => MAX_LV + 2 * (G.brk[id] || 0);
function synList() {
  const tags = new Set(Object.keys(G.wp).map(id => WEAPONS[id].tag));
  return SYNERGIES.filter(s => tags.has(s.a) && tags.has(s.b));
}
function synVal(stat) { return synList().filter(s => s.stat === stat).length * (SYN_BASE + SYN_AMP * G.amp); }
const atkMul = () => 1 + .1 * (G.pas.core || 0) + synVal('atk');
const rateMul = () => 1 / ((1 - .06 * (G.pas.rapid || 0)) / (1 + synVal('rate')));
const moveMul = () => 1 + .08 * (G.pas.engine || 0) + synVal('move');
const magnetR = () => 70 * (1 + .25 * (G.pas.magnet || 0));
const xpNeed = lv => 4 + lv * 4;
const pwr = id => 1 + .15 * Math.max(0, G.wp[id] - MAX_LV); // 突破後的額外倍率

// ───────── 戰鬥輔助 ─────────
function nearest(from, range = 1e9, skip) {
  let best = null, bd = range * range;
  for (const e of G.en) { if (skip && skip.has(e)) continue; const d = dist2(from, e); if (d < bd) { bd = d; best = e; } }
  if (G.boss) { const d = dist2(from, G.boss); if (d < bd && !(skip && skip.has(G.boss))) best = G.boss; }
  return best;
}
function addText(x, y, s, c = '#fff') { if (G.txt.length < 70) G.txt.push({ x, y, s, c, t: .7 }); }
function hurtEnemy(e, dmg, kb = 0, ang = 0) {
  dmg = Math.round(dmg * atkMul());
  e.hp -= dmg; e.hit = .08; addText(e.x, e.y - e.r - 6, dmg, e.boss ? '#ffd24a' : '#fff');
  if (kb && !e.boss) { e.x += Math.cos(ang) * kb; e.y += Math.sin(ang) * kb; }
  sfx('hit');
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; G.kills++; sfx('kill');
  G.giga = Math.min(100, G.giga + (e.boss ? 40 : 1));
  if (e.boss) return;
  G.gems.push({ x: e.x, y: e.y, v: e.xp });
  if (Math.random() < .015) G.gems.push({ x: e.x + 8, y: e.y, v: 0, heal: true });
  G.fx.push({ k: 'puff', x: e.x, y: e.y, t: .3, T: .3 });
}
function hurtPlayer(d) {
  const p = G.p; if (p.inv > 0) return;
  if (G.shieldOn) { const lv = G.wp.barrier || 1, R = 100 + 10 * lv; G.shieldOn = false; G.bcd = Math.max(5, 12 - lv); p.inv = .5; sfx('ice'); G.shake = .15;
    G.fx.push({ k: 'nova', x: p.x, y: p.y, R, t: .35, T: .35, c: '#7fe0ff' }); const dm = (15 + 6 * lv) * (G.ch.kit === 'shade' ? 1.4 : 1);
    for (const e of G.boss ? [...G.en, G.boss] : G.en) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) hurtEnemy(e, dm / atkMul(), 30, Math.atan2(e.y - p.y, e.x - p.x)); return; }
  p.hp -= d; p.inv = .6; G.shake = .25; sfx('hurt'); addText(p.x, p.y - 40, '-' + d, '#ff6070');
  if (p.hp <= 0) gameOver(false);
}
function dash() {
  const p = G.p; if (p.dashCd > 0) return;
  let dx = 0, dy = 0; inputDir(v => { dx = v.x; dy = v.y; });
  if (!dx && !dy) dx = p.face;
  const l = Math.hypot(dx, dy); p.dashDx = dx / l; p.dashDy = dy / l; p.dashT = .18; p.dashCd = G.ch.dashCd; p.inv = Math.max(p.inv, .22); sfx('dash'); G.dashHit = new Set();
  if (G.ch.kit === 'fang') for (let i = 0; i < 8; i++) { const a = i * .7854; G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: 16 + p.lv * 2, life: .8, r: 6, pierce: 1, hit: new Set(), c: '#d49bff' }); }
}
function giga() {
  if (G.giga < 100) return;
  G.giga = 0; sfx('giga'); G.shake = .6; G.fx.push({ k: 'giga', x: G.p.x, y: G.p.y, t: .7, T: .7 });
  for (const e of G.en) if (!e.dead) hurtEnemy(e, 240 / atkMul());
  if (G.boss) hurtEnemy(G.boss, 350 / atkMul());
  G.eb.length = 0;
}
function inputDir(cb) {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x--; if (keys.has('d') || keys.has('arrowright')) x++;
  if (keys.has('w') || keys.has('arrowup')) y--; if (keys.has('s') || keys.has('arrowdown')) y++;
  if (joy && Math.hypot(joy.x, joy.y) > 10) { const l = Math.hypot(joy.x, joy.y); x = joy.x / l; y = joy.y / l; }
  else if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
  cb({ x, y });
}

// ───────── 武器 ─────────
function fireWeapons(dt) {
  const p = G.p;
  for (const [id, lv] of Object.entries(G.wp)) {
    if (id === 'cyclone' || id === 'barrier') continue;
    G.wcd[id] = (G.wcd[id] || 0) - dt * rateMul(); if (G.wcd[id] > 0) continue;
    const k = pwr(id);
    if (id === 'buster') {
      const t = nearest(p, 520); if (!t) continue;
      const base = Math.atan2(t.y - p.y, t.x - p.x), n = 1 + (lv >= 3) + (lv >= 5);
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .13;
        const ch = G.ch.kit === 'volt' && i === 0 && G.shotN % 6 === 5; G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: (10 + 4 * lv) * k * (ch ? 3 : 1), life: 1.1, r: ch ? 12 : 6, pierce: ch ? 5 : lv >= 5 ? 2 : 0, hit: new Set(), c: ch ? '#fff3a0' : '#7fe9ff' }); } G.shotN++;
      p.shoot = .25; p.face = Math.cos(base) >= 0 ? 1 : -1; sfx('shot'); G.wcd[id] = Math.max(.18, .62 - .04 * lv);
    } else if (id === 'saber') {
      const t = nearest(p, 200 + 8 * lv); if (!t) continue; const a = Math.atan2(t.y - p.y, t.x - p.x), R = 100 + 6 * lv, half = lv >= 4 ? 3.2 : .95;
      for (const e of G.boss ? [...G.en, G.boss] : G.en) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > R + e.r) continue;
        let da = Math.atan2(e.y - p.y, e.x - p.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < half) hurtEnemy(e, (18 + 6 * lv) * k, 16, a); }
      G.fx.push({ k: 'slash', x: p.x, y: p.y, a, R, arc: half, t: .22, T: .22 }); p.face = Math.cos(a) >= 0 ? 1 : -1; p.shoot = .2; sfx('zap'); G.wcd[id] = Math.max(.45, .95 - .07 * lv);
    } else if (id === 'sniper') {
      const seen = new Set(); let t = nearest(p, 760); if (!t) continue;
      for (let j = 0; j < 1 + (lv >= 4); j++) { if (!t) break; seen.add(t); const a = Math.atan2(t.y - p.y, t.x - p.x), L = 820, ex = p.x + Math.cos(a) * L, ey = p.y + Math.sin(a) * L;
        for (const e of G.boss ? [...G.en, G.boss] : G.en) { if (e.dead) continue; const dx = ex - p.x, dy = ey - p.y, u = Math.max(0, Math.min(1, ((e.x - p.x) * dx + (e.y - p.y) * dy) / (L * L)));
          if (Math.hypot(p.x + dx * u - e.x, p.y + dy * u - e.y) < e.r + 10) hurtEnemy(e, (40 + 14 * lv) * k, 10, a); }
        G.fx.push({ k: 'beam', x: p.x, y: p.y - 10, ex, ey: ey - 10, t: .16, T: .16 }); p.face = Math.cos(a) >= 0 ? 1 : -1; t = nearest(p, 760, seen); }
      p.shoot = .25; sfx('boom'); G.wcd[id] = Math.max(.9, 1.9 - .12 * lv);
    } else if (id === 'burst') {
      const n = Math.min(8, 2 + Math.floor(lv / 2) * 2); G.burstAng += .43;
      for (let i = 0; i < n; i++) { const a = G.burstAng + i * 6.283 / n; G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, dmg: (6 + 2.5 * lv) * k, life: .95, r: 5, pierce: lv >= 5 ? 1 : 0, hit: new Set(), c: '#e0a8ff' }); }
      p.shoot = .2; sfx('shot'); G.wcd[id] = Math.max(.22, .5 - .04 * lv);
    } else if (id === 'thunder') {
      let t = nearest(p, 420); if (!t) continue; const seen = new Set(), pts = [{ x: p.x, y: p.y - 20 }];
      for (let j = 0; j < 2 + lv && t; j++) { seen.add(t); pts.push({ x: t.x, y: t.y }); hurtEnemy(t, (14 + 5 * lv) * k); t = nearest(t, 220, seen); }
      G.fx.push({ k: 'bolt', pts, t: .18, T: .18 }); sfx('zap'); G.wcd[id] = Math.max(.9, 1.7 - .1 * lv);
    } else if (id === 'missile') {
      const n = 1 + Math.floor(lv / 2);
      for (let i = 0; i < n; i++) { const a = rnd(0, 6.28);
        G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, dmg: (20 + 7 * lv) * k, life: 2.4, r: 8, homing: true, boom: 70 + 4 * lv, hit: new Set(), c: '#ffb347' }); }
      sfx('shot'); G.wcd[id] = Math.max(1.1, 2.3 - .12 * lv);
    } else if (id === 'flame') {
      const t = nearest(p, 220); if (!t) continue; const a = Math.atan2(t.y - p.y, t.x - p.x), R = 120 + 8 * lv;
      for (const e of [...G.en, ...(G.boss ? [G.boss] : [])]) { if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > R + e.r) continue;
        let da = Math.atan2(e.y - p.y, e.x - p.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < .6) hurtEnemy(e, (12 + 4 * lv) * k, 14, a); }
      G.fx.push({ k: 'flame', x: p.x, y: p.y, a, R, t: .25, T: .25 }); p.face = Math.cos(a) >= 0 ? 1 : -1; sfx('flame'); G.wcd[id] = Math.max(.6, 1.3 - .08 * lv);
    } else if (id === 'ice') {
      const R = 120 + 15 * lv;
      for (const e of [...G.en, ...(G.boss ? [G.boss] : [])]) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > R + e.r) continue; hurtEnemy(e, (10 + 3 * lv) * k); e.slow = 2; }
      G.fx.push({ k: 'nova', x: p.x, y: p.y, R, t: .4, T: .4 }); sfx('ice'); G.wcd[id] = Math.max(1.6, 3.2 - .15 * lv);
    }
  }
  if (G.wp.barrier && !G.shieldOn) { G.bcd -= dt * rateMul(); if (G.bcd <= 0) G.shieldOn = true; }
  // 旋風：常駐環繞
  const lv = G.wp.cyclone;
  if (lv) {
    G.orbAng += dt * 2.6; const n = 1 + Math.ceil(lv / 2), k = pwr('cyclone');
    for (let i = 0; i < n; i++) {
      const a = G.orbAng + i * 6.283 / n, o = { x: p.x + Math.cos(a) * 92, y: p.y + Math.sin(a) * 92 - 18, r: 13 };
      G.fx.push({ k: 'orb', x: o.x, y: o.y, t: .03, T: .03 });
      for (const e of [...G.en, ...(G.boss ? [G.boss] : [])]) { if (e.dead) continue;
        if (Math.hypot(e.x - o.x, e.y - o.y) > e.r + o.r) continue;
        if ((G.orbHit.get(e) || 0) > G.t) continue; G.orbHit.set(e, G.t + .5); hurtEnemy(e, (8 + 3 * lv) * k, 10, a + 1.57); }
    }
  }
}
function boom(x, y, R, dmg) {
  G.fx.push({ k: 'nova', x, y, R, t: .3, T: .3, c: '#ffa040' }); sfx('boom');
  for (const e of [...G.en, ...(G.boss ? [G.boss] : [])]) if (!e.dead && Math.hypot(e.x - x, e.y - y) < R + e.r) hurtEnemy(e, dmg);
}

// ───────── 敵人／首領 ─────────
function spawnEnemy() {
  const avail = Object.entries(ENEMIES).filter(([, d]) => G.t >= d.from);
  const w = avail.map(([, q]) => q.w); let r = Math.random() * w.reduce((a, b) => a + b), i = 0;
  while ((r -= w[i]) > 0) i++;
  const [type, d] = avail[i], a = rnd(0, 6.283), R = Math.max(VW, VH) * .62 + 40, m = G.t / 60;
  const hp = d.hp * (1 + m * .28 + m * m * .02);
  G.en.push({ type, d, x: G.p.x + Math.cos(a) * R, y: G.p.y + Math.sin(a) * R, hp, hpMax: hp, r: d.r, xp: d.xp, spd: d.spd * rnd(.92, 1.08), cd: rnd(0, d.shoot || 1.5), ph: rnd(0, 6.283), fuse: 0, leap: 0, hit: 0, slow: 0, ang: 0 });
}
function spawnBoss() {
  const b = BOSSES[G.bossIdx], a = rnd(0, 6.283), m = G.t / 60;
  G.boss = { boss: true, def: b, idx: G.bossIdx, x: G.p.x + Math.cos(a) * 520, y: G.p.y + Math.sin(a) * 520, hp: b.hp, hpMax: b.hp, r: 46 * b.scale / 1.7, spd: 62, q: [], hit: 0, slow: 0, cd: 2.5, state: 'walk', st: 0, dir: 1, ang: 0 };
  $('#bossBar').hidden = false; $('#bossName').textContent = b.name; G.shake = .4; sfx('boom');
}
function ring(b, n, spd, off = 0, r = 7) { for (let i = 0; i < n; i++) { const a = off + i * 6.283 / n; G.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: 10 + b.idx * 2, life: 5, r }); } }
function aimed(b, a, spd, r = 6, dmg) { G.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: dmg || 12 + b.idx * 2, life: 4, r }); }
const later = (b, t, fn) => b.q.push({ t, fn });
// 各首領專屬招式
const BOSS_ATK = {
  stomp(b, ang) { // 象王：震地環＋飛彈齊射
    if (Math.random() < .5) { G.shake = .3; sfx('boom'); G.fx.push({ k: 'nova', x: b.x, y: b.y, R: 160, t: .4, T: .4, c: '#c9d27a' }); ring(b, 16, 120, rnd(0, 6), 9); later(b, .45, () => ring(b, 16, 190, rnd(0, 6), 7)); }
    else { sfx('shot'); for (let i = 0; i < 7; i++) later(b, i * .1, () => aimed(b, ang + rnd(-.35, .35), rnd(190, 250), 9)); }
  },
  fan(b, ang) { // 龍王：火息扇形
    sfx('flame'); for (let k = 0; k < 3; k++) later(b, k * .28, () => { const a0 = Math.atan2(G.p.y - b.y, G.p.x - b.x); for (let i = -4; i <= 4; i++) aimed(b, a0 + i * .1, 190 + Math.abs(i) * 8 + k * 20, 7); });
  },
  spiral(b) { // 獅王：冰晶螺旋
    sfx('ice'); for (let k = 0; k < 8; k++) later(b, k * .16, () => { ring(b, 3, 170, k * .55, 7); ring(b, 3, 170, k * .55 + 3.14, 7); });
    later(b, 1.4, () => ring(b, 14, 150, rnd(0, 6), 7));
  },
  bolt(b, ang) { // 獸王：雷擊連射＋閃現
    sfx('zap'); for (let k = 0; k < 4; k++) later(b, k * .22, () => { const a0 = Math.atan2(G.p.y - b.y, G.p.x - b.x); for (let i = -1; i <= 1; i++) aimed(b, a0 + i * .07, 380, 5); });
    later(b, .9, () => { const q = rnd(0, 6.283); G.fx.push({ k: 'puff', x: b.x, y: b.y, t: .3, T: .3 }); b.x = G.p.x + Math.cos(q) * 300; b.y = G.p.y + Math.sin(q) * 300; G.fx.push({ k: 'nova', x: b.x, y: b.y, R: 90, t: .3, T: .3, c: '#fff36a' }); sfx('dash'); });
  },
};
function bossAtk(b, ang) {
  const pat = b.def.pat === 'all' ? ['stomp', 'fan', 'spiral', 'bolt'][(Math.random() * 4) | 0] : b.def.pat;
  BOSS_ATK[pat](b, ang);
  if (b.def.pat === 'all' && b.hp < b.hpMax * .5 && Math.random() < .5) later(b, .6, () => ring(b, 20, 140, rnd(0, 6), 6));
}
function updateBoss(b, dt) {
  const p = G.p, d = b.def, ang = Math.atan2(p.y - b.y, p.x - b.x); b.dir = Math.cos(ang) >= 0 ? 1 : -1; b.ang = ang;
  if (b.slow > 0) b.slow -= dt; b.hit = Math.max(0, b.hit - dt);
  for (const q of b.q) q.t -= dt; for (const q of b.q) if (q.t <= 0) q.fn(); b.q = b.q.filter(q => q.t > 0);
  const sp = b.spd * (b.slow > 0 ? .5 : 1);
  if (b.state === 'walk') {
    b.x += Math.cos(ang) * sp * dt; b.y += Math.sin(ang) * sp * dt; b.cd -= dt;
    if (b.cd <= 0) { b.cd = 3.2 - Math.min(1.2, b.idx * .25);
      if (Math.random() < .35) { b.state = 'tele'; b.st = .7; b.lock = ang; } else bossAtk(b, ang); }
  } else if (b.state === 'tele') { b.st -= dt; if (b.st <= 0) { b.state = 'dash'; b.st = .55; sfx('dash'); } }
  else if (b.state === 'dash') { b.st -= dt; b.x += Math.cos(b.lock) * 430 * dt; b.y += Math.sin(b.lock) * 430 * dt; if (b.st <= 0) b.state = 'walk'; }
  if (dist2(p, b) < (b.r + 16) ** 2) hurtPlayer(18 + b.idx * 3);
  $('#bossFill').style.width = Math.max(0, b.hp / b.hpMax * 100) + '%';
  if (b.hp <= 0) bossDown(b);
}
function bossDown(b) {
  sfx('bossdie'); G.shake = .8; G.fx.push({ k: 'giga', x: b.x, y: b.y, t: .8, T: .8 });
  G.eb.length = 0; G.boss = null; G.giga = Math.min(100, G.giga + 40); $('#bossBar').hidden = true;
  for (let i = 0; i < 18; i++) G.gems.push({ x: b.x + rnd(-60, 60), y: b.y + rnd(-60, 60), v: 4 });
  if (b.def.final) return gameOver(true);
  setTimeout(() => { if (G && !G.done) bossReward(b.def); }, 900);
}

// ───────── 卡片 ─────────
function rowsFor(id, lv) { return WEAPONS[id].rows(lv); }
function weaponCard(id) {
  const w = WEAPONS[id], lv = G.wp[id] || 0, next = lv + 1;
  const rows = rowsFor(id, next).map((r, i) => lv ? [r[0], `${rowsFor(id, lv)[i][1]} → ${r[1]}`] : r);
  return { type: 'weapon', cls: '', tag: lv ? `武器 Lv${lv}→${next}` : '新武器', icon: ico(id), name: w.name, art: ico(id, 72), desc: w.desc, rows, apply: () => { G.wp[id] = next; } };
}
function passiveCard(id) {
  const p = PASSIVES[id], n = (G.pas[id] || 0) + 1;
  return { type: 'pas', cls: 'pass', tag: `強化 ${n}/${p.max}`, icon: ico(id), name: p.name, art: ico(id, 72), desc: p.desc, rows: [], apply: () => { G.pas[id] = n; if (id === 'armor') { G.p.maxHp += 20; G.p.hp = Math.min(G.p.maxHp, G.p.hp + 20); } } };
}
const healCard = () => ({ type: 'heal', cls: 'heal', tag: '修復', icon: ico('heal'), name: '緊急維修', art: ico('heal', 72), desc: '回復 40% 最大生命。', rows: [], apply: () => { G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.maxHp * .4); } });
function levelOffers() {
  const pool = [];
  for (const id of Object.keys(G.wp)) if (G.wp[id] < wmax(id)) pool.push({ w: 3, c: () => weaponCard(id) });
  for (const id of G.unlocked) if (!G.wp[id] && Object.keys(G.wp).length < 6) pool.push({ w: 2.2, c: () => weaponCard(id) });
  for (const id of Object.keys(PASSIVES)) if ((G.pas[id] || 0) < PASSIVES[id].max) pool.push({ w: 1.5, c: () => passiveCard(id) });
  pool.push({ w: .7, c: healCard });
  const out = [];
  while (out.length < 3 && pool.length) {
    let r = Math.random() * pool.reduce((a, b) => a + b.w, 0), i = 0; while ((r -= pool[i].w) > 0 && i < pool.length - 1) i++;
    out.push(pool.splice(i, 1)[0].c());
  }
  return out;
}
function showCards(head, cards, foot, opts = {}) {
  S.cards = { list: cards, reroll: !!opts.reroll, head, foot, after: opts.after };
  setMode('cards'); renderCards();
}
function renderCards() {
  const c = S.cards;
  $('#cardsHead').innerHTML = c.head;
  $('#cardsFoot').innerHTML = c.reroll ? `<button id="rr"${G.rerolls <= 0 ? ' disabled' : ''}>R　重抽（剩 ${G.rerolls} 次）</button>` : c.foot || '';
  $('#cardsRow').innerHTML = c.list.map((k, i) => `<div class="card ${k.cls}" data-i="${i}"><div class="tag">${k.tag}</div>
    <div class="head"><div class="ico">${k.icon}</div><div class="nm">${k.name}</div></div>
    <div class="art">${k.art}</div><div class="ds">${k.desc}</div>
    <div class="rows">${k.rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div><span class="key">${i + 1}</span></div>`).join('');
}
$('#cardsFoot').addEventListener('click', e => { if (e.target.closest('#rr') && S.cards) rerollCards(); });
$('#cardsRow').addEventListener('click', e => { const el = e.target.closest('.card'); if (el) chooseCard(+el.dataset.i); });
function chooseCard(i) {
  const k = S.cards && S.cards.list[i]; if (!k) return;
  sfx('card'); k.apply(); const after = S.cards.after; S.cards = null; hudRebuild();
  if (after) after();
  if (G.pendingLevels > 0) { G.pendingLevels--; return levelUpUI(); }
  setMode('play');
}
function rerollCards() { if (G.rerolls <= 0 || !S.cards.reroll) return; G.rerolls--; S.cards.list = levelOffers(); renderCards(); }
function levelUpUI() { showCards(`升級！<small>Lv ${G.p.lv}</small>`, levelOffers(), '', { reroll: true }); sfx('level'); }
function bossReward(def) {
  const cards = [];
  const nw = def.weapon;
  if (nw) { const wc = weaponCard(nw); cards.push({ ...wc, cls: 'boss', tag: 'BOSS 武器', desc: '取得新的首領武器。選擇後永久解鎖，之後升級卡片也會出現。', apply: () => { G.wp[nw] = 1; G.unlocked.add(nw); store.set('unlock_' + nw, true); } }); }
  else { const own = Object.keys(G.wp).filter(id => G.wp[id] < wmax(id)); const id = own.length ? pick(own) : 'buster'; const wc = weaponCard(id); cards.push({ ...wc, cls: 'boss', tag: 'BOSS 強化', desc: '首領核心使武器進化。', apply: () => { G.wp[id] = Math.min(wmax(id), (G.wp[id] || 0) + 2); } }); }
  const ids = Object.keys(G.wp).sort((a, b) => G.wp[b] - G.wp[a]); const tgt = ids[0];
  cards.push({ type: 'limit', cls: 'limit', tag: '突破', icon: ico('limit'), name: '極限突破', art: ico(tgt, 56) + ico('limit', 40), desc: `${WEAPONS[tgt].name}突破極限：等級上限 +2，並立刻升 1 級。`,
    rows: [['等級上限', `${wmax(tgt)} → ${wmax(tgt) + 2}`]], apply: () => { G.brk[tgt] = (G.brk[tgt] || 0) + 1; G.wp[tgt]++; } });
  const n = synList().length, v = n * (SYN_BASE + SYN_AMP * G.amp);
  cards.push({ type: 'syn', cls: 'syn', tag: '協同', icon: ico('link'), name: '協同增幅器', art: ico('link', 72), desc: '所有協同的加成 +5%，包含之後才完成的協同。',
    rows: [['目前協同', n], ['總加成', `+${Math.round(v * 100)}% → +${Math.round(n * (SYN_BASE + SYN_AMP * (G.amp + 1)) * 100)}%`]], apply: () => { G.amp++; } });
  showCards(`首領擊破<small>${def.name}</small>`, cards, '選擇一項獎勵');
  sfx('level');
}

// ───────── HUD ─────────
function hudRebuild() {
  $('#weapons').innerHTML = Object.entries(G.wp).map(([id, lv]) => `<div class="wchip"><b>${ico(id)}</b>Lv${lv}${lv >= wmax(id) ? ' MAX' : ''}</div>`).join('');
  const sl = synList();
  $('#synergies').innerHTML = sl.map(s => `${s.name}　<em>${s.label} +${Math.round((SYN_BASE + SYN_AMP * G.amp) * 100)}%</em>`).join('<br>');
}
function hudTick() {
  const p = G.p;
  $('#hpFill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; $('#hpTxt').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
  $('#xpFill').style.width = p.xp / xpNeed(p.lv) * 100 + '%'; $('#lvTxt').textContent = 'Lv ' + p.lv;
  $('#timer').textContent = fmt(G.t);
  $('#gigaFill').style.height = G.giga + '%'; $('#gigaBox').classList.toggle('ready', G.giga >= 100); $('#tGiga').classList.toggle('ready', G.giga >= 100); $('#tGiga').style.setProperty('--f', G.giga + '%');
}

// ───────── 主更新 ─────────
function update(dt) {
  G.t += dt; const p = G.p;
  p.inv = Math.max(0, p.inv - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.shoot = Math.max(0, p.shoot - dt);
  // 移動
  let mv = { x: 0, y: 0 }; inputDir(v => mv = v);
  const sp = 190 * moveMul() * G.ch.spd;
  if (p.dashT > 0) { p.dashT -= dt; p.x += p.dashDx * 620 * dt; p.y += p.dashDy * 620 * dt;
    if (G.ch.kit === 'blade') for (const e of G.boss ? [...G.en, G.boss] : G.en) if (!e.dead && !G.dashHit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 46) { G.dashHit.add(e); hurtEnemy(e, 38 + p.lv * 4, 18, Math.atan2(p.dashDy, p.dashDx)); G.fx.push({ k: 'slash', x: e.x, y: e.y, a: Math.atan2(p.dashDy, p.dashDx), R: 50, arc: 1, t: .18, T: .18 }); } }
  else { p.x += mv.x * sp * dt; p.y += mv.y * sp * dt; }
  p.moving = !!(mv.x || mv.y); if (mv.x) p.face = mv.x > 0 ? 1 : -1; p.anim += dt;
  // 生怪
  if (!G.boss || true) {
    const m = G.t / 60; G.spawnAcc += dt * (1.1 + m * .55 + m * m * .04) * (G.boss ? .5 : 1);
    while (G.spawnAcc >= 1) { G.spawnAcc--; if (G.en.length < 230) spawnEnemy(); }
  }
  if (!G.boss && G.bossIdx < BOSSES.length && G.t >= (G.bossIdx + 1) * BOSS_EVERY) { spawnBoss(); G.bossIdx++; }
  if (G.t >= WIN_TIME && !G.done && !G.boss) gameOver(true);
  fireWeapons(dt);
  // 玩家子彈
  for (const b of G.pb) {
    if (b.homing) { const t = nearest(b, 700); if (t) { const a = Math.atan2(t.y - b.y, t.x - b.x), c = Math.atan2(b.vy, b.vx); let da = a - c; da = Math.atan2(Math.sin(da), Math.cos(da)); const na = c + Math.max(-4 * dt, Math.min(4 * dt, da)), s = Math.min(380, Math.hypot(b.vx, b.vy) + 260 * dt); b.vx = Math.cos(na) * s; b.vy = Math.sin(na) * s; } }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of G.boss ? [...G.en, G.boss] : G.en) {
      if (e.dead || b.hit.has(e) || b.dead) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        b.hit.add(e);
        if (b.boom) { boom(b.x, b.y, b.boom, b.dmg); b.dead = true; } else { hurtEnemy(e, b.dmg, 6, Math.atan2(b.vy, b.vx)); if (b.pierce-- <= 0) b.dead = true; }
      }
    }
  }
  G.pb = G.pb.filter(b => b.life > 0 && !b.dead);
  // 敵人
  for (const e of G.en) {
    if (e.dead) continue; e.hit = Math.max(0, e.hit - dt); if (e.slow > 0) e.slow -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; let s = e.spd * (e.slow > 0 ? .5 : 1); e.ang = Math.atan2(dy, dx);
    if (e.d.leap) { e.cd -= dt; if (e.leap > 0) { e.leap -= dt; s *= 3.4; } else if (e.cd <= 0 && d < 340) { e.leap = .4; e.cd = 2.2 + rnd(0, 1.2); } }
    if (e.d.bomb) { if (e.fuse > 0) { e.fuse -= dt; s *= .3; if (e.fuse <= 0) { G.fx.push({ k: 'nova', x: e.x, y: e.y, R: 80, t: .3, T: .3, c: '#ff8a3a' }); sfx('boom'); if (Math.hypot(p.x - e.x, p.y - e.y) < 80) hurtPlayer(22); killEnemy(e); continue; } } else if (d < e.r + 46) e.fuse = .65; }
    if (e.d.shoot) {
      if (d > 250) { e.x += dx / d * s * dt; e.y += dy / d * s * dt; } else if (d < 170) { e.x -= dx / d * s * dt; e.y -= dy / d * s * dt; }
      e.cd -= dt; if (e.cd <= 0 && d < 520) { e.cd = e.d.shoot; for (const o of e.d.fan ? [-.26, 0, .26] : [0]) { const a = e.ang + o; G.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, dmg: 8, life: 4, r: 5 }); } }
    } else { e.x += dx / d * s * dt; e.y += dy / d * s * dt; if (e.d.weave) { const w = Math.sin(G.t * 4.5 + e.ph) * s * .9 * dt; e.x += -dy / d * w; e.y += dx / d * w; } }
    if (d < e.r + 14) hurtPlayer(e.d.dmg);
  }
  // 敵人互相擠開（粗略）
  for (let i = 0; i < G.en.length; i += 2) { const a = G.en[i], b = G.en[(i * 7 + 3) % G.en.length]; if (a && b && a !== b) { const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy); if (d && d < a.r + b.r) { const f = (a.r + b.r - d) * .3; a.x += dx / d * f; a.y += dy / d * f; b.x -= dx / d * f; b.y -= dy / d * f; } } }
  G.en = G.en.filter(e => !e.dead && dist2(e, p) < 1600 ** 2);
  if (G.boss) updateBoss(G.boss, dt);
  // 敵彈
  for (const b of G.eb) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 12) { hurtPlayer(b.dmg); b.life = 0; } }
  G.eb = G.eb.filter(b => b.life > 0);
  // 寶石
  const mr = magnetR();
  for (const g of G.gems) {
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < mr || g.pull) { g.pull = true; g.x += (p.x - g.x) / d * 420 * dt; g.y += (p.y - g.y) / d * 420 * dt; }
    if (d < 18) { g.took = true; if (g.heal) { p.hp = Math.min(p.maxHp, p.hp + 25); addText(p.x, p.y - 40, '+25', '#7dff9a'); } else { p.xp += g.v; sfx('gem'); } }
  }
  G.gems = G.gems.filter(g => !g.took);
  if (G.gems.length > 600) G.gems.splice(0, G.gems.length - 600);
  while (p.xp >= xpNeed(p.lv)) { p.xp -= xpNeed(p.lv); p.lv++; G.pendingLevels++; }
  // 特效／文字
  for (const f of G.fx) f.t -= dt; G.fx = G.fx.filter(f => f.t > 0);
  for (const t of G.txt) { t.t -= dt; t.y -= 30 * dt; } G.txt = G.txt.filter(t => t.t > 0);
  G.shake = Math.max(0, G.shake - dt);
  hudTick();
  if (G.pendingLevels > 0 && S.mode === 'play') { G.pendingLevels--; levelUpUI(); }
}
function gameOver(win) {
  if (G.done) return; G.done = true; setMode('over');
  $('#overTitle').textContent = win ? '任務完成' : '機體損毀';
  const best = Math.max(store.get('best', 0), G.t | 0); store.set('best', best);
  $('#overStats').innerHTML = `<tr><td>存活時間</td><td>${fmt(G.t)}</td></tr><tr><td>擊破數</td><td>${G.kills}</td></tr><tr><td>等級</td><td>${G.p.lv}</td></tr><tr><td>最佳紀錄</td><td>${fmt(best)}</td></tr>`;
  $('#bossBar').hidden = true;
}

// ───────── 繪製 ─────────
let bgPat = null;
function makeBg() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#071328'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(53,176,255,.14)'; x.lineWidth = 1; x.strokeRect(.5, .5, 127, 127);
  x.strokeStyle = 'rgba(53,176,255,.06)'; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
  x.fillStyle = 'rgba(53,176,255,.22)'; for (const [a, b] of [[8, 8], [120, 8], [8, 120], [120, 120]]) x.fillRect(a - 2, b - 2, 4, 4);
  return ctx.createPattern(c, 'repeat');
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  if (!G) return;
  const p = G.p, sh = G.shake > 0 ? G.shake * 10 : 0;
  const cx = p.x - VW / 2 + rnd(-sh, sh), cy = p.y - VH / 2 + rnd(-sh, sh);
  bgPat = bgPat || makeBg();
  ctx.save(); ctx.scale(Z, Z); ctx.translate(-cx, -cy); ctx.fillStyle = bgPat; ctx.fillRect(cx, cy, VW, VH);
  // 寶石
  for (const g of G.gems) { ctx.fillStyle = g.heal ? '#ff6b7e' : '#57d8ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(g.x, g.y, g.heal ? 6 : 4 + Math.min(3, g.v / 2), 0, 6.283); ctx.fill(); }
  ctx.shadowBlur = 0;
  // 敵人（依 y 排序）
  const list = [...G.en]; if (G.boss) list.push(G.boss); list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.x < cx - 160 || e.x > cx + VW + 160 || e.y < cy - 160 || e.y > cy + VH + 160) continue;
    if (e.boss) { drawBoss(e); continue; }
    const im = e.d.art ? ART.small[e.d.art][((G.t * 8 + e.ph) | 0) % 2] : e.d.hue ? IMG.tint.robot200 : IMG[e.d.img]; const sc = e.d.scale;
    ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, e.r * .6, e.r, e.r * .4, 0, 0, 6.283); ctx.fill();
    ctx.rotate(e.ang); ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
    if (e.hit > 0 || (e.fuse > 0 && ((G.t * 14) | 0) % 2)) { ctx.globalAlpha = .6; ctx.fillStyle = e.fuse > 0 ? '#ffd24a' : '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 6.283); ctx.fill(); }
    if (e.slow > 0) { ctx.globalAlpha = .35; ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
  // 玩家
  drawHero();
  // 玩家子彈
  for (const b of G.pb) { ctx.fillStyle = b.c; ctx.shadowColor = b.c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); }
  ctx.shadowBlur = 0;
  for (const b of G.eb) { ctx.fillStyle = '#ff4466'; ctx.shadowColor = '#ff4466'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .4, 0, 6.283); ctx.fill(); }
  ctx.shadowBlur = 0;
  // 特效
  for (const f of G.fx) drawFx(f);
  // 傷害數字
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  for (const t of G.txt) { ctx.globalAlpha = Math.min(1, t.t * 2); ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x + 1, t.y + 1); ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y); }
  ctx.globalAlpha = 1; ctx.restore();
  // 玩家受傷閃紅
  if (p.inv > 0 && G.t > .1 && p.dashT <= 0 && p.hp < p.maxHp) { ctx.fillStyle = `rgba(255,40,60,${Math.min(.18, p.inv * .3)})`; ctx.fillRect(0, 0, W, H); }
}
function drawHero() {
  const p = G.p; const set = p.shoot > 0 && p.moving ? 'RunShoot' : p.moving ? 'Run' : 'Idle'; const fr = IMG.char[G.ch.id][set];
  const im = fr[((p.anim * (set === 'Idle' ? 8 : 14)) | 0) % fr.length]; const h = G.ch.h || 96, w = im.width / im.height * h;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 28, 22, 8, 0, 0, 6.283); ctx.fill();
  if (p.dashT > 0) { ctx.globalAlpha = .6; }
  else if (p.inv > 0 && ((G.t * 20) | 0) % 2) ctx.globalAlpha = .4;
  ctx.scale(G.ch.flipArt ? -p.face : p.face, 1); ctx.drawImage(im, -w / 2, -h / 2 - 8, w, h); ctx.restore();
  if (G.shieldOn) { ctx.save(); ctx.strokeStyle = 'rgba(127,224,255,.85)'; ctx.fillStyle = 'rgba(127,224,255,.12)'; ctx.lineWidth = 3; ctx.shadowColor = '#7fe0ff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 46 + Math.sin(G.t * 6) * 2, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore(); }
}
function drawBoss(b) {
  const fr = ART.bosses[b.idx], im = fr[((G.t * 5) | 0) % fr.length]; const h = 230 * b.def.scale / 1.7, w = h;
  ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, h * .3, h * .32, h * .08, 0, 0, 6.283); ctx.fill();
  if (b.state === 'tele') { ctx.strokeStyle = `rgba(255,70,90,${.4 + .4 * Math.sin(G.t * 40)})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b.lock) * 430 * .55, Math.sin(b.lock) * 430 * .55); ctx.stroke(); }
  ctx.scale(b.dir, 1); ctx.drawImage(im, -w / 2, -h / 2 - 8, w, h);
  if (b.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35; ctx.drawImage(im, -w / 2, -h / 2 - 8, w, h); ctx.globalCompositeOperation = 'source-over';}
  ctx.restore();
}
function drawFx(f) {
  const k = 1 - f.t / f.T;
  if (f.k === 'bolt') { ctx.strokeStyle = '#fff36a'; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.beginPath(); f.pts.forEach((q, i) => i ? ctx.lineTo(q.x + rnd(-6, 6), q.y + rnd(-6, 6)) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.shadowBlur = 0; }
  else if (f.k === 'nova') { ctx.strokeStyle = f.c || '#9fe6ff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.R * (.3 + .7 * k), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'flame') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = (1 - k) * .7; const g = ctx.createRadialGradient(0, 0, 10, 0, 0, f.R); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ff8a20'); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, f.R, -.6, .6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  else if (f.k === 'slash') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = (1 - k) * .9; const g = ctx.createRadialGradient(0, 0, f.R * .3, 0, 0, f.R); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.8, '#ff9ab0'); g.addColorStop(1, '#fff');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, f.R * (.6 + .4 * k), -f.arc, f.arc); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  else if (f.k === 'beam') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffffff'; ctx.shadowColor = '#7fe0ff'; ctx.shadowBlur = 16; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.ex, f.ey); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
  else if (f.k === 'orb') { ctx.fillStyle = '#b8ffd8'; ctx.shadowColor = '#5dffb0'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; }
  else if (f.k === 'puff') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#cfe9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + 22 * k, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'giga') { ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 16 * (1 - k) + 2; ctx.beginPath(); ctx.arc(f.x, f.y, 40 + 900 * k, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
}

// ───────── 迴圈與啟動 ─────────
let last = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (G && S.mode === 'play') update(dt);
  draw(); requestAnimationFrame(frame);
}
let chosen = store.get('char', 'volt');
function renderChars() {
  $('#chars').innerHTML = CHARS.map(c => `<button class="char${c.id === chosen ? ' on' : ''}" data-id="${c.id}"><div class="pt"></div><b>${c.name}</b><em>${c.role}</em><p><u>${c.skill}</u>${c.skillDesc}</p><small>${c.start.map(id => WEAPONS[id].name).join('、')}</small></button>`).join('');
  document.querySelectorAll('#chars .char').forEach(b => { const c = CHARS.find(x => x.id === b.dataset.id), cv2 = document.createElement('canvas'), im = IMG.char[c.id].Idle[0]; cv2.width = 96; cv2.height = 96; cv2.getContext('2d').drawImage(im, 0, 0, 96, 96 * im.height / im.width); b.querySelector('.pt').appendChild(cv2); });
}
$('#chars').addEventListener('click', e => { const b = e.target.closest('.char'); if (!b) return; chosen = b.dataset.id; store.set('char', chosen); document.querySelectorAll('#chars .char').forEach(x => x.classList.toggle('on', x === b)); sfx('card'); });
function start() { newGame(chosen); setMode('play'); startMusic(); }
$('#btnStart').addEventListener('click', start);
$('#btnAgain').addEventListener('click', start);
$('#btnResume').addEventListener('click', () => setMode('play'));
loadAll().then(() => { G = null; renderChars(); setMode('title'); requestAnimationFrame(frame); });
window.__mecha = { get G() { return G; }, S, BOSSES, update, giga, bossReward, levelUpUI };
