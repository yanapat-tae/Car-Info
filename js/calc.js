/*
 * calc.js — สูตรคำนวณทั้งหมดของแอป (ไม่ยุ่งกับหน้าจอเลย จึงทดสอบได้ง่าย)
 *
 * หลักคำนวณอัตราสิ้นเปลือง: วิธี "เต็มถังถึงเต็มถัง" (full-to-full)
 *   1) เติมเต็มถังครั้งที่ 1 ที่เลขไมล์ 10,000 km  -> ใช้เป็นจุดเริ่มต้น
 *   2) ขับไป แล้วเติมเต็มถังอีกครั้งที่ 10,500 km ได้ 35 ลิตร
 *   3) น้ำมัน 35 ลิตรที่เติมเข้าไปคือ "น้ำมันที่ใช้ไป" ในระยะ 500 km
 *      => 500 / 35 = 14.29 km/L
 *   ถ้ามีการเติมไม่เต็มถังระหว่างทาง ลิตรของครั้งนั้นจะถูกรวมไว้ในช่วงเดียวกัน
 *   ถ้าลืมจดการเติมครั้งไหน (ติ๊ก "ลืมจดครั้งก่อน") ช่วงนั้นจะไม่ถูกนำมาคำนวณ
 *   เพราะไม่รู้ว่าเติมไปจริงกี่ลิตร
 *
 * ไฟล์นี้ใช้ได้ทั้งในเบราว์เซอร์ (window.CarCalc) และใน Node สำหรับเทสต์ (require)
 */
