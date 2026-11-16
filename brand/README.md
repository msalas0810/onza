# Identidad y assets

Los SVG trazan el logo raster aprobado; el único componente retirado del símbolo es la línea horizontal interior. El wordmark mantiene las formas originales, no depende de Inter y no declara una fuente de origen que desconocemos. Hay pequeñas tolerancias propias del trazado raster-vector, verificadas visualmente.

SVG transparentes, sin raster incrustado, con paths y fill-rule evenodd. Las variantes sin sufijo son grafito, las -white blancas. Para otro color, cambiar fill de los paths o usar inline SVG controlado por el componente BrandMark; en un img externo el color CSS del padre no recolorea el archivo.

No añadir fondos a los lockups. Solo app-icon/favicon tienen fondo. Los PNG de png/ se renderizan desde el mismo SVG: 192/512 para PWA y 180 para apple-touch-icon. Conservar relación de aspecto y clear space. En inline SVG, evitar IDs de title duplicados entre instancias: el componente genera un ID único o usa aria-label.

Inter Variable 4.1 se incluye desde su repositorio oficial, sin modificar, bajo OFL.txt. No incluir San Francisco/SF Pro redistribuido ni atribuirle al wordmark una tipografía no identificada. Licencia y SHA256 en fonts/README.md.
