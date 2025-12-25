// 取得 DOM 元素捷徑 (Get DOM Element Shortcut)
const $ = (id) => document.getElementById(id);

// UI 元素對應物件 (UI Element Mapping)
const ui = {
  // 頂部狀態列 (Header Status)
  dot: $('dot'),
  conn: $('conn'),
  srcText: $('srcText'),
  policyText: $('policyText'),
  ntpTime: $('ntpTime'),
  uptime: $('uptime'),
  rssi: $('rssi'),

  // 數值顯示 (Metrics Display)
  gridV: $('gridV'), gridA: $('gridA'),
  h2V: $('h2V'), h2A: $('h2A'),
  h2VUnit: $('h2VUnit'), h2AUnit: $('h2AUnit'),
  pwrW: $('pwrW'), cost: $('cost'),
  battV: $('battV'), battA: $('battA'),

  // 狀態標籤 (Status Tags)
  gridVTag: $('gridVTag'), gridATag: $('gridATag'),
  h2VTag: $('h2VTag'), h2ATag: $('h2ATag'),

  // 控制按鈕 (Control Buttons)
  btnMains: $('btnMains'),
  btnHydro: $('btnHydro'),
  btnClearManual: $('btnClearManual'),
  mainsState: $('mainsState'),
  hydroState: $('hydroState'),

  modeStatus: $('modeStatus'), // 模式狀態文字

  btnLoad1: $('btnLoad1'),
  btnLoad2: $('btnLoad2'),
  btnLoad3: $('btnLoad3'), // 蓄電池充電開關 (Battery Switch)
  load1State: $('load1State'),
  load2State: $('load2State'),
  load3State: $('load3State'),

  // 排程設定 (Schedule UI)
  schedStart: $('schedStart'),
  schedEnd: $('schedEnd'),
  btnSaveSched: $('btnSaveSched'),

  // 警報與日誌 (Alerts & Logs)
  l1Alert: $('l1Alert'),
  l1Text: $('l1Text'),
  log: $('log'),

  // ===== 台電即時資訊 (Taipower) =====
  tpResvRate: $('tpResvRate'),
  tpResvMW: $('tpResvMW'),
  tpInd: $('tpInd'),
  tpPeakHr: $('tpPeakHr'),
  tpCurrLoad: $('tpCurrLoad'),
  tpUtil: $('tpUtil'),
  tpStatus: $('tpStatus'),
  tpAge: $('tpAge'),
  tpMaxSupply: $('tpMaxSupply'),
  tpPeakLoad: $('tpPeakLoad'),
  tpPub: $('tpPub'),
};

// 狀態追蹤變數，用於比對變化以產生日誌 (State Tracking for Change Detection)
let lastState = {
  grid: null,
  hydro: null,
  load1: null,
  load2: null,
  load3: null,
  init: false
};

// 產生帶時間戳的中文日誌 (Generate Timestamped Chinese Logs)
function log(msg, cls='e'){
  const t = new Date().toLocaleTimeString('zh-TW', { hour12:false });
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = `[${t}] ${msg}`;
  ui.log.appendChild(div);
  ui.log.scrollTop = ui.log.scrollHeight; // 自動捲動到底部 (Auto Scroll)
}

// 設定連線狀態顯示 (Set Online/Offline Status)
function setOnline(ok){
  ui.conn.textContent = ok ? 'ONLINE' : 'OFFLINE';
  ui.dot.classList.toggle('ok', ok);
  ui.dot.classList.toggle('bad', !ok);
}

// 格式化數字為兩位數 (Format Number to 2 Digits)
function fmt2(n){ return String(n).padStart(2,'0'); }

// 格式化運作時間 (Format Uptime)
function renderUptime(sec){
  const s = Number(sec);
  if(!Number.isFinite(s)) return '--:--';
  const hh = Math.floor(s/3600);
  const mm = Math.floor((s%3600)/60);
  return `${fmt2(hh)}:${fmt2(mm)}`;
}

