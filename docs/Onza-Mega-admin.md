# Mega admin (superadministrador) y panel de empresa

Estado: implementado y probado **en local**. Rama `feat/mega-admin`. Las migraciones 033–035 **no están aplicadas en ninguna base remota** (no se autorizó) y nada se desplegó.

## 1. Qué hay

| Pieza | Dónde |
| --- | --- |
| Operador único, segundo factor, auditoría | `supabase/migrations/202611280033_platform_operator.sql` |
| Empresas, estado de locales, membresías, invitaciones, clientes con seudónimo, RLS | `…0034_organizations.sql` |
| Funciones del panel de plataforma y del panel de empresa | `…0035_platform_rpc.sql` |
| Reversión de cada migración | `supabase/rollbacks/*.down.sql` (fuera de `migrations/` para que la CLI no las aplique hacia adelante) |
| Comprobación de cada petición, registro de denegaciones, inventario de rutas | `src/lib/platform/*`, `src/proxy.ts` |
| API del panel | `/api/platform-admin/{data,commands}` y, de empresa, `/api/panel/*` |
| Interfaz | `/admin/*` (plataforma) y `/panel/*` (empresa) |
| Alta de otro operador (solo por script) | `scripts/platform/add-operator.mjs` |
| Recorrido con navegador real | `scripts/verify-platform-local.mjs` |

### Decisiones sobre lo que ya existía

- **`/admin/[venueId]` ya era el administrador de un local.** El panel de plataforma usa `/admin`, `/admin/empresas`, etc. (segmentos estáticos) y convive con él: el administrador de un local es siempre un uuid. El proxy lo distingue.
- **La API usa `/api/platform-admin/*`** (el proyecto usa `/api`), no `/admin/api`.
- **`/admin/acceso` es la única ruta visible sin ser operador**: solo un formulario de inicio de sesión.
- **El acceso anterior por rol `onza` (`/onza`, `/api/onza`, `/api/platform`) no se tocó.** Cualquiera con una membresía de rol `onza` sigue entrando ahí. Está listado en el inventario como `legacy-onza` (ver §6).

## 2. Cómo se garantiza que solo entra un correo

Capas, de afuera hacia adentro. Todas tienen que dar el sí:

1. **Proxy** (`src/proxy.ts`): una ruta que no está en el inventario responde 404; para las páginas del panel decide si la cuenta es el operador y responde un **404 real** (no una página que dice «no encontrado» con estado 200). Solo al operador cuya sesión murió lo manda al inicio de sesión.
2. **Guard de la API** (`src/lib/platform/guard.ts`), en cada petición: la sesión se consulta al proveedor de autenticación (`getUser`, no se confía en el token) → correo verificado → la base decide.
3. **Base de datos** (`private.is_platform_operator()`): el correo del token (en minúsculas) debe ser igual al correo **vigente** de la cuenta, estar verificado en `auth.users` y ser el de la única fila de `private.platform_operators`. Si el correo cambia, el acceso se pierde solo.
4. **Cada función del panel** vuelve a llamar a `private.require_platform(...)` **antes de validar su entrada** (`private.gate` en la primera declaración): una cuenta ajena recibe `NOT_FOUND` con cualquier argumento, nunca un error de validación que delate la función.
5. **RLS** de las tablas globales (`platform_audit`, `organizations`, `org_memberships`, `venues`) usa la misma función.

La tabla de operadores no tiene permisos para nadie de la aplicación; un trigger impide insertar, cambiar o borrar filas salvo con el interruptor `onza.allow_operator_change`, que solo activa el script de operación dentro de su transacción.

### Segundo factor y sesión viva

- **Lectura sin segundo factor.** Toda **acción** (crear, editar, cambiar estado, borrar, invitar, suspender usuarios) exige un segundo factor (TOTP o llave) verificado en los **últimos 15 minutos** (claim `amr` con marca de tiempo). Si no: `REAUTH_REQUIRED` (401, solo para el operador). La interfaz pide el código, lo verifica con el proveedor y reintenta una vez.
- **Sesión revocada:** `SESSION_REVOKED` (401), pero **solo si el token muerto era del operador** (se pregunta a la base con la clave de servicio). Para cualquier otra cuenta, 404. Sin clave de servicio se cierra con 404.
- **Registro de denegaciones** (JSON por línea): `platform_access_denied` con IP, ruta, método, motivo e identificador de la petición. Nunca token, cookies, correo ni cuerpo (una prueba lo verifica).

