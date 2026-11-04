'use strict';
// ───────── 基礎 ─────────
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0;
function resize() {
  const d = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * d; cv.height = H * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
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
async function loadAll() {
  IMG.hero = {};
  const jobs = [];
  for (const [n, c] of Object.entries(HERO_ANIM)) {
    IMG.hero[n] = [];
    for (let i = 1; i <= c; i++) jobs.push(loadImg(`assets/hero/${n}_${i}.png`).then(im => IMG.hero[n][i - 1] = im));
  }
  for (const k of ['robot', 'zombie', 'soldier']) jobs.push(loadImg(`assets/enemy/${k}.png`).then(im => IMG[k] = im));
  await Promise.all(jobs);
  // 色相變體
  IMG.tint = {};
  const tint = (im, hue, key) => {
    const c = document.createElement('canvas'); c.width = im.width || 1; c.height = im.height || 1;
    const x = c.getContext('2d'); try { x.filter = `hue-rotate(${hue}deg) saturate(1.3)`; } catch {}
    x.drawImage(im, 0, 0); IMG.tint[key] = c;
  };
  tint(IMG.robot, 200, 'robot200');
  BOSSES.forEach((b, i) => {
    IMG.tint['boss' + i] = IMG.hero.Run.map(f => { const c = document.createElement('canvas'); c.width = f.width; c.height = f.height;
      const x = c.getContext('2d'); try { x.filter = `hue-rotate(${b.hue}deg) saturate(1.4) brightness(.95)`; } catch {} x.drawImage(f, 0, 0); return c; });
  });
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
cv.addEventListener('touchstart', e => { const t = e.changedTouches[0]; joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: 0, y: 0 }; $('#touch').hidden = S.mode !== 'play'; }, { passive: true });
cv.addEventListener('touchmove', e => { if (!joy) return; for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.x = t.clientX - joy.x0; joy.y = t.clientY - joy.y0; } }, { passive: true });
const endTouch = e => { if (joy) for (const t of e.changedTouches) if (t.identifier === joy.id) joy = null; };
cv.addEventListener('touchend', endTouch); cv.addEventListener('touchcancel', endTouch);
$('#tDash').addEventListener('touchstart', e => { e.stopPropagation(); if (S.mode === 'play') dash(); });
$('#tGiga').addEventListener('touchstart', e => { e.stopPropagation(); if (S.mode === 'play') giga(); });

