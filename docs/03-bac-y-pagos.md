# BAC y pagos · condición de entrada a producción

## Conclusión de la revisión pública

BAC sigue siendo la primera entidad elegida para conversar. No se presenta su ecommerce genérico como compatible ni certificado para Onza. El contrato público F-CRI-0006171 V5 prohíbe en 3.11 Licores, Market Place y Facilitadores de Pago, y en 3.10 impide prestar la afiliación a terceros no afiliados. Obtener un producto/acuerdo escrito aplicable a nuestro caso es el primer requisito, antes de escoger un endpoint. [B1]

La web oficial explica que los manuales, llaves e identificadores se entregan después de contratar. Otra página oficial menciona certificación final por BAC. El material público no contiene un manual completo y único para nuestra integración. [B2-B3]

No existe evidencia pública revisada de que BAC imponga una carpeta de React, un framework, nombres de variables o una estructura universal de código. Los puntos de control son el modelo comercial admitido, requisitos del sitio, seguridad, protocolo del gateway asignado, pruebas y autorización de producción. La arquitectura de este kit es nuestra propuesta para cumplir y mantener el producto, no una arquitectura certificada por el banco.

## Procedimiento documentado por BAC

El glosario distingue autorización, captura y liquidación; esto no confirma su disponibilidad por API para nuestro acuerdo. La sección 9 exige políticas aceptadas en checkout, seguridad y validación de respuestas. Describe redirect y hash para Cardinal; no trasladar ese protocolo a otro gateway. La sección 10.2 prevé manual, pruebas validadas y permiso escrito antes de producción. La 3.13 fija un mes de integración en ese contrato. [B1]

El contrato publica TLS mínimo 1.2; la ayuda pide 1.3. Confirmar el requisito vigente. Las sugerencias antifraude de límites por IP/tarjeta deben acordarse para la barra: varios clientes pueden compartir Wi-Fi. No convertir una sugerencia en un bloqueo universal. [B1-B2]

## Matriz de trabajo

| Área | Incorporar desde el demo | Antes de dinero real |
| --- | --- | --- |
| Actividad y vendedor | venue/merchant separado en modelo, dinero simulado | BAC confirma alcohol, retiro presencial y plataforma multicomercio |
| Afiliación | MerchantConfigRef por bar; sin credenciales reales | Identidad/afiliación autorizada por negocio o acuerdo marketplace específico |
| Checkout | Identificar local, precio final, forma de retiro y políticas | Validación del texto y aceptación requerida en la integración contratada |
| Datos de tarjeta | No hay campos reales ni almacenamiento | Formulario/tokenización aprobados; alcance de responsabilidades PCI definido |
| Transporte | HTTPS en staging y producción | Compatibilidad TLS validada con manual; ayuda BAC pide TLS 1.3 |
| Autenticación de tarjeta | Simular estados approved/rejected/requires_action | 3DS/redirect y verificación de autenticidad exactamente según gateway |
| Hold y captura | Estados, adapter y pruebas de concurrencia | Confirmar APIs y permisos para autorizar, consultar, anular, capturar y devolver |
| Comunicación | Error/unknown/refetch y logs redactados | Validar firmas/hashes y origen del resultado según manual; no inventar webhooks |
| Devoluciones | Un registro auditable y escenario simulado | Flujo al método original y conciliación del producto contratado |
| Comisión Onza | Ledger informativo separado, sin pagos automáticos | Contrato define split o facturación separada; no asumir split con hold |
| Certificación | Pruebas propias no equivalen a aval | Evidencia bancaria, casos exigidos y autorización escrita de producción |

Las reglas de validación, RLS, idempotencia y anti-doble-cobro son diseño de ingeniería de Onza. No se atribuyen como una lista textual de requisitos BAC. Las identidades y políticas públicas se investigan en B2; las medidas antifraude en B4. Los logos de BAC, Visa y Mastercard se usan solo en la integración autorizada, desde archivos oficiales, sin inventar badges de certificación.

## Preguntas exactas para BAC

