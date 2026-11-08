// เทสต์สูตรคำนวณ — รันด้วยคำสั่ง: npm test  (หรือ node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('full-to-full: ช่วงพื้นฐาน 500 km / 35 L', () => {
  const r = C.computeFuelEconomy([
    { id: 'a', date: '2026-01-01', odometer: 10000, liters: 40, total: 1400, full: true },
    { id: 'b', date: '2026-01-10', odometer: 10500, liters: 35, total: 1225, full: true }
  ]);
  assert.equal(r.segments.length, 1);
  close(r.segments[0].kmPerL, 500 / 35);
  close(r.segments[0].lPer100km, 7);
  close(r.segments[0].costPerKm, 1225 / 500);
  assert.equal(r.byLogId.b.distance, 500);
  assert.equal(r.byLogId.a, undefined, 'การเติมครั้งแรกยังคำนวณไม่ได้');
});

test('เติมไม่เต็มถังระหว่างทาง: ลิตรถูกรวมเข้าช่วงเดียวกัน', () => {
  const r = C.computeFuelEconomy([
    { id: 'a', date: '2026-01-01', odometer: 10000, liters: 40, total: 1400, full: true },
    { id: 'b', date: '2026-01-05', odometer: 10200, liters: 10, total: 350, full: false },
    { id: 'c', date: '2026-01-10', odometer: 10600, liters: 30, total: 1050, full: true }
  ]);
  assert.equal(r.segments.length, 1);
  close(r.segments[0].liters, 40);
  close(r.segments[0].kmPerL, 600 / 40);
  close(r.segments[0].cost, 1400);
});

test('ลืมจดครั้งก่อน: ช่วงนั้นไม่นำมาคิด แต่ช่วงถัดไปคิดได้', () => {
  const r = C.computeFuelEconomy([
    { id: 'a', date: '2026-01-01', odometer: 10000, liters: 40, total: 1400, full: true },
    { id: 'b', date: '2026-01-20', odometer: 11000, liters: 30, total: 1050, full: true, missed: true },
    { id: 'c', date: '2026-01-30', odometer: 11450, liters: 30, total: 1050, full: true }
  ]);
  assert.equal(r.segments.length, 1);
  assert.equal(r.segments[0].endLogId, 'c');
  close(r.segments[0].kmPerL, 15);
});

test('บันทึกไม่เรียงลำดับ: เรียงตามเลขไมล์ก่อนคำนวณ', () => {
  const r = C.computeFuelEconomy([
    { id: 'c', date: '2026-01-30', odometer: 11000, liters: 40, total: 0, full: true },
    { id: 'a', date: '2026-01-01', odometer: 10000, liters: 40, total: 1400, full: true },
    { id: 'b', date: '2026-01-15', odometer: 10500, liters: 25, total: 875, full: true }
  ]);
  assert.equal(r.segments.length, 2);
  close(r.segments[0].kmPerL, 20);
  close(r.segments[1].kmPerL, 12.5);
  assert.equal(r.segments[1].costPerKm, null, 'ไม่มีราคา -> ไม่เดาค่าใช้จ่าย');
  // ค่าเฉลี่ยถ่วงน้ำหนักด้วยระยะทาง: 1000 km / 65 L
  close(r.summary.avgKmPerL, 1000 / 65);
  close(r.summary.avgCostPerKm, 875 / 500);
  assert.equal(r.summary.best.endLogId, 'b');
  assert.equal(r.summary.worst.endLogId, 'c');
  assert.equal(r.summary.last.endLogId, 'c');
});

test('ไม่มีข้อมูลพอ: ค่าเฉลี่ยเป็น null ไม่ใช่ 0', () => {
  const r = C.computeFuelEconomy([{ id: 'a', date: '2026-01-01', odometer: 1, liters: 10, total: 300, full: true }]);
  assert.equal(r.summary.avgKmPerL, null);
  assert.equal(r.summary.totalSpent, 300);
  close(r.summary.avgPricePerL, 30);
});

test('คำนวณช่องที่สามของ ลิตร/ราคา/ยอดเงิน', () => {
  assert.equal(C.completeFuelAmounts({ liters: 30, price: 35.5 }, 'total'), 1065);
  assert.equal(C.completeFuelAmounts({ total: 1000, price: 40 }, 'liters'), 25);
  assert.equal(C.completeFuelAmounts({ total: '1,000', liters: '30' }, 'price'), 33.33);
  assert.equal(C.completeFuelAmounts({ liters: 30 }, 'total'), null);
});