(function (root) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;

  /** แปลงค่าเป็นตัวเลข ถ้าว่างหรือไม่ใช่ตัวเลขจะได้ null (ไม่เดาค่าแทน) */
  function toNum(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  function round(v, digits) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    const f = Math.pow(10, digits === undefined ? 2 : digits);
    return Math.round(v * f) / f;
  }

  /** 'YYYY-MM-DD' -> จำนวนวันนับจาก 1970 (ใช้ UTC เพื่อไม่ให้เพี้ยนเรื่องเวลา) */
  function dayNumber(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return null;
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
  }

  function daysBetween(fromStr, toStr) {
    const a = dayNumber(fromStr);
    const b = dayNumber(toStr);
    if (a === null || b === null) return null;
    return b - a;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /** บวกเดือนให้วันที่ เช่น 2026-01-31 + 1 เดือน = 2026-02-28 (ปัดเป็นวันสุดท้ายของเดือน) */
  function addMonths(dateStr, months) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return null;
    let y = +m[1];
    let mo = +m[2] - 1 + months;
    y += Math.floor(mo / 12);
    mo = ((mo % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const d = Math.min(+m[3], lastDay);
    return y + '-' + pad(mo + 1) + '-' + pad(d);
  }

  function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7); // 'YYYY-MM'
  }

  function sortByOdometer(logs) {
    return logs.slice().sort(function (a, b) {
      return (toNum(a.odometer) - toNum(b.odometer)) ||
        String(a.date).localeCompare(String(b.date));
    });
  }

  /**
   * คำนวณอัตราสิ้นเปลืองจากประวัติการเติมน้ำมันของรถ 1 คัน
   * คืนค่า { segments, byLogId, summary }
   *  - segments: ช่วง "เต็มถังถึงเต็มถัง" ที่คำนวณได้
   *  - byLogId: หา segment จาก id ของการเติมครั้งที่ปิดช่วงนั้น
   */
  function computeFuelEconomy(logs) {
    const sorted = sortByOdometer(logs || []);
    const segments = [];
    const byLogId = {};

    let startOdo = null;   // เลขไมล์ตอนเติมเต็มถังครั้งก่อน
    let accLiters = 0;     // ลิตรที่เติมสะสมตั้งแต่เต็มถังครั้งก่อน
    let accCost = 0;
    let costKnown = true;  // ทุกครั้งในช่วงนี้มีราคาครบไหม
    let broken = false;    // มีการลืมจดในช่วงนี้ไหม

    sorted.forEach(function (log) {
      const odo = toNum(log.odometer);
      const liters = toNum(log.liters) || 0;
      const total = toNum(log.total);
      if (odo === null) return;

      if (log.missed) broken = true;
      accLiters += liters;
      if (total === null || total <= 0) costKnown = false; else accCost += total;

      if (log.full) {
        if (startOdo !== null && !broken && odo > startOdo && accLiters > 0) {
          const distance = odo - startOdo;
          const seg = {
            endLogId: log.id,
            date: log.date,
            startOdo: startOdo,
            endOdo: odo,
            distance: distance,
            liters: accLiters,
            cost: costKnown ? accCost : null,
            kmPerL: distance / accLiters,
            lPer100km: (accLiters / distance) * 100,
            costPerKm: costKnown ? accCost / distance : null
          };
          segments.push(seg);
          byLogId[log.id] = seg;
        }
        // เริ่มช่วงใหม่จากการเติมเต็มถังครั้งนี้
        startOdo = odo;
        accLiters = 0;
        accCost = 0;
        costKnown = true;
        broken = false;
      }
    });

    return { segments: segments, byLogId: byLogId, summary: summarizeSegments(segments, logs || []) };
  }

  function summarizeSegments(segments, logs) {
    let dist = 0, liters = 0, costDist = 0, cost = 0;
    let best = null, worst = null;
    segments.forEach(function (s) {
      dist += s.distance;
      liters += s.liters;
      if (s.cost !== null) { cost += s.cost; costDist += s.distance; }
      if (!best || s.kmPerL > best.kmPerL) best = s;
      if (!worst || s.kmPerL < worst.kmPerL) worst = s;
    });

    let totalSpent = 0, totalLiters = 0, pricedLiters = 0, pricedSpent = 0;
    logs.forEach(function (l) {
      const li = toNum(l.liters) || 0;
      const t = toNum(l.total);
      totalLiters += li;
      if (t !== null && t > 0) {
        totalSpent += t;
        if (li > 0) { pricedLiters += li; pricedSpent += t; }
      }
    });

    // segments เรียงตามเลขไมล์ ช่วงสุดท้ายจึงเป็นช่วงล่าสุด
    const last = segments.length ? segments[segments.length - 1] : null;

    return {
      segmentCount: segments.length,
      trackedDistance: dist,
      trackedLiters: liters,
      avgKmPerL: liters > 0 ? dist / liters : null,
      avgLPer100km: dist > 0 ? (liters / dist) * 100 : null,
      avgCostPerKm: costDist > 0 ? cost / costDist : null,
      last: last,
      best: best,
      worst: worst,
      fillCount: logs.length,
      totalSpent: totalSpent,
      totalLiters: totalLiters,
      avgPricePerL: pricedLiters > 0 ? pricedSpent / pricedLiters : null
    };
  }

  /**
   * กรอก 2 ใน 3 ช่อง (ลิตร, ราคาต่อลิตร, ยอดเงิน) แล้วคำนวณช่องที่เหลือ
   * target = ชื่อช่องที่ต้องการให้คำนวณ
   */
  function completeFuelAmounts(values, target) {
    const liters = toNum(values.liters);
    const price = toNum(values.price);
    const total = toNum(values.total);
    if (target === 'total' && liters > 0 && price > 0) return round(liters * price, 2);
    if (target === 'liters' && total > 0 && price > 0) return round(total / price, 2);
    if (target === 'price' && total > 0 && liters > 0) return round(total / liters, 2);
    return null;
  }

  /** เลขไมล์ล่าสุดที่รู้ (ค่ามากสุดจากทุกบันทึก) */
  function currentOdometer(fuelLogs, services) {
    let max = null;
    (fuelLogs || []).concat(services || []).forEach(function (r) {
      const o = toNum(r.odometer);
      if (o !== null && (max === null || o > max)) max = o;
    });
    return max;
  }

  function reminderKey(s) {
    if (s.type === 'other') return 'other:' + String(s.title || '').trim().toLowerCase();
    return s.type;
  }

  /**
   * สร้างรายการแจ้งเตือนจากประวัติซ่อมบำรุง
   * ใช้ "บันทึกล่าสุด" ของแต่ละประเภทเท่านั้น (ทำรายการใหม่แล้ว อันเก่าถือว่าเสร็จแล้ว)
   * status: 'overdue' (เลยกำหนด), 'soon' (ใกล้ถึง), 'ok'
   */
  function computeReminders(services, currentOdo, todayStr, opts) {
    const soonKm = (opts && opts.soonKm) || 1000;
    const soonDays = (opts && opts.soonDays) || 30;
    const latest = {};
    (services || []).forEach(function (s) {
      const key = reminderKey(s);
      const prev = latest[key];
      if (!prev) { latest[key] = s; return; }
      const byDate = String(s.date).localeCompare(String(prev.date));
      const byOdo = (toNum(s.odometer) || 0) - (toNum(prev.odometer) || 0);
      if (byDate > 0 || (byDate === 0 && byOdo > 0)) latest[key] = s;
    });

    const rank = { overdue: 0, soon: 1, ok: 2 };
    const out = [];
    Object.keys(latest).forEach(function (key) {
      const s = latest[key];
      const nextKm = toNum(s.nextKm);
      const nextDate = s.nextDate || null;
      if (nextKm === null && !nextDate) return;

      const kmLeft = nextKm !== null && currentOdo !== null && currentOdo !== undefined ? nextKm - currentOdo : null;
      const daysLeft = nextDate ? daysBetween(todayStr, nextDate) : null;

      let status = 'ok';
      if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0)) status = 'overdue';
      else if ((kmLeft !== null && kmLeft <= soonKm) || (daysLeft !== null && daysLeft <= soonDays)) status = 'soon';

      out.push({ key: key, service: s, nextKm: nextKm, nextDate: nextDate, kmLeft: kmLeft, daysLeft: daysLeft, status: status });
    });

    out.sort(function (a, b) {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      // เทียบความเร่งด่วน: แปลงเป็น "สัดส่วนที่เหลือ" คร่าวๆ
      const ua = Math.min(a.kmLeft !== null ? a.kmLeft / soonKm : Infinity, a.daysLeft !== null ? a.daysLeft / soonDays : Infinity);
      const ub = Math.min(b.kmLeft !== null ? b.kmLeft / soonKm : Infinity, b.daysLeft !== null ? b.daysLeft / soonDays : Infinity);
      return ua - ub;
    });
    return out;
  }

  /** ค่าใช้จ่ายรายเดือนย้อนหลัง N เดือน (รวมเดือนปัจจุบัน) */
  function monthlyCosts(fuelLogs, services, months, todayStr) {
    const n = months || 6;
    const keys = [];
    for (let i = n - 1; i >= 0; i--) keys.push(monthKey(addMonths(todayStr.slice(0, 7) + '-01', -i)));
    const map = {};
    keys.forEach(function (k) { map[k] = { month: k, fuel: 0, service: 0 }; });
    (fuelLogs || []).forEach(function (l) {
      const k = monthKey(l.date); const t = toNum(l.total);
      if (map[k] && t > 0) map[k].fuel += t;
    });
    (services || []).forEach(function (s) {
      const k = monthKey(s.date); const t = toNum(s.cost);
      if (map[k] && t > 0) map[k].service += t;
    });
    return keys.map(function (k) { return map[k]; });
  }

  /** แปลงเป็น CSV (เปิดใน Excel/Google Sheets ได้) */
  function toCSV(rows, columns) {
    function cell(v) {
      if (v === null || v === undefined) return '';
      let s = String(v);
      // กัน "สูตร" ใน Excel ที่อาจถูกใส่มาในข้อความ (CSV injection)
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    const head = columns.map(function (c) { return cell(c.label); }).join(',');
    const body = rows.map(function (r) {
      return columns.map(function (c) { return cell(typeof c.value === 'function' ? c.value(r) : r[c.key]); }).join(',');
    });
    return [head].concat(body).join('\r\n');
  }

  const api = {
    toNum: toNum,
    round: round,
    daysBetween: daysBetween,
    addMonths: addMonths,
    monthKey: monthKey,
    sortByOdometer: sortByOdometer,
    computeFuelEconomy: computeFuelEconomy,
    completeFuelAmounts: completeFuelAmounts,
    currentOdometer: currentOdometer,
    computeReminders: computeReminders,
    monthlyCosts: monthlyCosts,
    toCSV: toCSV
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CarCalc = api;
})(typeof window !== 'undefined' ? window : this);
