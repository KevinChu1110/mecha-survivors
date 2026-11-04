'use strict';
// 程式繪製的原創怪物與首領（Canvas 向量，朝右；不使用任何外部素材）
const ART = (() => {
  const OUT = '#0a0f1c';
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.lineJoin = 'round'; x.lineCap = 'round'; fn(x); return c; };
  const lg = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const P = (x, pts, fill, lw = 4) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = OUT; x.lineWidth = lw; x.stroke(); };
  const E = (x, cx, cy, rx, ry, fill, lw = 4, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 6.283); x.fillStyle = fill; x.fill(); x.strokeStyle = OUT; x.lineWidth = lw; x.stroke(); };
  const R = (x, a, b, w, h, fill, lw = 4) => { x.beginPath(); x.roundRect(a, b, w, h, 4); x.fillStyle = fill; x.fill(); x.strokeStyle = OUT; x.lineWidth = lw; x.stroke(); };
  const L = (x, pts, col, lw) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.strokeStyle = col; x.lineWidth = lw; x.stroke(); };
  const glow = (x, cx, cy, r, c) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, '#fff'); g.addColorStop(.35, c); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill(); };

  // ── 小怪（64px 左右，朝右）──
  const drone = f => mk(64, 64, x => {
    const a = f ? .5 : -.5;
    for (const s of [-1, 1]) { L(x, [[32, 32], [32 + s * 20, 22]], '#456', 3); E(x, 32 + s * 22, 20, 12, 3, 'rgba(160,220,255,.7)', 2, a * s); }
    E(x, 32, 34, 17, 14, lg(x, 20, 48, '#8fa6c4', '#3c4d6b'));
    E(x, 40, 33, 6, 6, '#ff3355', 3); glow(x, 40, 33, 9, 'rgba(255,50,80,.8)');
    R(x, 20, 44, 24, 5, '#2a3550', 3);
  });
  const spider = f => mk(80, 80, x => {
    const k = f ? 7 : -7;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const bx = 28 + i * 8, ph = (i % 2 ? k : -k);
      L(x, [[bx, 40 + s * 6], [bx + (i - 1.5) * 6, 40 + s * (22 + ph * .3)], [bx + (i - 1.5) * 9 + ph, 40 + s * 34]], OUT, 6);
      L(x, [[bx, 40 + s * 6], [bx + (i - 1.5) * 6, 40 + s * (22 + ph * .3)], [bx + (i - 1.5) * 9 + ph, 40 + s * 34]], '#7a5a9a', 3);
    }
    E(x, 36, 40, 20, 14, lg(x, 26, 54, '#8a5fb0', '#43285f'));
    E(x, 54, 40, 11, 9, lg(x, 31, 49, '#a074c8', '#4c2f6b'));
    for (const s of [-1, 1]) { E(x, 59, 40 + s * 4, 3, 3, '#ffe14d', 2); }
    P(x, [[22, 30], [28, 22], [34, 31]], '#c9a3ec', 3); P(x, [[34, 29], [40, 21], [46, 30]], '#c9a3ec', 3);
  });
  const bomber = f => mk(64, 64, x => {
    E(x, 30, 36, 19, 19, lg(x, 17, 55, '#ff9a4a', '#a8330f'));
    for (let i = -1; i <= 1; i++) L(x, [[18 + i * 2, 24 + i * 9 + 6], [42 + i * 2, 24 + i * 9 + 6]], 'rgba(40,10,0,.55)', 4);
    R(x, 26, 12, 8, 7, '#555', 3); L(x, [[30, 12], [34, 5], [40, 4]], '#ddd', 2); glow(x, 41, 4, f ? 8 : 5, 'rgba(255,220,80,.95)');
    E(x, 38, 35, 5, 5, f ? '#fff' : '#ffe14d', 3);
  });
  const sentinel = f => mk(96, 96, x => {
    const p = f ? 2 : 0;
    P(x, [[28, 26], [52, 22], [64, 48], [52, 74], [28, 70], [18, 48]], lg(x, 22, 74, '#9db3cc', '#3a4a66'));
    P(x, [[60, 22], [80, 30], [86, 48 + p], [80, 66], [60, 74], [68, 48]], lg(x, 22, 74, '#5be0ff', '#1a6e92'));
    E(x, 40, 48, 9, 9, '#0a1a2a', 3); glow(x, 40, 48, 14 + p, 'rgba(90,230,255,.9)');
    L(x, [[24, 40], [46, 36]], 'rgba(255,255,255,.35)', 3);
  });
  const small = { drone: [drone(0), drone(1)], spider: [spider(0), spider(1)], bomber: [bomber(0), bomber(1)], sentinel: [sentinel(0), sentinel(1)] };

  // ── 首領（256px，朝右；4 影格）──
  const S = 256;
  const boss0 = ph => mk(S, S, x => { // 引爆象王：重裝象型
    const b = Math.sin(ph) * 3, l = Math.sin(ph) * 6;
    for (const [lx, d] of [[60, 1], [92, -1], [150, -1], [182, 1]]) R(x, lx, 168 + (d > 0 ? l : -l) * .5, 28, 54, lg(x, 168, 222, '#7a8452', '#3e4526'));
    E(x, 112, 138 + b, 78, 56, lg(x, 82, 194, '#a8b26a', '#4a5429'));
    for (let i = 0; i < 3; i++) { R(x, 64 + i * 26, 74 + b, 20, 26, '#4b5030'); E(x, 74 + i * 26, 74 + b, 7, 6, '#ff5a2a', 2); }
    P(x, [[60, 96 + b], [160, 90 + b], [166, 80 + b], [56, 82 + b]], '#8b9455', 3);
    E(x, 186, 118 + b, 44, 40, lg(x, 78, 158, '#bcc67c', '#566030'));
    E(x, 160, 116 + b, 22, 38, '#8e9858', 4, .2);
    L(x, [[218, 128 + b], [236, 150 + b], [232, 184 + b + l * .3]], OUT, 24); L(x, [[218, 128 + b], [236, 150 + b], [232, 184 + b + l * .3]], '#98a35f', 17);
    R(x, 222, 178 + b + l * .3, 24, 20, '#2b2f1d'); E(x, 234, 198 + b + l * .3, 8, 5, '#ff5a2a', 2);
    P(x, [[208, 150 + b], [246, 176 + b], [210, 164 + b]], '#f1ead2', 3);
    E(x, 200, 108 + b, 6, 6, '#ff2a2a', 3); glow(x, 200, 108 + b, 14, 'rgba(255,60,40,.8)');
  });
  const boss1 = ph => mk(S, S, x => { // 烈焰龍王：翼龍
    const w = Math.sin(ph) * 22, b = Math.cos(ph) * 3;
    P(x, [[96, 110], [30, 48 - w], [70, 74], [52, 62 - w * .6], [100, 96], [130, 98]], 'rgba(200,40,50,.9)');
    P(x, [[126, 100], [90, 46 - w], [124, 60], [112, 38 - w * .6], [148, 96]], '#d6384a');
    L(x, [[100, 150], [60, 176], [30, 168], [8, 190]], OUT, 22); L(x, [[100, 150], [60, 176], [30, 168], [8, 190]], '#b32436', 14);
    P(x, [[8, 190], [-2, 176], [22, 184]], '#ffb347', 3);
    E(x, 118, 152 + b, 62, 38, lg(x, 114, 190, '#e0483c', '#7a1426'));
    E(x, 124, 166 + b, 42, 20, '#f2c97a', 3);
    for (let i = 0; i < 5; i++) P(x, [[70 + i * 16, 118 + b], [78 + i * 16, 100 + b], [86 + i * 16, 118 + b]], '#ffb347', 3);
    L(x, [[150, 140 + b], [176, 104 + b], [196, 84 + b]], OUT, 30); L(x, [[150, 140 + b], [176, 104 + b], [196, 84 + b]], '#d6384a', 22);
    P(x, [[190, 66 + b], [240, 82 + b], [236, 98 + b], [196, 104 + b]], '#e0483c');
    P(x, [[196, 104 + b], [236, 100 + b + w * .2], [232, 112 + b + w * .3], [198, 116 + b]], '#8a1c2c', 3);
    for (let i = 0; i < 3; i++) P(x, [[210 + i * 8, 100 + b], [214 + i * 8, 108 + b], [218 + i * 8, 100 + b]], '#fff', 2);
    P(x, [[196, 66 + b], [182, 40 + b], [208, 62 + b]], '#ffb347', 3); P(x, [[212, 64 + b], [206, 38 + b], [226, 66 + b]], '#ffb347', 3);
    E(x, 214, 82 + b, 6, 6, '#ffe14d', 3); glow(x, 240, 108 + b, 16 + w * .3, 'rgba(255,150,40,.9)');
    for (const lx of [108, 148]) R(x, lx, 176, 22, 40, '#a52034');
  });
  const boss2 = ph => mk(S, S, x => { // 冰霜獅王：水晶鬃毛
    const b = Math.sin(ph) * 3, l = Math.sin(ph) * 7;
    for (const [lx, d] of [[58, 1], [88, -1], [148, -1], [178, 1]]) R(x, lx, 158 + (d > 0 ? l : -l) * .4, 26, 62, lg(x, 158, 220, '#8fd4f2', '#3b78a6'));
    L(x, [[56, 130], [24, 110 + b], [12, 140]], OUT, 16); L(x, [[56, 130], [24, 110 + b], [12, 140]], '#8fd4f2', 9);
    P(x, [[12, 140], [0, 128], [20, 128]], '#d6f4ff', 3);
    E(x, 112, 136 + b, 70, 46, lg(x, 90, 182, '#b6e6fb', '#3f7fae'));
    for (let i = 0; i < 12; i++) { const a = -2.6 + i * .5, cx = 168 + Math.cos(a) * 28, cy = 112 + b + Math.sin(a) * 28, tx = 168 + Math.cos(a) * 66, ty = 112 + b + Math.sin(a) * 66;
      P(x, [[cx - 8 * Math.sin(a), cy + 8 * Math.cos(a)], [tx, ty], [cx + 8 * Math.sin(a), cy - 8 * Math.cos(a)]], i % 2 ? '#e3f9ff' : '#7cc8f0', 3); }
    E(x, 172, 116 + b, 38, 34, lg(x, 82, 150, '#e8d9b0', '#9a8658'));
    P(x, [[196, 124 + b], [236, 130 + b], [232, 150 + b], [198, 150 + b]], '#f0e2bd');
    E(x, 236, 134 + b, 5, 4, '#111', 2); P(x, [[206, 150 + b], [210, 164 + b], [216, 150 + b]], '#fff', 2);
    P(x, [[160, 84 + b], [166, 64 + b], [178, 86 + b]], '#cfeeff', 3);
    E(x, 196, 110 + b, 6, 5, '#7fe8ff', 3); glow(x, 196, 110 + b, 14, 'rgba(120,230,255,.85)');
  });
  const boss3 = (ph, k) => mk(S, S, x => { // 雷霆獸王：電狼
    const b = Math.sin(ph) * 3, l = Math.sin(ph) * 9;
    for (const [lx, d] of [[52, 1], [86, -1], [148, -1], [182, 1]]) { P(x, [[lx, 156], [lx + 26, 156], [lx + 22 + (d > 0 ? l : -l), 220], [lx - 4 + (d > 0 ? l : -l), 220]], '#4a3a78'); }
    L(x, [[48, 128], [14, 110], [6, 80 + b]], OUT, 18); L(x, [[48, 128], [14, 110], [6, 80 + b]], '#f7d44a', 10); glow(x, 6, 78 + b, 14, 'rgba(255,230,90,.9)');
    P(x, [[48, 120 + b], [120, 98 + b], [190, 112 + b], [196, 150 + b], [120, 176 + b], [54, 160 + b]], lg(x, 98, 176, '#6c58b0', '#2c2252'));
    P(x, [[96, 100 + b], [112, 66 + b], [124, 102 + b]], '#f7d44a', 3); P(x, [[132, 102 + b], [152, 62 + b], [160, 108 + b]], '#f7d44a', 3);
    for (const cx of [86, 142]) { R(x, cx - 4, 74 + b, 8, 30, '#ccc', 3); glow(x, cx, 72 + b, 12, 'rgba(255,240,110,.95)'); }
    x.save(); x.strokeStyle = '#fff6a8'; x.shadowColor = '#ffe14d'; x.shadowBlur = 12; x.lineWidth = 3; x.beginPath(); x.moveTo(86, 72 + b);
    for (let i = 1; i <= 5; i++) x.lineTo(86 + i * 11.2, 72 + b + Math.sin(k * 3 + i * 2) * 10); x.stroke(); x.restore();
    P(x, [[180, 100 + b], [226, 112 + b], [244, 136 + b], [214, 152 + b], [182, 146 + b]], '#7a64c4');
    P(x, [[190, 100 + b], [196, 76 + b], [208, 104 + b]], '#f7d44a', 3);
    P(x, [[204, 148 + b], [208, 164 + b], [216, 150 + b]], '#fff', 2); P(x, [[222, 146 + b], [226, 160 + b], [232, 144 + b]], '#fff', 2);
    E(x, 210, 120 + b, 7, 5, '#fff36a', 3, -.3); glow(x, 210, 120 + b, 16, 'rgba(255,240,90,.9)');
    P(x, [[60, 164 + b], [90, 150 + b], [120, 170 + b]], '#f7d44a', 3);
  });
  const boss4 = (ph, k) => mk(S, S, x => { // 終焉機神：浮空巨像
    const b = Math.sin(ph) * 5, w = Math.sin(ph) * 8;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(x, [[128, 110 + b], [128 + s * (50 + i * 30), 40 + i * 28 + b - w * (i + 1) * .3], [128 + s * (60 + i * 30), 56 + i * 28 + b]], i % 2 ? '#c13aa0' : '#7b2bb0', 3);
    P(x, [[96, 100 + b], [160, 100 + b], [176, 150 + b], [150, 214 + b], [106, 214 + b], [80, 150 + b]], lg(x, 100, 214, '#9a5ad0', '#2c1250'));
    P(x, [[112, 122 + b], [144, 122 + b], [150, 150 + b], [128, 168 + b], [106, 150 + b]], '#1b0b33', 3);
    glow(x, 128, 144 + b, 22 + w * .5, 'rgba(255,90,220,.95)'); E(x, 128, 144 + b, 8, 8, '#fff', 2);
    P(x, [[150, 108 + b], [214, 128 + b], [244, 120 + b], [214, 146 + b], [152, 134 + b]], '#8a40c8');
    P(x, [[214, 128 + b], [250, 116 + b], [250, 126 + b], [226, 140 + b]], '#ffd0f4', 3);
    P(x, [[96, 108 + b], [64, 124 + b], [58, 176 + b], [82, 176 + b], [90, 130 + b]], '#8a40c8');
    P(x, [[110, 62 + b], [146, 62 + b], [154, 98 + b], [102, 98 + b]], lg(x, 62, 98, '#b070e0', '#4a1f78'));
    for (const [ex, ey] of [[114, 78], [128, 74], [142, 78]]) { E(x, ex, ey + b, 4, 4, '#ff59d6', 2); glow(x, ex, ey + b, 8, 'rgba(255,90,220,.8)'); }
    x.save(); x.translate(128, 52 + b); x.rotate(-.2); x.strokeStyle = '#ffb3f0'; x.shadowColor = '#ff59d6'; x.shadowBlur = 14; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 40, 9, 0, 0, 6.283); x.stroke(); x.restore();
  });
  const bossFns = [boss0, boss1, boss2, boss3, boss4];
  const bosses = bossFns.map(fn => [0, 1, 2, 3].map(k => fn(k * 1.571, k)));
  return { small, bosses };
})();
