# Desenreda el nudo (Tangle Teezer en Salcobrand)

Juego de realidad aumentada para celulares, sin app. La persona escanea el QR de la góndola, la cámara queda de fondo y un **nudo de pelo en 3D** flota sobre la pantalla. Lo **peina con el dedo, de arriba hacia abajo**, contra el reloj. Si sube el dedo da un tirón y pierde puntos. Todo el que juega gana un **cupón de descuento de 10% a 40%** según su puntaje, y ve el **ranking del día de su tienda**.

```
TANGLE-DESENREDA/
├── index.html           Pantallas (bienvenida, HUD del juego, resultado)
├── css/app.css          Estilos (línea gráfica)
├── fonts/               Poppins y Cormorant Garamond (woff2, licencia OFL)
├── js/
│   ├── config.js        LO QUE SE EDITA: descuento, niveles, URL de la planilla, modo de prueba
│   ├── game.js          Juego 3D (three.js): nudo, peinado con el dedo, puntaje
│   ├── app.js           Flujo, descuento según puntaje, ranking
│   ├── cam.js           Cámara de fondo (si no hay permiso, se juega igual)
│   ├── track.js         Métricas anónimas hacia Google Sheets
│   └── brush.js         Cepillo 3D de ejemplo hecho por código
├── lib/three.min.js     three.js r150 (MIT), servido desde el mismo sitio
├── img/sb-logo.png      Logo Salcobrand
├── qr/qr-ejemplo.png    QR de ejemplo (cambia NOMBRE-TIENDA por el código de cada tienda)
├── apps-script/         Backend en Google Sheets (Code.gs y appsscript.json)
└── .nojekyll
```

## Línea gráfica
Paleta "Metal-verso" tomada de las imágenes de la marca y de Salco Lente: fondo champagne perla, lila y rosa de acento, cobre y dorado para los metálicos, tinta casi negra en los textos. Titulares en Poppins (negrita) con una palabra en Cormorant Garamond cursiva, iconos de línea (sin emojis) y tarjetas de vidrio claro. Las fuentes van incluidas en `fonts/` (no dependen de internet). Los colores están como variables al inicio de `css/app.css` (`--violet`, `--rose`, `--copper`, `--gold`, `--champ`), y los colores de los cepillos 3D en `js/config.js`.

## Cómo se juega
1. Bienvenida con tres reglas y **¡A jugar!** (pide la cámara; si la niegan, juegan sobre un fondo de color).
2. Cuenta regresiva 3, 2, 1.
3. **Peinar**: cada hebra se endereza con las pasadas hacia abajo. Hay que **cubrir todo el ancho** porque cada hebra solo reacciona cerca del dedo. Subir el dedo en contra del pelo cuenta como **tirón** (resta puntos y las hebras se enredan un poco).
4. **Puntaje** = 700 por rapidez (tiempo que sobra) + 300 por limpieza (sin tirones). Si se acaba el tiempo, el puntaje es el avance logrado (máximo 300): igual recibe descuento, pero bajo.
5. **3 niveles** (nudo suave, medio y de domingo), cada uno con más hebras, más resistencia y menos tiempo. Los niveles solo cambian la dificultad.

## Descuento y cupón
- **Todo jugador gana descuento**, gane o pierda: va de **10% a 40%** en saltos de 5%, según el puntaje (con 900 puntos o más se llega al 40%). Fórmula en `js/app.js` (`descuento`), parámetros en `js/config.js` (`DESCUENTO`: `MIN`, `MAX`, `PASO`, `PUNTAJE_MAX`).
- Un **código por celular y día** (`TT-XXXXX`). Si juega de nuevo y logra más puntaje, **sube el descuento del mismo código** (nunca baja), así en caja solo hay un código válido por persona.
- El color del cupón cambia según el descuento: cobre (10% a 15%), plata (20% a 30%) y dorado (35% a 40%).
- Se muestra con fecha de vigencia. La planilla tiene una hoja `Cupones` con una columna **"Canjeado"** para marcar a mano al cobrar.
- **Los porcentajes y la vigencia son de ejemplo.** Definirlos con Salcobrand y la marca. Verificar que el cupón se pueda aplicar en caja, y que se pueda acumular o no con otras promociones.
- No es un sorteo: no se piden datos personales.

## Ranking por tienda
Cada QR lleva el código de la tienda: `.../TANGLE-DESENREDA/?t=SB-LAS-CONDES` (letras, números y guiones, hasta 24). El ranking del día muestra solo puntaje y nivel (anónimo). Si no hay conexión con la planilla, simplemente no se muestra.

## Poner en marcha
### 1. Planilla y backend (Google Sheets)
1. Crea una planilla nueva (por ejemplo "Desenreda el nudo").
2. **Extensiones > Apps Script**. Pega `apps-script/Code.gs`. En *Configuración del proyecto* activa "Mostrar archivo de manifiesto appsscript.json" y pega el de este repo.
3. **Implementar > Nueva implementación > Aplicación web**. Ejecutar como: *yo*. Quién tiene acceso: *cualquier persona*. Copia la URL que termina en `/exec` y acepta los permisos.
4. Pega esa URL en `js/config.js`, campo `URL`.
5. Si luego cambias el código del script: **Implementar > Administrar implementaciones > editar > Versión nueva** (la URL no cambia).

Hojas que se crean solas: `Jugadas` (todos los eventos) y `Cupones` (un código por persona y día, con su mayor descuento y una columna "Canjeado").

### 2. Publicar en GitHub Pages
1. Crea el repositorio (sugerido: `TANGLE-DESENREDA`) y sube **todo el contenido de esta carpeta** a la raíz.
2. **Settings > Pages > Deploy from a branch > main / (root)**.
3. Queda en `https://cvaldovinos25.github.io/TANGLE-DESENREDA/`. Si el repo se llama distinto, cambia el nombre en los QR.
4. Si actualizas archivos, sube la versión nueva en la URL (`?v=2` en `index.html`) o recarga con Ctrl+Shift+R para evitar caché.

### 3. Antes de lanzar
- `MODO_PRUEBA: false` en `js/config.js`.
- Pegar la `URL` del Apps Script.
- Un QR por tienda con su código (`?t=`). Opcional: `&origen=cartel` o `&origen=redes` para medir de dónde llegan.

## Métricas (hoja `Jugadas`)
Fecha y hora, tienda, origen, visita (1 = primera, 2 o más = repetición), evento (`inicio`, `nivel_ok`, `nivel_fail`, `cupon`, `puente`), nivel, puntaje, segundos, tirones, avance, cupón, descuento, tipo de dispositivo y versión. Indicadores útiles: escaneos (inicio), partidas por persona, nivel alcanzado, cupones emitidos vs. canjeados (columna "Canjeado").

## Privacidad
La app no pide ni guarda nombre, correo ni teléfono, ni IP, ni imágenes de la cámara (solo se usa como fondo). El código de visita y el cupón se guardan en el propio celular.

## Puente con la otra campaña
Si publican también "Tu pelo, tu cepillo", poner su URL en `CEPILLO_URL` y al terminar el juego aparece el botón "¿Cuál cepillo es para tu pelo?".

## Cómo afinar la dificultad
En `js/config.js`: `hebras`, `resistencia` (más alto = más pasadas) y `tiempo` por nivel. En `js/game.js`: `HIT` (radio del cepillo) y `TRAVEL` (recorrido necesario).

## Pendiente con la marca
Cepillo 3D de ejemplo hecho por código. Cuando haya fotos o modelo 3D reales del producto se pueden reemplazar. No se usa el logo de Tangle Teezer, solo el nombre en texto.
