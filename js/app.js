/*
 * app.js — หน้าจอและการทำงานของแอป
 * โครงสร้างง่ายๆ:
 *   state        = ข้อมูลทั้งหมด (รถ, การเติมน้ำมัน, การซ่อมบำรุง)
 *   render()     = วาดหน้าจอใหม่จาก state ทุกครั้งที่ข้อมูลเปลี่ยน
 *   open...Form  = เปิดฟอร์มเพิ่ม/แก้ไข แล้ว persist() บันทึกลงเครื่อง
 */
(function () {
  'use strict';

  const C = window.CarCalc;
  const S = window.CarStore;
  const Charts = window.CarCharts;

  const APP_VERSION = '1.1.2';
  const TABS = ['dashboard', 'fuel', 'service', 'settings'];
  const LAST_EXPORT_KEY = 'carinfo.lastExport';
  const BACKUP_SNOOZE_KEY = 'carinfo.backupSnoozeUntil';
  const BACKUP_EVERY_DAYS = 30; // เตือนสำรองข้อมูลถ้าไม่ได้สำรองนานกว่านี้
  const LOCALE = 'th-TH-u-ca-gregory'; // เดือนภาษาไทย ปี ค.ศ.
  const COLOR_FUEL = '#f0444f';    // สีกราฟ (ตรวจแล้วว่าแยกออกสำหรับคนตาบอดสี)
  const COLOR_SERVICE = '#2f9fd6';

  let state = S.load();
  let tab = 'dashboard';
  let selectedYear = null; // ปีที่เลือกดูในสรุปรายปี

  /* ======================= ไอคอน ======================= */
  const ICON_PATHS = {
    fuel: '<path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M4 20h12"/><path d="M8 9h4"/><path d="M15 9l3 3v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    oil: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    tire: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
    disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 3.5v3M20.5 12h-3"/>',
    battery: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 4v3M17 4v3M7 13h3M15.5 11.5v3M14 13h3"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    gauge: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-4"/>',
    thermo: '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/>',
    spark: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    wiper: '<path d="M3 19a14 14 0 0 1 18 0"/><path d="M12 19L18 6"/>',
    snow: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/>',
    cog: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2L19 19M5 19l2.8-2.8M16.2 7.8L19 5"/>',
    car: '<path d="M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v5H3z"/><path d="M3 13h18M6 18v2M18 18v2"/><circle cx="7.5" cy="15.5" r=".6"/><circle cx="16.5" cy="15.5" r=".6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    spring: '<path d="M8 3h8M8 21h8"/><path d="M9 5.5l6 2-6 2.5 6 2.5-6 2.5 6 2"/>',
    spray: '<rect x="7" y="8" width="8" height="13" rx="1.5"/><path d="M9 8V4h4v4M17 5h1M17 8h3M17 11h1"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 10h7M9 14h7M9 18h4"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON_PATHS[name] || '') + '</svg>';
  }

  /* ======================= ประเภทงานซ่อมบำรุง ======================= */
  const SERVICE_TYPES = [
    { id: 'oil', label: 'เปลี่ยนน้ำมันเครื่อง', icon: 'oil' },
    { id: 'oil_filter', label: 'ไส้กรองน้ำมันเครื่อง', icon: 'filter' },
    { id: 'air_filter', label: 'ไส้กรองอากาศ', icon: 'filter' },
    { id: 'cabin_filter', label: 'ไส้กรองแอร์', icon: 'filter' },
    { id: 'tires', label: 'เปลี่ยนยาง', icon: 'tire' },
    { id: 'alignment', label: 'สลับยาง / ตั้งศูนย์ถ่วงล้อ', icon: 'tire' },
    { id: 'brakes', label: 'ผ้าเบรก / จานเบรก', icon: 'disc' },
    { id: 'brake_fluid', label: 'น้ำมันเบรก', icon: 'oil' },
    { id: 'battery', label: 'แบตเตอรี่', icon: 'battery' },
    { id: 'coolant', label: 'น้ำยาหล่อเย็น', icon: 'thermo' },
    { id: 'transmission', label: 'น้ำมันเกียร์', icon: 'cog' },
    { id: 'spark_plugs', label: 'หัวเทียน', icon: 'spark' },
    { id: 'wipers', label: 'ใบปัดน้ำฝน', icon: 'wiper' },
    { id: 'ac', label: 'ระบบแอร์', icon: 'snow' },
    { id: 'inspection', label: 'เช็กระยะ', icon: 'gauge' },
    { id: 'tax', label: 'ต่อภาษี / พ.ร.บ.', icon: 'doc' },
    { id: 'insurance', label: 'ประกันภัย', icon: 'shield' },
    { id: 'suspension', label: 'ช่วงล่าง / พวงมาลัย', icon: 'spring' },
    { id: 'body', label: 'ทำสี / ตัวถัง', icon: 'spray' },
    { id: 'other', label: 'อื่นๆ', icon: 'wrench' }
  ];
  const TYPE_BY_ID = {};
  SERVICE_TYPES.forEach(function (t) { TYPE_BY_ID[t.id] = t; });

  const FUEL_GRADES = ['แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'แก๊สโซฮอล์ E85', 'เบนซิน 95', 'ดีเซล B7', 'ดีเซล B20', 'ดีเซลพรีเมียม'];

  /* ======================= ตัวช่วยจัดรูปแบบ ======================= */
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** กันข้อความที่ผู้ใช้พิมพ์ไปเป็นโค้ด HTML (สำคัญมาก ใช้ทุกครั้งที่แสดงข้อความผู้ใช้) */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const d = digits === undefined ? 0 : digits;
    return n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtMoney(n, digits) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    return '฿' + fmtNum(n, digits === undefined ? (Number.isInteger(n) ? 0 : 2) : digits);
  }
  function parseDate(s) { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) {
    if (!s) return '–';
    return parseDate(s).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtMonth(key, withYear) {
    return parseDate(key + '-01').toLocaleDateString(LOCALE, withYear ? { month: 'short', year: 'numeric' } : { month: 'short' });
  }
  function fmtIso(iso) { // เวลาแบบ ISO -> วันที่ตามเวลาเครื่อง
    const d = new Date(iso);
    return isNaN(d) ? '–' : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayNum(s) { return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000); }

  function relDays(d) {
    if (d === null) return '';
    if (d < 0) return 'เลยมา ' + fmtNum(-d) + ' วัน';
    if (d === 0) return 'ครบกำหนดวันนี้';
    return 'อีก ' + fmtNum(d) + ' วัน';
  }
  function relKm(k) {
    if (k === null) return '';
    if (k <= 0) return 'เลยมา ' + fmtNum(-k) + ' km';
    return 'อีก ' + fmtNum(k) + ' km';
  }

  /* ======================= ข้อมูล ======================= */
  function persist() {
    if (!S.save(state)) toast('บันทึกลงเครื่องไม่สำเร็จ (พื้นที่เต็มหรือเบราว์เซอร์บล็อก)');
  }
  function activeVehicle() {
    return state.vehicles.find(function (v) { return v.id === state.activeVehicleId; }) || state.vehicles[0] || null;
  }
  function fuelFor(vid) { return state.fuelLogs.filter(function (l) { return l.vehicleId === vid; }); }
  function servicesFor(vid) { return state.services.filter(function (s) { return s.vehicleId === vid; }); }
  function typeLabel(s) {
    const t = TYPE_BY_ID[s.type] || TYPE_BY_ID.other;
    if (s.type === 'other' && s.title) return s.title;
    return t.label;
  }

  function vehicleData(v) {
    const fuel = fuelFor(v.id);
    const services = servicesFor(v.id);
    const econ = C.computeFuelEconomy(fuel);
    const odo = C.currentOdometer(fuel, services);
    const reminders = C.computeReminders(services, odo, todayStr());
    return { fuel: fuel, services: services, econ: econ, odo: odo, reminders: reminders };
  }

  /* ======================= วาดหน้าจอ ======================= */
  function render() {
    const v = activeVehicle();
    if (v && state.activeVehicleId !== v.id) state.activeVehicleId = v.id;

    // แถบบน: ตัวเลือกรถ
    const wrap = $('#vehiclePickWrap');
    const sel = $('#vehicleSelect');
    wrap.hidden = state.vehicles.length === 0;
    sel.innerHTML = state.vehicles.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (v && x.id === v.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
    }).join('');

    // เมนูล่าง
    $$('.tabbar a').forEach(function (a) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    const data = v ? vehicleData(v) : null;
    $('#headerOdo').textContent = data && data.odo !== null ? 'เลขไมล์ ' + fmtNum(data.odo) + ' km' : 'บันทึกการดูแลรถ';

    $('#fab').hidden = !v || (tab !== 'fuel' && tab !== 'service');

    const view = $('#view');
    if (!v && tab !== 'settings') view.innerHTML = welcomeView();
    else if (tab === 'dashboard') view.innerHTML = dashboardView(v, data);
    else if (tab === 'fuel') view.innerHTML = fuelView(v, data);
    else if (tab === 'service') view.innerHTML = serviceView(v, data);
    else view.innerHTML = settingsView(v);

    drawCharts(data);
  }

  function welcomeView() {
    return '<div class="card glass empty" style="margin-top:24px">' +
      '<div class="empty-icon">' + icon('car') + '</div>' +
      '<h3>ยินดีต้อนรับสู่ Car Info</h3>' +
      '<p>จดการเติมน้ำมัน คำนวณอัตราสิ้นเปลือง (km/L)<br>และบันทึกการซ่อมบำรุงพร้อมแจ้งเตือนรอบถัดไป</p>' +
      '<button class="btn btn-primary btn-block" data-action="add-vehicle">' + icon('plus') + 'เพิ่มรถคันแรก</button>' +
      '</div>' +
      '<div class="notice">ข้อมูลทั้งหมด <b>เก็บในเครื่องนี้เท่านั้น</b> ไม่ส่งขึ้นอินเทอร์เน็ต — แนะนำให้กด “สำรองข้อมูล” ในหน้า รถ & ตั้งค่า เป็นระยะ</div>';
  }

  /* ---------- หน้า ภาพรวม ---------- */
  function dashboardView(v, d) {
    const sum = d.econ.summary;
    const month = C.monthlyCosts(d.fuel, d.services, 1, todayStr())[0];
    const monthTotal = month.fuel + month.service;
    let h = '<h1 class="page-title">' + esc(v.name) + '</h1>';
    h += backupBanner();

    // Hero: อัตราสิ้นเปลืองเฉลี่ย
    h += '<section class="card glass hero">';
    h += '<div class="hero-label">อัตราสิ้นเปลืองเฉลี่ย</div>';
    if (sum.avgKmPerL !== null) {
      h += '<div class="hero-value">' + fmtNum(sum.avgKmPerL, 1) + '<small>km/L</small></div>';
      h += '<div class="hero-meta"><span><b>' + fmtNum(sum.avgLPer100km, 1) + '</b> L/100km</span>' +
        '<span><b>' + (sum.avgCostPerKm !== null ? fmtMoney(sum.avgCostPerKm, 2) : '–') + '</b> ต่อ km</span>' +
        '<span>จาก ' + fmtNum(sum.trackedDistance) + ' km</span></div>';
    } else {
      h += '<div class="hero-value">–<small>km/L</small></div>';
      h += '<div class="hero-meta">' + (d.fuel.length === 0
        ? 'เริ่มจากเติมน้ำมัน “เต็มถัง” แล้วจดเลขไมล์ไว้'
        : 'ต้องมีการเติม “เต็มถัง” อย่างน้อย 2 ครั้ง จึงจะคำนวณได้') + '</div>';
    }
    h += '</section>';

    h += '<div class="quick">' +
      '<button class="btn btn-primary" data-action="add-fuel">' + icon('fuel') + 'เติมน้ำมัน</button>' +
      '<button class="btn" data-action="add-service">' + icon('wrench') + 'ซ่อมบำรุง</button></div>';

    h += '<div class="tiles">' +
      tile('เลขไมล์ล่าสุด', d.odo !== null ? fmtNum(d.odo) : '–', 'km') +
      tile('ครั้งล่าสุด', sum.last ? fmtNum(sum.last.kmPerL, 1) : '–', 'km/L', sum.last ? fmtDate(sum.last.date) : '') +
      tile('ค่าใช้จ่ายเดือนนี้', fmtMoney(monthTotal, 0), '', 'น้ำมัน ' + fmtMoney(month.fuel, 0) + ' · ซ่อม ' + fmtMoney(month.service, 0)) +
      tile('ราคาน้ำมันเฉลี่ย', sum.avgPricePerL !== null ? fmtNum(sum.avgPricePerL, 2) : '–', '฿/L') +
      '</div>';

    // แจ้งเตือน
    const due = d.reminders.filter(function (r) { return r.status !== 'ok'; });
    h += '<h2 class="section-title">ถึงกำหนดดูแล <a href="#service">ดูทั้งหมด</a></h2>';
    if (due.length) h += '<div class="list glass">' + due.slice(0, 4).map(reminderItem).join('') + '</div>';
    else h += '<div class="notice">' + (d.reminders.length
      ? 'ยังไม่มีรายการใกล้ถึงกำหนด (ภายใน 1,000 km หรือ 30 วัน)'
      : 'ใส่ “ครั้งถัดไป” ตอนบันทึกการซ่อมบำรุง แล้วแอปจะเตือนเมื่อใกล้ถึงกำหนด') + '</div>';

    // กราฟ km/L
    const segs = d.econ.segments;
    h += '<h2 class="section-title">อัตราสิ้นเปลืองแต่ละช่วง</h2>';
    if (segs.length >= 2) {
      h += '<section class="card glass"><div class="legend"><span>km/L ต่อช่วงเต็มถัง · เส้นประ = ค่าเฉลี่ย</span></div>' +
        '<div class="chart" id="chartEcon"></div>' + econTable(segs) + '</section>';
    } else {
      h += '<div class="notice">กราฟจะแสดงเมื่อมีข้อมูลอย่างน้อย 2 ช่วง (เติมเต็มถัง 3 ครั้ง)' +
        (segs.length === 1 ? ' — ตอนนี้มี 1 ช่วง: <b>' + fmtNum(segs[0].kmPerL, 1) + ' km/L</b>' : '') + '</div>';
    }

    // กราฟค่าใช้จ่าย
    const months = C.monthlyCosts(d.fuel, d.services, 6, todayStr());
    const any = months.some(function (m) { return m.fuel + m.service > 0; });
    h += '<h2 class="section-title">ค่าใช้จ่าย 6 เดือนล่าสุด</h2>';
    if (any) {
      h += '<section class="card glass"><div class="legend">' +
        '<span><i style="background:var(--chart-fuel)"></i>น้ำมัน</span>' +
        '<span><i style="background:var(--chart-service)"></i>ซ่อมบำรุง</span></div>' +
        '<div class="chart" id="chartCost"></div>' + costTable(months) + '</section>';
    } else {
      h += '<div class="notice">ยังไม่มีค่าใช้จ่ายใน 6 เดือนล่าสุด</div>';
    }
    h += yearlyView(d);
    return h;
  }

  function tile(label, value, unit, sub) {
    return '<div class="tile glass"><div class="tile-label">' + esc(label) + '</div>' +
      '<div class="tile-value">' + esc(value) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>' +
      (sub ? '<div class="tile-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  function econTable(segs) {
    return '<details class="table-view"><summary>ดูเป็นตาราง</summary><table><thead><tr>' +
      '<th>วันที่</th><th>ระยะ (km)</th><th>ลิตร</th><th>km/L</th></tr></thead><tbody>' +
      segs.slice().reverse().map(function (s) {
        return '<tr><td>' + esc(fmtDate(s.date)) + '</td><td>' + fmtNum(s.distance) + '</td><td>' +
          fmtNum(s.liters, 2) + '</td><td>' + fmtNum(s.kmPerL, 2) + '</td></tr>';
      }).join('') + '</tbody></table></details>';
  }

  function costTable(months) {
    return '<details class="table-view"><summary>ดูเป็นตาราง</summary><table><thead><tr>' +
      '<th>เดือน</th><th>น้ำมัน</th><th>ซ่อมบำรุง</th><th>รวม</th></tr></thead><tbody>' +
      months.slice().reverse().map(function (m) {
        return '<tr><td>' + esc(fmtMonth(m.month, true)) + '</td><td>' + fmtMoney(m.fuel, 0) + '</td><td>' +
          fmtMoney(m.service, 0) + '</td><td>' + fmtMoney(m.fuel + m.service, 0) + '</td></tr>';
      }).join('') + '</tbody></table></details>';
  }

  function reminderItem(r) {
    const s = r.service;
    const t = TYPE_BY_ID[s.type] || TYPE_BY_ID.other;
    const label = { overdue: 'เลยกำหนด', soon: 'ใกล้ถึง', ok: 'ปกติ' }[r.status];
    const ic = { overdue: 'alert', soon: 'clock', ok: 'check' }[r.status];
    const parts = [];
    if (r.nextKm !== null) parts.push('ที่ ' + fmtNum(r.nextKm) + ' km' + (r.kmLeft !== null ? ' (' + relKm(r.kmLeft) + ')' : ''));
    if (r.nextDate) parts.push(fmtDate(r.nextDate) + ' (' + relDays(r.daysLeft) + ')');
    return '<button class="item" data-action="edit-service" data-id="' + esc(s.id) + '">' +
      '<span class="item-icon blue">' + icon(t.icon) + '</span>' +
      '<span class="item-main"><span class="item-title">' + esc(typeLabel(s)) +
      ' <span class="badge ' + r.status + '">' + icon(ic) + label + '</span></span>' +
      '<span class="item-sub">' + esc(parts.join(' · ')) + '</span>' +
      '<span class="item-note">ทำล่าสุด ' + esc(fmtDate(s.date)) + (s.odometer ? ' · ' + fmtNum(+s.odometer) + ' km' : '') + '</span></span>' +
      '</button>';
  }

  /* ---------- หน้า น้ำมัน ---------- */
  function fuelView(v, d) {
    const sum = d.econ.summary;
    let h = '<h1 class="page-title">เติมน้ำมัน</h1>';
    h += '<div class="tiles">' +
      tile('เฉลี่ย', sum.avgKmPerL !== null ? fmtNum(sum.avgKmPerL, 1) : '–', 'km/L',
        sum.best ? 'ดีสุด ' + fmtNum(sum.best.kmPerL, 1) + ' · แย่สุด ' + fmtNum(sum.worst.kmPerL, 1) : '') +
      tile('ค่าใช้จ่าย/km', sum.avgCostPerKm !== null ? fmtMoney(sum.avgCostPerKm, 2) : '–', '') +
      tile('ค่าน้ำมันรวม', fmtMoney(sum.totalSpent, 0), '', fmtNum(sum.totalLiters, 1) + ' ลิตร') +
      tile('จำนวนครั้ง', fmtNum(sum.fillCount), 'ครั้ง') +
      '</div>';

    h += explainCard();

    h += '<h2 class="section-title">ประวัติการเติม</h2>';
    if (!d.fuel.length) {
      h += '<div class="card glass empty"><div class="empty-icon">' + icon('fuel') + '</div><h3>ยังไม่มีบันทึก</h3>' +
        '<p>กด + เพื่อจดการเติมน้ำมันครั้งแรก<br>เคล็ดลับ: เติมให้ “เต็มถัง” (หัวจ่ายตัด) จะคำนวณได้แม่นที่สุด</p>' +
        '<button class="btn btn-primary" data-action="add-fuel">' + icon('plus') + 'เพิ่มการเติมน้ำมัน</button></div>';
      return h;
    }
    const sorted = C.sortByOdometer(d.fuel).reverse();
    h += '<div class="list glass">' + sorted.map(function (l, i) {
      const prev = sorted[i + 1];
      const seg = d.econ.byLogId[l.id];
      const since = prev ? (+l.odometer - +prev.odometer) : null;
      const sub = fmtNum(+l.odometer) + ' km · ' + fmtNum(+l.liters, 2) + ' L' +
        (l.price ? ' × ' + fmtNum(+l.price, 2) + ' ฿/L' : '');
      const note = [l.grade, l.station, l.note].filter(Boolean).join(' · ');
      return '<button class="item" data-action="edit-fuel" data-id="' + esc(l.id) + '">' +
        '<span class="item-icon">' + icon('fuel') + '</span>' +
        '<span class="item-main"><span class="item-title">' + esc(fmtDate(l.date)) + ' ' +
        (l.full ? '<span class="badge full">เต็มถัง</span>' : '<span class="badge">ไม่เต็มถัง</span>') +
        (l.missed ? '<span class="badge soon">ลืมจดครั้งก่อน</span>' : '') + '</span>' +
        '<span class="item-sub">' + esc(sub) + '</span>' +
        (note ? '<span class="item-note">' + esc(note) + '</span>' : '') + '</span>' +
        '<span class="item-end"><div class="big">' + (l.total ? fmtMoney(+l.total) : '–') + '</div>' +
        (seg ? '<div class="sub econ">' + fmtNum(seg.kmPerL, 1) + ' km/L</div>' : '') +
        (since !== null && since > 0 ? '<div class="sub">+' + fmtNum(since) + ' km</div>' : '') +
        '</span></button>';
    }).join('') + '</div>';
    return h;
  }

  function explainCard() {
    return '<details class="card glass"><summary>คำนวณ km/L อย่างไร?</summary><div class="explain">' +
      '<p>แอปใช้วิธี <b>“เต็มถังถึงเต็มถัง”</b> ซึ่งแม่นที่สุดสำหรับการจดเอง:</p>' +
      '<ol><li>เติมเต็มถัง (หัวจ่ายตัด) แล้วจดเลขไมล์ เช่น <code>10,000 km</code></li>' +
      '<li>ขับตามปกติ จนเติมเต็มถังครั้งถัดไปที่ <code>10,500 km</code> ได้ <code>35 ลิตร</code></li>' +
      '<li>35 ลิตรนี้คือน้ำมันที่ใช้ไปใน 500 km → <code>500 ÷ 35 = 14.3 km/L</code></li></ol>' +
      '<p><b>เติมไม่เต็มถัง</b> ระหว่างทาง: ให้ติ๊ก “เต็มถัง” ออก ลิตรจะถูกรวมเข้ากับการเติมเต็มถังครั้งถัดไป</p>' +
      '<p><b>ลืมจด</b> การเติมครั้งก่อน: ติ๊ก “ลืมจดครั้งก่อน” แอปจะข้ามช่วงนั้น เพราะไม่รู้ลิตรที่เติมจริง</p>' +
      '<p class="small muted">L/100km = ลิตรที่ใช้ต่อการขับ 100 km (ยิ่งน้อยยิ่งประหยัด) · ค่าเฉลี่ยรวมคิดจาก ระยะทางรวม ÷ ลิตรรวม</p>' +
      '</div></details>';
  }

  /* ---------- หน้า ซ่อมบำรุง ---------- */
  function serviceView(v, d) {
    let h = '<h1 class="page-title">ซ่อมบำรุง</h1>';
    const total = d.services.reduce(function (a, s) { return a + (C.toNum(s.cost) || 0); }, 0);
    h += '<div class="tiles">' +
      tile('ค่าซ่อมบำรุงรวม', fmtMoney(total, 0), '', fmtNum(d.services.length) + ' รายการ') +
      tile('ต้องดูแล', fmtNum(d.reminders.filter(function (r) { return r.status !== 'ok'; }).length), 'รายการ', 'เลยกำหนด/ใกล้ถึง') +
      '</div>';

    h += '<h2 class="section-title">กำหนดครั้งถัดไป</h2>';
    if (d.reminders.length) h += '<div class="list glass">' + d.reminders.map(reminderItem).join('') + '</div>';
    else h += '<div class="notice">ยังไม่มีกำหนดครั้งถัดไป — ใส่ “ครั้งถัดไป (km / วันที่)” ในฟอร์มซ่อมบำรุง แล้วแอปจะเตือนเมื่อเหลือไม่ถึง 1,000 km หรือ 30 วัน</div>';

    h += '<h2 class="section-title">ประวัติ <button class="link" data-action="import-notes">วางจากโน้ต</button></h2>';
    if (!d.services.length) {
      h += '<div class="card glass empty"><div class="empty-icon">' + icon('wrench') + '</div><h3>ยังไม่มีบันทึก</h3>' +
        '<p>จดการเปลี่ยนน้ำมันเครื่อง ยาง แบตเตอรี่ ภาษี ฯลฯ<br>เคยจดไว้ในโน้ต? ก๊อปมาวางได้เลย</p>' +
        '<div class="btn-row"><button class="btn btn-primary" data-action="add-service">' + icon('plus') + 'เพิ่มรายการ</button>' +
        '<button class="btn" data-action="import-notes">' + icon('note') + 'วางจากโน้ต</button></div></div>';
      return h;
    }
    const sorted = d.services.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || ((+b.odometer || 0) - (+a.odometer || 0));
    });
    h += '<div class="list glass">' + sorted.map(function (s) {
      const t = TYPE_BY_ID[s.type] || TYPE_BY_ID.other;
      const extra = s.type !== 'other' && s.title ? s.title : '';
      const next = [];
      if (s.nextKm) next.push(fmtNum(+s.nextKm) + ' km');
      if (s.nextDate) next.push(fmtDate(s.nextDate));
      const note = [extra, s.shop, s.note].filter(Boolean).join(' · ');
      return '<button class="item" data-action="edit-service" data-id="' + esc(s.id) + '">' +
        '<span class="item-icon blue">' + icon(t.icon) + '</span>' +
        '<span class="item-main"><span class="item-title">' + esc(typeLabel(s)) + '</span>' +
        '<span class="item-sub">' + esc(fmtDate(s.date)) + (s.odometer ? ' · ' + fmtNum(+s.odometer) + ' km' : '') + '</span>' +
        (note ? '<span class="item-note">' + esc(note) + '</span>' : '') +
        (next.length ? '<span class="item-note">ครั้งถัดไป: ' + esc(next.join(' หรือ ')) + '</span>' : '') +
        '</span><span class="item-end"><div class="big">' + (s.cost ? fmtMoney(+s.cost) : '–') + '</div></span></button>';
    }).join('') + '</div>';
    return h;
  }

  /* ---------- หน้า รถ & ตั้งค่า ---------- */
  function settingsView(v) {
    let h = '<h1 class="page-title">รถ & ตั้งค่า</h1>';
    h += '<h2 class="section-title">รถของฉัน <button class="link" data-action="add-vehicle">+ เพิ่มรถ</button></h2>';
    if (state.vehicles.length) {
      h += '<div class="list glass">' + state.vehicles.map(function (x) {
        const sub = [x.make, x.model, x.year].filter(Boolean).join(' ');
        const n = fuelFor(x.id).length + servicesFor(x.id).length;
        return '<button class="item" data-action="edit-vehicle" data-id="' + esc(x.id) + '">' +
          '<span class="item-icon">' + icon('car') + '</span>' +
          '<span class="item-main"><span class="item-title">' + esc(x.name) +
          (v && x.id === v.id ? ' <span class="badge full">ใช้งานอยู่</span>' : '') + '</span>' +
          '<span class="item-sub">' + esc([sub, x.plate].filter(Boolean).join(' · ') || 'แตะเพื่อแก้ไข') + '</span>' +
          '<span class="item-note">' + esc([x.fuel, x.tankL ? 'ถัง ' + x.tankL + ' L' : '', n + ' บันทึก'].filter(Boolean).join(' · ')) + '</span>' +
          '</span></button>';
      }).join('') + '</div>';
    } else {
      h += '<div class="card glass empty"><p>ยังไม่มีรถ</p><button class="btn btn-primary" data-action="add-vehicle">' + icon('plus') + 'เพิ่มรถ</button></div>';
    }

    let lastExport = null;
    try { lastExport = localStorage.getItem(LAST_EXPORT_KEY); } catch (e) { /* ignore */ }
    const backup = S.readBackupBeforeImport();

    h += '<h2 class="section-title">สำรองข้อมูล</h2>';
    h += '<section class="card glass stack">' +
      '<div class="notice">ข้อมูล <b>เก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น</b> ถ้าล้างข้อมูลเบราว์เซอร์ ลบแอป หรือเปลี่ยนเครื่อง ข้อมูลจะหาย ' +
      'ให้กด “ส่งออก” เก็บไฟล์ไว้ใน Files / iCloud Drive / Google Drive เป็นระยะ<br>' +
      '<span class="small">สำรองล่าสุด: ' + (lastExport ? esc(fmtIso(lastExport)) : 'ยังไม่เคย') + '</span></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" data-action="export-json">' + icon('download') + 'ส่งออก (สำรอง)</button>' +
      '<button class="btn" data-action="import-json">' + icon('upload') + 'นำเข้าไฟล์สำรอง</button></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-sm" data-action="export-csv-fuel">CSV น้ำมัน</button>' +
      '<button class="btn btn-sm" data-action="export-csv-service">CSV ซ่อมบำรุง</button></div>' +
      '<button class="btn btn-sm btn-block" data-action="import-notes">' + icon('note') + 'นำเข้าประวัติซ่อมบำรุงจากโน้ต (ข้อความ)</button>' +
      '<p class="hint">CSV เปิดใน Excel / Google Sheets ได้ (เฉพาะรถที่เลือกอยู่) · ไฟล์สำรอง (.json) ใช้สำหรับนำกลับเข้าแอป</p>' +
      (backup ? '<button class="btn btn-sm" data-action="undo-import">ย้อนกลับเป็นข้อมูลก่อนนำเข้า (' + esc(fmtIso(backup.savedAt)) + ')</button>' : '') +
      '</section>';

    h += '<h2 class="section-title">ติดตั้งบน iPhone</h2>';
    h += '<section class="card glass explain"><ol>' +
      '<li>เปิดเว็บแอปนี้ด้วย <b>Safari</b></li>' +
      '<li>กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น)</li>' +
      '<li>เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> แล้วกด เพิ่ม</li></ol>' +
      '<p class="small muted">เปิดจากไอคอนบนหน้าจอโฮมทุกครั้ง ข้อมูลจะอยู่ในแอปนั้น (แยกจากข้อมูลใน Safari ปกติ)</p></section>';

    h += explainCard();

    h += '<h2 class="section-title">โซนอันตราย</h2>';
    h += '<section class="card glass"><button class="btn btn-danger btn-block" data-action="clear-all">ลบข้อมูลทั้งหมดในเครื่องนี้</button></section>';
    h += '<p class="hint" style="text-align:center">Car Info v' + APP_VERSION + '</p>';
    return h;
  }

  /* ---------- เตือนสำรองข้อมูล ---------- */
  function daysSinceBackup() {
    let last = null;
    try { last = localStorage.getItem(LAST_EXPORT_KEY); } catch (e) { /* ignore */ }
    if (!last || isNaN(new Date(last))) return null;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }

  function backupBanner() {
    const count = state.fuelLogs.length + state.services.length;
    if (!count) return '';
    const days = daysSinceBackup();
    if (days !== null && days < BACKUP_EVERY_DAYS) return '';
    let snooze = 0;
    try { snooze = Number(localStorage.getItem(BACKUP_SNOOZE_KEY)) || 0; } catch (e) { /* ignore */ }
    if (snooze > Date.now()) return '';
    const msg = days === null
      ? 'ยังไม่เคยสำรองข้อมูล (' + fmtNum(count) + ' รายการ)'
      : 'ไม่ได้สำรองข้อมูลมา ' + fmtNum(days) + ' วัน';
    return '<section class="card glass backup-banner" role="status">' +
      '<div class="backup-text"><span class="item-icon">' + icon('alert') + '</span><div><b>' + esc(msg) + '</b>' +
      '<div class="small muted">ข้อมูลอยู่ในเครื่องนี้เท่านั้น ส่งออกเก็บไว้ใน Files / iCloud กันข้อมูลหาย</div></div></div>' +
      '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="export-json">' + icon('download') + 'สำรองตอนนี้</button>' +
      '<button class="btn btn-sm" data-action="snooze-backup">เตือนอีก 7 วัน</button></div></section>';
  }

  /* ---------- สรุปรายปี ---------- */
  function yearlyView(d) {
    const years = C.yearlySummary(d.fuel, d.services);
    if (!years.length) return '';
    if (!selectedYear || !years.some(function (y) { return y.year === selectedYear; })) selectedYear = years[years.length - 1].year;
    const anyCost = years.some(function (y) { return y.fuel + y.service > 0; });

    let h = '<h2 class="section-title">สรุปรายปี</h2>';
    h += '<section class="card glass">';
    if (anyCost) {
      h += '<div class="legend"><span><i style="background:var(--chart-fuel)"></i>น้ำมัน</span>' +
        '<span><i style="background:var(--chart-service)"></i>ซ่อมบำรุง</span></div><div class="chart" id="chartYear"></div>';
    } else {
      h += '<div class="notice">ยังไม่มีค่าใช้จ่ายที่ใส่ราคาไว้ — แตะรายการในหน้าซ่อมบำรุงเพื่อเพิ่มราคา แล้วกราฟจะขึ้น</div>';
    }
    h += '<details class="table-view"' + (anyCost ? '' : ' open') + '><summary>ดูเป็นตาราง</summary><table><thead><tr>' +
      '<th>ปี</th><th>น้ำมัน</th><th>ซ่อม</th><th>รวม</th><th>ระยะ (km)</th></tr></thead><tbody>' +
      years.slice().reverse().map(function (y) {
        return '<tr><td>' + esc(y.year) + '</td><td>' + fmtMoney(y.fuel, 0) + '</td><td>' + fmtMoney(y.service, 0) +
          '</td><td>' + fmtMoney(y.fuel + y.service, 0) + '</td><td>' + (y.distance !== null ? fmtNum(y.distance) : '–') + '</td></tr>';
      }).join('') + '</tbody></table></details>';

    // รายละเอียดปีที่เลือก
    const y = years.find(function (x) { return x.year === selectedYear; });
    const total = y.fuel + y.service;
    h += '<div class="chips" style="margin-top:14px" role="group" aria-label="เลือกปี">' + years.map(function (x) {
      return '<button type="button" class="chip' + (x.year === selectedYear ? ' active' : '') + '" data-action="pick-year" data-year="' +
        esc(x.year) + '" aria-pressed="' + (x.year === selectedYear) + '">' + esc(x.year) + '</button>';
    }).join('') + '</div>';
    h += '<div class="tiles" style="margin:12px 0 4px">' +
      tile('รวมปี ' + y.year, fmtMoney(total, 0), '', 'น้ำมัน ' + fmtMoney(y.fuel, 0) + ' · ซ่อม ' + fmtMoney(y.service, 0)) +
      tile('ระยะทาง', y.distance !== null ? fmtNum(y.distance) : '–', 'km', 'คิดจากเลขไมล์ที่จดไว้') +
      tile('ค่าใช้จ่าย/km', y.distance && total > 0 ? fmtMoney(total / y.distance, 2) : '–', '') +
      tile('งานซ่อมบำรุง', fmtNum(y.serviceCount), 'ครั้ง', y.fillCount ? 'เติมน้ำมัน ' + fmtNum(y.fillCount) + ' ครั้ง' : '') +
      '</div>';

    const byType = {};
    d.services.forEach(function (s) {
      if (String(s.date).slice(0, 4) !== y.year) return;
      const k = TYPE_BY_ID[s.type] ? s.type : 'other';
      const r = byType[k] || (byType[k] = { type: k, count: 0, cost: 0 });
      r.count++; r.cost += C.toNum(s.cost) || 0;
    });
    const rows = Object.keys(byType).map(function (k) { return byType[k]; })
      .sort(function (a, b) { return (b.cost - a.cost) || (b.count - a.count); });
    if (rows.length) {
      h += '<table style="margin-top:8px"><thead><tr><th>ประเภทงาน ' + esc(y.year) + '</th><th>ครั้ง</th><th>ค่าใช้จ่าย</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + esc(TYPE_BY_ID[r.type].label) + '</td><td>' + fmtNum(r.count) + '</td><td>' + (r.cost > 0 ? fmtMoney(r.cost, 0) : '–') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (y.missingCost) {
      h += '<p class="hint">' + fmtNum(y.missingCost) + ' รายการในปีนี้ยังไม่มีราคา จึงไม่ถูกรวมในยอด — แตะรายการในหน้าซ่อมบำรุงเพื่อเพิ่มราคา</p>';
    }
    h += '</section>';
    return h;
  }

  /* ---------- นำเข้าจากโน้ต ---------- */
  function openNotesImport() {
    const v = activeVehicle();
    if (!v) { toast('เพิ่มรถก่อน แล้วค่อยนำเข้า'); return; }
    let parsed = null;
    openSheet('นำเข้าจากโน้ต',
      '<div class="form">' +
      '<p class="hint" style="margin:0">ก๊อปข้อความจากแอปโน้ตมาวาง 1 บรรทัดต่อ 1 รายการ รูปแบบ:<br>' +
      '<code>วันที่ &nbsp; เลขไมล์ &nbsp; รายละเอียด</code> เช่น <code>12/5/2024 135600 เปลี่ยนน้ำมันเครื่อง ที่ ร้าน A</code><br>' +
      'เลขไมล์เว้นว่างได้ · ปี พ.ศ. ก็ได้ · บรรทัดหัวตารางจะถูกข้าม · จะนำเข้าให้รถ <b>' + esc(v.name) + '</b></p>' +
      field('ข้อความ', '<textarea id="notesText" rows="8" placeholder="วางข้อความที่นี่"></textarea>') +
      '<button type="button" class="btn btn-block" id="notesParse">อ่านข้อมูล</button>' +
      '<div id="notesPreview"></div></div>');

    $('#notesParse').addEventListener('click', function () {
      parsed = C.parseServiceNotes($('#notesText').value, servicesFor(v.id));
      renderPreview();
    });

    function renderPreview() {
      const box = $('#notesPreview');
      if (!parsed.rows.length) {
        box.innerHTML = '<p class="form-error">ไม่พบรายการที่อ่านได้ — ตรวจว่าแต่ละบรรทัดขึ้นต้นด้วยวันที่ เช่น 23/3/2024</p>';
        return;
      }
      const dup = parsed.rows.filter(function (r) { return r.duplicate; }).length;
      let h = '<p class="small" style="margin:6px 2px">พบ <b>' + parsed.rows.length + '</b> รายการ' +
        (dup ? ' · ซ้ำกับที่มีอยู่ ' + dup + ' รายการ (ไม่ติ๊กไว้ให้)' : '') +
        (parsed.skipped.length ? ' · ข้าม ' + parsed.skipped.length + ' บรรทัดที่ไม่มีวันที่' : '') +
        '<br><span class="muted">ตรวจ “ประเภท” ที่แอปเดาให้ เปลี่ยนได้ก่อนกดนำเข้า</span></p>';
      h += '<div class="list glass import-list">' + parsed.rows.map(function (r, i) {
        return '<div class="item import-row">' +
          '<input type="checkbox" data-i="' + i + '"' + (r.duplicate ? '' : ' checked') + ' aria-label="นำเข้ารายการ ' + esc(fmtDate(r.date)) + '">' +
          '<div class="item-main"><div class="item-title">' + esc(fmtDate(r.date)) + ' <span class="muted small">' +
          (r.odometer !== null ? fmtNum(r.odometer) + ' km' : r.odoNote ? esc(r.odoNote) + ' km (ไม่ครบ)' : 'ไม่มีเลขไมล์') + '</span>' +
          (r.duplicate ? ' <span class="badge soon">มีแล้ว</span>' : '') + '</div>' +
          '<div class="item-sub">' + esc(r.title) + (r.shop ? ' <span class="muted">· ' + esc(r.shop) + '</span>' : '') + '</div>' +
          '<select class="type-pick" data-i="' + i + '" aria-label="ประเภท">' + SERVICE_TYPES.map(function (t) {
            return '<option value="' + t.id + '"' + (t.id === r.type ? ' selected' : '') + '>' + esc(t.label) + '</option>';
          }).join('') + '</select></div></div>';
      }).join('') + '</div>';
      h += '<button type="button" class="btn btn-primary btn-block" id="notesImport" style="margin-top:12px"></button>';
      box.innerHTML = h;
      updateCount();
      box.addEventListener('change', function (e) {
        const i = e.target.dataset.i;
        if (i === undefined) return;
        if (e.target.classList.contains('type-pick')) parsed.rows[+i].type = e.target.value;
        updateCount();
      });
      $('#notesImport').addEventListener('click', doImport);
    }

    function chosen() {
      return $$('#notesPreview input[type=checkbox]').filter(function (c) { return c.checked; })
        .map(function (c) { return parsed.rows[+c.dataset.i]; });
    }
    function updateCount() {
      const n = chosen().length;
      const b = $('#notesImport');
      b.textContent = 'นำเข้า ' + n + ' รายการ';
      b.disabled = n === 0;
    }
    function doImport() {
      const rows = chosen();
      if (!rows.length) return;
      rows.forEach(function (r) {
        state.services.push({
          id: S.uid(), vehicleId: v.id, type: r.type, title: r.title, date: r.date,
          odometer: r.odometer, cost: null, shop: r.shop,
          note: r.odoNote ? 'เลขไมล์ในโน้ต: ' + r.odoNote : '',
          nextKm: null, nextDate: null, source: 'notes'
        });
      });
      persist(); closeSheet();
      location.hash = '#service';
      render();
      toast('นำเข้า ' + rows.length + ' รายการแล้ว — อย่าลืมสำรองข้อมูล');
    }
  }

  /* ======================= กราฟ ======================= */
  function drawCharts(data) {
    if (!data) return;
    const econEl = $('#chartEcon');
    if (econEl) {
      const segs = data.econ.segments;
      Charts.line(econEl, segs.map(function (s) {
        return { t: dayNum(s.date), value: s.kmPerL, dateLabel: fmtDate(s.date), note: fmtNum(s.distance) + ' km' };
      }), {
        color: COLOR_FUEL, unit: 'km/L',
        format: function (v) { return fmtNum(v, 1); },
        reference: { value: data.econ.summary.avgKmPerL, label: 'เฉลี่ย ' + fmtNum(data.econ.summary.avgKmPerL, 1) },
        ariaLabel: 'กราฟ km/L ' + segs.length + ' ช่วง ล่าสุด ' + fmtNum(segs[segs.length - 1].kmPerL, 1) + ' km/L'
      });
    }
    const costEl = $('#chartCost');
    if (costEl) {
      const months = C.monthlyCosts(data.fuel, data.services, 6, todayStr());
      Charts.stackedBars(costEl, months.map(function (m) {
        return { label: fmtMonth(m.month), title: fmtMonth(m.month, true), values: [m.fuel, m.service] };
      }), [{ name: 'น้ำมัน', color: COLOR_FUEL }, { name: 'ซ่อมบำรุง', color: COLOR_SERVICE }], {
        format: function (v, full) {
          if (!full && v >= 10000) return '฿' + fmtNum(v / 1000, v >= 100000 ? 0 : 1) + 'k';
          return fmtMoney(v, 0);
        },
        ariaLabel: 'กราฟแท่งค่าใช้จ่ายรายเดือน 6 เดือนล่าสุด แยกน้ำมันและซ่อมบำรุง'
      });
    }
    const yearEl = $('#chartYear');
    if (yearEl) {
      const years = C.yearlySummary(data.fuel, data.services);
      Charts.stackedBars(yearEl, years.map(function (y) {
        return { label: y.year, title: 'ปี ' + y.year, values: [y.fuel, y.service] };
      }), [{ name: 'น้ำมัน', color: COLOR_FUEL }, { name: 'ซ่อมบำรุง', color: COLOR_SERVICE }], {
        format: function (v, full) {
          if (!full && v >= 10000) return '฿' + fmtNum(v / 1000, v >= 100000 ? 0 : 1) + 'k';
          return fmtMoney(v, 0);
        },
        ariaLabel: 'กราฟแท่งค่าใช้จ่ายรายปี แยกน้ำมันและซ่อมบำรุง'
      });
    }
  }

  /* ======================= Sheet (ฟอร์ม) ======================= */
  const sheet = $('#sheet');

  function openSheet(title, bodyHtml) {
    $('#sheetBody').innerHTML =
      '<div class="sheet-head"><h2 id="sheetTitle">' + esc(title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="ปิด">' + icon('close') + '</button></div>' + bodyHtml;
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    sheet.scrollTop = 0;
  }
  function closeSheet() {
    if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
  }
  sheet.addEventListener('close', function () { $('#sheetBody').innerHTML = ''; });
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet) { // แตะพื้นที่มืดนอกฟอร์ม = ปิด
      const r = sheet.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) closeSheet();
    }
    if (e.target.closest('[data-close]')) closeSheet();
  });

  function field(label, inputHtml, hint) {
    return '<label class="field"><span>' + label + '</span>' + inputHtml + (hint ? '<small class="hint">' + hint + '</small>' : '') + '</label>';
  }
  function attr(v) { return v === null || v === undefined ? '' : esc(v); }
  function formError(form, msg) {
    const el = $('.form-error', form);
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ block: 'nearest' });
  }
  function numVal(form, name) { return C.toNum(form.elements[name].value); }
  function strVal(form, name) { return String(form.elements[name].value || '').trim(); }

  /* ---------- ฟอร์มรถ ---------- */
  function openVehicleForm(v) {
    const isNew = !v;
    v = v || {};
    openSheet(isNew ? 'เพิ่มรถ' : 'แก้ไขรถ',
      '<form class="form" id="vehicleForm" novalidate>' +
      field('ชื่อเรียก *', '<input name="name" required maxlength="40" placeholder="เช่น Civic ของฉัน" value="' + attr(v.name) + '">') +
      '<div class="row">' +
      field('ยี่ห้อ', '<input name="make" maxlength="30" placeholder="Honda" value="' + attr(v.make) + '">') +
      field('รุ่น', '<input name="model" maxlength="30" placeholder="Civic" value="' + attr(v.model) + '">') +
      '</div><div class="row">' +
      field('ปี (ค.ศ.)', '<input name="year" inputmode="numeric" maxlength="4" placeholder="2020" value="' + attr(v.year) + '">') +
      field('ทะเบียน', '<input name="plate" maxlength="20" placeholder="1กข 1234" value="' + attr(v.plate) + '">') +
      '</div><div class="row">' +
      field('น้ำมันที่ใช้', '<input name="fuel" list="fuelGrades" maxlength="30" placeholder="แก๊สโซฮอล์ 95" value="' + attr(v.fuel) + '">') +
      field('ความจุถัง (ลิตร)', '<input name="tankL" inputmode="decimal" placeholder="47" value="' + attr(v.tankL) + '">', 'ไม่บังคับ ใช้เตือนถ้ากรอกลิตรเกินถัง') +
      '</div>' + fuelDatalist() +
      '<p class="form-error" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-primary btn-block" type="submit">บันทึก</button>' +
      (isNew ? '' : '<button class="btn btn-danger btn-block" type="button" data-action="delete-vehicle" data-id="' + esc(v.id) + '">ลบรถคันนี้</button>') +
      '</div></form>');

    $('#vehicleForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.target;
      const name = strVal(f, 'name');
      if (!name) return formError(f, 'กรุณาใส่ชื่อเรียกรถ');
      const tank = numVal(f, 'tankL');
      if (strVal(f, 'tankL') && (tank === null || tank <= 0)) return formError(f, 'ความจุถังต้องเป็นตัวเลขมากกว่า 0');
      const rec = Object.assign({}, v, {
        id: v.id || S.uid(), name: name, make: strVal(f, 'make'), model: strVal(f, 'model'),
        year: strVal(f, 'year'), plate: strVal(f, 'plate'), fuel: strVal(f, 'fuel'), tankL: tank,
        createdAt: v.createdAt || new Date().toISOString()
      });
      if (isNew) { state.vehicles.push(rec); state.activeVehicleId = rec.id; }
      else state.vehicles = state.vehicles.map(function (x) { return x.id === rec.id ? rec : x; });
      persist(); closeSheet();
      if (isNew && tab === 'settings') location.hash = '#dashboard'; // hashchange จะ render ให้
      render(); toast(isNew ? 'เพิ่มรถแล้ว' : 'บันทึกแล้ว');
    });
  }

  function fuelDatalist() {
    return '<datalist id="fuelGrades">' + FUEL_GRADES.map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>';
  }

  function deleteVehicle(id) {
    const v = state.vehicles.find(function (x) { return x.id === id; });
    if (!v) return;
    const n = fuelFor(id).length + servicesFor(id).length;
    if (!confirm('ลบ “' + v.name + '” และบันทึกทั้งหมดของรถคันนี้ (' + n + ' รายการ)?\nแนะนำให้ส่งออกไฟล์สำรองก่อน')) return;
    state.vehicles = state.vehicles.filter(function (x) { return x.id !== id; });
    state.fuelLogs = state.fuelLogs.filter(function (x) { return x.vehicleId !== id; });
    state.services = state.services.filter(function (x) { return x.vehicleId !== id; });
    if (state.activeVehicleId === id) state.activeVehicleId = state.vehicles[0] ? state.vehicles[0].id : null;
    persist(); closeSheet(); render(); toast('ลบแล้ว');
  }

  /* ---------- ฟอร์มเติมน้ำมัน ---------- */
  function openFuelForm(log) {
    const v = activeVehicle();
    if (!v) return;
    const isNew = !log;
    const d = vehicleData(v);
    const lastFill = C.sortByOdometer(d.fuel).pop();
    log = log || {
      date: todayStr(), full: true, missed: false,
      price: lastFill ? lastFill.price : '',
      grade: lastFill && lastFill.grade ? lastFill.grade : (v.fuel || '')
    };

    openSheet(isNew ? 'เติมน้ำมัน' : 'แก้ไขการเติมน้ำมัน',
      '<form class="form" id="fuelForm" novalidate>' +
      '<div class="row">' +
      field('วันที่', '<input type="date" name="date" required value="' + attr(log.date) + '">') +
      field('เลขไมล์ (km) *', '<input name="odometer" inputmode="numeric" required placeholder="' + (d.odo !== null ? 'ล่าสุด ' + fmtNum(d.odo) : 'เช่น 52340') + '" value="' + attr(log.odometer) + '">') +
      '</div>' +
      '<div class="row row-3">' +
      field('ลิตร *', '<input name="liters" inputmode="decimal" placeholder="0.00" value="' + attr(log.liters) + '">') +
      field('฿/ลิตร', '<input name="price" inputmode="decimal" placeholder="0.00" value="' + attr(log.price) + '">') +
      field('ยอดเงิน ฿', '<input name="total" inputmode="decimal" placeholder="0.00" value="' + attr(log.total) + '">') +
      '</div><p class="hint" style="margin-top:-6px">กรอก 2 ช่อง ช่องที่ 3 จะคำนวณให้อัตโนมัติ (ช่องสีส้ม)</p>' +
      '<label class="check"><input type="checkbox" name="full"' + (log.full ? ' checked' : '') + '>' +
      '<div><b>เติมเต็มถัง</b><span>เติมจนหัวจ่ายตัด — ใช้คำนวณ km/L</span></div></label>' +
      '<label class="check"><input type="checkbox" name="missed"' + (log.missed ? ' checked' : '') + '>' +
      '<div><b>ลืมจดการเติมครั้งก่อน</b><span>ติ๊กถ้ามีการเติมที่ไม่ได้จดไว้ก่อนครั้งนี้ แอปจะไม่นำช่วงนั้นมาคำนวณ</span></div></label>' +
      '<div class="row">' +
      field('ชนิดน้ำมัน', '<input name="grade" list="fuelGrades" maxlength="30" value="' + attr(log.grade) + '">') +
      field('ปั๊ม', '<input name="station" maxlength="40" placeholder="เช่น PTT สาขา..." value="' + attr(log.station) + '">') +
      '</div>' + fuelDatalist() +
      field('หมายเหตุ', '<textarea name="note" maxlength="300" placeholder="เช่น ขับทางไกล, เปิดแอร์ตลอด">' + esc(log.note || '') + '</textarea>') +
      '<p class="form-error" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-primary btn-block" type="submit">บันทึก</button>' +
      (isNew ? '' : '<button class="btn btn-danger btn-block" type="button" data-action="delete-fuel" data-id="' + esc(log.id) + '">ลบรายการนี้</button>') +
      '</div></form>');

    const form = $('#fuelForm');
    setupMoneyAutoCalc(form, isNew && log.price ? ['price'] : []);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const date = strVal(form, 'date');
      const odometer = numVal(form, 'odometer');
      const liters = numVal(form, 'liters');
      const price = numVal(form, 'price');
      const total = numVal(form, 'total');
      if (!date) return formError(form, 'กรุณาเลือกวันที่');
      if (odometer === null || odometer <= 0) return formError(form, 'กรุณาใส่เลขไมล์ (ตัวเลข km)');
      if (liters === null || liters <= 0) return formError(form, 'กรุณาใส่จำนวนลิตร');
      if ((price !== null && price < 0) || (total !== null && total < 0)) return formError(form, 'ราคา/ยอดเงินต้องไม่ติดลบ');

      const others = d.fuel.filter(function (x) { return x.id !== log.id; });
      if (others.some(function (x) { return +x.odometer === odometer; })) {
        return formError(form, 'มีบันทึกที่เลขไมล์ ' + fmtNum(odometer) + ' km อยู่แล้ว');
      }
      const conflict = others.some(function (x) {
        return (x.date < date && +x.odometer > odometer) || (x.date > date && +x.odometer < odometer);
      });
      if (conflict && !confirm('เลขไมล์ไม่สอดคล้องกับวันที่ของบันทึกอื่น (เช่น วันที่ใหม่กว่าแต่เลขไมล์น้อยกว่า)\nตรวจสอบตัวเลขอีกครั้ง — บันทึกต่อไหม?')) return;
      if (v.tankL && liters > v.tankL * 1.1 &&
        !confirm('จำนวนลิตร (' + liters + ' L) มากกว่าความจุถัง (' + v.tankL + ' L) — บันทึกต่อไหม?')) return;

      const rec = Object.assign({}, log, {
        id: log.id || S.uid(), vehicleId: log.vehicleId || v.id, date: date, odometer: odometer,
        liters: liters, price: price, total: total,
        full: form.elements.full.checked, missed: form.elements.missed.checked,
        grade: strVal(form, 'grade'), station: strVal(form, 'station'), note: strVal(form, 'note')
      });
      if (isNew) state.fuelLogs.push(rec);
      else state.fuelLogs = state.fuelLogs.map(function (x) { return x.id === rec.id ? rec : x; });
      persist(); closeSheet(); render();

      const seg = C.computeFuelEconomy(fuelFor(v.id)).byLogId[rec.id];
      toast(seg ? 'บันทึกแล้ว · ช่วงนี้ได้ ' + fmtNum(seg.kmPerL, 1) + ' km/L' : 'บันทึกแล้ว');
    });
  }

  /**
   * คำนวณ ลิตร / ราคาต่อลิตร / ยอดเงิน อัตโนมัติ
   * จำว่าผู้ใช้พิมพ์ช่องไหนล่าสุด 2 ช่อง แล้วคำนวณช่องที่เหลือ
   */
  function setupMoneyAutoCalc(form, initialEdited) {
    const names = ['liters', 'price', 'total'];
    let edited = initialEdited.slice();
    names.forEach(function (n) {
      form.elements[n].addEventListener('input', function () {
        form.elements[n].classList.remove('auto');
        edited = edited.filter(function (x) { return x !== n; });
        if (form.elements[n].value.trim() !== '') edited.push(n);
        edited = edited.slice(-2);
        if (edited.length < 2) return;
        const target = names.find(function (x) { return edited.indexOf(x) < 0; });
        const val = C.completeFuelAmounts({
          liters: form.elements.liters.value, price: form.elements.price.value, total: form.elements.total.value
        }, target);
        if (val !== null) {
          form.elements[target].value = val.toFixed(2);
          form.elements[target].classList.add('auto');
        }
      });
    });
  }

  function deleteFuel(id) {
    if (!confirm('ลบรายการเติมน้ำมันนี้?')) return;
    state.fuelLogs = state.fuelLogs.filter(function (x) { return x.id !== id; });
    persist(); closeSheet(); render(); toast('ลบแล้ว');
  }

  /* ---------- ฟอร์มซ่อมบำรุง ---------- */
  function openServiceForm(s) {
    const v = activeVehicle();
    if (!v) return;
    const isNew = !s;
    const d = vehicleData(v);
    s = s || { date: todayStr(), type: 'oil' };

    openSheet(isNew ? 'บันทึกซ่อมบำรุง' : 'แก้ไขซ่อมบำรุง',
      '<form class="form" id="serviceForm" novalidate>' +
      field('ประเภท', '<select name="type">' + SERVICE_TYPES.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === s.type ? ' selected' : '') + '>' + esc(t.label) + '</option>';
      }).join('') + '</select>') +
      field('รายละเอียด', '<input name="title" maxlength="60" placeholder="เช่น 0W-20 สังเคราะห์แท้ 4 ลิตร" value="' + attr(s.title) + '">') +
      '<div class="row">' +
      field('วันที่', '<input type="date" name="date" required value="' + attr(s.date) + '">') +
      field('เลขไมล์ (km)', '<input name="odometer" inputmode="numeric" placeholder="' + (d.odo !== null ? 'ล่าสุด ' + fmtNum(d.odo) : '') + '" value="' + attr(s.odometer) + '">') +
      '</div><div class="row">' +
      field('ค่าใช้จ่าย ฿', '<input name="cost" inputmode="decimal" placeholder="0" value="' + attr(s.cost) + '">') +
      field('ร้าน / ศูนย์', '<input name="shop" maxlength="40" value="' + attr(s.shop) + '">') +
      '</div>' +
      '<h3 class="section-title" style="margin:8px 2px 0">ครั้งถัดไป (ใส่อย่างใดอย่างหนึ่งหรือทั้งคู่)</h3>' +
      field('ที่เลขไมล์ (km)', '<input name="nextKm" inputmode="numeric" placeholder="เช่น 60000" value="' + attr(s.nextKm) + '">' +
        '<div class="chips"><button type="button" class="chip" data-km="5000">+5,000</button><button type="button" class="chip" data-km="10000">+10,000</button>' +
        '<button type="button" class="chip" data-km="20000">+20,000</button><button type="button" class="chip" data-km="40000">+40,000</button>' +
        '<button type="button" class="chip" data-km="clear">ล้าง</button></div>',
        'บวกจากเลขไมล์ของรายการนี้ · ระยะที่เหมาะสมดูจากคู่มือรถของคุณ') +
      field('หรือวันที่', '<input type="date" name="nextDate" value="' + attr(s.nextDate) + '">' +
        '<div class="chips"><button type="button" class="chip" data-mo="3">+3 เดือน</button><button type="button" class="chip" data-mo="6">+6 เดือน</button>' +
        '<button type="button" class="chip" data-mo="12">+1 ปี</button><button type="button" class="chip" data-mo="24">+2 ปี</button>' +
        '<button type="button" class="chip" data-mo="clear">ล้าง</button></div>') +
      field('หมายเหตุ', '<textarea name="note" maxlength="300">' + esc(s.note || '') + '</textarea>') +
      '<p class="form-error" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-primary btn-block" type="submit">บันทึก</button>' +
      (isNew ? '' : '<button class="btn btn-danger btn-block" type="button" data-action="delete-service" data-id="' + esc(s.id) + '">ลบรายการนี้</button>') +
      '</div></form>');

    const form = $('#serviceForm');
    form.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (chip.dataset.km) {
        if (chip.dataset.km === 'clear') { form.elements.nextKm.value = ''; return; }
        const base = numVal(form, 'odometer') !== null ? numVal(form, 'odometer') : d.odo;
        if (base === null) return formError(form, 'ใส่เลขไมล์ของรายการนี้ก่อน');
        formError(form, '');
        form.elements.nextKm.value = base + Number(chip.dataset.km);
      }
      if (chip.dataset.mo) {
        if (chip.dataset.mo === 'clear') { form.elements.nextDate.value = ''; return; }
        form.elements.nextDate.value = C.addMonths(strVal(form, 'date') || todayStr(), Number(chip.dataset.mo));
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const type = strVal(form, 'type');
      const title = strVal(form, 'title');
      const date = strVal(form, 'date');
      const odometer = numVal(form, 'odometer');
      const cost = numVal(form, 'cost');
      const nextKm = numVal(form, 'nextKm');
      const nextDate = strVal(form, 'nextDate');
      if (!date) return formError(form, 'กรุณาเลือกวันที่');
      if (type === 'other' && !title) return formError(form, 'ประเภท “อื่นๆ” กรุณาใส่รายละเอียด');
      if (strVal(form, 'odometer') && (odometer === null || odometer < 0)) return formError(form, 'เลขไมล์ต้องเป็นตัวเลข');
      if (strVal(form, 'cost') && (cost === null || cost < 0)) return formError(form, 'ค่าใช้จ่ายต้องเป็นตัวเลข');
      if (strVal(form, 'nextKm') && nextKm === null) return formError(form, 'เลขไมล์ครั้งถัดไปต้องเป็นตัวเลข');
      if (nextKm !== null && odometer !== null && nextKm <= odometer) return formError(form, 'เลขไมล์ครั้งถัดไปต้องมากกว่าเลขไมล์ปัจจุบัน');
      if (nextDate && nextDate <= date) return formError(form, 'วันที่ครั้งถัดไปต้องหลังวันที่ทำรายการ');

      const rec = Object.assign({}, s, {
        id: s.id || S.uid(), vehicleId: s.vehicleId || v.id, type: type, title: title, date: date,
        odometer: odometer, cost: cost, shop: strVal(form, 'shop'), note: strVal(form, 'note'),
        nextKm: nextKm, nextDate: nextDate || null
      });
      if (isNew) state.services.push(rec);
      else state.services = state.services.map(function (x) { return x.id === rec.id ? rec : x; });
      persist(); closeSheet(); render(); toast('บันทึกแล้ว');
    });
  }

  function deleteService(id) {
    if (!confirm('ลบรายการซ่อมบำรุงนี้?')) return;
    state.services = state.services.filter(function (x) { return x.id !== id; });
    persist(); closeSheet(); render(); toast('ลบแล้ว');
  }

  /* ======================= สำรอง / นำเข้า ======================= */
  function downloadFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    // มือถือ: ใช้เมนูแชร์ (เลือก "บันทึกไปยังไฟล์" ได้) ถ้ารองรับ
    if (coarse && navigator.canShare && typeof File === 'function') {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: filename }).then(function () { return true; })
          .catch(function (err) { return err && err.name === 'AbortError' ? false : fallback(); });
      }
    }
    return Promise.resolve(fallback());

    function fallback() {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    }
  }

  function exportJSON() {
    downloadFile('car-info-backup-' + todayStr() + '.json', S.exportJSON(state), 'application/json').then(function (ok) {
      if (!ok) return;
      try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
      if (tab === 'settings') render();
      toast('ส่งออกไฟล์สำรองแล้ว');
    });
  }

  function exportCSV(kind) {
    const v = activeVehicle();
    if (!v) return;
    let csv, name;
    if (kind === 'fuel') {
      const econ = C.computeFuelEconomy(fuelFor(v.id));
      csv = C.toCSV(C.sortByOdometer(fuelFor(v.id)), [
        { label: 'วันที่', key: 'date' }, { label: 'เลขไมล์ (km)', key: 'odometer' },
        { label: 'ลิตร', key: 'liters' }, { label: 'บาท/ลิตร', key: 'price' }, { label: 'ยอดเงิน (บาท)', key: 'total' },
        { label: 'เต็มถัง', value: function (r) { return r.full ? 'ใช่' : 'ไม่'; } },
        { label: 'ลืมจดครั้งก่อน', value: function (r) { return r.missed ? 'ใช่' : ''; } },
        { label: 'km/L (ช่วงที่จบครั้งนี้)', value: function (r) { const s = econ.byLogId[r.id]; return s ? C.round(s.kmPerL, 2) : ''; } },
        { label: 'ชนิดน้ำมัน', key: 'grade' }, { label: 'ปั๊ม', key: 'station' }, { label: 'หมายเหตุ', key: 'note' }
      ]);
      name = 'car-info-fuel-';
    } else {
      const rows = servicesFor(v.id).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      csv = C.toCSV(rows, [
        { label: 'วันที่', key: 'date' }, { label: 'เลขไมล์ (km)', key: 'odometer' },
        { label: 'ประเภท', value: function (r) { return (TYPE_BY_ID[r.type] || TYPE_BY_ID.other).label; } },
        { label: 'รายละเอียด', key: 'title' }, { label: 'ค่าใช้จ่าย (บาท)', key: 'cost' }, { label: 'ร้าน', key: 'shop' },
        { label: 'ครั้งถัดไป (km)', key: 'nextKm' }, { label: 'ครั้งถัดไป (วันที่)', key: 'nextDate' }, { label: 'หมายเหตุ', key: 'note' }
      ]);
      name = 'car-info-service-';
    }
    const safe = String(v.name).replace(/[^\w฀-๿-]+/g, '_').slice(0, 30);
    // ﻿ = BOM ให้ Excel อ่านภาษาไทยถูก
    downloadFile(name + safe + '-' + todayStr() + '.csv', '﻿' + csv, 'text/csv').then(function (ok) {
      if (ok) toast('ส่งออก CSV แล้ว');
    });
  }

  function summaryText(s) {
    return s.vehicles.length + ' คัน, เติมน้ำมัน ' + s.fuelLogs.length + ' ครั้ง, ซ่อมบำรุง ' + s.services.length + ' รายการ';
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = function () {
      let next;
      try { next = S.parseImport(String(reader.result)); }
      catch (err) { toast('นำเข้าไม่สำเร็จ: ' + err.message); return; }
      if (!confirm('แทนที่ข้อมูลปัจจุบัน\n(' + summaryText(state) + ')\n\nด้วยข้อมูลในไฟล์\n(' + summaryText(next) + ')?\n\nแอปจะเก็บข้อมูลเดิมไว้ 1 ชุดเผื่อย้อนกลับ')) return;
      S.keepBackupBeforeImport(state);
      state = next;
      persist(); render(); toast('นำเข้าข้อมูลแล้ว');
    };
    reader.onerror = function () { toast('อ่านไฟล์ไม่สำเร็จ'); };
    reader.readAsText(file);
  }

  function undoImport() {
    const b = S.readBackupBeforeImport();
    if (!b) return;
    if (!confirm('ย้อนกลับเป็นข้อมูลก่อนนำเข้า (' + summaryText(b.state) + ')?\nข้อมูลปัจจุบันจะถูกแทนที่')) return;
    state = b.state;
    persist(); render(); toast('ย้อนกลับแล้ว');
  }

  function clearAll() {
    if (!confirm('ลบข้อมูลทั้งหมดในเครื่องนี้? (' + summaryText(state) + ')\nย้อนกลับไม่ได้ ถ้ายังไม่ได้ส่งออกไฟล์สำรอง')) return;
    if (!confirm('ยืนยันอีกครั้ง: ลบทั้งหมด')) return;
    S.keepBackupBeforeImport(state); // กันพลาด: ยังย้อนกลับได้จากปุ่ม "ย้อนกลับ"
    state = S.emptyState();
    persist(); location.hash = '#dashboard'; render(); toast('ลบข้อมูลแล้ว');
  }

  /* ======================= Toast ======================= */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }

  /* ======================= เหตุการณ์ ======================= */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'add-vehicle': return openVehicleForm();
      case 'edit-vehicle': return openVehicleForm(state.vehicles.find(function (x) { return x.id === id; }));
      case 'delete-vehicle': return deleteVehicle(id);
      case 'add-fuel': return openFuelForm();
      case 'edit-fuel': return openFuelForm(state.fuelLogs.find(function (x) { return x.id === id; }));
      case 'delete-fuel': return deleteFuel(id);
      case 'add-service': return openServiceForm();
      case 'edit-service': return openServiceForm(state.services.find(function (x) { return x.id === id; }));
      case 'delete-service': return deleteService(id);
      case 'export-json': return exportJSON();
      case 'import-json': return $('#importFile').click();
      case 'export-csv-fuel': return exportCSV('fuel');
      case 'export-csv-service': return exportCSV('service');
      case 'undo-import': return undoImport();
      case 'clear-all': return clearAll();
      case 'import-notes': return openNotesImport();
      case 'pick-year': selectedYear = btn.dataset.year; return render();
      case 'snooze-backup':
        try { localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now() + 7 * 86400000)); } catch (err) { /* ignore */ }
        return render();
    }
  });

  $('#importFile').addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });

  $('#vehicleSelect').addEventListener('change', function (e) {
    state.activeVehicleId = e.target.value;
    persist(); render();
  });

  $('#fab').addEventListener('click', function () {
    if (tab === 'service') openServiceForm(); else openFuelForm();
  });

  function readHash() {
    const h = location.hash.replace('#', '');
    tab = TABS.indexOf(h) >= 0 ? h : 'dashboard';
  }
  window.addEventListener('hashchange', function () { readHash(); render(); window.scrollTo(0, 0); });

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const v = activeVehicle();
      if (v && tab === 'dashboard') drawCharts(vehicleData(v));
    }, 150);
  });

  // ข้อมูลเปลี่ยนจากแท็บอื่นของเบราว์เซอร์ -> โหลดใหม่
  window.addEventListener('storage', function (e) {
    if (e.key === 'carinfo.v1') { state = S.load(); render(); }
  });

  /* ======================= เริ่มแอป ======================= */
  readHash();
  render();
  S.requestPersistence();

  // Service worker = ทำให้เปิดแอปได้แม้ไม่มีเน็ต (ทำงานเฉพาะตอนเปิดผ่าน http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    });
  }
})();