## 3. Modelo de datos

- `organizations`: nombre, slug único, razón social, documento, país, moneda, contacto, notas, plan y funciones (etiquetas, **sin cobros**), `is_demo`, estado `active|suspended|closed`.
- `venues` (columnas nuevas): `organization_id`, `publication_status` (`draft|published|archived`), `suspended_*` (solo el operador la aplica), `service_modes` (consumo, retiro y entrega con zonas, tarifa y pedido mínimo), `brand_color`. «Visible en directorio» es el `demo_listed` existente; horarios = `hours`; preparación = `eta_minutes`. Los locales existentes quedan `published` y sin empresa: se ven igual.
- `org_memberships`: ocho roles (propietario, administrador, gerente de local, gerente de operaciones, caja, cocina, personal, analista) con alcance a uno o varios locales (los de la propia empresa, verificado por trigger).
- `org_invitations`: solo se guarda el **hash SHA-256** de un token de 256 bits; un solo uso; vencen a los 7 días; una pendiente por correo y empresa.
- Clientes por empresa: seudónimo `Cliente-XXXXXX` derivado con una **sal propia de cada empresa**; no hay correo ni identificador de cuenta en ninguna respuesta.
- `platform_audit`: solo inserción (trigger que bloquea update/delete incluso al dueño); lectura global solo del operador.
- Empresa o local suspendido, o no publicado, **no recibe pedidos nuevos** (trigger sobre `orders`; no se tocó `onza_command`).
- Las membresías de empresa se reflejan en `memberships` (modelo operativo existente) para que el administrador de cada local y la barra sigan funcionando sin cambios.

## 4. Interfaz (todo en español, trato de «usted»)

- **/admin**: resumen global (empresas, locales, pedidos y ventas del período, pedidos por día, actividad por empresa); **Nueva empresa** (asistente de 4 pasos: Empresa → Establecimiento → Administrador → Confirmación, con slug automático, validación de documento y teléfono por país, enlace del menú y QR); **Nuevo establecimiento**; **Empresas** (filtros por estado y demostración; detalle con datos, plan editable, invitaciones, pedidos recientes, inventario y **exportación CSV**; activar, suspender, desactivar y eliminar con confirmación y motivo); **Establecimientos** (filtros publicados / en directorio / pendientes / suspendidos / archivados; detalle con recepción de pedidos, actividad de 30 días, personal, enlace y QR; publicar, suspender, archivar y eliminar); **Usuarios** (miembros, consumidores, operadores); **Auditoría** con filtros por empresa y acción; **Seguridad** (activar el segundo factor).
- **/panel**: selector de empresa y de local según el rol, resumen, clientes (seudónimos), menú, horarios y modalidades de servicio, personal por invitación (invitar, reenviar, revocar, cambiar rol y locales) y activación de la invitación con **la contraseña que la persona elige**. El registro público sigue siendo solo de consumidores; ninguna empresa se crea ni se publica sola (el alta deja el local en borrador).

Países con validación de documento y teléfono: Costa Rica (cédula física, jurídica, DIMEX), Panamá, Guatemala, México, Colombia, Estados Unidos y España.

## 5. Criterios de aceptación y evidencia

