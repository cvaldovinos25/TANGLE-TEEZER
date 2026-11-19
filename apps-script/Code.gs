/**
 * Desenreda el nudo | backend en Google Apps Script
 * Recibe las jugadas de la app (POST) y entrega el ranking del día por tienda (GET).
 * Hojas: "Jugadas" (todos los eventos) y "Cupones" (un código por celular y día, con su mayor descuento).
 * No guarda IP ni datos del dispositivo, solo el tipo (móvil o escritorio).
 */
var TZ = 'America/Santiago';
var H_J = ['Fecha y hora (Chile)', 'Tienda', 'Origen', 'Visita', 'Evento', 'Nivel', 'Puntaje', 'Segundos', 'Tirones', 'Avance %', 'Cupón', 'Dto %', 'Dispositivo', 'Versión'];
var H_C = ['Código', 'Tienda', 'Fecha de emisión', 'Puntaje', 'Dto %', 'Canjeado (marcar a mano)'];
var EVENTOS = ['inicio', 'nivel_ok', 'nivel_fail', 'cupon', 'puente'];

function txt(v, n) { var s = String(v == null ? '' : v).slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function num(v, a, b) { var x = Math.round(Number(v)); return isFinite(x) ? Math.max(a, Math.min(b, x)) : ''; }
function hoja(ss, nombre, cab) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.setFrozenRows(1); }
  for (var i = 0; i < cab.length; i++) {                       // agrega los encabezados que falten
    var c = sh.getRange(1, i + 1);
    if (c.getValue() === '') c.setValue(cab[i]).setFontWeight('bold').setBackground('#007dc3').setFontColor('#ffffff');
  }
  return sh;
}
function ahora() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (d.camp !== 'desenreda' || EVENTOS.indexOf(d.evt) < 0) return salida({ ok: false });
    var ss = SpreadsheetApp.getActiveSpreadsheet(), f = ahora(), tienda = txt(d.tienda, 24);
    hoja(ss, 'Jugadas', H_J).appendRow([f, tienda, txt(d.origen, 24), num(d.visita, 1, 100000), d.evt, num(d.nivel, 1, 9), num(d.puntaje, 0, 2000), num(d.seg, 0, 600), num(d.tirones, 0, 99), num(d.avance, 0, 100), txt(d.cupon, 12), num(d.dto, 0, 100), txt(d.disp, 12), txt(d.ver, 10)]);
    if (d.evt === 'cupon' && d.cupon) {                          // un código por persona: se actualiza su mayor descuento
      var sc = hoja(ss, 'Cupones', H_C), codigo = txt(d.cupon, 12), vals = sc.getLastRow() > 1 ? sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues() : [], fila = -1;
      for (var i = 0; i < vals.length; i++) if (vals[i][0] === codigo) { fila = i + 2; break; }
      if (fila > 0) { sc.getRange(fila, 4, 1, 2).setValues([[num(d.puntaje, 0, 2000), num(d.dto, 0, 100)]]); }
      else sc.appendRow([codigo, tienda, f, num(d.puntaje, 0, 2000), num(d.dto, 0, 100), '']);
    }
    return salida({ ok: true });
  } catch (err) { return salida({ ok: false }); } finally { lock.releaseLock(); }
}

/* Ranking del día de una tienda: solo puntaje y nivel (anónimo), los 8 mejores. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion !== 'ranking') return salida({ ok: true, servicio: 'desenreda el nudo' });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jugadas'), top = [];
  if (sh && sh.getLastRow() > 1) {
    var n = Math.min(3000, sh.getLastRow() - 1), v = sh.getRange(sh.getLastRow() - n + 1, 1, n, 7).getValues(), hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), t = txt(p.t, 24);
    for (var i = 0; i < v.length; i++) if (v[i][4] === 'nivel_ok' && v[i][1] === t && String(v[i][0]).slice(0, 10) === hoy) top.push({ puntaje: v[i][6], nivel: v[i][5] });
    top.sort(function (a, b) { return b.puntaje - a.puntaje; }); top = top.slice(0, 8);
  }
  return salida({ ok: true, top: top });
}
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
