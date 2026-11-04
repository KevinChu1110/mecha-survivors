# 機甲倖存者

類吸血鬼倖存者的機甲生存動作遊戲，全繁體中文，瀏覽器直接玩。

**線上遊玩：https://kevinchu1110.github.io/mecha-survivors/**

## 角色
| 角色 | 定位 | 起始武器 | 專屬能力 |
|---|---|---|---|
| 雷鋒 | 均衡射擊 | 爆能砲 | 每 6 發有一發貫穿重擊（×3） |
| 赤焰 | 近戰突進 | 光刃斬 | 衝刺沿途斬擊敵人，冷卻較短 |
| 暗影 | 狙擊護盾 | 穿甲狙擊、反應護盾 | 護盾震波傷害提升 |
| 戰神 | 連射機動 | 全向連射 | 衝刺起點向八方射出彈幕，冷卻最短 |

## 玩法
- 自動射擊，只需要移動；撿經驗升級，三選一強化。
- 敵人共 8 種：基本機兵、疾行殭屍、狙擊兵、重裝坦克，另有蛇行無人機、撲擊蜘蛛、自爆機器人、三向砲擊哨兵（後四種為程式繪製的原創造型）。
- 每 2 分鐘出現一隻首領，五隻外觀與招式各自不同（象王震地環／飛彈齊射、龍王火息扇形、獅王冰晶螺旋、獸王雷擊閃現、機神綜合招式）。擊破後從三張獎勵卡擇一：**首領武器**（永久解鎖）、**極限突破**（武器等級上限 +2）、**協同增幅器**（所有協同加成 +5%）。
- 持有特定屬性組合的武器會觸發協同（雷暴、熔爆、超導……），提供攻擊、攻速或移速加成。
- 撐到 12:00 或擊破終焉機神即通關。

| 操作 | 鍵盤 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵 | 螢幕拖曳 |
| 衝刺 | Space／Shift | 衝刺鈕 |
| 大招 | E（擊殺累積能量） | 大招鈕 |
| 暫停／靜音 | P／M | — |

## 開發
純靜態網頁，沒有建置步驟：

```bash
python3 -m http.server 8000   # 然後開 http://localhost:8000
```

- `js/art.js`：程式繪製的新怪物與五隻首領
- `js/data.js`：武器、被動、協同、敵人、首領資料
- `js/game.js`：引擎、繪製、卡片介面

玩法設計受 Rockman X Survivors 的獎勵卡與協同系統啟發。本專案不使用任何 CAPCOM 的角色、圖像或音樂。

## 自訂素材外掛包
想在自己的電腦上換成其他角色圖，請看 [assets/custom/README.md](assets/custom/README.md)。外掛包資料夾不會被 git 追蹤，也不會被推上 GitHub。

## 素材與授權
程式碼採 MIT 授權。素材皆為 CC0：
- 主角：[The Robot – Free Sprite](https://opengameart.org/content/the-robot-free-sprite)（pzUH）
- 敵人：[Topdown Shooter](https://opengameart.org/content/topdown-shooter)（Kenney）
- 音樂：[Boss Fight 2](https://opengameart.org/content/boss-fight-2)（ansimuz）
- 音效：以 WebAudio 即時合成