| # | Criterio | Evidencia |
| --- | --- | --- |
| 1 | Una sola fila de operadores; no se agrega desde la interfaz | `tests/db/platform-operator.test.ts` (fila única, trigger, tabla sin permisos) |
| 2 | Correo verificado y coincidente (minúsculas); sin verificar se rechaza | idem (mayúsculas, sin verificar, invitado, sin correo, correo cambiado, token con otro correo) |
| 3 | Cualquier otra cuenta recibe 404 en todas las rutas | `tests/platform/guard.test.ts` (todas las vistas y acciones de la API) y `scripts/verify-platform-local.mjs` (10 rutas × 5 tipos de cuenta en un navegador real, 404 reales) |
| 4 | RLS usa la misma función; otra cuenta no lee ni escribe datos globales | `tests/db/organizations.test.ts`, `platform-operator.test.ts` |
| 5 | Tabla de operadores ilegible e inescribible para la aplicación | idem; `tests/db/audit-permissions.test.ts` |
| 6 | Si el correo cambia, el acceso se pierde | `platform-operator.test.ts` |
| 7 | Sin segundo factor solo lectura; acción sensible → `REAUTH_REQUIRED` (15 min) | `platform-operator.test.ts`, `platform-rpc.test.ts` (21 funciones), `guard.test.ts` |
| 8 | Sesión revocada → `SESSION_REVOKED` | `guard.test.ts` (también 404 para cuentas ajenas) |
| 9 | Registro de denegaciones sin token | `guard.test.ts` |
| 10 | Inventario de rutas con denegación por defecto | `tests/platform/route-inventory.test.ts` (recorre `src/app`; una ruta sin clasificar falla la prueba y el proxy la bloquea) |
| 11 | Alta atómica | `platform-rpc.test.ts` (si falla, no queda nada) |
| 12 | Aislamiento entre empresas y por alcance de locales | `platform-rpc.test.ts` (panel de empresa), `organizations.test.ts` |
| 13 | Invitaciones: hash, un solo uso, 7 días, correo verificado, revocar | `platform-rpc.test.ts` |
| 14 | Seudónimos sin correo ni identificador | `platform-rpc.test.ts` |
| 15 | Empresa/local suspendido no opera | `organizations.test.ts`, `platform-rpc.test.ts` |
| 16 | Cada migración con reversión probada | `tests/db/platform-rollback.test.ts` (baja, verifica, vuelve a subir; idempotente) |
| 17 | Funciones nuevas sin ejecución para el rol público | `audit-permissions.test.ts` (ampliada) |

Comandos: `npm run typecheck`, `npm run lint`, `npx vitest run`, y el recorrido con navegador (ver `scripts/verify-platform-local.mjs`).

## 6. Limitaciones y pendientes

1. **Migraciones no aplicadas en remoto.** Para activar el panel hay que aplicar 033–035 (con respaldo previo) y **asegurarse de que el correo `admin.choliempresas@gmail.com` exista y esté verificado** en el proveedor de autenticación. La reversión está en `supabase/rollbacks/`.
2. **Segundo factor:** se usa TOTP (gratis) del proveedor de autenticación; hay que tenerlo habilitado en el proyecto (no se cambió ninguna configuración de autenticación). El operador lo activa en `/admin/seguridad`. Hasta entonces el panel es de solo lectura.
3. **No hay servicio de correo propio:** las invitaciones se copian y se entregan a mano (el enlace se muestra una sola vez).
4. **Activar una invitación o suspender/eliminar usuarios necesita la clave de servicio** en el servidor (`SUPABASE_SERVICE_ROLE_KEY`). Production de Vercel no la tiene (PEN-014): allí esas acciones responden «no está configurado».
5. **Editor de menú y plano:** el panel de plataforma muestra el menú y el plano en **solo lectura**. La edición la hace el administrador del propio local (`/admin/<uuid>`), al que las personas de la empresa llegan desde `/panel/menu`. Que el operador edite directo exigiría extender `private.is_staff` y el proxy; queda para una etapa aparte.
6. **Acceso `onza` anterior:** `/onza` y sus API siguen abiertos a cualquier membresía con rol `onza` (incluida la cuenta demo). Cumple el pedido solo para el panel nuevo; para que **ningún** otro acceso global exista hay que decidir si se retira o se unifica con el operador único.
7. **Limitación de intentos:** el endpoint público de activación de invitaciones no tiene límite propio (el token de 256 bits lo hace inviable de adivinar). Conviene una regla de límite en Cloudflare.
8. **Locales anteriores sin empresa:** los locales existentes no tienen empresa asignada; el resumen lo avisa. Asignarlos es un trabajo de datos que no se hizo.
9. **Plan y funciones** son etiquetas: no hay cobros ni integración de facturación.
10. **Moneda:** el modelo guarda la moneda de la empresa, pero los pedidos solo admiten colones (restricción previa).
