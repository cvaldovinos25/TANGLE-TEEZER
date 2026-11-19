/* ============================================================
   Desenreda el nudo | configuración (lo único que se edita)
   ============================================================ */
window.TT = window.TT || {};
TT.CONFIG = {
  CAMP: 'desenreda',
  VERSION: '8',
  MARCA: 'Tangle Teezer',
  /* URL de la aplicación web de Google Apps Script (ver README). Vacío = no se envían métricas. */
  URL: 'https://script.google.com/macros/s/AKfycbw0MAEl0Z4-9LkuosBGbeuOp8EVhzFB5W8QAAX-GEgg7znDE1kXlTzvdOexUxQiOHyg/exec',
  /* Mientras sea true se muestra "Modo de prueba" y los descuentos aparecen como ejemplo. Poner false al lanzar. */
  MODO_PRUEBA: true,
  /* Clave del enlace de PRUEBAS: con ?prueba=CLAVE se puede jugar todas las veces que se quiera (sin bloqueo) y las filas quedan marcadas con origen "prueba" en la planilla.
     Cambiarla y no compartir ese enlace con el público. */
  CLAVE_PRUEBA: 'pelo-prueba',
  /* Enlace opcional a la otra campaña ("Tu pelo, tu cepillo"). Vacío = no se muestra el botón. */
  CEPILLO_URL: '',
  /* Vigencia del cupón en días */
  VIGENCIA_DIAS: 7,
  /* Descuento: se entrega SOLO al completar los 3 niveles, en UNA sola partida por dispositivo (sin repetir niveles ni mejorar el puntaje). Va de MIN a MAX en saltos de PASO,
     según el puntaje PROMEDIO de los 3 niveles (cada nivel vale hasta 1000). Con PUNTAJE_MAX o más de promedio se llega al máximo; el 40% exige casi el puntaje perfecto (sin faltas y con mucho tiempo sobrando en los 3 niveles).
     Los porcentajes son de EJEMPLO: definir con Salcobrand y la marca. */
  DESCUENTO: { MIN: 10, MAX: 40, PASO: 5, PUNTAJE_MAX: 950 },
  /* Niveles: cuántas hebras, cuánto "pasadas" necesita cada una (resistencia) y tiempo en segundos.
     Los niveles solo cambian la dificultad; el descuento depende del puntaje total. */
  NIVELES: [
    { id: 1, nombre: 'Nudo firme',      hebras: 12, nudos: 4, resistencia: 1.8, tiempo: 38 },
    { id: 2, nombre: 'Nudo medio',      hebras: 16, nudos: 5, resistencia: 2.6, tiempo: 36 },
    { id: 3, nombre: 'Nudo de domingo', hebras: 22, nudos: 6, resistencia: 3.5, tiempo: 34 }
  ],
  /* Cabellos por mechón (más = más lleno y más pesado). Fijo en 24 (más = más lleno y más pesado; 0 = automático: 40, o 24 en celulares modestos). */
  HILOS: 24,
  /* Colores de las hebras */
  PELOS: ['#2a1810', '#3a2316', '#4a2c1b', '#5a3822', '#6b4328', '#3a2316', '#7a4d2c', '#33200f']
};
