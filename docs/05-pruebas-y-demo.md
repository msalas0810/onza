# Pruebas y demo

## Datos del demo

Dos locales ficticios activos (Sala Norte y Patio Central), un local cerrado (Club Cero), 6 productos por local activo, un producto agotado y precios CRC finales. Semillas no se presentan como locales afiliados reales. Configuración reutilizable en fixtures/demo-data.json; el seed final la importa sin datos personales.

Un cliente invitado normal, cliente-2, bartender de cada local, admin del local y acceso de Onza restringido. Si se usan alias y passwords sencillos, solo en entorno privado de demo y sin dinero real. Para compartir públicamente usar accesos seguros o controles de acceso a la demo.

## Guion de demostración, 3-5 minutos

1. Abrir cliente en iPhone/perfil A y barra en tablet/perfil B. Admin en una tercera sesión opcional. Verificar local seleccionado y entorno DEMO.
2. Cliente abre Sala Norte, mira fotografías/fallback y agrega dos productos; muestra total final. Cambiar a oscuro conserva estado.
3. Checkout: activar sonido si se desea y simular reserva aprobada. Aparece pedido recibido; no “pagado”.
4. Bartender acepta; cliente ve Preparando. Refrescar cliente demuestra persistencia.
5. Bartender marca Listo. Cliente ve el ticket con aviso; tono solo si habilitado/soportado. No presentar como garantía con pantalla bloqueada.
6. Bartender escanea QR o introduce código; se confirma captura simulada. Entrega físicamente de forma representada y confirma.
7. Repetir escaneo: muestra entregado y no crea otra operación financiera.
8. Administrador ve el pedido entregado, unidades y cobro en sus métricas. Abrir otro local demuestra aislamiento.

## Escenarios mínimos de aceptación

| ID | Escenario | Resultado exigido |
| --- | --- | --- |
| V01 | Claro/oscuro + contraste | Todos los componentes, focos y errores legibles, sin colores sueltos |
| V02 | 360 px / zoom 200% / teclado | Nada esencial cortado ni oculto; navegación accesible |
| V03 | Reduced motion | Información completa sin desplazamientos innecesarios |
| C01 | Doble submit mismo key | Un solo pedido y una sola autorización |
| C02 | Misma key con otro carrito | Conflicto explícito, no reutilización incorrecta |
| C03 | Precio cambia / agotado | Revalidación server y confirmación nueva; no cargo sorpresa |
| C04 | Local pausado/cerrado | No acepta nuevos pedidos, conserva los existentes |
| P01 | Autorización rechazada | No entra a cola; reintento explícito |
| P02 | Autorización requiere acción | Estado pending hasta evidencia de resultado, sin aceptar prematuramente |
| P03 | Timeout de captura después de éxito | Consulta y reconciliación; una captura total |
| P04 | Dos bartenders capturan | Mismo operation ID/result; no doble cobro |
| P04b | Dos dispositivos intentan entregar | Un solo claim de sesión habilita entrega; el otro no muestra permiso de handoff |
| P04c | Se corta tras entregar físicamente | Supervisor verifica el hecho antes de transferir/resolver claim; no entrega automática nueva |
| P04d | Se pierde referencia al autorizar | Lookup por operation/key o unknown controlado; ninguna nueva autorización ciega |
| P05 | Aceptar y cancelar compiten | Una transición gana y la otra ve estado actualizado |
| P06 | Anular y capturar compiten | Exclusión mutua y resolución de unknown antes de otra operación |
| P07 | Cobrado sin completar entrega | Incidencia recuperable, sin recobrar ni expirar como no cobrado |
| Q01 | QR ajeno/vencido/alterado | Rechazo sin filtrar información de otro negocio |
| Q02 | QR ya consumido | Estado entregado, ninguna nueva captura |
| Q03 | Cámara denegada / unsupported | Código manual disponible; limpio cierre de stream |
| A01 | Cliente lee pedido de otro UID | Denegado en DB y backend |
| A02 | Staff modifica otro venue | Denegado aunque manipule URL/body |
| A03 | Invitado intenta rol admin | Denegado; authenticated no concede privilegios |
| A04 | Cliente altera total/status | Rechazado o recalculado; ninguna escritura sensible directa |
| N01 | Refrescar estando Listo | Estado correcto, no repetición abusiva de audio |
| N02 | Safari bloqueado/silencio | No se promete alerta; al volver se sincroniza |
| N03 | Conexión cae y vuelve | Indicador y refetch; no pedido duplicado |
| D01 | Pedido listo no recogido | Cierre uncollected y void_pending/voided, sin cobrar penalidad |
| D02 | Métricas cruzan medianoche | business_date y filtro de turno consistentes |
| D03 | Producto cambia después de pedir | Historial conserva nombre/precio snapshot |
| S01 | Secrets/bank payloads | No aparecen en bundle, logs, QR, fixtures o repositorio |

## Niveles de prueba

Dominio: tests de estados, montos, deadlines e idempotencia. Integración: transacciones/constraints/RLS usando sesiones de distintos roles y concurrencia real. E2E: recorrido y errores críticos en navegador. Visual: capturas con viewport/tema constantes y comparación humana. Dispositivo: Safari iPhone y Chrome Android reales para cámara, permisos, audio, safe area y retorno de foreground.

Los presupuestos de rendimiento del documento 02 son objetivos; reportar mediciones, dispositivo y conexión. No convertir un Lighthouse local en promesa de rapidez universal. Las pruebas físicas de vibración y push no se reemplazan por mocks de navigator.

## Condición para compartir el demo

Pantalla DEMO discreta y visible; cero tarjetas reales; datos ficticios; acceso controlado a roles privilegiados. Un reset solo server-side y autenticado elimina exclusivamente datos de ese proyecto demo, con confirmación y sin afectar un entorno real. Documentar qué funciona y qué está simulado. No ocultar un fallo de persistencia con animación local.

## Condición para piloto con dinero

Contrato/proveedor aprobado para alcohol y varios negocios, credenciales y gateway oficiales, evaluación de seguridad aplicable, pruebas bancarias, notificaciones fuera de la pestaña si se prometen, estación de retiro, verificación de edad presencial, soporte nocturno y conciliación. Son pendientes operativos, no capacidades ya incluidas en este paquete.
