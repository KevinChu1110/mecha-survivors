'use strict';
// 資料表：武器、被動、協同、敵人、首領。文字一律繁體中文。
const WEAPONS = {
  buster:  {name:'爆能砲',  tag:'能量', base:true,
    desc:'自動瞄準最近的敵人連射。',
    rows:l=>[['傷害',10+4*l],['間隔',(Math.max(.18,.62-.04*l)).toFixed(2)+'s'],['彈數',1+(l>=3)+(l>=5)]]},
  thunder: {name:'三重雷霆', tag:'雷電', base:true,
    desc:'閃電在敵人之間連鎖跳躍。',
    rows:l=>[['傷害',14+5*l],['連鎖',2+l],['間隔',(Math.max(.9,1.7-.1*l)).toFixed(1)+'s']]},
  cyclone: {name:'雙重旋風', tag:'風', base:true,
    desc:'氣旋環繞機體，持續切割靠近的敵人。',
    rows:l=>[['氣旋',1+Math.ceil(l/2)],['傷害',8+3*l],['間隔','0.5s']]},
  missile: {name:'追蹤飛彈', tag:'爆炸', boss:0,
    desc:'發射追蹤飛彈，命中後範圍爆炸。',
    rows:l=>[['傷害',20+7*l],['飛彈',1+Math.floor(l/2)],['間隔',(Math.max(1.1,2.3-.12*l)).toFixed(1)+'s']]},
  flame:   {name:'烈焰噴流', tag:'火', boss:1,
    desc:'朝最近敵人噴出扇形烈焰。',
    rows:l=>[['傷害',12+4*l],['射程',120+8*l],['間隔',(Math.max(.6,1.3-.08*l)).toFixed(1)+'s']]},
  ice:     {name:'極寒脈衝', tag:'冰', boss:2,
    desc:'向四周釋放冰霜衝擊，並使敵人減速。',
    rows:l=>[['傷害',10+3*l],['範圍',120+15*l],['間隔',(Math.max(1.6,3.2-.15*l)).toFixed(1)+'s']]},
  saber:   {name:'光刃斬',  tag:'近戰', base:true,
    desc:'朝最近的敵人揮出弧形光刃；Lv4 起變成環身一圈。',
    rows:l=>[['傷害',18+6*l],['範圍',100+6*l],['間隔',(Math.max(.45,.95-.07*l)).toFixed(2)+'s']]},
  sniper:  {name:'穿甲狙擊',tag:'狙擊', base:true,
    desc:'超遠距離貫穿射線，一槍打穿整排敵人。',
    rows:l=>[['傷害',40+14*l],['射線',1+(l>=4)],['間隔',(Math.max(.9,1.9-.12*l)).toFixed(1)+'s']]},
  burst:   {name:'全向連射',tag:'連射', base:true,
    desc:'旋轉朝四面八方連續射擊。',
    rows:l=>[['傷害',6+2.5*l],['彈數',Math.min(8,2+Math.floor(l/2)*2)],['間隔',(Math.max(.22,.5-.04*l)).toFixed(2)+'s']]},
  barrier: {name:'反應護盾',tag:'防禦', base:true,
    desc:'抵擋一次攻擊並放出震波；一段時間後自動重新充能。',
    rows:l=>[['震波傷害',15+6*l],['充能',Math.max(5,12-l)+'s'],['範圍',100+10*l]]},
};
const MAX_LV = 6;

const PASSIVES = {
  armor:  {name:'強化裝甲', desc:'最大生命 +20，並回復 20。', max:6},
  engine: {name:'高速引擎', desc:'移動速度 +8%。',           max:5},
  magnet: {name:'磁力吸附', desc:'經驗吸取範圍 +25%。',       max:5},
  core:   {name:'能量核心', desc:'所有武器傷害 +10%。',       max:6},
  rapid:  {name:'連射晶片', desc:'所有武器冷卻 -6%。',        max:5},
};

