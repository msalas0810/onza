/* Onza V1 · barra de revisión de las maquetas. No forma parte del producto.
   Se oculta con ?captura=1. Estilos propios aislados (rv-*) para no contaminar los componentes. */
(function () {
  "use strict";
  const S = window.OnzaStore;
  const params = new URLSearchParams(location.search);
  if (params.get("captura") === "1") { window.OnzaReview = { update() {} }; return; }

  const ROUTES = [
    ["Cliente", [["#/acceso", "Acceso"], ["#/acceso/correo", "Ingresar con correo"], ["#/acceso/correo?modo=crear", "Crear cuenta"], ["#/confirmar?email=nuevo@correo.demo", "Confirmar correo"], ["#/recuperar", "Recuperar contraseña"], ["#/restablecer", "Nueva contraseña"], ["#/onboarding", "Completar perfil"], ["#/explorar", "Explorar"], ["#/local/mil948", "Local abierto (Mil948)"], ["#/local/wilk", "Local pausado (Wilk)"], ["#/local/otro-bar", "Local cerrado (Otro Bar)"], ["#/carrito", "Carrito"], ["#/checkout", "Checkout"], ["#/pedidos", "Pedidos"], ["#/cuenta", "Cuenta"], ["#/sesion-activa?want=equipo", "Sesión del tipo equivocado"]]],
    ["Equipo", [["#/equipo/acceso", "Acceso del equipo"], ["#/equipo/locales", "Tus locales"], ["#/equipo/clave", "Cambio de contraseña"], ["#/barra/mil948", "Barra Mil948"], ["#/barra/stiefel-pub", "Barra Stiefel Pub"]]],
    ["Administración", ["resumen", "pedidos", "menu", "disponibilidad", "negocio", "equipo"].map((t) => [`#/admin/mil948/${t}`, `Admin · ${t}`])],
  ];
  const SESSIONS = [
    ["", "Sin sesión"], ["maria@correo.demo", "Cliente · María"], ["new-customer", "Cliente nuevo (sin perfil)"],
    ["jorge@equipo.demo", "Empleado · Jorge (1 local)"], ["ana@equipo.demo", "Admin · Ana (2 locales)"], ["luis@equipo.demo", "Empleado · Luis (clave temporal)"],
  ];

  const css = `
  .rv-fab{position:fixed;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:90;height:40px;padding:0 14px;border-radius:999px;border:1px dashed #8a847d;background:#fff8;backdrop-filter:blur(6px);color:#0d0d0e;font:600 13px/1 InterVariable,system-ui;cursor:pointer}
  :root[data-theme=dark] .rv-fab{background:#0008;color:#f4f1ed}
  @media (min-width:1024px){.rv-fab{bottom:16px}}
  .rv-panel{position:fixed;inset:0 0 0 auto;width:min(360px,100%);z-index:91;background:#1b1b1d;color:#ece8e2;font:13px/1.45 InterVariable,system-ui;overflow:auto;padding:16px 16px 40px;box-shadow:-8px 0 24px #0006}
  .rv-panel h2{font:600 11px/1 InterVariable,system-ui;letter-spacing:.08em;text-transform:uppercase;color:#a8a29b;margin:18px 0 8px}
  .rv-panel select,.rv-panel button{font:inherit;color:#ece8e2;background:#2a2a2d;border:1px solid #444;border-radius:8px;min-height:36px;padding:0 10px}
  .rv-panel select{width:100%}.rv-panel button{cursor:pointer;margin:0 6px 6px 0}.rv-panel button[aria-pressed=true]{background:#741f2c;border-color:#741f2c}
  .rv-panel .rv-top{display:flex;justify-content:space-between;align-items:center}.rv-panel .rv-msg{min-height:20px;color:#8cd3ac}
  .rv-panel ul{margin:0;padding-left:18px;color:#cfc9c1}.rv-panel p{margin:0 0 8px;color:#a8a29b}.rv-panel a{color:#e2a2ab}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "rv-fab";
  fab.type = "button";
  fab.textContent = "Revisión";
  fab.setAttribute("aria-label", "Abrir barra de revisión de la maqueta");
  document.body.appendChild(fab);
  const panel = document.createElement("aside");
  panel.className = "rv-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Revisión de la maqueta");
  document.body.appendChild(panel);
  let info = { key: "", components: [] };
  let msg = "";

  const pressed = (cond) => `aria-pressed="${!!cond}"`;
  function draw() {
    const f = S.frame.get();
    const s = f.session;
    panel.innerHTML = `<div class="rv-top"><strong>Revisión · maqueta</strong><button data-rv="close" aria-label="Cerrar">✕</button></div>
      <p>No es parte del producto. Datos en este navegador. <a href="index.html">Índice</a> · <a href="flujo.html">Flujo cruzado</a> · <a href="componentes.html">Componentes</a></p>
      <h2>Ir a</h2><select data-rv="route"><option value="">Elegí una pantalla…</option>${ROUTES.map(([g, list]) => `<optgroup label="${g}">${list.map(([h, l]) => `<option value="${h}">${l}</option>`).join("")}</optgroup>`).join("")}</select>
      <h2>Sesión de este marco</h2><select data-rv="session">${SESSIONS.map(([v, l]) => `<option value="${v}" ${s && s.email === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <h2>Apariencia</h2>
      <button data-rv="theme" data-v="" ${pressed(!f.theme)}>Sistema</button><button data-rv="theme" data-v="light" ${pressed(f.theme === "light")}>Claro</button><button data-rv="theme" data-v="dark" ${pressed(f.theme === "dark")}>Oscuro</button><br>
      <button data-rv="bg" ${pressed(f.bg === "white")}>P-2: fondo blanco (pendiente)</button>
      <button data-rv="motion" ${pressed(f.motion === "reduce")}>Movimiento reducido</button>
      <h2>Estado de listas (Explorar, Pedidos)</h2>
      ${["normal", "cargando", "vacio", "error"].map((v) => `<button data-rv="view" data-v="${v}" ${pressed((f.view || "normal") === v)}>${v}</button>`).join("")}
      <h2>Dispositivo</h2>
      <button data-rv="offline" ${pressed(f.offline)}>Sin conexión</button><button data-rv="expire" ${pressed(f.expired)}>Vencer sesión</button>
      <h2>Simular (como si pasara en otro dispositivo)</h2>
      <button data-rv="sim" data-v="soldout">Agotar un producto del carrito</button><button data-rv="sim" data-v="price">Subir un precio del carrito</button>
      <button data-rv="sim" data-v="paused">Pausar local del carrito</button><button data-rv="sim" data-v="closed">Cerrar local del carrito</button><button data-rv="sim" data-v="open">Abrir local del carrito</button>
      <button data-rv="sim" data-v="accept">El local acepta mi pedido</button><button data-rv="sim" data-v="incoming">Pedido entrante en Mil948</button>
      <h2>Propuestas pendientes</h2><button data-rv="p1" ${pressed(f.p1)}>P-1: menú de local cerrado en solo lectura</button>
      <div class="rv-msg" role="status">${msg}</div>
      <h2>Componentes de esta pantalla</h2><ul>${info.components.map((c) => `<li>${c}</li>`).join("") || "<li>—</li>"}</ul>
      <h2>Reiniciar</h2><button data-rv="reset">Volver al estado inicial</button>`;
  }
  fab.addEventListener("click", () => { panel.hidden = false; draw(); panel.querySelector("select").focus(); });
  panel.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.rv === "route" && el.value) { location.hash = el.value.slice(1); }
    if (el.dataset.rv === "session") {
      S.signOut();
      const v = el.value;
      if (v === "new-customer") S.signInCustomer("nuevo" + Date.now().toString(36) + "@correo.demo", "");
      else if (v.endsWith("@correo.demo")) S.signInCustomer(v);
      else if (v) S.signInStaff(v);
      S.frame.set({ expired: false });
      location.hash = "/";
      window.OnzaApp.render();
    }
  });
  panel.addEventListener("click", (e) => {
    const el = e.target.closest("[data-rv]");
    if (!el || el.tagName === "SELECT") return;
    const f = S.frame.get();
    const v = el.dataset.v;
    msg = "";
    switch (el.dataset.rv) {
      case "close": panel.hidden = true; fab.focus(); return;
      case "theme": S.frame.set({ theme: v || null }); break;
      case "bg": S.frame.set({ bg: f.bg === "white" ? null : "white" }); break;
      case "motion": S.frame.set({ motion: f.motion === "reduce" ? null : "reduce" }); break;
      case "view": S.frame.set({ view: v }); break;
      case "offline": S.frame.set({ offline: !f.offline }); msg = f.offline ? "Conexión restablecida: se vuelve a consultar el estado." : "Este marco quedó sin conexión."; break;
      case "expire": S.frame.set({ expired: !f.expired }); msg = f.expired ? "Sesión vigente." : "La sesión venció: la próxima acción pide volver a entrar."; break;
      case "p1": S.frame.set({ p1: !f.p1 }); break;
      case "sim": {
        const map = { soldout: S.simulateSoldOut, price: S.simulatePriceChange, accept: S.simulateVenueAccepts, incoming: () => { S.simulateIncoming("mil948"); return "Entró un pedido nuevo en Mil948."; } };
        msg = map[v] ? map[v]() : S.simulateVenueState(v);
        break;
      }
      case "reset": S.reset(); location.hash = "/"; location.reload(); return;
    }
    window.OnzaApp.render();
    draw();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; fab.focus(); } });
  window.OnzaReview = { update(next) { info = next; if (!panel.hidden) draw(); } };
})();
