# Consulta de turnos — Aconcagua Fest (CEREFAN)

Página estática (HTML + CSS + JS, sin librerías) para que cada voluntario consulte sus turnos escribiendo su nombre y apellido. Pensada para celulares y para abrirse desde un código QR.

## Estructura

```
index.html               interfaz
style.css                estilos
script.js                interfaz: carga de datos y pantallas
buscador.js              lógica de búsqueda (sin tildes/mayúsculas, tolerante a errores)
turnos.xlsx              fuente oficial de datos (no se modifica)
datos/voluntarios.json   datos derivados del Excel (los usa la página)
datos/inconsistencias.txt  avisos generados al convertir el Excel
assets/logocerefan.png   logo original
assets/logocerefan-web.png  mismo logo, reducido para carga rápida en celular
herramientas/convertir_excel.py   convierte turnos.xlsx -> voluntarios.json
```

## Publicar en GitHub Pages

1. Crea un repositorio y sube todos estos archivos a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**.
3. Tras un minuto la página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`. Esa URL es estable: úsala para el código QR.

Nota: al abrir `index.html` con doble clic (`file://`) los navegadores bloquean la carga del JSON. Para probar en tu computador ejecuta `python3 -m http.server` en esta carpeta y abre `http://localhost:8000`.

## Actualizar los turnos

1. Edita `turnos.xlsx` (mantén las columnas `Nombre, Apellido, Tipo, Turno, Área, Subárea` en las hojas de turno y `Nombre, Apellido, Tipo, Fecha/Momento` en Montaje/Desmontaje).
2. Ejecuta:
   ```
   pip install openpyxl
   python3 herramientas/convertir_excel.py
   ```
3. Revisa `datos/inconsistencias.txt` (nombres duplicados, nombres muy parecidos, filas incompletas). El script solo avisa: no corrige nada.
4. Sube `turnos.xlsx` y `datos/` a GitHub.

Reglas de lectura del Excel:
- El **horario** de cada turno se toma del nombre de la hoja (`TURNO1 (10-13)` → `10:00–13:00`). Si cambias el nombre de la hoja, cambia el horario mostrado.
- Las filas con Área `Reserva` se muestran como asignación especial ("Turno 1 — 10:00–13:00").
- Las hojas Montaje y Desmontaje muestran el texto de la columna `Fecha/Momento` tal cual.
- Una persona se identifica por su nombre + apellido normalizado (sin tildes ni mayúsculas); todas sus filas se agrupan.

## Sobre la privacidad

La página no muestra listados y solo presenta a la persona buscada, pero **es una página estática: `datos/voluntarios.json` (y `turnos.xlsx`, si lo subes) son archivos públicos que cualquiera con la URL podría descargar.** Si eso es un problema, no subas `turnos.xlsx` al repositorio y considera un repositorio/hosting con acceso restringido.
