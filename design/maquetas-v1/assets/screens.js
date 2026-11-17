/* Onza V1 · pantallas y recorridos de las maquetas.
   Cada pantalla declara los componentes que usa (correspondencia con la app en GUIA.md §5). */
(function () {
  "use strict";
  const S = window.OnzaStore;
  const U = window.OnzaUI;
  const { esc, money, ico, btn, field, input, seg, toggle, badge, notice, sheet } = U;
  const app = document.getElementById("app");
  const layer = document.getElementById("layer");
  const params = new URLSearchParams(location.search);
  const ui = { sheet: null, notices: {}, errors: {}, busy: false, justAdded: null, bump: false, pickupResult: null, cardErrors: {}, seen: null, prevStatus: {}, readyFlash: null, saved: {}, form: {}, addResult: null };

  /* ---------- Preferencias del marco (tema, movimiento, fondo) ---------- */
  function applyPrefs() {
    const f = S.frame.get();
    const root = document.documentElement;
    if (f.theme === "light" || f.theme === "dark") root.dataset.theme = f.theme; else delete root.dataset.theme;
    if (f.motion === "reduce") root.dataset.motion = "reduce"; else delete root.dataset.motion;
    if (f.bg === "white") root.dataset.bg = "white"; else delete root.dataset.bg;
  }
  const reducedMotion = () => S.frame.get().motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Sesión de revisión: ?rol= inicia una cuenta de la maqueta ---------- */
  const DEMO_ROLES = {
    cliente: () => S.signInCustomer("maria@correo.demo"),
    empleado: () => S.signInStaff("jorge@equipo.demo"),
    admin: () => S.signInStaff("ana@equipo.demo"),
    nuevo: () => S.signInStaff("luis@equipo.demo"),
  };
  // Si la cuenta ya no puede entrar (p. ej. se le quitó el acceso), el marco queda sin sesión.
  if (params.get("rol") && !S.session() && DEMO_ROLES[params.get("rol")]) { try { DEMO_ROLES[params.get("rol")](); } catch (e) { /* sin sesión */ } }

  /* ---------- Enrutador ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, query] = raw.split("?");
    return { path, parts: path.split("/").filter(Boolean), q: new URLSearchParams(query || "") };
  }
  const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  const CUSTOMER = /^\/(explorar|local|carrito|checkout|confirmado|pedido|pedidos|cuenta)(\/|$)/;
  const STAFF = /^\/(equipo\/locales|equipo\/clave|barra|admin)(\/|$)/;
  const CUSTOMER_ENTRY = /^\/(acceso|confirmar|recuperar|restablecer)(\/|$)/;

  /* Misma política que src/lib/access-policy.ts, más sesión vencida y cambio de clave. */
  function decide(path, full, isNavigation) {
    const f = S.frame.get();
    const s = f.session;
    const here = encodeURIComponent(full);
    if (path === "/") return s ? (s.kind === "staff" ? "/equipo/locales" : "/explorar") : "/acceso";
    // Como el proxy: solo una navegación con sesión vencida redirige; una acción abre la hoja de reingreso.
    if (isNavigation && s && f.expired && (CUSTOMER.test(path) || STAFF.test(path) || path === "/onboarding"))
      return s.kind === "staff" ? `/equipo/acceso?next=${here}&vencida=1&email=${encodeURIComponent(s.email)}` : `/acceso/correo?next=${here}&vencida=1&email=${encodeURIComponent(s.email)}`;
    if (path === "/onboarding") {
      if (!s) return "/acceso";
      if (s.kind === "staff") return "/sesion-activa?want=cliente";
      return s.onboarded ? "/explorar" : null;
    }
    if (CUSTOMER.test(path)) {
      if (!s) return `/acceso?next=${here}`;
      if (s.kind === "staff") return `/sesion-activa?want=cliente&next=${here}`;
      if (!s.onboarded) return `/onboarding?next=${here}`;
      return null;
    }
    if (STAFF.test(path)) {
      if (!s) return `/equipo/acceso?next=${here}`;
      if (s.kind === "customer") return "/sesion-activa?want=equipo";
      if (path !== "/equipo/clave" && S.memberships(s.email).some((m) => m.mustChange)) return "/equipo/clave";
      return null;
    }
    if (CUSTOMER_ENTRY.test(path) && s && !f.expired) {
      if (s.kind === "staff") return "/sesion-activa?want=cliente";
      return s.onboarded ? "/explorar" : "/onboarding";
    }
    if (path === "/equipo/acceso" && s && !f.expired) return s.kind === "customer" ? "/sesion-activa?want=equipo" : staffHome(s.email);
    if (path === "/sesion-activa" && !s) return "/acceso";
    return null;
  }
  function staffHome(email) {
    const list = S.memberships(email);
    if (list.some((m) => m.mustChange)) return "/equipo/clave";
    if (list.length === 1) return `/barra/${list[0].venue}`;
    return "/equipo/locales";
  }
  const safeNext = (v, fallback) => (v && v.startsWith("/") && !v.startsWith("//") ? v : fallback);

  /* ---------- Shells ---------- */
  function customerShell(body, meta) {
    const w = S.world();
    const f = S.frame.get();
    const c = S.cart();
    const totals = S.cartTotals(c);
    const { path } = parseHash();
    const nav = [["/explorar", "Explorar", "compass"], ["/pedidos", "Pedidos", "receipt"], ["/cuenta", "Cuenta", "user"]];
    const cur = (p) => (path.startsWith(p) || (p === "/explorar" && path.startsWith("/local")) ? 'aria-current="page"' : "");
    const offline = f.offline ? U.banner("offline", "Sin conexión. Mostramos lo último que cargamos; no se puede pedir hasta reconectar.") : "";
    const dockHtml = meta.dock && c && c.venue === meta.dock && totals.count ? U.dock(w.venues[c.venue], totals, ui.bump) : "";
    return `<header class="hdr"><a class="brand" href="#/explorar" aria-label="Onza, explorar">${U.wordmark()}</a>
      <nav class="topnav" aria-label="Principal">${nav.map(([h, l]) => `<a href="#${h}" ${cur(h)}>${l}</a>`).join("")}</nav>
      <span class="spacer"></span><span class="demo-chip">Demo · sin dinero real</span>
      ${c && totals.count ? `<a class="icon-btn" href="#/carrito" aria-label="Carrito de ${esc(w.venues[c.venue].name)}: ${totals.count} productos">${ico("bag")}<span class="count num">${totals.count}</span></a>` : ""}</header>
      ${offline}<main id="main" class="page ${meta.width || ""} ${dockHtml ? "has-dock" : ""}">${body}</main>${dockHtml}
      <nav class="bnav" aria-label="Principal">${nav.map(([h, l, i]) => `<a href="#${h}" ${cur(h)}>${ico(i)}${l}</a>`).join("")}</nav>`;
  }
  function staffShell(body, meta) {
    const f = S.frame.get();
    const s = f.session;
    const w = S.world();
    const m = meta.venue ? S.memberships(s.email).find((x) => x.venue === meta.venue) : null;
    const venue = meta.venue ? w.venues[meta.venue] : null;
    const role = m ? (m.role === "admin" ? "Administrador" : "Empleado") : "";
    const offline = f.offline ? U.banner("offline", "Sin conexión. Las acciones quedan pausadas hasta reconectar; nada se envía a ciegas.") : "";
    const sound = meta.sound ? `<button class="icon-btn" data-act="sound" aria-pressed="${!!f.sound}" aria-label="Sonido de pedidos nuevos: ${f.sound ? "activado" : "desactivado"}" title="Sonido">${ico(f.sound ? "volume" : "volumeOff")}</button>` : "";
    const many = S.memberships(s.email).length > 1;
    return `<header class="shdr"><a class="brand" href="#${many ? "/equipo/locales" : venue ? "/barra/" + venue.slug : "/equipo/locales"}" aria-label="Onza equipo">${U.wordmark()}<span class="tag eyebrow">Equipo</span></a>
      ${venue ? `<span class="sep opt"></span><div class="who"><strong>${esc(venue.name)}</strong><span>${esc(s.name)} · ${role}</span></div>` : `<span class="sep opt"></span><div class="who"><strong>${esc(s.name)}</strong><span>${esc(s.email)}</span></div>`}
      <span class="grow"></span>${sound}${many && venue ? `<a class="btn quiet sm wide-only" href="#/equipo/locales">Cambiar de local</a>` : ""}
      <button class="btn secondary sm" data-act="logout" data-to="/equipo/acceso" aria-label="Salir">${ico("out", "sm")}<span class="label hide-sm">Salir</span></button></header>
      ${offline}<main id="main" class="page ops">${body}</main>`;
  }
  function accessShell(body, opts = {}) {
    return `<main id="main" class="access"><span class="bg-note">En la app: fondo Particle Wave original</span><div class="inner">
      <div class="lockup"><img class="shot" src="assets/brand/onza-shot-white.svg" alt=""><img class="word" src="assets/brand/onza-wordmark-white.svg" alt="onza">${opts.tag ? `<span class="eyebrow" style="color:inherit;opacity:.7">${esc(opts.tag)}</span>` : ""}</div>${body}</div></main>`;
  }
  function plainShell(body) {
    return `<header class="hdr"><span class="brand">${U.wordmark()}</span><span class="spacer"></span><span class="demo-chip">Demo · sin dinero real</span></header><main id="main" class="page">${body}</main>`;
  }

  /* ---------- Pantallas de acceso ---------- */
  const SCREENS = {};
  SCREENS.acceso = () => ({
    shell: "access", title: "Acceso", components: ["Particle Wave (app)", "Button", "Lockup"],
    html: `<h1>Tu próxima ronda.<br>Sin perderte la noche.</h1><p class="sub">Pedí tus tragos. Recogé en la barra.</p>
      <div class="stack tight">
        <button class="btn inverse block" data-act="google">${U.GOOGLE}<span class="label">Continuar con Google</span></button>
        <button class="btn secondary block" disabled aria-describedby="apple-soon">${ico("apple")}<span class="label">Continuar con Apple</span><span class="t-caption" id="apple-soon" style="margin-left:auto">Próximamente</span></button>
        <a class="btn secondary block" href="#/acceso/correo${parseHash().q.get("next") ? "?next=" + encodeURIComponent(parseHash().q.get("next")) : ""}">${ico("mail")}<span class="label">Continuar con correo</span></a>
      </div>
      <p class="muted" style="text-align:center">¿Sos personal? <a href="#/equipo/acceso">Entrá por acá ↗</a></p>
      <p class="hint" style="text-align:center">DEMO · sin dinero real · <a href="#/acceso/referencia">ver acceso real</a></p>`,
  });
  SCREENS["acceso/referencia"] = () => ({
    shell: "customerPlain", title: "Acceso real", components: [],
    html: `<div class="access-ref"><a class="back" href="#/acceso">${ico("left", "sm")}Volver</a><h1 class="t-title">Acceso aprobado (capturas de la app)</h1>
      <p class="muted">La maqueta no recrea el fondo. Estas son capturas de <code>/acceso</code> con Particle Wave original, comprobadas en el Preview (D-2026-11-17-04).</p>
      <img src="assets/acceso/access-mobile.png" alt="Acceso en teléfono" style="max-width:360px"><img src="assets/acceso/access-desktop.png" alt="Acceso en escritorio"></div>`,
  });
  SCREENS["acceso/correo"] = () => {
    const { q } = parseHash();
    const mode = ui.form.authMode || q.get("modo") || "ingresar";
    const e = ui.errors;
    const email = ui.form.email ?? q.get("email") ?? "";
    return {
      shell: "access", title: mode === "crear" ? "Crear cuenta" : "Ingresar", components: ["SegmentedControl", "Field", "Button", "Notice"],
      html: `${q.get("vencida") ? `<div class="notice warning" role="status">${ico("clock")}<div><strong>Tu sesión venció</strong>Volvé a entrar para seguir donde estabas. Tu carrito se guardó.</div></div>` : ""}
        ${ui.notices.auth ? notice("success", "", ui.notices.auth) : ""}
        ${seg("authMode", [["ingresar", "Ingresar"], ["crear", "Crear cuenta"]], mode, 'aria-label="Modo" style="width:100%"')}
        <form class="stack" data-form="${mode === "crear" ? "signup" : "login"}" novalidate>
          ${field("email", "Correo", input("email", `type="email" autocomplete="email" value="${esc(email)}" required`, e.email), "", e.email)}
          ${field("password", "Contraseña", input("password", `type="password" autocomplete="${mode === "crear" ? "new-password" : "current-password"}" required`, e.password), mode === "crear" ? "Al menos 10 caracteres." : "", e.password)}
          ${e.form ? `<p class="field-error" role="alert">${ico("alert", "sm")}${e.form}</p>` : ""}
          ${btn(mode === "crear" ? "Crear cuenta" : "Ingresar", "inverse block", `type="submit" ${ui.busy ? 'aria-busy="true"' : ""}`)}
        </form>
        ${mode === "ingresar" ? `<a class="btn quiet" href="#/recuperar" style="justify-self:center">¿Olvidaste tu contraseña?</a>` : `<p class="hint" style="text-align:center">Te vamos a enviar un correo para confirmar la cuenta.</p>`}
        <a class="back" href="#/acceso" style="justify-self:center">${ico("left", "sm")}Otras opciones</a>
        <p class="hint" style="text-align:center">Maqueta: maria@correo.demo entra con cualquier contraseña.</p>`,
    };
  };
  SCREENS.confirmar = () => {
    const email = parseHash().q.get("email") || "tu correo";
    const limited = ui.form.resent;
    return {
      shell: "access", title: "Confirmá tu correo", components: ["Notice", "Button"],
      html: `<h1>Revisá tu correo</h1><p class="sub">Te enviamos un enlace a <strong>${esc(email)}</strong>. Abrilo en este dispositivo para seguir.</p>
        <div class="stack tight">${btn("Ya confirmé (simular enlace)", "inverse block", `data-act="confirm-link" data-email="${esc(email)}"`)}
        ${btn(limited ? "Reenviar en 60 s" : "Reenviar correo", "secondary block", `data-act="resend" ${limited ? "disabled" : ""}`)}
        ${limited ? `<p class="hint" style="text-align:center">Enviamos otro. Para evitar abusos, esperá un minuto antes de pedir uno nuevo.</p>` : ""}
        <a class="btn quiet block" href="#/acceso/correo?modo=crear">Usar otro correo</a></div>`,
    };
  };
  SCREENS.recuperar = () => ({
    shell: "access", title: "Recuperar contraseña", components: ["Field", "Button", "Notice"],
    html: ui.form.recoverSent
      ? `<h1>Revisá tu correo</h1><p class="sub">Si hay una cuenta con ese correo, te llega un enlace para crear una contraseña nueva.</p>
        <a class="btn inverse block" href="#/restablecer">Abrir enlace (simulado)</a><a class="btn quiet block" href="#/restablecer?vencido=1">Ver enlace vencido</a><a class="back" href="#/acceso/correo" style="justify-self:center">${ico("left", "sm")}Volver a ingresar</a>`
      : `<h1>Recuperar contraseña</h1><p class="sub">Te enviamos un enlace a tu correo.</p>
        <form class="stack" data-form="recover" novalidate>${field("email", "Correo", input("email", 'type="email" autocomplete="email" required', ui.errors.email), "", ui.errors.email)}${btn("Enviar enlace", "inverse block", 'type="submit"')}</form>
        <a class="back" href="#/acceso/correo" style="justify-self:center">${ico("left", "sm")}Volver</a>`,
  });
  SCREENS.restablecer = () => {
    const expired = parseHash().q.get("vencido");
    return {
      shell: "access", title: "Nueva contraseña", components: ["Field", "Button", "ErrorState"],
      html: expired
        ? `<h1>El enlace venció</h1><p class="sub">Por seguridad, cada enlace sirve una vez y por poco tiempo.</p><a class="btn inverse block" href="#/recuperar">Pedir uno nuevo</a>`
        : `<h1>Creá una contraseña nueva</h1><form class="stack" data-form="reset" novalidate>
          ${field("pw", "Contraseña nueva", input("pw", 'type="password" autocomplete="new-password"', ui.errors.pw), "Al menos 10 caracteres.", ui.errors.pw)}
          ${field("pw2", "Repetir contraseña", input("pw2", 'type="password" autocomplete="new-password"', ui.errors.pw2), "", ui.errors.pw2)}
          ${btn("Guardar", "inverse block", 'type="submit"')}</form>`,
    };
  };
  SCREENS.onboarding = () => {
    const s = S.session();
    const e = ui.errors;
    const v = ui.form;
    return {
      shell: "plain", title: "Completá tu perfil", components: ["Field", "Toggle", "Button"],
      html: `<div class="page-head"><p class="eyebrow">Último paso</p><h1 class="t-title">Completá tu perfil</h1></div>
        <form class="stack" data-form="onboarding" novalidate>
          ${field("name", "Nombre", input("name", `autocomplete="name" value="${esc(v.name ?? s.name ?? "")}"`, e.name), "", e.name)}
          ${field("username", "Usuario", `<div class="search"><span class="ico" style="left:16px;stroke:none;font-weight:600;width:auto;height:auto">@</span>${input("username", `autocomplete="username" value="${esc(v.username || "")}" style="padding-left:36px"`, e.username)}</div>`, "Único. Lo ve el equipo del local cuando retirás.", e.username)}
          ${field("phone", "Teléfono", `<div class="row" style="gap:8px"><select class="input" style="width:112px" aria-label="Código de país"><option>+506</option><option>+1</option><option>+52</option></select>${input("phone", `type="tel" autocomplete="tel-national" value="${esc(v.phone || "")}"`, e.phone)}</div>`, "No lo verificamos. Solo queda en tu cuenta.", e.phone)}
          ${field("birth", "Fecha de nacimiento", input("birth", `type="date" value="${esc(v.birth || "")}"`, e.birth), "Tenés que ser mayor de 18. Es una declaración, no una verificación.", e.birth)}
          <label class="toggle"><input type="checkbox" id="terms" ${v.terms ? "checked" : ""} ${e.terms ? 'aria-invalid="true"' : ""}><span class="grow t-label" style="font-weight:400">Acepto las <a href="#/onboarding">condiciones</a> y la <a href="#/onboarding">política de privacidad</a> (borrador · versión 2026-11)</span></label>
          ${e.terms ? `<span class="field-error">${ico("alert", "sm")}${e.terms}</span>` : ""}
          <div class="stack tight"><p class="t-label">Avisos opcionales</p>${toggle("news", "Novedades de Onza", false)}${toggle("offers", "Ofertas de mis locales favoritos", false)}</div>
          ${btn("Continuar", "primary block", 'type="submit"')}
        </form>`,
    };
  };
  SCREENS["sesion-activa"] = () => {
    const s = S.session();
    const want = parseHash().q.get("want");
    const staff = s.kind === "staff";
    return {
      shell: "plain", title: "Sesión iniciada", components: ["Panel", "Button"],
      html: `<div class="page-head"><h1 class="t-title">Ya hay una sesión iniciada</h1></div>
        <div class="panel row" style="margin-bottom:16px"><span class="mono">${esc((s.name || s.email)[0].toUpperCase())}</span><div class="grow"><strong>${esc(s.name || s.email)}</strong><div class="muted t-label" style="font-weight:400">${staff ? "Cuenta del equipo" : "Cuenta personal"} · ${esc(s.email)}</div></div></div>
        <p class="muted" style="margin-bottom:24px">${staff && want !== "equipo" ? "Esta cuenta es del equipo y no puede pedir." : !staff && want === "equipo" ? "Esta cuenta es personal y no tiene acceso al equipo." : ""}</p>
        <div class="stack tight"><a class="btn primary block" href="#${staff ? staffHome(s.email) : "/explorar"}">${staff ? "Continuar al espacio del equipo" : "Continuar a Explorar"}</a>
        ${btn("Usar otra cuenta", "secondary block", `data-act="logout" data-to="${want === "equipo" ? "/equipo/acceso" : "/acceso"}"`)}</div>
        <p class="hint" style="margin-top:16px">Nada se cierra solo: la sesión actual sigue hasta que elijas otra cuenta.</p>`,
    };
  };

  /* ---------- Cliente ---------- */
  SCREENS.explorar = () => {
    const w = S.world();
    const f = S.frame.get();
    const view = f.view || "normal";
    const term = (ui.form.search || "").trim().toLowerCase();
    let venues = Object.values(w.venues);
    if (term) venues = venues.filter((v) => (v.name + " " + v.zone).toLowerCase().includes(term));
    const loc = f.location;
    const rank = { open: 0, paused: 1, closed: 2 };
    const byAvail = (a, b) => rank[a.openState] - rank[b.openState] || a.name.localeCompare(b.name);
    const byDist = (a, b) => rank[a.openState] - rank[b.openState] || a.demoDistanceM - b.demoDistanceM;
    const sorted = venues.slice().sort(loc === "granted" ? byDist : byAvail);
    const active = sorted.filter((v) => v.openState !== "closed");
    const closed = sorted.filter((v) => v.openState === "closed");
    const locCtrl = loc === "granted"
      ? `<div class="row wrap"><span class="chip" aria-current="true">${ico("pin", "sm")}&nbsp;Ubicación activa</span><span class="muted t-label" style="font-weight:400">Ordenado por cercanía · distancias simuladas en maqueta</span></div>`
      : loc === "denied"
        ? notice("warning", "Sin ubicación", "Ordenamos por disponibilidad. Podés activarla en los permisos del navegador.", btn("Reintentar", "secondary sm", 'data-act="location"'))
        : `<div class="row wrap">${btn("Usar mi ubicación", "secondary sm", 'data-act="location"', "pin")}<span class="muted t-label" style="font-weight:400">Ordenado por disponibilidad</span></div>`;
    let body;
    if (view === "cargando") body = U.skeletonCards(3);
    else if (view === "error") body = U.errorState("No pudimos cargar los locales", "Revisá tu conexión y probá de nuevo.", btn("Reintentar", "secondary", 'data-act="view" data-value="normal"', "refresh"));
    else if (view === "vacio" || (term && !venues.length)) body = U.emptyState(`Sin resultados${term ? ` para “${esc(ui.form.search)}”` : ""}`, "Probá con otro nombre o barrio.", btn("Borrar búsqueda", "secondary", 'data-act="clear-search"'), "search");
    else {
      const featured = loc === "granted" && active[0] ? active[0] : null;
      const rest = featured ? active.slice(1) : active;
      body = `${featured ? `<h2 class="eyebrow section-label">Más cerca</h2>${U.venueCard(featured, { withDistance: true })}` : ""}
        ${rest.length ? `<h2 class="eyebrow section-label">${featured ? "Otros abiertos" : "Abiertos"}</h2><div class="vgrid three">${rest.map((v) => U.venueCard(v, { withDistance: loc === "granted" })).join("")}</div>` : ""}
        ${closed.length ? `<h2 class="eyebrow section-label">Cerrados</h2><div>${closed.map((v) => U.venueRow(v, { withDistance: loc === "granted" })).join("")}</div>` : ""}`;
    }
    return {
      shell: "customer", width: "explore", title: "Explorar", components: ["AppShell", "PageHeader", "SearchField", "VenueCard", "VenueRow", "StatusBadge", "EmptyState", "ErrorState", "Skeleton", "ConnectionBanner"],
      html: `<div class="page-head"><h1 class="t-display">Explorar</h1></div>
        <div class="stack"><div class="search">${ico("search")}<input class="input" type="search" id="search" data-input="search" placeholder="Buscar local o barrio" aria-label="Buscar local o barrio" value="${esc(ui.form.search || "")}"></div>${locCtrl}</div>
        ${body}<p class="hint" style="margin-top:48px">Locales reales con datos de demo: menús, precios y horarios simulados. Sin relación comercial con Onza.</p>`,
    };
  };
  SCREENS.local = (parts) => {
    const w = S.world();
    const v = w.venues[parts[1]];
    if (!v) return { shell: "customer", title: "No encontrado", html: U.errorState("No encontramos este local", "", `<a class="btn secondary" href="#/explorar">Volver a Explorar</a>`) };
    const products = Object.values(w.products).filter((p) => p.venue === v.slug);
    const c = S.cart();
    const readOnly = v.openState === "closed";
    const p1 = S.frame.get().p1;
    const menu = v.categories.map((cat, ci) => {
      const list = products.filter((p) => p.cat === ci);
      if (!list.length) return "";
      return `<section id="cat-${ci}" aria-labelledby="h-cat-${ci}" style="scroll-margin-top:72px"><h2 class="eyebrow section-label" id="h-cat-${ci}">${esc(cat)}</h2>
        ${list.map((p) => U.productRow(p, { qty: c && c.venue === v.slug ? S.cartQty(p.id) : 0, justAdded: ui.justAdded === p.id, blocked: readOnly ? "Local cerrado" : "" })).join("")}</section>`;
    }).join("");
    let state = "";
    if (v.openState === "paused") state = notice("warning", "Pedidos pausados", "Podés armar tu ronda. Vas a poder pedir cuando el local reanude.");
    if (readOnly) state = notice("", "Cerrado", `${v.hours}. Tus pedidos anteriores siguen en Pedidos.`, `<a class="btn secondary sm" href="#/pedidos">Ver mis pedidos</a>`);
    return {
      shell: "customer", width: "menu", dock: v.slug, title: v.name, components: ["VenueHero", "VenueMedia", "StatusBadge", "Notice", "CategoryChips", "ProductRow", "QuantityStepper", "CartDock", "Sheet (detalle / reemplazar carrito)"],
      html: `<a class="back" href="#/explorar">${ico("left", "sm")}Explorar</a>${U.venueHero(v)}${state}
        ${!readOnly || p1 ? `<nav class="chips" aria-label="Categorías" style="margin:24px -16px 0">${v.categories.map((cat, ci) => `<a class="chip" href="#/local/${v.slug}" data-act="scroll" data-target="cat-${ci}">${esc(cat)}</a>`).join("")}</nav>${menu}` : ""}
        ${readOnly && !p1 ? `<p class="hint" style="margin-top:16px">Propuesta P-1 (pendiente): mostrar el menú en solo lectura. Activala desde Revisión.</p>` : ""}`,
    };
  };
  function cartIssues(c) {
    const w = S.world();
    const out = {};
    if (!c) return out;
    for (const line of c.items) {
      const p = w.products[line.pid];
      if (!p.available) out[line.pid] = { code: "OUT_OF_STOCK" };
      else if (p.version !== line.version) out[line.pid] = { code: "PRICE_CHANGED", price: p.price };
    }
    return out;
  }
  SCREENS.carrito = () => {
    const w = S.world();
    const c = S.cart();
    if (!c) return { shell: "customer", title: "Carrito", components: ["EmptyState"], html: `<div class="page-head"><h1 class="t-title">Carrito</h1></div>${U.emptyState("Tu carrito está vacío", "Elegí un local y armá tu ronda.", `<a class="btn primary" href="#/explorar">Explorar locales</a>`, "bag")}` };
    const v = w.venues[c.venue];
    const issues = cartIssues(c);
    const totals = S.cartTotals(c);
    const rows = c.items.map((line) => {
      const p = w.products[line.pid];
      const issue = issues[line.pid];
      const flag = issue ? (issue.code === "OUT_OF_STOCK" ? `<span class="flag">Se agotó · quitalo para seguir</span>` : `<span class="flag">Ahora cuesta ${money(issue.price)}</span>${btn("Aceptar precio nuevo", "secondary sm", `data-act="accept-price" data-pid="${p.id}" style="margin-top:8px"`)}`) : "";
      return `<div class="prow ${issue ? "issue" : ""} ${p.available ? "" : "soldout"}"><div class="thumb"><img src="assets/products/${p.img}.png" alt=""></div>
        <div class="grow"><div class="name">${esc(p.name)}</div><div class="price">${money(line.price)} c/u</div>${flag}</div><div>${U.stepper(p.id, line.qty)}</div></div>`;
    }).join("");
    const st = v.openState !== "open" ? notice("warning", v.openState === "paused" ? "Pedidos pausados" : "Local cerrado", v.openState === "paused" ? "Tu carrito se guarda. Vas a poder pedir cuando reanude." : "Tu carrito se guarda, pero no se puede pedir ahora.") : "";
    const blocking = Object.keys(issues).length > 0 || v.openState !== "open";
    return {
      shell: "customer", title: "Carrito", components: ["ProductRow (variante carrito)", "QuantityStepper", "Notice", "Sheet (vaciar)", "Button"],
      html: `<div class="page-head"><h1 class="t-title">Carrito</h1><a class="t-label" href="#/local/${v.slug}" style="font-weight:600">${esc(v.name)} · Retiro: ${esc(v.pickup)}</a></div>
        ${st}<div class="lines">${rows}</div>
        <div class="total-row"><span>Total</span><span>${money(totals.total)}</span></div>
        <div class="sticky-cta stack tight"><a class="btn primary lg block" href="#/checkout" ${blocking ? 'aria-disabled="true" data-act="blocked"' : ""}>Continuar</a>
        ${blocking ? `<p class="btn-note">${Object.keys(issues).length ? "Revisá los productos marcados." : "El local no recibe pedidos ahora."}</p>` : ""}
        ${btn("Vaciar carrito", "quiet", 'data-act="empty-cart" style="justify-self:center"')}</div>`,
    };
  };
  SCREENS.checkout = () => {
    const w = S.world();
    const c = S.cart();
    if (!c) { setTimeout(() => go("#/carrito")); return { shell: "customer", html: "" }; }
    const v = w.venues[c.venue];
    const totals = S.cartTotals(c);
    const f = S.frame.get();
    if (!f.attemptKey) S.frame.set({ attemptKey: "a" + Date.now() + Math.random().toString(36).slice(2, 6) });
    const err = ui.errors.checkout;
    let errHtml = "";
    if (err) {
      const action = ["OUT_OF_STOCK", "PRICE_CHANGED"].includes(err.code) ? `<a class="btn secondary sm" href="#/carrito">Revisar carrito</a>` : err.code === "OFFLINE" ? btn("Reintentar", "secondary sm", 'data-act="place"', "refresh") : "";
      errHtml = notice("danger", err.code === "OFFLINE" ? "Sin conexión" : "No se hizo el pedido", err.message, action);
    }
    return {
      shell: "customer", title: "Confirmar pedido", components: ["Panel", "OrderLines", "Notice (error por código)", "Button (cargando)", "SessionExpiredSheet"],
      html: `<a class="back" href="#/carrito">${ico("left", "sm")}Carrito</a><div class="page-head"><h1 class="t-title">Confirmar pedido</h1></div>
        <div class="stack">
        <div class="panel row">${U.mono(v)}<div class="grow"><strong>${esc(v.name)}</strong><div class="muted t-label" style="font-weight:400">Retiro: ${esc(v.pickup)} · ~${v.prepMin} min</div></div></div>
        <div class="lines">${c.items.map((l) => `<div class="line"><span class="q">${l.qty}×</span><span>${esc(w.products[l.pid].name)}</span><span class="amt">${money(l.qty * l.price)}</span></div>`).join("")}</div>
        <div class="total-row"><span>Total</span><span>${money(totals.total)}</span></div>
        <div class="panel row">${ico("lock")}<div class="grow"><strong class="t-label" style="font-weight:600">Pago simulado</strong><div class="muted t-label" style="font-weight:400">Demo sin dinero real. No pedimos tarjeta.</div></div></div>
        <p class="muted t-label" style="font-weight:400">Podés cancelar hasta que el local acepte tu pedido.</p>
        ${errHtml}</div>
        <div class="sticky-cta">${btn(`Pedir · ${money(totals.total)}`, "primary lg block", `data-act="place" ${ui.busy ? 'aria-busy="true" disabled' : ""} ${f.offline ? 'aria-describedby="off-note"' : ""}`)}
        ${f.offline ? `<p class="btn-note" id="off-note">Sin conexión: el pedido no se va a enviar.</p>` : ""}</div>`,
    };
  };
  SCREENS.confirmado = (parts) => {
    const w = S.world();
    const o = w.orders.find((x) => x.id === parts[1]);
    if (!o) return { shell: "customer", html: "" };
    const v = w.venues[o.venue];
    clearTimeout(ui.confirmTimer);
    ui.confirmTimer = setTimeout(() => { if (parseHash().parts[0] === "confirmado") go(`#/pedido/${o.id}`); }, reducedMotion() ? 1200 : 1800);
    return {
      shell: "customer", title: "Pedido enviado", components: ["Vasito (confirmación)", "Button"],
      html: `<div class="state" role="status" aria-live="polite" style="padding-top:64px"><div class="vaso ${reducedMotion() ? "static" : ""}"><span class="outline"></span><span class="fill"></span></div>
        <h1 class="t-title">Pedido enviado</h1><p>#${o.number} · ${esc(v.name)}<br>Te avisamos cuando esté listo.</p><a class="btn secondary" href="#/pedido/${o.id}">Ver pedido</a></div>`,
    };
  };
  SCREENS.pedido = (parts) => {
    const w = S.world();
    const f = S.frame.get();
    const o = w.orders.find((x) => x.id === parts[1]);
    if (!o) return { shell: "customer", title: "Pedido", html: U.errorState("No encontramos el pedido", "", `<a class="btn secondary" href="#/pedidos">Mis pedidos</a>`) };
    const v = w.venues[o.venue];
    const flash = ui.readyFlash === o.id;
    let top = "";
    if (o.status === "ready") top = `<div class="ready-head" role="status" aria-live="assertive">${ico("bell", "lg " + (flash ? "anim-bell" : ""))}<div class="grow"><strong class="t-heading" style="display:block">Listo para retirar</strong><span class="t-label" style="font-weight:400">Mostrá el código o el QR en ${esc(v.pickup)}.</span></div></div>${U.ticket(o, v)}${ui.wakeLock ? `<p class="hint" style="text-align:center">La pantalla queda encendida mientras ves el código.</p>` : ""}`;
    if (o.status === "canceled") top = notice("danger", "Pedido cancelado", o.canceledBy === "venue" ? `El local lo canceló: ${o.reason}.` : "Lo cancelaste antes de que el local lo aceptara.");
    if (o.status === "delivered") top = notice("success", "Entregado", "¡Salud! Gracias por pedir con Onza.");
    const conflict = ui.notices.order ? notice("warning", "", ui.notices.order) : "";
    return {
      shell: "customer", title: `Pedido #${o.number}`, components: ["OrderTimeline", "PickupTicket", "Notice", "Sheet (cancelar)", "ConnectionBanner", "Toggle (sonido)"],
      html: `<a class="back" href="#/pedidos">${ico("left", "sm")}Pedidos</a>
        <div class="page-head"><p class="eyebrow">${esc(v.name)}</p><div class="row between"><h1 class="t-title num">#${o.number}</h1>${badge(U.statusLabel[o.status], U.statusClass[o.status])}</div></div>
        <div class="stack">${conflict}${top}
        ${["queued", "preparing", "ready", "delivered"].includes(o.status) && o.status !== "ready" ? U.timeline(o) : ""}
        ${["queued", "preparing"].includes(o.status) ? `<div class="panel">${toggle("ready-sound", "Avisarme con sonido cuando esté listo", !!f.customerSound, 'data-act="customer-sound"')}<p class="hint">Necesita esta pestaña abierta. La pantalla siempre muestra el estado.</p></div>` : ""}
        <div class="lines">${o.items.map((i) => `<div class="line"><span class="q">${i.qty}×</span><span>${esc(i.name)}</span><span class="amt">${money(i.qty * i.price)}</span></div>`).join("")}</div>
        <div class="total-row"><span>Total</span><span>${money(o.total)}</span></div><p class="hint">Pago simulado · sin dinero real</p>
        ${o.status === "queued" ? btn("Cancelar pedido", "danger block", `data-act="cancel" data-id="${o.id}"`) : ""}</div>`,
    };
  };
  SCREENS.pedidos = () => {
    const w = S.world();
    const s = S.session();
    const view = S.frame.get().view;
    const mine = w.orders.filter((o) => o.customer === s.email).sort((a, b) => b.createdAt - a.createdAt);
    const active = mine.filter((o) => ["queued", "preparing", "ready"].includes(o.status));
    const past = mine.filter((o) => !active.includes(o));
    const card = (o) => `<a class="vrow" href="#/pedido/${o.id}">${U.mono(w.venues[o.venue])}<div class="grow"><div class="row between"><strong>${esc(w.venues[o.venue].name)}</strong><span class="num">${money(o.total)}</span></div>
      <div class="row between"><span class="muted t-label" style="font-weight:400">#${o.number} · ${o.items.map((i) => i.qty + "× " + i.name).join(", ")}</span>${badge(U.statusLabel[o.status], U.statusClass[o.status])}</div></div></a>`;
    let body;
    if (view === "cargando") body = `<div class="stack" aria-busy="true">${[1, 2].map(() => '<div class="sk" style="height:72px"></div>').join("")}</div>`;
    else if (view === "error") body = U.errorState("No pudimos cargar tus pedidos", "Probá de nuevo en un momento.", btn("Reintentar", "secondary", 'data-act="view" data-value="normal"', "refresh"));
    else if (!mine.length || view === "vacio") body = U.emptyState("Todavía no pediste", "Tus pedidos y tickets aparecen acá.", `<a class="btn primary" href="#/explorar">Explorar locales</a>`, "brand");
    else body = `${active.length ? `<h2 class="eyebrow section-label" style="margin-top:0">En curso</h2>${active.map(card).join("")}` : ""}${past.length ? `<h2 class="eyebrow section-label">Anteriores</h2>${past.map(card).join("")}` : ""}`;
    return { shell: "customer", title: "Pedidos", components: ["VenueRow (variante pedido)", "StatusBadge", "EmptyState", "ErrorState", "Skeleton"], html: `<div class="page-head"><h1 class="t-display">Pedidos</h1></div>${body}` };
  };
  SCREENS.cuenta = () => {
    const s = S.session();
    const f = S.frame.get();
    const profile = S.world().customers.find((c) => c.email === s.email) || {};
    return {
      shell: "customer", title: "Cuenta", components: ["PageHeader", "SegmentedControl", "Toggle", "Button"],
      html: `<div class="page-head"><h1 class="t-display">Cuenta</h1></div>
        <div class="panel row" style="margin-bottom:32px"><span class="mono">${esc((s.name || "?")[0])}</span><div class="grow"><strong>${esc(s.name)}</strong><div class="muted t-label" style="font-weight:400">@${esc(profile.username || "")} · ${esc(s.email)}</div></div></div>
        <section class="stack tight" style="margin-bottom:32px"><h2 class="t-heading">Apariencia</h2>${seg("theme", [["system", "Sistema"], ["light", "Claro"], ["dark", "Oscuro"]], f.theme || "system", 'class="seg block" aria-label="Apariencia"')}</section>
        <section class="stack tight" style="margin-bottom:32px"><h2 class="t-heading">Avisos</h2>${toggle("p-news", "Novedades de Onza", false)}${toggle("p-offers", "Ofertas de mis locales favoritos", false)}</section>
        <section class="stack tight" style="margin-bottom:32px"><h2 class="t-heading">Privacidad</h2><a href="#/cuenta" class="t-label">Condiciones y privacidad (borrador)</a><p class="hint">Aceptadas el 17/11/2026 · versión 2026-11</p>
        ${btn("Eliminar cuenta", "danger", 'disabled aria-describedby="del-note"')}<p class="hint" id="del-note">Pendiente de decisión (P-4).</p></section>
        ${btn("Cerrar sesión", "secondary block", 'data-act="logout" data-to="/acceso"', "out")}`,
    };
  };

  /* ---------- Equipo ---------- */
  SCREENS["equipo/acceso"] = () => {
    const e = ui.errors;
    const { q } = parseHash();
    return {
      shell: "access", tag: "Equipo", title: "Acceso del equipo", components: ["Particle Wave (app)", "Field", "Button", "Notice"],
      html: `<h1>Acceso del equipo</h1><p class="sub">Las cuentas del equipo las crea el administrador de tu local.</p>
        ${q.get("vencida") ? `<div class="notice warning">${ico("clock")}<div><strong>Tu sesión venció</strong>Volvé a entrar para seguir operando.</div></div>` : ""}
        <form class="stack" data-form="staff-login" novalidate>
          ${field("email", "Correo del trabajo", input("email", `type="email" autocomplete="username" value="${esc(ui.form.email ?? q.get("email") ?? "")}"`, e.email), "", e.email)}
          ${field("password", "Contraseña", input("password", 'type="password" autocomplete="current-password"', e.password), "", e.password)}
          ${e.form ? `<p class="field-error" role="alert">${ico("alert", "sm")}${e.form}</p>` : ""}
          ${btn("Ingresar", "inverse block", 'type="submit"')}</form>
        <p class="muted" style="text-align:center">¿Querés pedir tragos? <a href="#/acceso">Acceso para clientes</a></p>
        <details class="hint"><summary>Cuentas de la maqueta</summary><p style="margin-top:8px">jorge@equipo.demo (empleado, 1 local) · ana@equipo.demo (admin Mil948 + empleada Stiefel) · luis@equipo.demo (contraseña temporal). Cualquier contraseña.</p></details>`,
    };
  };
  SCREENS["equipo/locales"] = () => {
    const s = S.session();
    const w = S.world();
    const list = S.memberships(s.email);
    return {
      shell: "staff", title: "Tus locales", components: ["AppShell (equipo)", "VenueRow (variante equipo)", "StatusBadge", "Button", "EmptyState"],
      html: `<div class="page-head"><h1 class="t-title">Tus locales</h1><p class="muted">Elegí dónde vas a trabajar.</p></div>
        ${list.length ? `<div class="stack" style="max-width:640px">${list.map((m) => {
          const v = w.venues[m.venue];
          return `<div class="panel row wrap">${U.mono(v)}<div class="grow"><strong>${esc(v.name)}</strong><div class="row" style="gap:8px;margin-top:4px">${badge(m.role === "admin" ? "Administrador" : "Empleado", "", true)}${badge(U.venueStatus(v).label, U.venueStatus(v).cls)}</div></div>
            <div class="row"><a class="btn primary sm" href="#/barra/${v.slug}">Abrir barra</a>${m.role === "admin" ? `<a class="btn secondary sm" href="#/admin/${v.slug}/resumen">Administrar</a>` : ""}</div></div>`;
        }).join("")}</div>` : U.emptyState("No tenés locales asignados", "Pedile al administrador de tu local que te dé acceso.", "", "store")}`,
    };
  };
  SCREENS["equipo/clave"] = () => ({
    shell: "staff", title: "Creá tu contraseña", components: ["Field", "Button", "Notice"],
    html: `<div style="max-width:440px" class="stack"><div class="page-head" style="margin:0"><h1 class="t-title">Creá tu contraseña</h1><p class="muted">Tu contraseña temporal sirve una sola vez. Hasta cambiarla no podés operar, ni desde la app ni por la API.</p></div>
      <form class="stack" data-form="change-pw" novalidate>
        ${field("pw", "Contraseña nueva", input("pw", 'type="password" autocomplete="new-password"', ui.errors.pw), "Al menos 10 caracteres.", ui.errors.pw)}
        ${field("pw2", "Repetir contraseña", input("pw2", 'type="password" autocomplete="new-password"', ui.errors.pw2), "", ui.errors.pw2)}
        ${btn("Guardar y continuar", "primary block", 'type="submit"')}</form></div>`,
  });
  function noAccess(slug, text) {
    return { shell: "staff", title: "Sin acceso", components: ["ErrorState"], html: U.errorState(text || "Ya no tenés acceso a este local", "Si es un error, hablá con el administrador.", `<a class="btn secondary" href="#/equipo/locales">Ver mis locales</a>`) };
  }
  SCREENS.barra = (parts) => {
    const slug = parts[1];
    const s = S.session();
    const m = S.memberships(s.email).find((x) => x.venue === slug);
    if (!m) return noAccess(slug);
    const w = S.world();
    const f = S.frame.get();
    const v = w.venues[slug];
    const orders = w.orders.filter((o) => o.venue === slug);
    const cols = [["queued", "Nuevos"], ["preparing", "Preparando"], ["ready", "Listos"]];
    const tab = f.barraTab || "queued";
    const first = ui.seen === null;
    const anim = (o) => {
      if (first) return "";
      const prev = ui.prevStatus[o.id];
      if (!prev && o.status === "queued") return "new";
      if (prev && prev !== o.status) return "moved";
      return "";
    };
    const waiting = orders.filter((o) => ["queued", "preparing"].includes(o.status));
    const longest = waiting.length ? Math.max(...waiting.map((o) => U.minutes(o.createdAt))) : 0;
    const closedOrders = orders.filter((o) => ["delivered", "canceled", "expired", "uncollected"].includes(o.status));
    const html = `<div class="board-head"><div class="grow"><h1 class="t-title">Barra</h1><p class="muted t-label" style="font-weight:400">${esc(v.pickup)}${waiting.length ? ` · Espera más larga <strong class="num">${longest} min</strong>` : ""}</p></div>
      ${v.openState === "closed" ? badge("Cerrado · solo el admin puede abrir", "") : `<label class="toggle"><span class="t-label">Recibiendo pedidos</span><input type="checkbox" data-act="pause" ${v.openState === "open" ? "checked" : ""} ${f.offline ? "disabled" : ""} aria-label="Recibiendo pedidos"></label>`}
      ${btn("Validar retiro", "primary lg", `data-act="pickup" ${f.offline ? "disabled" : ""}`, "scan")}</div>
      ${ui.notices.barra ? notice("warning", "", ui.notices.barra) : ""}
      ${v.openState === "paused" ? notice("warning", "Pedidos pausados", "Los clientes ven el local en pausa y no pueden pedir. Los pedidos en curso siguen acá.") : ""}
      <nav class="tabs board-tabs" role="tablist" aria-label="Estados">${cols.map(([st, label]) => `<button role="tab" aria-selected="${tab === st}" data-act="barra-tab" data-value="${st}">${label}<span class="n">${orders.filter((o) => o.status === st).length}</span></button>`).join("")}</nav>
      <div class="board">${cols.map(([st, label]) => {
        const list = orders.filter((o) => o.status === st).sort((a, b) => a.createdAt - b.createdAt);
        return `<section class="col" ${tab !== st ? "hidden" : ""} aria-label="${label}"><div class="col-head"><h2 class="t-heading">${label}</h2><span class="count-pill">${list.length}</span></div>
          ${list.length ? list.map((o) => U.staffCard(o, { anim: anim(o), offline: f.offline, error: ui.cardErrors[o.id] })).join("") : `<p class="muted t-label" style="font-weight:400;padding:16px 0">${st === "queued" ? "Sin pedidos nuevos." : st === "preparing" ? "Nada en preparación." : "Nada esperando retiro."}</p>`}</section>`;
      }).join("")}</div>
      ${closedOrders.length ? `<details style="margin-top:32px"><summary class="t-label" style="cursor:pointer;min-height:44px;display:flex;align-items:center">${ico("history", "sm")}&nbsp;Cerrados hoy (${closedOrders.length})</summary><div class="rows" style="margin-top:8px">${closedOrders.map((o) => `<div class="r"><span class="num" style="font-weight:600">#${o.number}</span><span class="grow sub">${o.items.map((i) => i.qty + "× " + i.name).join(", ")}${o.reason ? " · " + esc(o.reason) : ""}</span>${badge(U.statusLabel[o.status], U.statusClass[o.status])}</div>`).join("")}</div></details>` : ""}`;
    ui.nextSeen = Object.fromEntries(orders.map((o) => [o.id, o.status]));
    return { shell: "staff", venue: slug, sound: true, title: `Barra · ${v.name}`, components: ["AppShell (equipo)", "OrderCard (barra)", "Tabs", "Toggle", "Sheet (rechazo)", "Sheet (validar retiro)", "ConnectionBanner", "Notice"], html };
  };

  /* ---------- Administración ---------- */
  const ADMIN_TABS = [["resumen", "Resumen", "chart"], ["pedidos", "Pedidos", "receipt"], ["menu", "Menú", "wine"], ["disponibilidad", "Disponibilidad", "toggle"], ["negocio", "Negocio", "store"], ["equipo", "Equipo", "users"]];
  SCREENS.admin = (parts) => {
    const slug = parts[1];
    const tab = parts[2] || "resumen";
    const s = S.session();
    const m = S.memberships(s.email).find((x) => x.venue === slug);
    if (!m) return noAccess(slug);
    if (m.role !== "admin") return noAccess(slug, "Solo el administrador puede ver esta sección");
    const w = S.world();
    const v = w.venues[slug];
    const body = ADMIN[tab] ? ADMIN[tab](v, w, s) : "";
    const navLinks = (cls) => ADMIN_TABS.map(([id, label, icon]) => `<a href="#/admin/${slug}/${id}" ${tab === id ? 'aria-current="page"' : ""}>${cls === "side" ? ico(icon, "sm") : ""}${label}</a>`).join("");
    return {
      shell: "staff", venue: slug, title: `Admin · ${v.name}`, components: ["AppShell (equipo)", "Tabs con URL / navegación lateral", ...(ADMIN_META[tab] || [])],
      html: `<div class="row between wrap" style="margin-bottom:16px"><div><p class="eyebrow">Administración</p><h1 class="t-title">${esc(v.name)}</h1></div><a class="btn secondary sm" href="#/barra/${slug}">Abrir barra</a></div>
        <div class="admin"><nav class="side" aria-label="Administración">${navLinks("side")}</nav><div><nav class="tabs" aria-label="Administración">${navLinks("tabs")}</nav>${body}</div></div>`,
    };
  };
  const ADMIN_META = {
    resumen: ["MetricTile", "Rows"], pedidos: ["SegmentedControl", "Rows", "StatusBadge"], menu: ["Rows (producto)", "Toggle", "Sheet (editor)", "SearchField"],
    disponibilidad: ["SegmentedControl", "BlockCard", "Toggle"], negocio: ["BlockCard", "VenueMedia", "Field", "SavedState"], equipo: ["Rows (persona)", "StatusBadge", "Sheet (alta / rol / quitar acceso)", "SecretReveal"],
  };
  const ADMIN = {
    resumen(v, w) {
      const today = w.orders.filter((o) => o.venue === v.slug);
      const delivered = today.filter((o) => o.status === "delivered");
      const sales = today.filter((o) => !["canceled", "expired"].includes(o.status)).reduce((s, o) => s + o.total, 0);
      const metric = (label, value) => `<div class="metric"><span class="muted t-label" style="font-weight:400">${label}</span><span class="v">${value}</span></div>`;
      const live = ["queued", "preparing", "ready"].map((st) => [st, today.filter((o) => o.status === st).length]);
      return `<div class="metrics">${metric("Pedidos hoy", today.length)}${metric("Ventas simuladas", money(sales))}${metric("Entregados", delivered.length)}${metric("Cancelados", today.filter((o) => o.status === "canceled").length)}</div>
        <p class="hint" style="margin-top:8px">Calculado con los pedidos de esta maqueta. Sin dinero real.</p>
        <h2 class="t-heading" style="margin:32px 0 12px">Ahora en la barra</h2><div class="rows">${live.map(([st, n]) => `<div class="r"><span class="grow">${U.statusLabel[st]}</span><span class="num" style="font-weight:600">${n}</span></div>`).join("")}</div>`;
    },
    pedidos(v, w) {
      const filter = ui.form.orderFilter || "activos";
      let list = w.orders.filter((o) => o.venue === v.slug).sort((a, b) => b.createdAt - a.createdAt);
      if (filter === "activos") list = list.filter((o) => ["queued", "preparing", "ready"].includes(o.status));
      return `${seg("orderFilter", [["activos", "Activos"], ["todos", "Todos"]], filter, 'aria-label="Filtro" style="margin-bottom:16px"')}
        ${list.length ? `<div class="rows">${list.map((o) => `<div class="r"><span class="num" style="font-weight:600;min-width:56px">#${o.number}</span><div class="grow"><div>${esc(o.customerName)} · ${o.items.reduce((s, i) => s + i.qty, 0)} productos</div><div class="sub">${new Date(o.createdAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}${o.reason ? " · " + esc(o.reason) : ""}</div></div><span class="num">${money(o.total)}</span>${badge(U.statusLabel[o.status], U.statusClass[o.status])}</div>`).join("")}</div>` : U.emptyState("Sin pedidos activos", "", "", "receipt")}`;
    },
    menu(v, w) {
      const term = (ui.form.menuSearch || "").toLowerCase();
      const products = Object.values(w.products).filter((p) => p.venue === v.slug && p.name.toLowerCase().includes(term));
      return `<div class="row between wrap" style="margin-bottom:16px"><h2 class="t-heading">Menú</h2>${btn("Nuevo producto", "primary sm", 'data-act="edit-product"', "plus")}</div>
        <div class="search" style="margin-bottom:16px">${ico("search")}<input class="input" type="search" data-input="menuSearch" placeholder="Buscar producto" aria-label="Buscar producto" value="${esc(ui.form.menuSearch || "")}"></div>
        ${v.categories.map((cat, ci) => {
          const list = products.filter((p) => p.cat === ci);
          if (!list.length) return "";
          return `<h3 class="eyebrow section-label">${esc(cat)}</h3><div class="rows">${list.map((p) => `<div class="r"><span class="thumb"><img src="assets/products/${p.img}.png" alt=""></span><div class="grow"><div style="font-weight:600">${esc(p.name)}</div><div class="sub num">${money(p.price)}${p.available ? "" : " · Agotado"}</div></div>
            <label class="toggle" title="Disponible"><span class="sr-only">Disponible: ${esc(p.name)}</span><input type="checkbox" data-act="avail" data-pid="${p.id}" ${p.available ? "checked" : ""}></label>${btn("Editar", "quiet sm", `data-act="edit-product" data-pid="${p.id}"`)}</div>`).join("")}</div>`;
        }).join("")}`;
    },
    disponibilidad(v, w) {
      const soldOut = Object.values(w.products).filter((p) => p.venue === v.slug && !p.available);
      const desc = { open: "Los clientes ven el menú y pueden pedir.", paused: "Visible, pero nadie puede pedir. Para picos de trabajo.", closed: "Fuera de horario. El menú no se muestra." };
      return `<div class="stack loose"><section class="block-card"><h2 class="t-heading">Estado del local</h2>${seg("venueState", [["open", "Abierto"], ["paused", "Pausado"], ["closed", "Cerrado"]], v.openState, 'class="seg block" aria-label="Estado del local"')}<p class="muted">${desc[v.openState]}</p></section>
        <section class="block-card"><h2 class="t-heading">Capacidad</h2>${field("cap", "Pedidos activos al mismo tiempo", input("cap", `type="number" min="1" value="${v.capacity}" style="max-width:160px"`), "Al llegar al máximo, el checkout avisa y no crea pedidos.")}</section>
        <section class="block-card"><h2 class="t-heading">Agotados ahora</h2>${soldOut.length ? `<div class="rows">${soldOut.map((p) => `<div class="r"><span class="grow">${esc(p.name)}</span><label class="toggle"><span class="t-label">Disponible</span><input type="checkbox" data-act="avail" data-pid="${p.id}"></label></div>`).join("")}</div>` : `<p class="muted">Todo disponible.</p>`}</section></div>`;
    },
    negocio(v) {
      const saved = (k) => ui.saved[k] ? `<span class="saved" role="status">${ico("check", "sm")}Guardado</span>` : "";
      const block = (k, title, inner) => `<section class="block-card"><div class="row between"><h2 class="t-heading">${title}</h2>${saved(k)}</div>${inner}<div>${btn("Guardar", "secondary sm", `data-act="save-block" data-block="${k}"`)}</div></section>`;
      return `<div class="stack loose">
        <section class="block-card"><h2 class="t-heading">Imágenes</h2>${U.media(v, "ratio-21x9")}<div class="row">${U.mono(v, "lg")}<div class="grow muted t-label" style="font-weight:400">Portada 16:9 (mín. 1600 px) y logo cuadrado. Sin filtros.</div></div>
          <div class="row wrap">${btn("Subir portada", "secondary sm", "disabled", "image")}${btn("Subir logo", "secondary sm", "disabled", "image")}</div><p class="hint">Pendiente: fotos y logos aportados o con uso permitido. Revisión de permisos antes del lanzamiento.</p></section>
        ${block("datos", "Datos públicos", `${field("vn", "Nombre", input("vn", `value="${esc(v.name)}"`))}${field("vz", "Barrio", input("vz", `value="${esc(v.zone)}"`))}${field("va", "Dirección publicada", input("va", `value="${esc(v.addressPublished)}"`), "Fuente: " + (v.sources[0] || "").replace(/^https?:\/\//, "").split("/")[0])}`)}
        ${block("ubicacion", "Ubicación", `<div class="row" style="gap:12px">${field("lat", "Latitud", input("lat", 'inputmode="decimal" placeholder="Por verificar"'))}${field("lng", "Longitud", input("lng", 'inputmode="decimal" placeholder="Por verificar"'))}</div><p class="hint">Sin coordenadas verificadas, la app no muestra distancia para este local.</p>`)}
        ${block("retiro", "Retiro", `${field("pk", "Punto de retiro", input("pk", `value="${esc(v.pickup)}"`))}${field("prep", "Preparación estimada (min)", input("prep", `type="number" value="${v.prepMin}" style="max-width:160px"`))}`)}
        ${block("horario", "Horario informado", field("hr", "Texto visible para clientes", input("hr", `value="${esc(v.hours)}"`), "Propuesta P-3 (pendiente): horario estructurado por día."))}</div>`;
    },
    equipo(v, w, s) {
      const team = w.team[v.slug];
      const admins = team.filter((p) => p.role === "admin").length;
      return `<div class="row between wrap" style="margin-bottom:16px"><div><h2 class="t-heading">Equipo</h2><p class="muted t-label" style="font-weight:400">Solo dos permisos: Empleado opera la barra; Administrador además gestiona el local.</p></div>${btn("Agregar persona", "primary sm", 'data-act="add-member"', "plus")}</div>
        ${ui.notices.team ? notice("success", "", ui.notices.team) : ""}
        <div class="rows">${team.map((p) => {
          const me = p.email === s.email;
          const last = p.role === "admin" && admins === 1;
          return `<div class="r wrap"><span class="mono" style="width:40px;height:40px;font-size:14px">${esc(p.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span>
            <div class="grow"><div style="font-weight:600">${esc(p.name)}${me ? ' <span class="muted t-label" style="font-weight:400">(vos)</span>' : ""}</div><div class="sub">${esc(p.email)}</div></div>
            <div class="row wrap" style="gap:8px">${p.mustChange ? badge("Clave temporal", "warning") : ""}${badge(p.role === "admin" ? "Administrador" : "Empleado", "", true)}
            ${btn("Rol", "quiet sm", `data-act="role" data-email="${esc(p.email)}" ${me ? 'disabled title="No podés cambiar tu propio rol"' : ""}`)}
            ${btn("Quitar acceso", "quiet sm", `data-act="revoke" data-email="${esc(p.email)}" ${me || last ? `disabled title="${me ? "No podés quitarte tu propio acceso" : "El local necesita al menos un administrador"}"` : ""} style="color:var(--onza-danger-text)"`)}</div></div>`;
        }).join("")}</div>`;
    },
  };

  /* ---------- Hojas (sheets) ---------- */
  function renderSheet() {
    const sh = ui.sheet;
    if (!sh) { layer.innerHTML = ""; return; }
    const w = S.world();
    let html = "";
    if (sh.type === "product") {
      const p = w.products[sh.pid];
      const c = S.cart();
      const qty = c && c.venue === p.venue ? S.cartQty(p.id) : 0;
      const closed = w.venues[p.venue].openState === "closed";
      html = sheet(p.name, `<div class="media ratio-3x2" style="margin-bottom:16px"><img class="photo" src="assets/products/${p.img}.png" alt="" style="object-fit:contain;background:var(--onza-surface)"></div><p class="muted">${esc(p.desc)}</p><p class="t-heading num" style="margin-top:12px">${money(p.price)}</p>`,
        !p.available ? badge("Agotado") : closed ? `<p class="btn-note">Local cerrado</p>` : qty ? U.stepper(p.id, qty) : btn("Agregar", "primary block", `data-act="add" data-pid="${p.id}"`));
    }
    if (sh.type === "replace") {
      const c = S.cart();
      const from = w.venues[c.venue];
      const to = w.venues[w.products[sh.pid].venue];
      html = sheet("¿Empezar un carrito nuevo?", `<p class="muted">Tu carrito de ${esc(from.name)} tiene ${S.cartTotals(c).count} productos. Un pedido es de un solo local.</p>`,
        `${btn(`Conservar ${esc(from.name)}`, "secondary", 'data-act="close-sheet"')}${btn(`Vaciar y agregar en ${esc(to.name)}`, "primary", `data-act="replace" data-pid="${sh.pid}"`)}`);
    }
    if (sh.type === "empty-cart") html = sheet("¿Vaciar el carrito?", `<p class="muted">Se quitan todos los productos.</p>`, `${btn("Volver", "secondary", 'data-act="close-sheet"')}${btn("Vaciar", "danger", 'data-act="empty-confirm"')}`);
    if (sh.type === "cancel") {
      const o = w.orders.find((x) => x.id === sh.id);
      html = sheet(`¿Cancelar #${o.number}?`, `<p class="muted">El local todavía no lo aceptó. Si lo acepta antes, ya no se puede cancelar.</p>`, `${btn("Volver", "secondary", 'data-act="close-sheet"')}${btn("Cancelar pedido", "danger", `data-act="cancel-confirm" data-id="${o.id}" data-v="${o.version}" ${ui.busy ? 'aria-busy="true"' : ""}`)}`);
    }
    if (sh.type === "expired") {
      const s = S.session();
      html = sheet("Tu sesión venció", `<p class="muted">Volvé a entrar para continuar. ${s && s.kind === "customer" ? "Tu carrito se guarda para esta cuenta." : ""}</p>`, btn("Volver a entrar", "primary block", 'data-act="reauth"'), { noClose: true });
    }
    if (sh.type === "location") html = sheet("Permiso de ubicación (simulado)", `<p class="muted">En la app, el navegador pregunta. La ubicación se usa una vez para ordenar y no se guarda.</p>`, `${btn("Bloquear", "secondary", 'data-act="loc" data-value="denied"')}${btn("Permitir", "primary", 'data-act="loc" data-value="granted"')}`);
    if (sh.type === "reject") {
      const o = w.orders.find((x) => x.id === sh.id);
      const reasons = ["Sin stock", "No podemos prepararlo ahora", "Pedido duplicado", "Otro motivo"];
      html = sheet(`Rechazar #${o.number}`, `<form class="stack" data-form="reject" data-id="${o.id}" data-v="${o.version}" novalidate><fieldset class="stack tight" style="border:0;padding:0;margin:0"><legend class="t-label" style="margin-bottom:8px">Motivo (lo ve el cliente)</legend>
        ${reasons.map((r, i) => `<label class="toggle"><input type="radio" name="reason" value="${r}" ${i === 0 ? "checked" : ""} style="appearance:auto;width:20px;height:20px;background:none"><span>${r}</span></label>`).join("")}</fieldset>
        ${field("other", "Detalle (obligatorio si elegís Otro motivo)", `<textarea class="input" id="other" name="other" ${ui.errors.reason ? 'aria-invalid="true"' : ""}></textarea>`, "", ui.errors.reason)}
        <div class="actions">${btn("Volver", "secondary", 'type="button" data-act="close-sheet"')}${btn("Rechazar pedido", "danger", 'type="submit"')}</div></form>`, "");
    }
    if (sh.type === "pickup") {
      const r = ui.pickupResult;
      const result = r ? (r.ok
        ? `<div class="result ok" role="status"><span class="big"><svg class="ico anim-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span><strong class="t-heading">Entregado #${r.order.number}</strong><span>${r.order.items.map((i) => i.qty + "× " + esc(i.name)).join(", ")}</span></div>`
        : `<div class="result bad" role="alert">${ico("alert", "lg")}<strong>${esc(r.message)}</strong></div>`) : "";
      html = sheet("Validar retiro", `<form class="stack" data-form="pickup" novalidate>${r && r.ok ? "" : field("code", "Código privado del ticket", `<input class="input code" id="code" name="code" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX XXXX XXXX" ${r && !r.ok ? 'aria-invalid="true"' : ""}>`, "12 caracteres. El número del pedido no sirve.")}
        ${result}<div class="actions">${r && r.ok ? btn("Validar otro", "primary", 'type="button" data-act="pickup-again"') : `${btn("Escanear QR", "secondary", 'type="button" disabled title="En la app abre la cámara del teléfono"', "scan")}${btn("Validar", "primary", 'type="submit"')}`}</div>
        ${r && r.ok ? "" : `<p class="hint">Escanear usa la cámara del teléfono en la app; en la maqueta, escribí el código.${sh.hint ? " Código de prueba: " + sh.hint : ""}</p>`}</form>`, "", { sub: "Pedí el código al cliente o escaneá su QR." });
    }
    if (sh.type === "edit-product") {
      const v = w.venues[sh.venue];
      const p = sh.pid ? w.products[sh.pid] : { name: "", desc: "", price: "", cat: 0 };
      html = sheet(sh.pid ? "Editar producto" : "Nuevo producto", `<form class="stack" data-form="product" novalidate>
        ${field("pname", "Nombre", input("pname", `value="${esc(p.name)}"`))}${field("pdesc", "Descripción", `<textarea class="input" id="pdesc">${esc(p.desc)}</textarea>`)}
        ${field("pprice", "Precio (₡)", input("pprice", `type="number" inputmode="numeric" value="${p.price}"`), sh.pid ? "Si cambiás el precio, quien lo tenga en el carrito lo confirma antes de pedir." : "")}
        ${field("pcat", "Categoría", `<select class="input" id="pcat">${v.categories.map((c, i) => `<option value="${i}" ${i === p.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`)}
        <div class="row">${btn("Subir imagen", "secondary sm", "type=button disabled", "image")}<span class="hint">En la app se guarda en Storage.</span></div>
        ${ui.errors.product ? `<p class="field-error" role="alert">${ico("alert", "sm")}${esc(ui.errors.product)}</p>` : ""}
        <div class="actions">${btn("Cancelar", "secondary", 'type="button" data-act="close-sheet"')}${btn("Guardar", "primary", 'type="submit"')}</div></form>`, "");
    }
    if (sh.type === "add-member") {
      const r = ui.addResult;
      html = r ? sheet("Cuenta lista", r.password
        ? `<p class="muted">Pasale esta contraseña temporal a la persona en mano. Se muestra una sola vez; al entrar, va a tener que cambiarla.</p><div class="secret" style="margin-top:16px">${esc(r.password)}</div>`
        : `<p class="muted">Esa persona ya tenía cuenta del equipo. Ahora también accede a este local con su contraseña de siempre.</p>`, btn("Listo", "primary block", 'data-act="close-sheet"'), { noClose: true })
        : sheet("Agregar persona", `<form class="stack" data-form="member" novalidate>
          ${field("mname", "Nombre", input("mname", `value="${esc(ui.form.mname || "")}"`, ui.errors.mname), "", ui.errors.mname)}
          ${field("memail", "Correo del trabajo", input("memail", `type="email" value="${esc(ui.form.memail || "")}"`, ui.errors.memail), "Distinto de su correo personal.", ui.errors.memail)}
          <div class="field"><span class="label">Permiso</span>${seg("mrole", [["employee", "Empleado"], ["admin", "Administrador"]], ui.form.mrole || "employee", 'class="seg block" aria-label="Permiso"')}</div>
          <div class="actions">${btn("Cancelar", "secondary", 'type="button" data-act="close-sheet"')}${btn("Crear cuenta", "primary", 'type="submit"')}</div></form>`, "", { sub: "Sin correo de invitación: creás la cuenta y le das una contraseña temporal." });
    }
    if (sh.type === "role") {
      const p = w.team[sh.venue].find((x) => x.email === sh.email);
      html = sheet(`Permiso de ${p.name.split(" ")[0]}`, `${seg("newRole", [["employee", "Empleado"], ["admin", "Administrador"]], ui.form.newRole || p.role, 'class="seg block" aria-label="Permiso"')}${ui.errors.role ? `<p class="field-error" style="margin-top:12px">${ico("alert", "sm")}${esc(ui.errors.role)}</p>` : ""}`,
        `${btn("Cancelar", "secondary", 'data-act="close-sheet"')}${btn("Guardar", "primary", `data-act="role-save" data-email="${esc(p.email)}"`)}`);
    }
    if (sh.type === "revoke") {
      const v = w.venues[sh.venue];
      const p = w.team[sh.venue].find((x) => x.email === sh.email);
      const others = S.memberships(p.email).filter((m) => m.venue !== sh.venue).length;
      html = sheet(`¿Quitar el acceso de ${p.name.split(" ")[0]} a ${v.name}?`, `<p class="muted">Pierde el acceso a este local de inmediato: cualquier acción que intente después se rechaza. ${others ? `Sus otros ${others === 1 ? "local sigue" : others + " locales siguen"} igual.` : "No tiene otros locales."}</p>${ui.errors.revoke ? `<p class="field-error" style="margin-top:12px">${ico("alert", "sm")}${esc(ui.errors.revoke)}</p>` : ""}`,
        `${btn("Cancelar", "secondary", 'data-act="close-sheet"')}${btn("Quitar acceso", "danger", `data-act="revoke-confirm" data-email="${esc(p.email)}"`)}`);
    }
    layer.innerHTML = html;
    const focusable = layer.querySelector("input:not([disabled]), textarea, [data-act]:not(.scrim)");
    if (focusable && !layer.contains(document.activeElement)) focusable.focus({ preventScroll: true });
  }
  function openSheet(next) { ui.sheet = next; ui.errors = {}; renderSheet(); }
  function closeSheet() { ui.sheet = null; ui.pickupResult = null; ui.addResult = null; ui.errors = {}; layer.innerHTML = ""; render(); }

  /* ---------- Sonido y vibración (solo tras gesto; nunca única señal) ---------- */
  let audio = null;
  function ensureAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { audio = null; }
  }
  function tone(freq = 660) {
    if (!audio || audio.state !== "running") return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain); gain.connect(audio.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
    osc.start(); osc.stop(audio.currentTime + 0.3);
  }
  let wakeLock = null;
  async function syncWakeLock(want) {
    try {
      if (want && !wakeLock && "wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        ui.wakeLock = true;
        wakeLock.addEventListener("release", () => { wakeLock = null; ui.wakeLock = false; });
      } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; ui.wakeLock = false; }
    } catch (e) { ui.wakeLock = false; }
  }

  /* ---------- Render ---------- */
  let current = null;
  function render(isNavigation) {
    applyPrefs();
    const { path, parts, q } = parseHash();
    const full = location.hash.replace(/^#/, "") || "/";
    const redirect = decide(path, full, isNavigation === true);
    if (redirect) { location.replace("#" + redirect); return; }
    const key = parts.length ? (SCREENS[parts.slice(0, 2).join("/")] ? parts.slice(0, 2).join("/") : parts[0]) : "acceso";
    const screen = (SCREENS[key] || SCREENS.acceso)(parts, q);
    if (key !== current) { window.scrollTo(0, 0); current = key; }
    let html = screen.html;
    if (screen.shell === "customer") html = customerShell(html, screen);
    else if (screen.shell === "staff") html = staffShell(html, screen);
    else if (screen.shell === "access") html = accessShell(html, screen);
    else if (screen.shell === "plain") html = plainShell(html);
    else if (screen.shell === "customerPlain") html = `<main id="main" class="page menu">${html}</main>`;
    const active = document.activeElement && document.activeElement.id;
    const caret = document.activeElement && document.activeElement.selectionStart;
    app.innerHTML = html;
    document.title = `${screen.title || "Onza"} · Maqueta Onza`;
    if (active) { const el = document.getElementById(active); if (el && el.matches("input")) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* */ } } }
    window.OnzaReview && window.OnzaReview.update({ key, components: screen.components || [] });
    if (ui.nextSeen) { ui.prevStatus = ui.nextSeen; ui.seen = true; ui.nextSeen = null; }
    ui.bump = false; ui.justAdded = null;
    // Ticket visible → pedir que la pantalla no se apague.
    const order = parts[0] === "pedido" && S.world().orders.find((o) => o.id === parts[1]);
    syncWakeLock(!!(order && order.status === "ready"));
    if (ui.sheet) renderSheet();
  }

  /* Cambios desde otro marco (equivale a Realtime): detectar transiciones para animar y sonar. */
  let lastOrders = Object.fromEntries(S.world().orders.map((o) => [o.id, o.status]));
  let lastRev = S.world().rev;
  S.onChange((msg) => {
    if (msg && msg.type === "reset") { location.reload(); return; }
    const w = S.world();
    if (w.rev === lastRev) return; // BroadcastChannel y storage avisan el mismo cambio: procesarlo una vez
    lastRev = w.rev;
    const f = S.frame.get();
    const s = f.session;
    const { parts } = parseHash();
    for (const o of w.orders) {
      const prev = lastOrders[o.id];
      if (s && s.kind === "staff" && parts[0] === "barra" && o.venue === parts[1] && !prev && o.status === "queued" && f.sound) tone(660);
      if (s && s.kind === "customer" && o.customer === s.email && prev && prev !== "ready" && o.status === "ready") {
        ui.readyFlash = o.id;
        if (f.customerSound) tone(880);
        if (f.vibrate && "vibrate" in navigator) navigator.vibrate(200);
        setTimeout(() => { ui.readyFlash = null; }, 600);
      }
    }
    lastOrders = Object.fromEntries(w.orders.map((o) => [o.id, o.status]));
    if (f.offline) return; // sin conexión: la pantalla no se entera hasta reconectar (como Realtime caído)
    if (!ui.sheet || ui.sheet.type === "pickup" || ui.sheet.type === "product") render();
  });

  /* ---------- Errores de comandos ---------- */
  function handleError(err, where) {
    if (err.code === "SESSION_EXPIRED") { openSheet({ type: "expired" }); return true; }
    if (err.code === "PASSWORD_CHANGE_REQUIRED") { go("#/equipo/clave"); return true; }
    if (where) { ui.errors[where] = err; render(); }
    return false;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", async (event) => {
    const el = event.target.closest("[data-act]");
    if (!el || el.matches("input[type=checkbox]")) return;
    const act = el.dataset.act;
    if (el.getAttribute("aria-disabled") === "true") { event.preventDefault(); return; }
    const w = S.world();
    const { parts } = parseHash();
    try {
      switch (act) {
        case "close-sheet": closeSheet(); break;
        case "google": {
          // Google aporta nombre y correo; R1: un correo del equipo no entra por acá.
          S.signInCustomer("gabriela@gmail.demo", "Gabriela Méndez");
          const next = parseHash().q.get("next");
          go("#" + (S.session().onboarded ? safeNext(next, "/explorar") : `/onboarding${next ? "?next=" + encodeURIComponent(next) : ""}`));
          break;
        }
        case "seg": {
          const { name, value } = el.dataset;
          if (name === "theme") { S.frame.set({ theme: value === "system" ? null : value }); render(); break; }
          if (name === "venueState") { S.setVenueState(parts[1], value); render(); break; }
          ui.form[name] = value;
          if (ui.sheet) renderSheet(); else render();
          break;
        }
        case "confirm-link": S.signInCustomer(el.dataset.email, ""); go("#/onboarding"); break;
        case "resend": ui.form.resent = true; render(); break;
        case "location": openSheet({ type: "location" }); break;
        case "loc": S.frame.set({ location: el.dataset.value }); closeSheet(); break;
        case "view": S.frame.set({ view: el.dataset.value }); render(); break;
        case "clear-search": ui.form.search = ""; S.frame.set({ view: "normal" }); render(); break;
        case "scroll": event.preventDefault(); document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" }); break;
        case "product": openSheet({ type: "product", pid: el.dataset.pid }); break;
        case "add": {
          const result = S.addToCart(el.dataset.pid);
          if (result === "conflict") { openSheet({ type: "replace", pid: el.dataset.pid }); break; }
          ui.justAdded = el.dataset.pid; ui.bump = true;
          render();
          break;
        }
        case "replace": S.addToCart(el.dataset.pid, true); ui.bump = true; closeSheet(); break;
        case "qty": {
          const pid = el.dataset.pid;
          S.setQty(pid, S.cartQty(pid) + Number(el.dataset.delta));
          ui.bump = true;
          render();
          const qtyEl = document.querySelector(`#p-${CSS.escape(pid)} .qty`);
          qtyEl && qtyEl.classList.add("tick");
          break;
        }
        case "accept-price": S.acceptNewPrice(el.dataset.pid); render(); break;
        case "empty-cart": openSheet({ type: "empty-cart" }); break;
        case "empty-confirm": S.clearCart(); closeSheet(); break;
        case "blocked": event.preventDefault(); break;
        case "place": {
          if (ui.busy) break;
          ui.busy = true; ui.errors = {}; render();
          await new Promise((r) => setTimeout(r, 700)); // latencia simulada; spinner visible ≥ 300 ms
          try {
            const order = S.placeOrder(S.frame.get().attemptKey);
            S.frame.set({ attemptKey: null });
            ui.busy = false;
            go(`#/confirmado/${order.id}`);
          } catch (err) {
            ui.busy = false;
            handleError(err, "checkout") || render();
          }
          break;
        }
        case "cancel": openSheet({ type: "cancel", id: el.dataset.id }); break;
        case "cancel-confirm": {
          try { S.cancelByCustomer(el.dataset.id, Number(el.dataset.v)); ui.notices.order = ""; }
          catch (err) {
            if (handleError(err)) break;
            ui.notices.order = err.code === "VERSION_CONFLICT" ? "El local ya aceptó tu pedido. Ya no se puede cancelar." : err.message;
          }
          closeSheet();
          break;
        }
        case "customer-sound": break;
        case "logout": S.signOut(); go("#" + el.dataset.to); break;
        case "reauth": {
          const s = S.session();
          const next = location.hash.replace(/^#/, "");
          ui.sheet = null; layer.innerHTML = "";
          go(s && s.kind === "staff" ? `#/equipo/acceso?next=${encodeURIComponent(next)}&vencida=1&email=${encodeURIComponent(s.email)}` : `#/acceso/correo?next=${encodeURIComponent(next)}&vencida=1&email=${encodeURIComponent(s ? s.email : "")}`);
          break;
        }
        /* Equipo */
        case "sound": {
          const on = !S.frame.get().sound;
          if (on) { ensureAudio(); tone(520); }
          S.frame.set({ sound: on });
          render();
          break;
        }
        case "barra-tab": S.frame.set({ barraTab: el.dataset.value }); render(); break;
        case "staff": {
          const id = el.dataset.id;
          try { S.staffAction(id, Number(el.dataset.v), el.dataset.do); delete ui.cardErrors[id]; ui.notices.barra = ""; }
          catch (err) {
            if (handleError(err)) break;
            if (err.code === "VERSION_CONFLICT") {
              const o = S.world().orders.find((x) => x.id === id);
              ui.notices.barra = o.status === "canceled" ? `El cliente canceló #${o.number} antes de que lo aceptaras.` : `#${o.number} cambió en otro dispositivo. Mostramos su estado actual.`;
            } else if (err.code === "NOT_AUTHORIZED") { ui.notices.barra = err.message; }
            else ui.cardErrors[id] = err.message;
          }
          render();
          break;
        }
        case "reject": openSheet({ type: "reject", id: el.dataset.id }); break;
        case "pickup": {
          const ready = w.orders.find((o) => o.venue === parts[1] && o.status === "ready");
          ui.pickupResult = null;
          openSheet({ type: "pickup", hint: ready ? ready.pickupCode : "" });
          break;
        }
        case "pickup-again": ui.pickupResult = null; renderSheet(); break;
        /* Admin */
        case "edit-product": openSheet({ type: "edit-product", venue: parts[1], pid: el.dataset.pid }); break;
        case "save-block": ui.saved[el.dataset.block] = true; render(); setTimeout(() => { ui.saved[el.dataset.block] = false; }, 4000); break;
        case "add-member": ui.form.mname = ""; ui.form.memail = ""; ui.form.mrole = "employee"; ui.addResult = null; openSheet({ type: "add-member", venue: parts[1] }); break;
        case "role": ui.form.newRole = null; openSheet({ type: "role", venue: parts[1], email: el.dataset.email }); break;
        case "role-save": {
          try { S.setRole(parts[1], el.dataset.email, ui.form.newRole || "employee"); closeSheet(); }
          catch (err) { if (!handleError(err)) { ui.errors.role = err.message; renderSheet(); } }
          break;
        }
        case "revoke": openSheet({ type: "revoke", venue: parts[1], email: el.dataset.email }); break;
        case "revoke-confirm": {
          try {
            const p = S.world().team[parts[1]].find((x) => x.email === el.dataset.email);
            S.revoke(parts[1], el.dataset.email);
            ui.notices.team = `${p.name} ya no tiene acceso a ${S.world().venues[parts[1]].name}.`;
            closeSheet();
          } catch (err) { if (!handleError(err)) { ui.errors.revoke = err.message; renderSheet(); } }
          break;
        }
      }
    } catch (err) {
      if (!handleError(err)) { console.warn(err); }
    }
  });

  document.addEventListener("change", (event) => {
    const el = event.target;
    const { parts } = parseHash();
    try {
      if (el.dataset.act === "avail") { S.setAvailable(el.dataset.pid, el.checked); render(); }
      if (el.dataset.act === "pause") { S.setVenueState(parts[1], el.checked ? "open" : "paused"); render(); }
      if (el.dataset.act === "customer-sound") { if (el.checked) ensureAudio(); S.frame.set({ customerSound: el.checked, vibrate: el.checked }); }
    } catch (err) { if (!handleError(err)) { ui.notices.barra = err.message; render(); } }
  });
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.input) { ui.form[el.dataset.input] = el.value; render(); }
    if (el.id === "code") { el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(?=.)/g, "$1 "); }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const val = (id) => (form.querySelector("#" + id) || {}).value || "";
    const kind = form.dataset.form;
    ui.errors = {};
    const { q, parts } = parseHash();
    try {
      if (kind === "login" || kind === "signup") {
        const email = val("email").trim().toLowerCase();
        ui.form.email = email;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ui.errors.email = "Escribí un correo válido.";
        if (!val("password")) ui.errors.password = "Escribí tu contraseña.";
        else if (kind === "signup" && val("password").length < 10) ui.errors.password = "Usá al menos 10 caracteres.";
        if (Object.keys(ui.errors).length) return render();
        const exists = S.world().customers.some((c) => c.email === email);
        if (kind === "login") {
          if (!exists && !S.memberships(email).length) { ui.errors.form = "Correo o contraseña incorrectos."; return render(); }
          ui.busy = true; render(); await new Promise((r) => setTimeout(r, 400)); ui.busy = false;
          S.signInCustomer(email);
          ui.form = {};
          go("#" + safeNext(q.get("next"), "/explorar"));
        } else {
          if (S.memberships(email).length) { ui.errors.form = "Ese correo es de una cuenta del equipo. Usá tu correo personal."; return render(); }
          if (exists) { ui.errors.form = "Ya hay una cuenta con ese correo. Ingresá."; return render(); }
          ui.form = {};
          go(`#/confirmar?email=${encodeURIComponent(email)}`);
        }
      }
      if (kind === "recover") {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("email"))) { ui.errors.email = "Escribí un correo válido."; return render(); }
        ui.form.recoverSent = true; render();
      }
      if (kind === "reset" || kind === "change-pw") {
        if (val("pw").length < 10) ui.errors.pw = "Usá al menos 10 caracteres.";
        else if (val("pw") !== val("pw2")) ui.errors.pw2 = "Las contraseñas no coinciden.";
        if (Object.keys(ui.errors).length) return render();
        if (kind === "reset") { ui.notices.auth = "Contraseña actualizada. Ya podés ingresar."; ui.form = {}; go("#/acceso/correo"); }
        else { S.changePassword(val("pw"), val("pw2")); go("#" + staffHome(S.session().email)); }
      }
      if (kind === "onboarding") {
        const data = { name: val("name").trim(), username: val("username").trim().toLowerCase().replace(/^@/, ""), phone: val("phone").trim(), birth: val("birth"), terms: form.querySelector("#terms").checked };
        ui.form = { ...ui.form, ...data };
        if (data.name.length < 2) ui.errors.name = "Escribí tu nombre.";
        if (!/^[a-z0-9_.]{3,20}$/.test(data.username)) ui.errors.username = "De 3 a 20 letras, números, punto o guion bajo.";
        if (!/^\d{8}$/.test(data.phone.replace(/\D/g, ""))) ui.errors.phone = "Escribí 8 dígitos.";
        if (!data.birth) ui.errors.birth = "Escribí tu fecha de nacimiento.";
        else {
          const b = new Date(data.birth);
          const adult = new Date(b.getFullYear() + 18, b.getMonth(), b.getDate()) <= new Date();
          if (!adult) ui.errors.birth = "Onza es solo para mayores de 18 años.";
        }
        if (!data.terms) ui.errors.terms = "Necesitás aceptar las condiciones para continuar.";
        if (Object.keys(ui.errors).length) return render();
        try { S.completeOnboarding(data); }
        catch (err) { if (err.code === "USERNAME_TAKEN") { ui.errors.username = err.message; return render(); } throw err; }
        ui.form = {};
        go("#" + safeNext(q.get("next"), "/explorar"));
      }
      if (kind === "staff-login") {
        const email = val("email").trim().toLowerCase();
        ui.form.email = email;
        if (!email) ui.errors.email = "Escribí tu correo.";
        if (!val("password")) ui.errors.password = "Escribí tu contraseña.";
        if (Object.keys(ui.errors).length) return render();
        S.signInStaff(email);
        ui.form = {};
        const next = q.get("next");
        go("#" + (next && !S.memberships(email).some((m) => m.mustChange) ? safeNext(next, staffHome(email)) : staffHome(email)));
      }
      if (kind === "reject") {
        const reason = form.querySelector("input[name=reason]:checked").value;
        const other = val("other").trim();
        const text = reason === "Otro motivo" ? other : reason + (other ? ": " + other : "");
        try { S.staffAction(form.dataset.id, Number(form.dataset.v), "reject", text); closeSheet(); }
        catch (err) {
          if (handleError(err)) return;
          if (err.code === "REASON_REQUIRED") { ui.errors.reason = err.message; renderSheet(); return; }
          ui.notices.barra = err.code === "VERSION_CONFLICT" ? "El pedido cambió antes de rechazarlo. Mostramos su estado actual." : err.message;
          closeSheet();
        }
      }
      if (kind === "pickup") {
        try { const order = S.validatePickup(parts[1], val("code")); ui.pickupResult = { ok: true, order }; }
        catch (err) { if (handleError(err)) return; ui.pickupResult = { ok: false, message: err.message }; }
        renderSheet();
        const code = layer.querySelector("#code");
        if (code) code.focus();
      }
      if (kind === "product") {
        try { S.saveProduct(ui.sheet.venue, { id: ui.sheet.pid, name: val("pname"), desc: val("pdesc"), price: val("pprice"), cat: val("pcat") }); closeSheet(); }
        catch (err) { if (!handleError(err)) { ui.errors.product = err.message; renderSheet(); } }
      }
      if (kind === "member") {
        ui.form.mname = val("mname"); ui.form.memail = val("memail");
        try { ui.addResult = S.addMember(ui.sheet.venue, { name: val("mname"), email: val("memail"), role: ui.form.mrole }); renderSheet(); render(); }
        catch (err) {
          if (handleError(err)) return;
          if (["INVALID_NAME"].includes(err.code)) ui.errors.mname = err.message; else ui.errors.memail = err.message;
          renderSheet();
        }
      }
    } catch (err) {
      if (handleError(err)) return;
      ui.errors.form = err.message;
      render();
    }
  });

  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && ui.sheet && ui.sheet.type !== "expired") closeSheet(); });
  window.addEventListener("hashchange", () => { ui.errors = {}; ui.notices = {}; ui.sheet = null; layer.innerHTML = ""; render(true); });
  window.addEventListener("online", render);
  window.OnzaApp = { render, openSheet, go };
  render(true);
})();
