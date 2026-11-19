/**
 * Desenreda el nudo | backend en Google Apps Script
 * Recibe las jugadas de la app (POST) y entrega el ranking del día por tienda (GET).
 *
 * Hojas (se crean solas):
 *  - "Partidas": UNA FILA POR PARTIDA (cada celular juega una sola): fecha, hora de juego, puntaje obtenido, descuento obtenido, resultado y más.
 *  - "Cupones": un código por celular y día con su mayor descuento y la columna "Canjeado" para marcar a mano en caja.
 *  - "Jugadas": registro de todos los eventos (inicio, nivel superado o fallido...) para medir el embudo.
 *  - "Resumen": tablero con fórmulas. Se arma una sola vez ejecutando la función armarResumen() desde el editor.
 * No guarda IP ni datos personales, solo el tipo de dispositivo (móvil o escritorio).
 */
var TZ = 'America/Santiago';
var H_J = ['Fecha y hora (Chile)', 'Tienda', 'Origen', 'Visita', 'Evento', 'Nivel', 'Puntaje', 'Segundos', 'Tirones', 'Avance %', 'Cupón', 'Dto %', 'Dispositivo', 'Versión'];
var H_C = ['Código', 'Tienda', 'Fecha de emisión', 'Puntaje total', 'Dto %', 'Canjeado (marcar a mano)'];
var H_P = ['Fecha', 'Hora de juego', 'Puntaje obtenido', 'Descuento obtenido (%)', 'Resultado', 'Cupón', 'Tienda', 'Origen', 'Tipo de visita', 'Puntaje nivel 1', 'Puntaje nivel 2', 'Puntaje nivel 3', 'Tiempo total (s)', 'Tirones', 'Dispositivo', 'Versión'];
var EVENTOS = ['inicio', 'nivel_ok', 'nivel_fail', 'cupon', 'partida', 'puente'];

function txt(v, n) { var s = String(v == null ? '' : v).slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function num(v, a, b) { var x = Math.round(Number(v)); return isFinite(x) ? Math.max(a, Math.min(b, x)) : ''; }
function hoja(ss, nombre, cab) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.setFrozenRows(1); }
  for (var i = 0; i < cab.length; i++) {                       // agrega los encabezados que falten
    var c = sh.getRange(1, i + 1);
    if (c.getValue() === '') c.setValue(cab[i]).setFontWeight('bold').setBackground('#5f46b0').setFontColor('#ffffff');
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
    hoja(ss, 'Jugadas', H_J).appendRow([f, tienda, txt(d.origen, 24), num(d.visita, 1, 100000), d.evt, num(d.nivel, 1, 9), num(d.puntaje, 0, 4000), num(d.seg, 0, 600), num(d.tirones, 0, 99), num(d.avance, 0, 100), txt(d.cupon, 12), num(d.dto, 0, 100), txt(d.disp, 12), txt(d.ver, 10)]);
    if (d.evt === 'partida') {                                   // una fila por partida completa (los 3 niveles)
      var visita = num(d.visita, 1, 100000);
      var res = d.resultado === 'completo' ? 'Completó los 3 niveles' : (d.resultado === 'abandono' ? 'Abandonó (nivel ' : 'No completó (nivel ') + num(d.nivel, 1, 9) + ')';
      if (d.resultado === 'completo') res = 'Completó los 3 niveles';
      hoja(ss, 'Partidas', H_P).appendRow([f.slice(0, 10), f.slice(11), num(d.puntaje, 0, 4000), num(d.dto, 0, 100), res, txt(d.cupon, 12), tienda, txt(d.origen, 24),
        visita === 1 ? 'Primera visita' : 'Repetición', num(d.p1, 0, 1000), num(d.p2, 0, 1000), num(d.p3, 0, 1000), num(d.seg, 0, 2000), num(d.tirones, 0, 999), txt(d.disp, 12), txt(d.ver, 10)]);
    }
    if (d.evt === 'cupon' && d.cupon) {                          // un código por persona: se actualiza su mayor descuento
      var sc = hoja(ss, 'Cupones', H_C), codigo = txt(d.cupon, 12), vals = sc.getLastRow() > 1 ? sc.getRange(2, 1, sc.getLastRow() - 1, 1).getValues() : [], fila = -1;
      for (var i = 0; i < vals.length; i++) if (vals[i][0] === codigo) { fila = i + 2; break; }
      if (fila > 0) { sc.getRange(fila, 4, 1, 2).setValues([[num(d.puntaje, 0, 4000), num(d.dto, 0, 100)]]); }
      else sc.appendRow([codigo, tienda, f, num(d.puntaje, 0, 4000), num(d.dto, 0, 100), '']);
    }
    return salida({ ok: true });
  } catch (err) { return salida({ ok: false }); } finally { lock.releaseLock(); }
}

