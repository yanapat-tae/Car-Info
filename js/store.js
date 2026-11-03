/*
 * store.js — เก็บ/โหลดข้อมูลใน localStorage ของเบราว์เซอร์ และสำรอง (Export/Import)
 *
 * ข้อมูลอยู่ในเครื่องนี้ + เบราว์เซอร์นี้เท่านั้น ไม่ส่งไปที่ไหน
 * ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหาย -> ควร Export เก็บไว้เป็นระยะ
 */
(function (root) {
  'use strict';

  const KEY = 'carinfo.v1';
  const BACKUP_KEY = 'carinfo.v1.beforeImport';
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return { version: SCHEMA_VERSION, activeVehicleId: null, vehicles: [], fuelLogs: [], services: [] };
  }

  function uid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function safeGet(key) {
    try { return root.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { root.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  /** ตรวจรูปแบบข้อมูล ถ้าผิดจะ throw พร้อมข้อความภาษาไทย */
  function normalize(data) {
    if (!data || typeof data !== 'object') throw new Error('ไฟล์ไม่ใช่ข้อมูลของแอปนี้');
    const s = emptyState();
    ['vehicles', 'fuelLogs', 'services'].forEach(function (k) {
      if (data[k] === undefined) return;
      if (!Array.isArray(data[k])) throw new Error('รูปแบบข้อมูล "' + k + '" ไม่ถูกต้อง');
      s[k] = data[k].filter(function (x) { return x && typeof x === 'object' && x.id; });
    });
    if (typeof data.version === 'number' && data.version > SCHEMA_VERSION) {
      throw new Error('ไฟล์นี้มาจากแอปเวอร์ชันใหม่กว่า กรุณาอัปเดตแอปก่อน');
    }
    const ids = s.vehicles.map(function (v) { return v.id; });
    s.activeVehicleId = ids.indexOf(data.activeVehicleId) >= 0 ? data.activeVehicleId : (ids[0] || null);
    return s;
  }

  function load() {
    const raw = safeGet(KEY);
    if (!raw) return emptyState();
    try { return normalize(JSON.parse(raw)); }
    catch (e) {
      // ไม่ทับข้อมูลเดิมที่อ่านไม่ได้ เก็บสำเนาไว้ก่อน
      safeSet(KEY + '.corrupt.' + Date.now(), raw);
      return emptyState();
    }
  }

  function save(state) {
    return safeSet(KEY, JSON.stringify(state));
  }

  function exportJSON(state) {
    return JSON.stringify({
      app: 'car-info',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: state
    }, null, 2);
  }

  /** อ่านไฟล์สำรอง แล้วคืนค่า state ใหม่ (ยังไม่บันทึก) */
  function parseImport(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('อ่านไฟล์ไม่ได้ (ไม่ใช่ JSON)'); }
    const data = parsed && parsed.app === 'car-info' ? parsed.data : parsed;
    if (data && typeof data === 'object' && parsed && typeof parsed.version === 'number' && data.version === undefined) {
      data.version = parsed.version;
    }
    return normalize(data);
  }

  /** เก็บสำเนาข้อมูลปัจจุบันไว้ 1 ชุดก่อน Import เผื่อต้องการย้อนกลับ */
  function keepBackupBeforeImport(state) {
    return safeSet(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: state }));
  }

  function readBackupBeforeImport() {
    const raw = safeGet(BACKUP_KEY);
    if (!raw) return null;
    try { const p = JSON.parse(raw); return { savedAt: p.savedAt, state: normalize(p.data) }; }
    catch (e) { return null; }
  }

  function clearAll() {
    try { root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  /** ขอให้เบราว์เซอร์ไม่ลบข้อมูลอัตโนมัติ (ถ้ารองรับ) */
  function requestPersistence() {
    if (root.navigator && root.navigator.storage && root.navigator.storage.persist) {
      return root.navigator.storage.persist().catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  root.CarStore = {
    uid: uid,
    emptyState: emptyState,
    load: load,
    save: save,
    exportJSON: exportJSON,
    parseImport: parseImport,
    keepBackupBeforeImport: keepBackupBeforeImport,
    readBackupBeforeImport: readBackupBeforeImport,
    clearAll: clearAll,
    requestPersistence: requestPersistence
  };
})(window);