1. ¿Qué contrato/producto admite pedidos de bebidas alcohólicas con retiro presencial y una plataforma para varios establecimientos, dado lo que enumera el ecommerce público?
2. ¿Cada local debe afiliarse individualmente o existe un acuerdo de plataforma? ¿Onza puede operar técnicamente por cuenta del local con consentimiento?
3. ¿Cuál gateway y versión nos asignan? Entregar manual, credenciales sandbox, endpoints oficiales y casos de prueba.
4. ¿Podemos reservar el total en tarjeta, mantenerlo mientras preparan y capturar por API al validar el retiro? ¿Se admite con 3DS y tarjetas de débito?
5. ¿Cómo anular una reserva y consultar una captura cuyo resultado quedó desconocido? ¿Qué mecanismos de idempotencia/consulta ofrece el gateway?
6. ¿Qué caducidad, límites y tratamiento de cierres aplican? ¿Qué ocurre en cambios de fecha y pedidos cercanos al cierre nocturno?
7. ¿Podemos usar checkout alojado o tokenización sin que Onza maneje datos sensibles de tarjeta? ¿Qué evaluación o validación PCI corresponde a ese diseño?
8. ¿Puede separarse la comisión de Onza y liquidarse a distintos bares con este mismo flujo de autorización? Si no, ¿cómo recomiendan estructurarlo?
9. ¿Cuánto cuesta autorización, captura, consulta, anulación, devolución, token, intento rechazado, cierre y liquidación? ¿Qué cargos son por código/bar?
10. ¿Cómo se recibe soporte un sábado a la 1 a. m. y qué procedimiento existe para incidentes y conciliación?

No enviar esta consulta automáticamente. Es un guion listo para una conversación autorizada por el fundador, no una gestión realizada.

## Flujo de referencia de Onza

1. Backend valida local/carrito y crea pedido pendiente con snapshots.
2. Provider prepara autorización; el cliente completa interacción/3DS si corresponde.
3. Backend confirma autorización con evidencia verificable; recién entonces entra en cola.
4. Barra acepta, prepara y marca listo; no hay captura por marcar listo.
5. Backend valida retiro y realiza captura idempotente; confirma resultado.
6. Bartender entrega y confirma; se consume el token y queda auditoría.
7. Se concilia cobro, devolución y liquidación por separado. El dinero llega al bar según su contrato; nunca prometer depósito instantáneo al escanear.

Una excepción comercial no está concedida por un selector de configuración. `BAC_APPROVAL_REFERENCE` es evidencia administrativa controlada, no un permiso que una cadena cualquiera active por sí sola. El provider real permanece sin implementar hasta recibir el acuerdo y manual.

## Contrato de pagos

Ver `contracts/payment-provider.ts`. `MockPaymentProvider` simula approved, declined, requires_action, timeout/unknown, captura duplicada, anulación y devolución. No se simula un banco con nombres de APIs reales inventadas.

`BacPaymentProvider` será un adapter server-only. No tendrá implementation funcional ni URLs placeholder que parezcan reales. Debe lanzar ProviderNotConfigured hasta que se definan credenciales, protocolo y gate comercial. El frontend nunca elige merchant ni provider y nunca envía una comisión arbitraria al banco.

## Certificación y salida

La carpeta puede comenzar a implementarse hoy con simulación. Las pruebas de Onza son necesarias pero no suficientes para habilitar dinero real. La salida requiere aprobación comercial del caso, integration contract documentado, sandbox bancario aprobado, acceso por bar correcto, conciliación demostrada, política de incidencias, revisión de seguridad y autorización bancaria correspondiente. No publicar un checklist privado supuesto ni afirmar cumplimiento PCI por usar Supabase o HTTPS.

## Fuentes BAC

- B1: https://www.baccredomatic.com/sites/default/files/2024-07/cr_carga_de_terminos_condiciones_e-commerce.PDF — V5, cláusulas 3.10-3.11, página impresa 8 de 20; revisión del PDF público.
- B2: https://ayuda.baccredomatic.com/para_empresas_o_negocios/comercios_afiliados/e-commerce?country=es — requisitos y entrega de documentación por país.
- B3: https://www.baccredomatic.com/es-cr/empresas/soluciones-herramientas — integración a cargo del comercio y certificación final.
- B4: https://info.baccredomatic.com/medidas-seguridad — orientación antifraude pública.

Consulta inicial: 15 de noviembre de 2026; contrato contrastado de nuevo el 16. El contrato que BAC entregue al proyecto y las instrucciones del gateway aplicable serán la referencia operativa, no una estimación hecha desde páginas públicas.
