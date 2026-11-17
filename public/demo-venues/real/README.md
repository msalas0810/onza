# Portadas y logos de locales reales

Esta carpeta está **vacía a propósito**: al preparar el demo no se pudo descargar ninguna imagen de fuente verificable
(la red del entorno bloqueó Wikimedia y los sitios de los locales) y no se inventan fotos ni logos.

Cómo agregar una imagen:

1. Copiá el archivo acá (`<slug>-cover.jpg` para la portada 16:9, `<slug>-logo.png` para el logo cuadrado).
2. Agregá una entrada a `SOURCES.json` con `file`, `venue`, `kind` (`cover` o `logo`), `source_url`, `license`,
   `author`, `retrieved_on` y, si lo exige la licencia, la atribución.
3. Ejecutá `npm run demo:seed-real-venues`. El seed solo usa archivos con entrada en `SOURCES.json`.

Los locales sin imagen se muestran con su monograma compacto. Esto no implica autorización ni relación comercial con
los locales; la revisión de permisos es un pendiente previo al lanzamiento.