// 協同：同時持有兩個標籤的武器就生效
const SYNERGIES = [
  {id:'storm',  name:'雷暴',  a:'雷電', b:'風',   stat:'atk',  label:'攻擊'},
  {id:'melt',   name:'熔爆',  a:'火',   b:'爆炸', stat:'rate', label:'攻速'},
  {id:'super',  name:'超導',  a:'冰',   b:'雷電', stat:'move', label:'移速'},
  {id:'blaze',  name:'烈風',  a:'風',   b:'火',   stat:'rate', label:'攻速'},
  {id:'arms',   name:'標準武裝',a:'能量',b:'爆炸', stat:'atk',  label:'攻擊'},
  {id:'frostb', name:'冰爆',  a:'冰',   b:'爆炸', stat:'move', label:'移速'},
  {id:'bladeT', name:'雷刃',  a:'近戰', b:'雷電', stat:'atk',  label:'攻擊'},
  {id:'bladeF', name:'烈斬',  a:'近戰', b:'火',   stat:'rate', label:'攻速'},
  {id:'pierce', name:'穿甲彈',a:'狙擊', b:'爆炸', stat:'atk',  label:'攻擊'},
  {id:'overld', name:'過載',  a:'連射', b:'能量', stat:'rate', label:'攻速'},
  {id:'zero',   name:'絕對零度',a:'防禦',b:'冰',  stat:'move', label:'移速'},
  {id:'gale',   name:'颶風彈幕',a:'連射',b:'風',  stat:'rate', label:'攻速'},
  {id:'fort',   name:'堡壘',  a:'防禦', b:'狙擊', stat:'atk',  label:'攻擊'},
];
const SYN_BASE = 0.15, SYN_AMP = 0.05;

const ENEMIES = {
  grunt:  {w:6, img:'robot',  hp:22,  spd:58,  dmg:8,  r:14, scale:1.5, xp:1, from:0},
  runner: {w:4, img:'zombie', hp:13,  spd:108, dmg:6,  r:11, scale:1.35,xp:1, from:30},
  shooter:{w:2.5, img:'soldier',hp:26,  spd:46,  dmg:6,  r:14, scale:1.5, xp:2, from:75, shoot:2.2},
  drone:   {w:3.5, art:'drone',    hp:16,  spd:96,  dmg:6,  r:12, scale:1,   xp:1, from:45,  weave:1},
  spider:  {w:2.5, art:'spider',   hp:36,  spd:66,  dmg:9,  r:15, scale:1,   xp:2, from:100, leap:1},
  bomber:  {w:1.8, art:'bomber',   hp:20,  spd:92,  dmg:0,  r:14, scale:1,   xp:2, from:130, bomb:1},
  sentinel:{w:.8,  art:'sentinel', hp:160, spd:34,  dmg:14, r:22, scale:1,   xp:6, from:200, shoot:2.6, fan:1},
  tank:   {w:1, img:'robot',  hp:130, spd:38,  dmg:15, r:24, scale:2.5, xp:5, from:150, hue:200},
};

const BOSSES = [
  {name:'引爆象王', hue:25,  scale:1.7, hp:1400, weapon:'missile', pat:'stomp'},
  {name:'烈焰龍王', hue:350, scale:1.8, hp:2300, weapon:'flame', pat:'fan'},
  {name:'冰霜獅王', hue:190, scale:1.8, hp:3400, weapon:'ice', pat:'spiral'},
  {name:'雷霆獸王', hue:55,  scale:1.9, hp:4800, weapon:null, pat:'bolt'},
  {name:'終焉機神', hue:280, scale:2.3, hp:7500, weapon:null, final:true, pat:'all'},
];
const BOSS_EVERY = 120;   // 秒
const WIN_TIME = 12 * 60; // 秒

// 可選角色（原創機甲）
const CHARS = [
  {id:'volt',  name:'雷鋒', role:'均衡射擊', hue:0,   br:1,   hp:100, spd:1,    dashCd:1.4, start:['buster'],
    skill:'蓄能射擊', skillDesc:'每 6 發爆能砲，第 6 發為貫穿重擊（傷害 ×3）。'},
  {id:'blade', name:'赤焰', role:'近戰突進', hue:280, br:1.08,hp:115, spd:1.08, dashCd:1.2, start:['saber'],
    skill:'斬鐵衝刺', skillDesc:'衝刺時沿途斬擊敵人，並且衝刺冷卻較短。'},
  {id:'shade', name:'暗影', role:'狙擊護盾', hue:160, br:.55, hp:90,  spd:.98,  dashCd:1.5, start:['sniper','barrier'],
    skill:'冷靜射手', skillDesc:'開局即擁有穿甲狙擊與反應護盾；護盾震波傷害提升。'},
  {id:'fang',  name:'戰神', role:'連射機動', hue:208, br:.9, hp:80,  spd:1.16, dashCd:.9,  start:['burst'],
    skill:'疾風突圍', skillDesc:'衝刺起點向八方射出彈幕，衝刺冷卻最短。'},
];