/* Ranking del día de una tienda: solo el puntaje total de partidas completas (anónimo), los 8 mejores. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion !== 'ranking') return salida({ ok: true, servicio: 'desenreda el nudo' });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Partidas'), top = [];
  if (sh && sh.getLastRow() > 1) {
    var n = Math.min(3000, sh.getLastRow() - 1), v = sh.getRange(sh.getLastRow() - n + 1, 1, n, 7).getValues(), hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), t = txt(p.t, 24);
    for (var i = 0; i < v.length; i++) if (v[i][6] === t && v[i][4] === 'Completó los 3 niveles' && String(v[i][0]).slice(0, 10) === hoy) top.push({ puntaje: v[i][2], nivel: 3 });
    top.sort(function (a, b) { return b.puntaje - a.puntaje; }); top = top.slice(0, 8);
  }
  return salida({ ok: true, top: top });
}
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/**
 * Arma la hoja "Resumen" con fórmulas que se actualizan solas. Ejecutar UNA VEZ desde el editor (menú Ejecutar > armarResumen),
 * después de que existan las hojas "Partidas" y "Jugadas" (basta jugar una partida de prueba).
 */
function armarResumen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen', 0);
  sh.clear();
  var k = [
    ['Indicador', 'Valor'],
    ['Escaneos / partidas iniciadas', '=COUNTIF(Jugadas!E:E,"inicio")'],
    ['Partidas registradas', '=COUNTA(Partidas!A2:A)'],
    ['Completaron los 3 niveles', '=COUNTIF(Partidas!E2:E,"Completó*")'],
    ['Tasa de finalización', '=IFERROR(B4/B3,0)'],
    ['Puntaje promedio (todas)', '=IFERROR(AVERAGE(Partidas!C2:C),0)'],
    ['Descuento promedio entregado (%)', '=IFERROR(AVERAGEIF(Partidas!E2:E,"Completó*",Partidas!D2:D),0)'],
    ['Partidas de repetición de visita', '=COUNTIF(Partidas!I2:I,"Repetición")'],
    ['Cupones emitidos', '=COUNTA(Cupones!A2:A)'],
    ['Cupones canjeados (columna Canjeado con algo escrito)', '=COUNTA(Cupones!F2:F)'],
    ['Tasa de canje', '=IFERROR(B10/B9,0)'],
    ['Saltos a la otra campaña', '=COUNTIF(Jugadas!E:E,"puente")']
  ];
  sh.getRange(1, 1, k.length, 2).setValues(k);
  sh.getRange('B5').setNumberFormat('0%'); sh.getRange('B11').setNumberFormat('0%'); sh.getRange('B6:B7').setNumberFormat('0.0');
  sh.getRange('D1').setFormula('=QUERY(Partidas!A2:P,"select G,count(A),avg(C),avg(D) where G is not null group by G order by count(A) desc label G \'Tienda\', count(A) \'Partidas\', avg(C) \'Puntaje prom.\', avg(D) \'Dto prom. %\'",0)');
  sh.getRange('I1').setFormula('=QUERY(Partidas!A2:P,"select A,count(A),avg(C),avg(D) where A is not null group by A order by A desc label A \'Día\', count(A) \'Partidas\', avg(C) \'Puntaje prom.\', avg(D) \'Dto prom. %\'",0)');
  sh.getRange('N1').setFormula('=QUERY(Partidas!A2:P,"select D,count(A) where E starts with \'Completó\' group by D order by D desc label D \'Descuento %\', count(A) \'Partidas\'",0)');
  sh.getRange('A1:B1').setFontWeight('bold').setBackground('#5f46b0').setFontColor('#ffffff');
  sh.setColumnWidth(1, 330); sh.setFrozenRows(1);
}