// ───────── 狀態 ─────────
const S = { mode: 'title', cards: null };
let G = null;
function newGame() {
  G = {
    t: 0, kills: 0, spawnAcc: 0, nextBoss: 0, bossIdx: 0, boss: null,
    p: { x: 0, y: 0, hp: 100, maxHp: 100, lv: 1, xp: 0, face: 1, inv: 0, dashT: 0, dashCd: 0, dashDx: 1, dashDy: 0, anim: 0, shoot: 0, moving: false },
    pas: {}, wp: { buster: 1 }, brk: {}, wcd: {}, amp: 0, giga: 0, unlocked: new Set(['buster', 'thunder', 'cyclone']),
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
  $('#hud').hidden = m === 'title'; $('#touch').hidden = !(m === 'play' && 'ontouchstart' in window);
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
  p.hp -= d; p.inv = .6; G.shake = .25; sfx('hurt'); addText(p.x, p.y - 40, '-' + d, '#ff6070');
  if (p.hp <= 0) gameOver(false);
}
function dash() {
  const p = G.p; if (p.dashCd > 0) return;
  let dx = 0, dy = 0; inputDir(v => { dx = v.x; dy = v.y; });
  if (!dx && !dy) dx = p.face;
  const l = Math.hypot(dx, dy); p.dashDx = dx / l; p.dashDy = dy / l; p.dashT = .18; p.dashCd = 1.4; p.inv = Math.max(p.inv, .22); sfx('dash');
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
    if (id === 'cyclone') continue;
    G.wcd[id] = (G.wcd[id] || 0) - dt * rateMul(); if (G.wcd[id] > 0) continue;
    const k = pwr(id);
    if (id === 'buster') {
      const t = nearest(p, 520); if (!t) continue;
      const base = Math.atan2(t.y - p.y, t.x - p.x), n = 1 + (lv >= 3) + (lv >= 5);
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .13;
        G.pb.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: (10 + 4 * lv) * k, life: 1.1, r: 6, pierce: lv >= 5 ? 2 : 0, hit: new Set(), c: '#7fe9ff' }); }
      p.shoot = .25; p.face = Math.cos(base) >= 0 ? 1 : -1; sfx('shot'); G.wcd[id] = Math.max(.18, .62 - .04 * lv);
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
  const w = avail.map(([k]) => ({ grunt: 6, runner: 4, shooter: 2.5, tank: 1 }[k])); let r = Math.random() * w.reduce((a, b) => a + b), i = 0;
  while ((r -= w[i]) > 0) i++;
  const [type, d] = avail[i], a = rnd(0, 6.283), R = Math.max(W, H) * .62 + 40, m = G.t / 60;
  const hp = d.hp * (1 + m * .28 + m * m * .02);
  G.en.push({ type, d, x: G.p.x + Math.cos(a) * R, y: G.p.y + Math.sin(a) * R, hp, hpMax: hp, r: d.r, xp: d.xp, spd: d.spd * rnd(.92, 1.08), cd: rnd(0, d.shoot || 1), hit: 0, slow: 0, ang: 0 });
}
function spawnBoss() {
  const b = BOSSES[G.bossIdx], a = rnd(0, 6.283), m = G.t / 60;
  G.boss = { boss: true, def: b, idx: G.bossIdx, x: G.p.x + Math.cos(a) * 520, y: G.p.y + Math.sin(a) * 520, hp: b.hp, hpMax: b.hp, r: 34 * b.scale / 1.7, spd: 62, hit: 0, slow: 0, cd: 2.5, state: 'walk', st: 0, dir: 1, ang: 0 };
  $('#bossBar').hidden = false; $('#bossName').textContent = b.name; G.shake = .4; sfx('boom');
}
function ring(b, n, spd, off = 0) { for (let i = 0; i < n; i++) { const a = off + i * 6.283 / n; G.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: 10 + b.idx * 2, life: 5, r: 7 }); } }
function updateBoss(b, dt) {
  const p = G.p, d = b.def, ang = Math.atan2(p.y - b.y, p.x - b.x); b.dir = Math.cos(ang) >= 0 ? 1 : -1; b.ang = ang;
  if (b.slow > 0) b.slow -= dt; b.hit = Math.max(0, b.hit - dt);
  const sp = b.spd * (b.slow > 0 ? .5 : 1);
  if (b.state === 'walk') {
    b.x += Math.cos(ang) * sp * dt; b.y += Math.sin(ang) * sp * dt; b.cd -= dt;
    if (b.cd <= 0) { const r = Math.random(); b.cd = 3.2 - Math.min(1.2, b.idx * .25);
      if (r < .4) { b.state = 'tele'; b.st = .7; b.lock = ang; }
      else if (r < .75) { ring(b, 14 + b.idx * 3, 150 + b.idx * 12, rnd(0, 6)); if (b.idx >= 2) setTimeout(() => G.boss === b && ring(b, 14 + b.idx * 3, 150, .2), 450); sfx('shot'); }
      else { for (let i = -2; i <= 2; i++) { const a = ang + i * .16; G.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: 12 + b.idx * 2, life: 4, r: 7 }); } sfx('shot'); } }
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
  return { type: 'weapon', cls: '', tag: lv ? `武器 Lv${lv}→${next}` : '新武器', icon: w.icon, name: w.name, art: w.icon, desc: w.desc, rows, apply: () => { G.wp[id] = next; } };
}
function passiveCard(id) {
  const p = PASSIVES[id], n = (G.pas[id] || 0) + 1;
  return { type: 'pas', cls: 'pass', tag: `強化 ${n}/${p.max}`, icon: p.icon, name: p.name, art: p.icon, desc: p.desc, rows: [], apply: () => { G.pas[id] = n; if (id === 'armor') { G.p.maxHp += 20; G.p.hp = Math.min(G.p.maxHp, G.p.hp + 20); } } };
}
const healCard = () => ({ type: 'heal', cls: 'heal', tag: '修復', icon: '💊', name: '緊急維修', art: '💊', desc: '回復 40% 最大生命。', rows: [], apply: () => { G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.maxHp * .4); } });
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
  $('#cardsFoot').textContent = c.reroll ? `R 重抽（剩 ${G.rerolls} 次）` : c.foot || '';
  $('#cardsRow').innerHTML = c.list.map((k, i) => `<div class="card ${k.cls}" data-i="${i}"><div class="tag">${k.tag}</div>
    <div class="head"><div class="ico">${k.icon}</div><div class="nm">${k.name}</div></div>
    <div class="art">${k.art}</div><div class="ds">${k.desc}</div>
    <div class="rows">${k.rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div><span class="key">${i + 1}</span></div>`).join('');
}
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
  cards.push({ type: 'limit', cls: 'limit', tag: '突破', icon: WEAPONS[tgt].icon, name: '極限突破', art: `<span style="font-size:36px">${WEAPONS[tgt].icon}⚡</span>`, desc: `${WEAPONS[tgt].name}突破極限：等級上限 +2，並立刻升 1 級。`,
    rows: [['等級上限', `${wmax(tgt)} → ${wmax(tgt) + 2}`]], apply: () => { G.brk[tgt] = (G.brk[tgt] || 0) + 1; G.wp[tgt]++; } });
  const n = synList().length, v = n * (SYN_BASE + SYN_AMP * G.amp);
  cards.push({ type: 'syn', cls: 'syn', tag: '協同', icon: '🔗', name: '協同增幅器', art: '🔗', desc: '所有協同的加成 +5%，包含之後才完成的協同。',
    rows: [['目前協同', n], ['總加成', `+${Math.round(v * 100)}% → +${Math.round(n * (SYN_BASE + SYN_AMP * (G.amp + 1)) * 100)}%`]], apply: () => { G.amp++; } });
  showCards(`首領擊破<small>${def.name}</small>`, cards, '選擇一項獎勵');
  sfx('level');
}

