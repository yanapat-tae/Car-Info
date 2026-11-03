/*
 * charts.js — กราฟแบบ SVG ที่วาดเอง (ไม่ต้องโหลดไลบรารี ใช้ออฟไลน์ได้)
 *   CarCharts.line(...)        กราฟเส้น km/L ตามเวลา
 *   CarCharts.stackedBars(...) กราฟแท่งค่าใช้จ่ายรายเดือน (น้ำมัน + ซ่อมบำรุง)
 * แตะ/ชี้ที่กราฟเพื่อดูตัวเลข (tooltip) และมีตารางให้ดูแทนได้เสมอ
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const SURFACE = '#1a0d10'; // สีพื้นการ์ด ใช้ทำขอบรอบจุดให้แยกจากเส้น

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, x, y, str, attrs) {
    const t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str; // textContent = ปลอดภัยจากข้อความแปลกๆ
    return t;
  }

  /** หาเส้นตารางแกน Y ที่เป็นเลขกลมๆ เช่น 0, 500, 1000 */
  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const raw = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  function makeTooltip(container) {
    let tip = container.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.setAttribute('role', 'status');
      container.appendChild(tip);
    }
    tip.hidden = true;
    return {
      show: function (x, y, rows, title) {
        tip.textContent = '';
        rows.forEach(function (r) {
          const row = document.createElement('div');
          row.className = 'chart-tip-row';
          if (r.color) {
            const key = document.createElement('span');
            key.className = 'chart-tip-key';
            key.style.background = r.color;
            row.appendChild(key);
          }
          const v = document.createElement('strong');
          v.textContent = r.value;
          row.appendChild(v);
          const l = document.createElement('span');
          l.className = 'chart-tip-label';
          l.textContent = r.label;
          row.appendChild(l);
          tip.appendChild(row);
        });
        if (title) {
          const t = document.createElement('div');
          t.className = 'chart-tip-title';
          t.textContent = title;
          tip.appendChild(t);
        }
        tip.hidden = false;
        const cw = container.clientWidth;
        const tw = tip.offsetWidth;
        let left = x - tw / 2;
        left = Math.max(4, Math.min(cw - tw - 4, left));
        tip.style.left = left + 'px';
        tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
      },
      hide: function () { tip.hidden = true; }
    };
  }

  /**
   * กราฟเส้น
   * points: [{ t: number(วัน), value, dateLabel }]
   * opts: { color, format(v), unit, reference: { value, label } }
   */
  function line(container, points, opts) {
    container.querySelectorAll('svg').forEach(function (s) { s.remove(); });
    const W = Math.max(260, container.clientWidth);
    const H = 190;
    const m = { l: 40, r: 16, t: 16, b: 26 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart-svg', tabindex: 0,
      role: 'img', 'aria-label': opts.ariaLabel || '' });
    container.insertBefore(svg, container.firstChild);

    const values = points.map(function (p) { return p.value; });
    if (opts.reference) values.push(opts.reference.value);
    const ticks = niceTicks(Math.min.apply(null, values) * 0.95, Math.max.apply(null, values) * 1.05, 3);
    const yMin = ticks[0], yMax = ticks[ticks.length - 1];
    const tMin = points[0].t, tMax = points[points.length - 1].t;
    const x = function (t) { return tMax === tMin ? m.l + pw / 2 : m.l + ((t - tMin) / (tMax - tMin)) * pw; };
    const y = function (v) { return m.t + ph - ((v - yMin) / (yMax - yMin)) * ph; };

    // เส้นตาราง + ตัวเลขแกน Y (สีจาง)
    const grid = el('g', { class: 'chart-grid' }, svg);
    ticks.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      text(grid, m.l - 8, y(v) + 4, opts.format(v), { 'text-anchor': 'end', class: 'chart-axis' });
    });
    // วันที่แรก/สุดท้าย
    text(svg, x(tMin), H - 6, points[0].dateLabel, { 'text-anchor': points.length > 1 ? 'start' : 'middle', class: 'chart-axis' });
    if (points.length > 1) text(svg, x(tMax), H - 6, points[points.length - 1].dateLabel, { 'text-anchor': 'end', class: 'chart-axis' });

    // เส้นค่าเฉลี่ย (ประ)
    if (opts.reference) {
      const ry = y(opts.reference.value);
      el('line', { x1: m.l, x2: W - m.r, y1: ry, y2: ry, class: 'chart-ref' }, svg);
      text(svg, m.l + 4, ry - 6, opts.reference.label, { class: 'chart-ref-label' });
    }

    // พื้นที่ไล่สีจางๆ ใต้เส้น
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': opts.color, 'stop-opacity': 0.28 }, grad);
    el('stop', { offset: '100%', 'stop-color': opts.color, 'stop-opacity': 0 }, grad);

    const d = points.map(function (p, i) { return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.value).toFixed(1); }).join(' ');
    if (points.length > 1) {
      el('path', { d: d + ' L' + x(tMax).toFixed(1) + ',' + (m.t + ph) + ' L' + x(tMin).toFixed(1) + ',' + (m.t + ph) + ' Z', fill: 'url(#' + gid + ')' }, svg);
      el('path', { d: d, fill: 'none', stroke: opts.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    }
    points.forEach(function (p) {
      el('circle', { cx: x(p.t), cy: y(p.value), r: 4, fill: opts.color, stroke: SURFACE, 'stroke-width': 2 }, svg);
    });

    // ป้ายค่าล่าสุด (ป้ายเดียวพอ ไม่ใส่ทุกจุด)
    const last = points[points.length - 1];
    text(svg, Math.min(x(last.t), W - m.r), y(last.value) - 12, opts.format(last.value), { 'text-anchor': 'end', class: 'chart-value' });

    // ชั้น interaction: เส้นแนวตั้ง + tooltip
    const cross = el('line', { y1: m.t, y2: m.t + ph, class: 'chart-cross', visibility: 'hidden' }, svg);
    const focusDot = el('circle', { r: 6, fill: opts.color, stroke: SURFACE, 'stroke-width': 2, visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.l - 10, y: 0, width: pw + 20, height: H, fill: 'transparent' }, svg);
    const tip = makeTooltip(container);
    let idx = -1;

    function showAt(i) {
      idx = Math.max(0, Math.min(points.length - 1, i));
      const p = points[idx];
      const px = x(p.t), py = y(p.value);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      focusDot.setAttribute('cx', px); focusDot.setAttribute('cy', py); focusDot.setAttribute('visibility', 'visible');
      const scale = svg.getBoundingClientRect().width / W || 1;
      tip.show(px * scale, py * scale, [{ value: opts.format(p.value) + ' ' + opts.unit, label: '', color: opts.color }], p.dateLabel + (p.note ? ' · ' + p.note : ''));
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden'); focusDot.setAttribute('visibility', 'hidden'); tip.hide(); idx = -1;
    }
    function nearest(evt) {
      const r = svg.getBoundingClientRect();
      const sx = (evt.clientX - r.left) * (W / r.width);
      let best = 0, bd = Infinity;
      points.forEach(function (p, i) { const dd = Math.abs(x(p.t) - sx); if (dd < bd) { bd = dd; best = i; } });
      return best;
    }
    hit.addEventListener('pointermove', function (e) { showAt(nearest(e)); });
    hit.addEventListener('pointerdown', function (e) { showAt(nearest(e)); });
    hit.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { showAt(idx < 0 ? 0 : idx + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { showAt(idx < 0 ? points.length - 1 : idx - 1); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    });
  }

  /** path ของแท่งที่มุมบนโค้ง 4px (ปลายข้อมูล) ฐานเป็นเส้นตรง */
  function barPath(x, y, w, h, rTop) {
    const r = Math.min(rTop, w / 2, h);
    if (r <= 0) return 'M' + x + ',' + (y + h) + 'h' + w + 'v' + (-h) + 'h' + (-w) + 'Z';
    return 'M' + x + ',' + (y + h) +
      'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + h) + 'Z';
  }

  /**
   * กราฟแท่งซ้อน
   * groups: [{ label, title, values: [n, n] }]
   * series: [{ name, color }]
   */
  function stackedBars(container, groups, series, opts) {
    container.querySelectorAll('svg').forEach(function (s) { s.remove(); });
    const W = Math.max(260, container.clientWidth);
    const H = 200;
    const m = { l: 48, r: 8, t: 22, b: 26 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const GAP = 2;

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart-svg', role: 'img', 'aria-label': opts.ariaLabel || '' });
    container.insertBefore(svg, container.firstChild);

    const totals = groups.map(function (g) { return g.values.reduce(function (a, b) { return a + b; }, 0); });
    const ticks = niceTicks(0, Math.max(1, Math.max.apply(null, totals)), 3);
    const yMax = ticks[ticks.length - 1];
    const y = function (v) { return m.t + ph - (v / yMax) * ph; };
    const band = pw / groups.length;
    const bw = Math.min(36, band * 0.56);

    const grid = el('g', { class: 'chart-grid' }, svg);
    ticks.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      text(grid, m.l - 8, y(v) + 4, opts.format(v), { 'text-anchor': 'end', class: 'chart-axis' });
    });

    const tip = makeTooltip(container);
    const scaleOf = function () { return svg.getBoundingClientRect().width / W || 1; };

    groups.forEach(function (g, gi) {
      const cx = m.l + band * gi + band / 2;
      const x0 = cx - bw / 2;
      text(svg, cx, H - 6, g.label, { 'text-anchor': 'middle', class: 'chart-axis' });

      let acc = 0;
      const lastIdx = g.values.reduce(function (li, v, i) { return v > 0 ? i : li; }, -1);
      g.values.forEach(function (v, si) {
        if (v <= 0) return;
        const yTop = y(acc + v);
        const yBottom = y(acc);
        // ช่องว่าง 2px ระหว่างชิ้น (ยกเว้นชิ้นล่างสุดที่ติดฐาน)
        const h = Math.max(1, yBottom - yTop - (acc > 0 ? GAP : 0));
        const p = el('path', {
          d: barPath(x0, yTop, bw, h, si === lastIdx ? 4 : 0),
          fill: series[si].color, class: 'chart-bar', tabindex: 0
        }, svg);
        acc += v;
        const show = function () {
          const s = scaleOf();
          tip.show(cx * s, yTop * s, [
            { value: opts.format(v, true), label: series[si].name, color: series[si].color }
          ], g.title + ' · รวม ' + opts.format(totals[gi], true));
        };
        p.addEventListener('pointerenter', show);
        p.addEventListener('pointerdown', show);
        p.addEventListener('focus', show);
        p.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') tip.hide(); });
        p.addEventListener('blur', function () { tip.hide(); });
      });

      // ป้ายยอดรวมเฉพาะเดือนล่าสุด
      if (gi === groups.length - 1 && totals[gi] > 0) {
        text(svg, cx, y(totals[gi]) - 6, opts.format(totals[gi]), { 'text-anchor': 'middle', class: 'chart-value' });
      }
    });
  }

  root.CarCharts = { line: line, stackedBars: stackedBars };
})(window);
