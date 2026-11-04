'use strict';
// 資料表：武器、被動、協同、敵人、首領。文字一律繁體中文。
const WEAPONS = {
  buster:  {name:'爆能砲',  icon:'🔫', tag:'能量', base:true,
    desc:'自動瞄準最近的敵人連射。',
    rows:l=>[['傷害',10+4*l],['間隔',(Math.max(.18,.62-.04*l)).toFixed(2)+'s'],['彈數',1+(l>=3)+(l>=5)]]},
  thunder: {name:'三重雷霆',icon:'⚡', tag:'雷電', base:true,
    desc:'閃電在敵人之間連鎖跳躍。',
    rows:l=>[['傷害',14+5*l],['連鎖',2+l],['間隔',(Math.max(.9,1.7-.1*l)).toFixed(1)+'s']]},
  cyclone: {name:'雙重旋風',icon:'🌀', tag:'風', base:true,
    desc:'氣旋環繞機體，持續切割靠近的敵人。',
    rows:l=>[['氣旋',1+Math.ceil(l/2)],['傷害',8+3*l],['間隔','0.5s']]},
  missile: {name:'追蹤飛彈',icon:'🚀', tag:'爆炸', boss:0,
    desc:'發射追蹤飛彈，命中後範圍爆炸。',
    rows:l=>[['傷害',20+7*l],['飛彈',1+Math.floor(l/2)],['間隔',(Math.max(1.1,2.3-.12*l)).toFixed(1)+'s']]},
  flame:   {name:'烈焰噴流',icon:'🔥', tag:'火', boss:1,
    desc:'朝最近敵人噴出扇形烈焰。',
    rows:l=>[['傷害',12+4*l],['射程',120+8*l],['間隔',(Math.max(.6,1.3-.08*l)).toFixed(1)+'s']]},
  ice:     {name:'極寒脈衝',icon:'❄️', tag:'冰', boss:2,
    desc:'向四周釋放冰霜衝擊，並使敵人減速。',
    rows:l=>[['傷害',10+3*l],['範圍',120+15*l],['間隔',(Math.max(1.6,3.2-.15*l)).toFixed(1)+'s']]},
};
const MAX_LV = 6;

const PASSIVES = {
  armor:  {name:'強化裝甲', icon:'🛡️', desc:'最大生命 +20，並回復 20。', max:6},
  engine: {name:'高速引擎', icon:'👟', desc:'移動速度 +8%。',           max:5},
  magnet: {name:'磁力吸附', icon:'🧲', desc:'經驗吸取範圍 +25%。',       max:5},
  core:   {name:'能量核心', icon:'🔋', desc:'所有武器傷害 +10%。',       max:6},
  rapid:  {name:'連射晶片', icon:'⏱️', desc:'所有武器冷卻 -6%。',        max:5},
};

// 協同：同時持有兩個標籤的武器就生效
const SYNERGIES = [
  {id:'storm',  name:'雷暴',  a:'雷電', b:'風',   stat:'atk',  label:'攻擊'},
  {id:'melt',   name:'熔爆',  a:'火',   b:'爆炸', stat:'rate', label:'攻速'},
  {id:'super',  name:'超導',  a:'冰',   b:'雷電', stat:'move', label:'移速'},
  {id:'blaze',  name:'烈風',  a:'風',   b:'火',   stat:'rate', label:'攻速'},
  {id:'arms',   name:'標準武裝',a:'能量',b:'爆炸', stat:'atk',  label:'攻擊'},
  {id:'frostb', name:'冰爆',  a:'冰',   b:'爆炸', stat:'move', label:'移速'},
];
const SYN_BASE = 0.15, SYN_AMP = 0.05;

const ENEMIES = {
  grunt:  {img:'robot',  hp:22,  spd:58,  dmg:8,  r:14, scale:1.5, xp:1, from:0},
  runner: {img:'zombie', hp:13,  spd:108, dmg:6,  r:11, scale:1.35,xp:1, from:30},
  shooter:{img:'soldier',hp:26,  spd:46,  dmg:6,  r:14, scale:1.5, xp:2, from:75, shoot:2.2},
  tank:   {img:'robot',  hp:130, spd:38,  dmg:15, r:24, scale:2.5, xp:5, from:150, hue:200},
};

const BOSSES = [
  {name:'引爆象王', hue:25,  scale:1.7, hp:1400, weapon:'missile'},
  {name:'烈焰龍王', hue:350, scale:1.8, hp:2300, weapon:'flame'},
  {name:'冰霜獅王', hue:190, scale:1.8, hp:3400, weapon:'ice'},
  {name:'雷霆獸王', hue:55,  scale:1.9, hp:4800, weapon:null},
  {name:'終焉機神', hue:280, scale:2.3, hp:7500, weapon:null, final:true},
];
const BOSS_EVERY = 120;   // 秒
const WIN_TIME = 12 * 60; // 秒