// ───────── HUD ─────────
function hudRebuild() {
  $('#weapons').innerHTML = Object.entries(G.wp).map(([id, lv]) => `<div class="wchip"><b>${WEAPONS[id].icon}</b>Lv${lv}${lv >= wmax(id) ? ' MAX' : ''}</div>`).join('');
  const sl = synList();
  $('#synergies').innerHTML = sl.map(s => `${s.name}　<em>${s.label} +${Math.round((SYN_BASE + SYN_AMP * G.amp) * 100)}%</em>`).join('<br>');
}
function hudTick() {
  const p = G.p;
  $('#hpFill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; $('#hpTxt').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
  $('#xpFill').style.width = p.xp / xpNeed(p.lv) * 100 + '%'; $('#lvTxt').textContent = 'Lv ' + p.lv;
  $('#timer').textContent = fmt(G.t);
  $('#gigaFill').style.height = G.giga + '%'; $('#gigaBox').classList.toggle('ready', G.giga >= 100);
}

// ───────── 主更新 ─────────
function update(dt) {
  G.t += dt; const p = G.p;
  p.inv = Math.max(0, p.inv - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.shoot = Math.max(0, p.shoot - dt);
  // 移動
  let mv = { x: 0, y: 0 }; inputDir(v => mv = v);
  const sp = 190 * moveMul();
  if (p.dashT > 0) { p.dashT -= dt; p.x += p.dashDx * 620 * dt; p.y += p.dashDy * 620 * dt; }
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
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, s = e.spd * (e.slow > 0 ? .5 : 1); e.ang = Math.atan2(dy, dx);
    if (e.d.shoot) {
      if (d > 250) { e.x += dx / d * s * dt; e.y += dy / d * s * dt; } else if (d < 170) { e.x -= dx / d * s * dt; e.y -= dy / d * s * dt; }
      e.cd -= dt; if (e.cd <= 0 && d < 520) { e.cd = e.d.shoot; G.eb.push({ x: e.x, y: e.y, vx: dx / d * 190, vy: dy / d * 190, dmg: 8, life: 4, r: 5 }); }
    } else { e.x += dx / d * s * dt; e.y += dy / d * s * dt; }
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
  ctx.clearRect(0, 0, W, H);
  if (!G) return;
  const p = G.p, sh = G.shake > 0 ? G.shake * 10 : 0;
  const cx = p.x - W / 2 + rnd(-sh, sh), cy = p.y - H / 2 + rnd(-sh, sh);
  bgPat = bgPat || makeBg();
  ctx.save(); ctx.translate(-cx, -cy); ctx.fillStyle = bgPat; ctx.fillRect(cx, cy, W, H);
  // 寶石
  for (const g of G.gems) { ctx.fillStyle = g.heal ? '#ff6b7e' : '#57d8ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(g.x, g.y, g.heal ? 6 : 4 + Math.min(3, g.v / 2), 0, 6.283); ctx.fill(); }
  ctx.shadowBlur = 0;
  // 敵人（依 y 排序）
  const list = [...G.en]; if (G.boss) list.push(G.boss); list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.x < cx - 120 || e.x > cx + W + 120 || e.y < cy - 120 || e.y > cy + H + 120) continue;
    if (e.boss) { drawBoss(e); continue; }
    const im = e.d.hue ? IMG.tint.robot200 : IMG[e.d.img]; const sc = e.d.scale;
    ctx.save(); ctx.translate(e.x, e.y); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, e.r * .6, e.r, e.r * .4, 0, 0, 6.283); ctx.fill();
    ctx.rotate(e.ang); ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc);
    if (e.hit > 0) { ctx.globalAlpha = .6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 6.283); ctx.fill(); }
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
  const p = G.p; const set = p.shoot > 0 && p.moving ? 'RunShoot' : p.moving ? 'Run' : 'Idle'; const fr = IMG.hero[set];
  const im = fr[((p.anim * (set === 'Idle' ? 8 : 14)) | 0) % fr.length]; const h = 96, w = im.width / im.height * h;
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 28, 22, 8, 0, 0, 6.283); ctx.fill();
  if (p.dashT > 0) { ctx.globalAlpha = .6; }
  else if (p.inv > 0 && ((G.t * 20) | 0) % 2) ctx.globalAlpha = .4;
  ctx.scale(p.face, 1); ctx.drawImage(im, -w / 2, -h / 2 - 8, w, h); ctx.restore();
}
function drawBoss(b) {
  const fr = IMG.tint['boss' + b.idx], im = fr[((G.t * 10) | 0) % fr.length]; const h = 96 * b.def.scale, w = im.width / im.height * h;
  ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, h * .3, h * .24, h * .08, 0, 0, 6.283); ctx.fill();
  if (b.state === 'tele') { ctx.strokeStyle = `rgba(255,70,90,${.4 + .4 * Math.sin(G.t * 40)})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b.lock) * 430 * .55, Math.sin(b.lock) * 430 * .55); ctx.stroke(); }
  ctx.scale(b.dir, 1); ctx.drawImage(im, -w / 2, -h / 2 - 8, w, h);
  if (b.hit > 0) { ctx.globalAlpha = .45; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.283); ctx.fill(); }
  ctx.restore();
}
function drawFx(f) {
  const k = 1 - f.t / f.T;
  if (f.k === 'bolt') { ctx.strokeStyle = '#fff36a'; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.beginPath(); f.pts.forEach((q, i) => i ? ctx.lineTo(q.x + rnd(-6, 6), q.y + rnd(-6, 6)) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.shadowBlur = 0; }
  else if (f.k === 'nova') { ctx.strokeStyle = f.c || '#9fe6ff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.R * (.3 + .7 * k), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (f.k === 'flame') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = (1 - k) * .7; const g = ctx.createRadialGradient(0, 0, 10, 0, 0, f.R); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ff8a20'); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, f.R, -.6, .6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
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
function start() { newGame(); setMode('play'); startMusic(); }
$('#btnStart').addEventListener('click', start);
$('#btnAgain').addEventListener('click', start);
$('#btnResume').addEventListener('click', () => setMode('play'));
loadAll().then(() => { G = null; setMode('title'); requestAnimationFrame(frame); });
window.__mecha = { get G() { return G; }, S, BOSSES, update, giga, bossReward, levelUpUI };