test('addMonths ปัดวันสิ้นเดือน และข้ามปี', () => {
  assert.equal(C.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(C.addMonths('2026-11-15', 6), '2027-05-15');
  assert.equal(C.addMonths('2026-03-01', -3), '2025-12-01');
});

test('แจ้งเตือน: ใช้บันทึกล่าสุดของแต่ละประเภท และจัดสถานะถูกต้อง', () => {
  const services = [
    { id: 1, type: 'oil', date: '2026-01-01', odometer: 10000, nextKm: 15000 },
    { id: 2, type: 'oil', date: '2026-06-01', odometer: 15000, nextKm: 20000, nextDate: '2026-12-01' },
    { id: 3, type: 'battery', date: '2024-01-01', odometer: 1000, nextDate: '2026-10-01' },
    { id: 4, type: 'tires', date: '2025-01-01', odometer: 5000, nextKm: 60000 },
    { id: 5, type: 'brakes', date: '2025-01-01', odometer: 5000 }
  ];
  const r = C.computeReminders(services, 19500, '2026-11-03');
  assert.deepEqual(r.map(x => [x.key, x.status]), [
    ['battery', 'overdue'],
    ['oil', 'soon'],
    ['tires', 'ok']
  ]);
  const oil = r.find(x => x.key === 'oil');
  assert.equal(oil.service.id, 2);
  assert.equal(oil.kmLeft, 500);
  assert.equal(oil.daysLeft, 28);
});

test('ค่าใช้จ่ายรายเดือน 6 เดือนล่าสุด', () => {
  const m = C.monthlyCosts(
    [{ date: '2026-11-01', total: 1000 }, { date: '2026-06-30', total: 500 }, { date: '2026-05-31', total: 999 }],
    [{ date: '2026-11-02', cost: 2500 }],
    6, '2026-11-03');
  assert.deepEqual(m.map(x => x.month), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(m[0], { month: '2026-06', fuel: 500, service: 0 });
  assert.deepEqual(m[5], { month: '2026-11', fuel: 1000, service: 2500 });
});

test('CSV: escape เครื่องหมายคำพูด/จุลภาค และกันสูตร Excel', () => {
  const csv = C.toCSV([{ a: 'x,"y"', b: '=SUM(1)', c: -5 }], [
    { label: 'A', key: 'a' }, { label: 'B', key: 'b' }, { label: 'C', key: 'c' }
  ]);
  assert.equal(csv, 'A,B,C\r\n"x,""y""",\'=SUM(1),-5');
});

test('นำเข้าจากโน้ต: แยกวันที่ เลขไมล์ ประเภท และร้าน', () => {
  const text = [
    'Service Record',
    'Date\tKm\tEvent',
    '1/2/2024\t10000\tเปลี่ยนน้ำมันเครื่อง 5W-30 ที่ ร้านเอ',
    '15/3/2024\t\tเปลี่ยนกรองแอร์ ใบปัดน้ำฝน',
    '2/4/2024  12xxx  เปลี่ยนโช็คหน้า',
    '05/05/2567 13000 เปลี่ยนแบตเตอรี่',
    '9/9/2024 14000 ติดตั้งของ ที่ Shop A เปลี่ยนน้ำมันเกียร์',
    '31/2/2024 1 วันที่ไม่มีจริง'
  ].join('\n');
  const r = C.parseServiceNotes(text, [{ date: '2024-03-15', title: 'เปลี่ยนกรองแอร์ ใบปัดน้ำฝน' }]);
  assert.equal(r.rows.length, 5);
  assert.deepEqual(r.rows[0], { line: 3, date: '2024-02-01', odometer: 10000, odoNote: '', title: 'เปลี่ยนน้ำมันเครื่อง 5W-30', shop: 'ร้านเอ', type: 'oil', alsoTypes: [], duplicate: false });
  assert.equal(r.rows[1].odometer, null);
  assert.equal(r.rows[1].type, 'cabin_filter');
  assert.equal(r.rows[1].duplicate, true, 'มีอยู่แล้ว -> ไม่นำเข้าซ้ำ');
  assert.equal(r.rows[2].odometer, null, 'เลขไมล์ไม่ครบ -> ไม่เดา');
  assert.equal(r.rows[2].odoNote, '12xxx');
  assert.equal(r.rows[2].type, 'suspension');
  assert.equal(r.rows[3].date, '2024-05-05', 'ปี พ.ศ. แปลงเป็น ค.ศ.');
  assert.equal(r.rows[3].type, 'battery');
  assert.equal(r.rows[4].shop, '', 'ไม่ตัดชื่อร้านกลางประโยค');
  assert.equal(r.skipped.length, 3);
});

test('สรุปรายปี: ค่าใช้จ่าย ระยะทาง และรายการที่ไม่มีราคา', () => {
  const y = C.yearlySummary(
    [{ date: '2025-01-10', odometer: 20000, liters: 40, total: 1400 }, { date: '2025-12-20', odometer: 30000, liters: 40, total: 1500 }],
    [{ date: '2024-03-01', odometer: 12000, cost: 2000 }, { date: '2024-11-01', odometer: 18000 }, { date: '2025-06-01', odometer: 25000, cost: 900 }]
  );
  assert.deepEqual(y.map(r => [r.year, r.fuel, r.service, r.missingCost, r.distance]), [
    ['2024', 0, 2000, 1, 6000],
    ['2025', 2900, 900, 0, 12000]
  ]);
});

test('หลายงานในบรรทัดเดียว: แยกทุกประเภท และไม่นับคำซ้อน', () => {
  assert.deepEqual(C.classifyAll('เปลี่ยนน้ำมันเครื่อง, น้ำมันเกียร์, กรองเกียร์, ล้างกรองอากาศ'), ['oil', 'transmission', 'air_filter']);
  assert.deepEqual(C.classifyAll('เปลี่ยนกรองแอร์'), ['cabin_filter'], '"กรองแอร์" ไม่นับเป็น "ระบบแอร์"');
  assert.deepEqual(C.classifyAll('เปลี่ยนผ้าเบรค น้ำมันเบรค'), ['brakes', 'brake_fluid']);
  const r = C.parseServiceNotes('1/1/2025 100 เปลี่ยนน้ำมันเครื่อง, กรองแอร์');
  assert.equal(r.rows[0].type, 'oil');
  assert.deepEqual(r.rows[0].alsoTypes, ['cabin_filter']);
});

test('รอบการดูแล: คำนวณครั้งถัดไปจากครั้งล่าสุดที่ทำงานนั้น (รวมงานที่ทำพ่วง)', () => {
  const services = [
    { id: 'a', type: 'transmission', date: '2025-02-08', odometer: 152925 },
    { id: 'b', type: 'oil', alsoTypes: ['transmission'], date: '2025-12-26', odometer: 164249 },
    { id: 'c', type: 'oil', alsoTypes: ['cabin_filter'], date: '2026-06-14', odometer: 172528 },
    { id: 'd', type: 'coolant', date: '2025-01-25', odometer: 152180 }
  ];
  const intervals = { oil: { km: 8000 }, transmission: { km: 30000 }, coolant: { km: 20000 }, brake_fluid: { km: 30000, months: 24 } };
  const r = C.computeReminders(services, 174455, '2026-11-08', { intervals });
  const by = Object.fromEntries(r.map(x => [x.key, x]));
  assert.equal(by.oil.nextKm, 180528);
  assert.equal(by.oil.kmLeft, 6073);
  assert.equal(by.oil.status, 'ok');
  assert.equal(by.transmission.service.id, 'b', 'น้ำมันเกียร์ที่ทำพ่วงกับน้ำมันเครื่องนับเป็นครั้งล่าสุด');
  assert.equal(by.transmission.nextKm, 194249);
  assert.equal(by.coolant.nextKm, 172180);
  assert.equal(by.coolant.status, 'overdue');
  assert.equal(by.brake_fluid.status, 'nohistory');
  assert.equal(by.cabin_filter, undefined, 'ไม่ได้ตั้งรอบ และไม่ได้ใส่ครั้งถัดไป -> ไม่เตือน');
  assert.deepEqual(r.map(x => x.status), ['overdue', 'ok', 'ok', 'nohistory']);
});

test('รอบการดูแล: "ครั้งถัดไป" ที่ใส่เองมีสิทธิ์ก่อนรอบ', () => {
  const r = C.computeReminders([{ id: 'a', type: 'oil', date: '2026-01-01', odometer: 10000, nextKm: 15000 }],
    12000, '2026-02-01', { intervals: { oil: { km: 8000 } } });
  assert.equal(r[0].nextKm, 15000);
  assert.equal(r[0].basis, 'manual');
});
