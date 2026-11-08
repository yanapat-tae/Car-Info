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

  /** รายการนี้นับเป็นงานประเภท t ไหม (ประเภทหลัก หรือ "งานอื่นที่ทำด้วย") */
  function coversType(s, t) {
    return s.type === t || (Array.isArray(s.alsoTypes) && s.alsoTypes.indexOf(t) >= 0);
  }

  function latestOf(list) {
    let best = null;
    list.forEach(function (s) {
      if (!best) { best = s; return; }
      const byDate = String(s.date).localeCompare(String(best.date));
      const byOdo = (toNum(s.odometer) || 0) - (toNum(best.odometer) || 0);
      if (byDate > 0 || (byDate === 0 && byOdo > 0)) best = s;
    });
    return best;
  }

  /**
   * สร้างรายการแจ้งเตือนครั้งถัดไป
   * ที่มาของกำหนด 2 แบบ:
   *  1) 'manual'   — ใส่ "ครั้งถัดไป" ไว้เองในรายการล่าสุด (มีสิทธิ์ก่อน)
   *  2) 'interval' — คำนวณจากรอบที่ตั้งไว้: เลขไมล์ครั้งล่าสุด + รอบ km / วันที่ล่าสุด + รอบเดือน
   * opts.intervals = { oil: { km: 8000, months: 6 }, ... }
   * status: 'overdue' เลยกำหนด, 'soon' ใกล้ถึง, 'ok' ปกติ, 'nohistory' ตั้งรอบไว้แต่ยังไม่เคยบันทึก
   */
  function computeReminders(services, currentOdo, todayStr, opts) {
    const soonKm = (opts && opts.soonKm) || 1000;
    const soonDays = (opts && opts.soonDays) || 30;
    const intervals = (opts && opts.intervals) || {};
    const list = services || [];
    const cur = currentOdo === undefined ? null : currentOdo;

    // ประเภทที่ต้องพิจารณา
    const keys = [];
    function addKey(k) { if (keys.indexOf(k) < 0) keys.push(k); }
    list.forEach(function (s) {
      addKey(reminderKey(s));
      (s.alsoTypes || []).forEach(function (t) { if (t !== 'other') addKey(t); });
    });
    Object.keys(intervals).forEach(function (k) {
      const iv = intervals[k];
      if (iv && (toNum(iv.km) > 0 || toNum(iv.months) > 0)) addKey(k);
    });

    const rank = { overdue: 0, soon: 1, ok: 2, nohistory: 3 };
    const out = [];
    keys.forEach(function (key) {
      const isOther = key.indexOf('other:') === 0;
      const candidates = list.filter(function (s) { return isOther ? reminderKey(s) === key : coversType(s, key); });
      const latest = latestOf(candidates);
      const iv = isOther ? null : intervals[key];
      const ivKm = iv ? toNum(iv.km) : null;
      const ivMonths = iv ? toNum(iv.months) : null;
      const hasIv = (ivKm > 0) || (ivMonths > 0);

      if (!latest) {
        if (hasIv) out.push({ key: key, service: null, status: 'nohistory', basis: 'interval', interval: iv,
          nextKm: null, nextDate: null, kmLeft: null, daysLeft: null, lastOdo: null });
        return;
      }

      let nextKm = null, nextDate = null, basis = null;
      const manual = reminderKey(latest) === key && (toNum(latest.nextKm) !== null || latest.nextDate);
      if (manual) {
        nextKm = toNum(latest.nextKm);
        nextDate = latest.nextDate || null;
        basis = 'manual';
      } else if (hasIv) {
        const lastOdo = toNum(latest.odometer);
        if (ivKm > 0 && lastOdo !== null) nextKm = lastOdo + ivKm;
        if (ivMonths > 0) nextDate = addMonths(latest.date, ivMonths);
        basis = 'interval';
      }
      if (nextKm === null && !nextDate) {
        if (basis === 'interval') out.push({ key: key, service: latest, status: 'nohistory', basis: basis, interval: iv,
          nextKm: null, nextDate: null, kmLeft: null, daysLeft: null, lastOdo: null, noOdometer: true });
        return;
      }

      const kmLeft = nextKm !== null && cur !== null ? nextKm - cur : null;
      const daysLeft = nextDate ? daysBetween(todayStr, nextDate) : null;
      let status = 'ok';
      if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0)) status = 'overdue';
      else if ((kmLeft !== null && kmLeft <= soonKm) || (daysLeft !== null && daysLeft <= soonDays)) status = 'soon';

      out.push({ key: key, service: latest, nextKm: nextKm, nextDate: nextDate, kmLeft: kmLeft, daysLeft: daysLeft,
        status: status, basis: basis, interval: iv || null, lastOdo: toNum(latest.odometer) });
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

  /* ------------------------------------------------------------
   * นำเข้าประวัติซ่อมบำรุงจากข้อความ (เช่น ก๊อปจากแอปโน้ต)
   * รูปแบบต่อบรรทัด:  วันที่   เลขไมล์(ไม่บังคับ)   รายละเอียด
   *   23/3/2024   132100   เปลี่ยนน้ำมันเครื่อง ที่ ร้าน A
   * ------------------------------------------------------------ */

  // คำค้นสำหรับเดาประเภทงาน — ประเภทที่คำค้นโผล่ "เร็วที่สุด" ในข้อความจะถูกเลือก
  const TYPE_KEYWORDS = [
    ['oil_filter', /กรองน้ำมันเครื่อง|oil filter/i],
    ['oil', /น้ำมันเครื่อง|engine oil/i],
    ['transmission', /น้ำมันเกียร์|กรองเกียร์|\bATF\b|เกียร์/i],
    ['coolant', /น้ำหล่อเย็น|น้ำยาหล่อเย็น|หม้อน้ำ|coolant/i],
    ['brake_fluid', /น้ำมันเบร[คก]|brake fluid/i],
    ['brakes', /ผ้าเบร[คก]|จานเบร[คก]|สายถักเบร[คก]|เบร[คก]/i],
    ['cabin_filter', /กรองแอร์|cabin filter/i],
    ['air_filter', /กรองอากาศ|air filter/i],
    ['wipers', /ใบปัด/i],
    ['battery', /แบตเตอร[ีี่]|แบต\b|battery/i],
    ['alignment', /ตั้งศูนย์|ถ่วงล้อ|สลับยาง/i],
    ['tires', /เปลี่ยนยาง|ยางใหม่|\btires?\b|\btyres?\b/i],
    ['spark_plugs', /หัวเทียน|spark plug/i],
    ['ac', /แอร์|air ?con/i],
    ['suspension', /โช[็๊]?[คค]|ช่วงล่าง|ลูกหมา[กย]|แร็[คค]|พวงมาลัย|คันชัก|ปีกนก|บูช/i],
    ['body', /ทำสี|พ่นสี|ตัวถัง|เคาะ|ซ่อมสี/i],
    ['tax', /ภาษี|พ\.?ร\.?บ|ต่อทะเบียน/i],
    ['insurance', /ประกัน/i],
    ['inspection', /เช[็ค]?[คก]ระยะ/i]
  ];

  /**
   * หาทุกประเภทงานในข้อความ เรียงตามลำดับที่ปรากฏ
   * ถ้าคำซ้อนกัน (เช่น "กรองแอร์" มีคำว่า "แอร์") ใช้คำที่ยาวกว่า
   */
  function classifyAll(text) {
    const hits = [];
    TYPE_KEYWORDS.forEach(function (pair) {
      const re = new RegExp(pair[1].source, pair[1].flags.replace('g', '') + 'g');
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ type: pair[0], start: m.index, end: m.index + m[0].length });
        if (!m[0].length) re.lastIndex++;
      }
    });
    hits.sort(function (a, b) { return (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)); });
    const taken = [];
    const types = [];
    hits.forEach(function (h) {
      if (taken.some(function (t) { return h.start < t.end && t.start < h.end; })) return;
      taken.push(h);
      if (types.indexOf(h.type) < 0) types.push(h.type);
    });
    return types;
  }

  function classifyService(text) {
    return classifyAll(text)[0] || 'other';
  }

  function parseNoteDate(d, m, y) {
    let year = +y;
    if (String(y).length <= 2) year += 2000;
    if (year > 2400) year -= 543; // ปี พ.ศ. -> ค.ศ.
    const day = +d, mon = +m;
    if (mon < 1 || mon > 12 || day < 1) return null;
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    if (day > last) return null;
    return year + '-' + pad(mon) + '-' + pad(day);
  }

  /**
   * แปลงข้อความเป็นรายการซ่อมบำรุง (ยังไม่บันทึก)
   * existing = รายการเดิมของรถคันนี้ ใช้ตรวจว่าเคยนำเข้าแล้วหรือยัง
   * คืน [{ line, date, odometer, odoNote, title, shop, type, duplicate }] และ skipped = บรรทัดที่อ่านไม่ได้
   */
  function parseServiceNotes(text, existing) {
    const seen = {};
    (existing || []).forEach(function (s) { seen[s.date + '|' + String(s.title || '').trim()] = true; });
    const rows = [];
    const skipped = [];
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      const line = raw.trim();
      if (!line) return;
      const dm = /^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{2,4})(?=\s|$)\s*(.*)$/.exec(line);
      if (!dm) { skipped.push(line); return; }
      const date = parseNoteDate(dm[1], dm[2], dm[3]);
      if (!date) { skipped.push(line); return; }

      let rest = dm[4].trim();
      let odometer = null;
      let odoNote = '';
      const km = /^(\d[\d,]*[xX]*)(?:\s*(?:km|กม\.?))?(?:\s+|$)(.*)$/.exec(rest);
      if (km) {
        if (/[xX]/.test(km[1])) odoNote = km[1]; // เลขไมล์ไม่ครบ (เช่น 135xxx) -> ไม่เดา เก็บไว้ในหมายเหตุ
        else odometer = toNum(km[1]);
        rest = km[2].trim();
      }
      if (!rest) { skipped.push(line); return; }

      // "... ที่ ร้าน X" ท้ายประโยค -> ชื่อร้าน
      // ยอมรับเมื่ออยู่ท้ายบรรทัด สั้น และไม่มีคำบอกงาน (กันตัดผิดกลางประโยค)
      let title = rest;
      let shop = '';
      const at = /^(.*\S)\s+ที่\s+([^,]+)$/.exec(rest) || /^(.*\S)ที่\s*([A-Za-z0-9][^,]*)$/.exec(rest);
      if (at && at[2].trim().length <= 40 && !/เปลี่|เปลี้|ล้าง|เติม|ซ่อม/.test(at[2])) {
        title = at[1].trim(); shop = at[2].trim();
      }

      const types = classifyAll(rest);
      rows.push({
        line: i + 1,
        date: date,
        odometer: odometer,
        odoNote: odoNote,
        title: title,
        shop: shop,
        type: (types[0] || 'other'),
        alsoTypes: types.slice(1),
        duplicate: !!seen[date + '|' + title]
      });
    });
    return { rows: rows, skipped: skipped };
  }

  /**
   * สรุปรายปี: ค่าน้ำมัน, ค่าซ่อมบำรุง, จำนวนรายการ, รายการที่ไม่มีราคา, ระยะทาง
   * ระยะทางของปี = เลขไมล์สูงสุดที่จดได้ถึงสิ้นปีนั้น − ของสิ้นปีก่อน
   * (ปีแรกใช้เลขไมล์ต่ำสุดของปีนั้นเป็นจุดเริ่ม)
   */
  function yearlySummary(fuelLogs, services) {
    const map = {};
    const odoPoints = [];
    function yr(y) { return map[y] || (map[y] = { year: y, fuel: 0, service: 0, liters: 0, fillCount: 0, serviceCount: 0, missingCost: 0, distance: null }); }
    (fuelLogs || []).forEach(function (l) {
      const y = String(l.date || '').slice(0, 4); if (!/^\d{4}$/.test(y)) return;
      const r = yr(y); const t = toNum(l.total);
      if (t > 0) r.fuel += t;
      r.liters += toNum(l.liters) || 0; r.fillCount++;
      if (toNum(l.odometer) !== null) odoPoints.push([l.date, toNum(l.odometer)]);
    });
    (services || []).forEach(function (s) {
      const y = String(s.date || '').slice(0, 4); if (!/^\d{4}$/.test(y)) return;
      const r = yr(y); const t = toNum(s.cost);
      r.serviceCount++;
      if (t > 0) r.service += t; else r.missingCost++;
      if (toNum(s.odometer) !== null) odoPoints.push([s.date, toNum(s.odometer)]);
    });
    const years = Object.keys(map).sort();
    let prevEnd = null;
    years.forEach(function (y) {
      let end = null, minIn = null;
      odoPoints.forEach(function (p) {
        if (p[0] <= y + '-12-31' && (end === null || p[1] > end)) end = p[1];
        if (p[0].slice(0, 4) === y && (minIn === null || p[1] < minIn)) minIn = p[1];
      });
      const start = prevEnd !== null ? prevEnd : minIn;
      if (end !== null && start !== null && end >= start) map[y].distance = end - start;
      if (end !== null) prevEnd = end;
    });
    return years.map(function (y) { return map[y]; });
  }

  const api = {
    classifyService: classifyService,
    classifyAll: classifyAll,
    coversType: coversType,
    parseServiceNotes: parseServiceNotes,
    yearlySummary: yearlySummary,
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