// API 呼叫函式 (API Fetch Wrappers)
async function apiGet(url){
  const r = await fetch(url, { cache:'no-store' });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
async function apiText(url){
  const r = await fetch(url, { cache:'no-store' });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

// 顯示或隱藏 L1 警報 (Toggle L1 Alert Visibility)
function showL1(active){
  ui.l1Alert.classList.toggle('hidden', !active);
}

let schedLoaded = false; // 排程載入旗標 (Schedule Loaded Flag)

// 監測狀態變化並寫入日誌 (Monitor State Changes & Log)
function checkStateChange(d) {
  const curGrid = !!d.relay_grid;
  const curHydro = !!d.relay_hydro;
  const curL1 = !!d.relay_load1;
  const curL2 = !!d.relay_load2;
  const curL3 = !!d.relay_load3;

  // 若為初次載入，僅記錄狀態不寫日誌 (Skip logging on first load)
  if (!lastState.init) {
    lastState = { grid: curGrid, hydro: curHydro, load1: curL1, load2: curL2, load3: curL3, init: true };
    return;
  }

  // 電源切換監測 (Power Source Change Detection)
  if (!lastState.grid && curGrid) log("系統電源已切換：市電 (Grid)", "ok");
  if (!lastState.hydro && curHydro) log("系統電源已切換：氫能 (Hydro)", "ok");

  // 偵測是否處於安全延遲期間 (Detect Safe Delay Deadtime)
  if (lastState.grid && !curGrid && !curHydro) log("電源切斷 (Safe Delay)", "e");

  // 負載開關監測 (Load Switching Detection)
  if (curL1 !== lastState.load1) log(curL1 ? "負載 1 已開啟" : "負載 1 已關閉", curL1 ? "m" : "e");
  if (curL2 !== lastState.load2) log(curL2 ? "負載 2 已開啟" : "負載 2 已關閉", curL2 ? "m" : "e");

  // 蓄電池充電開關監測 (Battery Switch Detection)
  if (curL3 !== lastState.load3) log(curL3 ? "蓄電池充電開關 已開啟" : "蓄電池充電開關 已關閉", curL3 ? "m" : "e");

  // 更新紀錄 (Update State Snapshot)
  lastState.grid = curGrid;
  lastState.hydro = curHydro;
  lastState.load1 = curL1;
  lastState.load2 = curL2;
  lastState.load3 = curL3;
}

// 台電資訊：顯示不可用狀態 (Taipower: set unavailable)
function setTpUnavailable(reason){
  if (!ui.tpStatus) return; // 若 HTML 未放入 tp 區塊，直接略過

  ui.tpStatus.textContent = reason || '資料不可用';

  if (ui.tpResvRate) ui.tpResvRate.textContent = '--';
  if (ui.tpResvMW) ui.tpResvMW.textContent = '--';
  if (ui.tpInd) ui.tpInd.textContent = '--';
  if (ui.tpPeakHr) ui.tpPeakHr.textContent = '--';
  if (ui.tpCurrLoad) ui.tpCurrLoad.textContent = '--';
  if (ui.tpUtil) ui.tpUtil.textContent = '--';
  if (ui.tpAge) ui.tpAge.textContent = '--';
  if (ui.tpMaxSupply) ui.tpMaxSupply.textContent = '--';
  if (ui.tpPeakLoad) ui.tpPeakLoad.textContent = '--';
  if (ui.tpPub) ui.tpPub.textContent = '--';
}

// 渲染畫面數據 (Render Status UI)
function renderStatus(d){
  // 執行狀態變化監測 (Run Change Detection)
  checkStateChange(d);

  // 基礎資訊更新 (Basic Info Update)
  ui.ntpTime.textContent = d.time ?? '--:--:--';
  ui.uptime.textContent = renderUptime(d.uptime);
  ui.rssi.textContent = (d.rssi ?? '--');

  const src = d.src_mode || 'none';
  ui.srcText.textContent = src === 'grid' ? 'MAINS' : (src === 'hydro' ? 'H2' : '--');

  // 若尚未載入排程，則更新輸入框 (Load Schedule Setting Once)
  if (!schedLoaded && d.sched_sh !== undefined) {
    ui.schedStart.value = `${fmt2(d.sched_sh)}:${fmt2(d.sched_sm)}`;
    ui.schedEnd.value   = `${fmt2(d.sched_eh)}:${fmt2(d.sched_em)}`;
    schedLoaded = true;
  }

  // 更新控制按鈕狀態 (Update Control Buttons)
  const relayGrid = !!d.relay_grid;
  const relayHydro = !!d.relay_hydro;
  ui.btnMains.classList.toggle('active', relayGrid);
  ui.btnHydro.classList.toggle('active', relayHydro);
  ui.mainsState.textContent = relayGrid ? 'ACTIVE' : 'INACTIVE';
  ui.hydroState.textContent = relayHydro ? 'ACTIVE' : 'INACTIVE';

  const rL1 = !!d.relay_load1;
  const rL2 = !!d.relay_load2;
  const rL3 = !!d.relay_load3;

  ui.btnLoad1.classList.toggle('active', rL1);
  ui.load1State.textContent = rL1 ? 'ON' : 'OFF';

  ui.btnLoad2.classList.toggle('active', rL2);
  ui.load2State.textContent = rL2 ? 'ON' : 'OFF';

  ui.btnLoad3.classList.toggle('active', rL3);
  ui.load3State.textContent = rL3 ? 'ON' : 'OFF';

  // 更新儀表數據 (Update Metrics)
  const gridV = Number(d.grid_v);
  const gridA = Number(d.grid_a);
  const gridW = Number(d.grid_w);
  const battV = Number(d.batt_v);
  const battA = Number(d.batt_a);
  const estCost = Number(d.est_cost);

  ui.gridV.textContent = Number.isFinite(gridV) ? gridV.toFixed(1) : '0.0';
  ui.gridA.textContent = Number.isFinite(gridA) ? gridA.toFixed(2) : '0.00';
  ui.pwrW.textContent  = Number.isFinite(gridW) ? String(Math.round(gridW)) : '0';
  ui.cost.textContent  = Number.isFinite(estCost) ? `$${estCost.toFixed(2)}` : '$0.00';
  ui.battV.textContent = Number.isFinite(battV) ? battV.toFixed(2) : '0.00';
  ui.battA.textContent = Number.isFinite(battA) ? battA.toFixed(2) : '0.00';

  // 處理氫能模式下的顯示邏輯 (Handle Display Logic for Hydro Mode)
  const onHydro = relayHydro && !relayGrid;
  ui.h2V.textContent = '--';
  ui.h2VUnit.textContent = '';
  // 若切換到氫能，電流顯示將來自感測器讀值 (If Hydro, map sensor current to H2 card)
  ui.h2A.textContent = (onHydro && Number.isFinite(gridA)) ? gridA.toFixed(2) : '0.00';
  ui.h2AUnit.textContent = 'A';

  // 更新標籤狀態 (Update Tags)
  ui.gridVTag.textContent = onHydro ? 'STANDBY' : 'LIVE';
  ui.gridATag.textContent = onHydro ? 'STANDBY' : 'LIVE';
  ui.h2VTag.textContent = onHydro ? 'LIVE' : 'STANDBY';
  ui.h2ATag.textContent = onHydro ? 'LIVE' : 'STANDBY';

  // 調整卡片亮度/樣式 (Dimming Inactive Cards)
  $('card-grid-v').classList.toggle('dim', onHydro);
  $('card-grid-a').classList.toggle('dim', onHydro);
  $('card-h2-v').classList.toggle('dim', !onHydro);
  $('card-h2-a').classList.toggle('dim', !onHydro);

  // 判斷當前策略模式 (Determine Policy Mode)
  const l1Active = Number.isFinite(gridV) && gridV < 80.0 && relayHydro;
  showL1(l1Active);

  const inSched = !!d.in_schedule;
  const manual = !!d.manual_override;
  const currentSrcName = (src === 'hydro') ? '氫能' : '市電';

  if (l1Active) ui.policyText.textContent = 'L1';
  else if (inSched) ui.policyText.textContent = 'SCHEDULE';
  else if (manual) ui.policyText.textContent = 'MANUAL';
  else ui.policyText.textContent = 'DEFAULT';

  // 更新狀態文字描述 (Update Status Description Text)
  if (l1Active) {
    ui.modeStatus.textContent = '⚠ 異常保護 (強制氫能)';
    ui.modeStatus.className = 'block-sub alert';
  } else if (manual) {
    ui.modeStatus.textContent = `手動鎖定: ${currentSrcName}供電`;
    ui.modeStatus.className = 'block-sub manual';
  } else if (inSched) {
    ui.modeStatus.textContent = '自動模式 (時段規則:氫能)';
    ui.modeStatus.className = 'block-sub sched';
  } else {
    ui.modeStatus.textContent = `自動模式 (預設:${currentSrcName})`;
    ui.modeStatus.className = 'block-sub auto';
  }

  // 更新手動解除按鈕 (Update Manual Reset Button)
  if (manual) {
    ui.btnClearManual.classList.add('recommend');
    ui.btnClearManual.classList.remove('dimmed');
    ui.btnClearManual.textContent = "解除手動鎖定 (回到自動)";
  } else {
    ui.btnClearManual.classList.remove('recommend');
    ui.btnClearManual.classList.add('dimmed');
    ui.btnClearManual.textContent = "目前為自動模式";
  }

  // ===== 台電即時資訊渲染 (Taipower) =====
  if (ui.tpStatus) {
    const tpOk = !!d.tp_ok;
    const tp = d.tp || null;

    if (!tp || !tpOk) {
      const age = Number(d.tp_age_sec);
      if (Number.isFinite(age) && age > 0 && !tpOk) setTpUnavailable('資料過期');
      else setTpUnavailable('資料不可用');
    } else {
      ui.tpStatus.textContent = 'OK';

      const age = Number(d.tp_age_sec);
      if (ui.tpAge) ui.tpAge.textContent = Number.isFinite(age) ? String(Math.floor(age)) : '--';

      if (ui.tpResvRate) ui.tpResvRate.textContent = (tp.fore_peak_resv_rate ?? '--');
      if (ui.tpResvMW) ui.tpResvMW.textContent = (tp.fore_peak_resv_capacity ?? '--');
      if (ui.tpInd) ui.tpInd.textContent = (tp.fore_peak_resv_indicator ?? '--');
      if (ui.tpPeakHr) ui.tpPeakHr.textContent = (tp.fore_peak_hour_range ?? '--');

      if (ui.tpCurrLoad) ui.tpCurrLoad.textContent = (tp.curr_load ?? '--');
      if (ui.tpUtil) ui.tpUtil.textContent = (tp.curr_util_rate ?? '--');

      if (ui.tpMaxSupply) ui.tpMaxSupply.textContent = (tp.fore_maxi_sply_capacity ?? '--');
      if (ui.tpPeakLoad) ui.tpPeakLoad.textContent = (tp.fore_peak_dema_load ?? '--');

      if (ui.tpPub) ui.tpPub.textContent = (tp.publish_time ?? '--');
    }
  }
}

// 傳送控制指令 (Send Control Command)
async function sendCtrl(target, state){
  let logMsg = "";
  // 產生對應的中文操作日誌 (Generate Chinese Log Message)
  if(target === 'grid') logMsg = "發送指令：手動切換至市電";
  else if(target === 'hydro') logMsg = "發送指令：手動切換至氫能";
  else if(target === 'manual' && state === 'off') logMsg = "發送指令：解除鎖定 (自動模式)";
  else if(target === 'load1') logMsg = "發送指令：切換負載 1 狀態";
  else if(target === 'load2') logMsg = "發送指令：切換負載 2 狀態";
  else if(target === 'load3') logMsg = "發送指令：切換 蓄電池充電開關 狀態";
  else logMsg = `發送指令：${target} ${state}`;

  try{
    log(logMsg, 'e'); // 先在前端顯示操作紀錄 (Log locally first)
    await apiText(`/api/control?target=${encodeURIComponent(target)}&state=${encodeURIComponent(state)}`);
  }catch(e){
    log('指令發送失敗 (請檢查連線)', 'bad');
  }
}

// 儲存排程設定 (Save Schedule Settings)
async function saveSched(){
  const s = ui.schedStart.value;
  const e = ui.schedEnd.value;
  if(!s || !e) { log('時間格式錯誤', 'bad'); return; }

  const [sh, sm] = s.split(':');
  const [eh, em] = e.split(':');

  try {
    const url = `/api/settings?sh=${sh}&sm=${sm}&eh=${eh}&em=${em}`;
    await apiGet(url);
    log(`時段設定更新：${s} ~ ${e}`, 'ok');
  } catch(err) {
    log('時段更新失敗', 'bad');
  }
}

// 綁定按鈕事件 (Bind Event Listeners)
ui.btnMains.addEventListener('click', ()=>sendCtrl('grid','on'));
ui.btnHydro.addEventListener('click', ()=>sendCtrl('hydro','on'));
ui.btnClearManual.addEventListener('click', ()=>sendCtrl('manual','off'));

ui.btnLoad1.addEventListener('click', ()=>sendCtrl('load1','toggle'));
ui.btnLoad2.addEventListener('click', ()=>sendCtrl('load2','toggle'));
ui.btnLoad3.addEventListener('click', ()=>sendCtrl('load3','toggle'));

ui.btnSaveSched.addEventListener('click', saveSched);

let wasOnline = false;

// 定時輪詢函式 (Polling Function)
async function tick(){
  try{
    const d = await apiGet('/api/status');
    setOnline(true);
    if(!wasOnline) {
      log('系統連線已建立', 'ok');
      lastState.init = false;
    }
    wasOnline = true;
    renderStatus(d);
  }catch(e){
    setOnline(false);
    if(wasOnline) log('系統連線中斷', 'bad');
    wasOnline = false;
  }
}

// 程式進入點 (Main Entry Point)
(async function init(){
  setOnline(false);
  log('正在連接控制系統...', 'e');
  await tick();
  setInterval(tick, 1000); // 每秒更新一次 (Update every second)
})();
