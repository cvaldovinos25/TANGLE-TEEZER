/* ============================================================
   Desenreda el nudo | configuración (lo único que se edita)
   ============================================================ */
window.TT = window.TT || {};
TT.CONFIG = {
  CAMP: 'desenreda',
  VERSION: '4',
  MARCA: 'Tangle Teezer',
  /* URL de la aplicación web de Google Apps Script (ver README). Vacío = no se envían métricas. */
  URL: '',
  /* Mientras sea true se muestra "Modo de prueba" y los descuentos aparecen como ejemplo. Poner false al lanzar. */
  MODO_PRUEBA: true,
  /* Enlace opcional a la otra campaña ("Tu pelo, tu cepillo"). Vacío = no se muestra el botón. */
  CEPILLO_URL: '',
  /* Vigencia del cupón en días */
  VIGENCIA_DIAS: 7,
  /* Descuento: lo gana TODO el que juega, según su puntaje (0 a 1000). Va de MIN a MAX en saltos de PASO.
     Con PUNTAJE_MAX o más se llega al descuento máximo. Los porcentajes son de EJEMPLO: definir con Salcobrand y la marca. */
  DESCUENTO: { MIN: 10, MAX: 40, PASO: 5, PUNTAJE_MAX: 900 },
  /* Niveles: cuántas hebras, cuánto "pasadas" necesita cada una (resistencia) y tiempo en segundos.
     Los niveles solo cambian la dificultad; el descuento depende del puntaje. */
  NIVELES: [
    { id: 1, nombre: 'Nudo suave',     hebras: 9,  nudos: 3,  resistencia: 1.0, tiempo: 40 },
    { id: 2, nombre: 'Nudo medio',     hebras: 14, nudos: 4, resistencia: 1.5, tiempo: 36 },
    { id: 3, nombre: 'Nudo de domingo', hebras: 20, nudos: 5, resistencia: 2.1, tiempo: 32 }
  ],
  /* Cabellos por mechón (más = más lleno y más pesado). Fijo en 24 (más = más lleno y más pesado; 0 = automático: 40, o 24 en celulares modestos). */
  HILOS: 24,
  /* Colores de las hebras */
  PELOS: ['#2a1810', '#3a2316', '#4a2c1b', '#5a3822', '#6b4328', '#3a2316', '#7a4d2c', '#33200f']
};
