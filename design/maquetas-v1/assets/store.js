/* Onza V1 · estado y reglas de las maquetas.
   Imita las reglas del servidor real (GUIA.md §6) para que los flujos se puedan recorrer:
   - "mundo" compartido (localStorage + BroadcastChannel) = lo que sería la base de datos;
   - "marco" por ventana (sesión, conexión, sesión vencida) = lo que sería cada dispositivo.
   No hay red, autenticación ni pagos reales. */
(function () {
  "use strict";
  const WORLD_KEY = "onza-maqueta-v1-world";
  const params = new URLSearchParams(location.search);
  const FRAME = params.get("marco") || "main";
  const FRAME_KEY = "onza-maqueta-v1-frame-" + FRAME;
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("onza-maqueta-v1") : null;

  /* ---------- Errores con código, como /api/commands ---------- */
  class CommandError extends Error {
    constructor(code, message, detail) {
      super(message);
      this.code = code;
      this.detail = detail || null;
    }
  }

  /* ---------- Semilla ---------- */
  function seed() {
    const venues = {};
    const products = {};
    for (const fact of window.ONZA_FACTS) {
      const demo = window.ONZA_DEMO.venues[fact.slug];
      venues[fact.slug] = { ...fact, ...demo, categories: [] };
      window.ONZA_DEMO.menus[fact.slug].forEach(([category, items], ci) => {
        venues[fact.slug].categories.push(category);
        items.forEach(([name, desc, price, img], pi) => {
          const id = `${fact.slug}-${ci}-${pi}`;
          products[id] = { id, venue: fact.slug, cat: ci, name, desc, price, img, available: true, version: 1 };
        });
      });
    }
    const team = JSON.parse(JSON.stringify(window.ONZA_DEMO.team));
    const now = Date.now();
    const world = {
      rev: 1,
      venues,
      products,
      team,
      customers: JSON.parse(JSON.stringify(window.ONZA_DEMO.customers)),
      orders: [],
      attempts: {},
      nextNumber: 421,
    };
    // Pedidos sembrados en Mil948 para que la barra no arranque vacía.
    const mk = (customer, items, status, minutesAgo) => {
      const order = buildOrder(world, "mil948", customer, items);
      order.status = status;
      order.createdAt = now - minutesAgo * 60000;
      if (status !== "queued") order.acceptedAt = order.createdAt + 60000;
      if (status === "ready") order.readyAt = now - 2 * 60000;
      world.orders.push(order);
    };
    mk({ email: "sofia@correo.demo", name: "Sofía Vargas" }, [["mil948-1-0", 2]], "ready", 9);
    mk({ email: "otro@correo.demo", name: "Diego" }, [["mil948-0-0", 1], ["mil948-1-1", 2]], "preparing", 6);
    mk({ email: "otro2@correo.demo", name: "Camila" }, [["mil948-0-2", 1], ["mil948-2-0", 1]], "queued", 2);
    return world;
  }

  function code12() {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  function buildOrder(world, venue, customer, lines) {
    const items = lines.map(([pid, qty]) => {
      const p = world.products[pid];
      return { pid, name: p.name, qty, price: p.price };
    });
    const number = world.nextNumber++;
    return {
      id: "o" + number + "-" + Math.random().toString(36).slice(2, 6),
      number: String(number).padStart(4, "0"),
      venue,
      customer: customer.email,
      customerName: customer.name.split(" ")[0],
      items,
      total: items.reduce((s, i) => s + i.qty * i.price, 0),
      status: "queued",
      version: 1,
      createdAt: Date.now(),
      pickupCode: code12(),
      codeConsumed: false,
      pickupAttempts: 0,
      reason: "",
    };
  }

  /* ---------- Persistencia ---------- */
  function readWorld() {
    try {
      const raw = localStorage.getItem(WORLD_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* almacenamiento no disponible */ }
    const fresh = seed();
    writeWorld(fresh, false);
    return fresh;
  }
  function writeWorld(world, notify = true) {
    world.rev = (world.rev || 0) + 1;
    try { localStorage.setItem(WORLD_KEY, JSON.stringify(world)); } catch (e) { /* memoria */ }
    memoryWorld = world;
    if (notify && channel) channel.postMessage({ type: "world", rev: world.rev });
  }
  let memoryWorld = null;
  function world() {
    memoryWorld = readWorld();
    return memoryWorld;
  }

  function readFrame() {
    try { return JSON.parse(localStorage.getItem(FRAME_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeFrame(next) {
    try { localStorage.setItem(FRAME_KEY, JSON.stringify(next)); } catch (e) { /* memoria */ }
  }
  const frame = {
    get: readFrame,
    set(patch) { writeFrame({ ...readFrame(), ...patch }); },
    clear() { try { localStorage.removeItem(FRAME_KEY); } catch (e) { /* */ } },
  };

  /* ---------- Sesión (por marco) ---------- */
  function session() { return readFrame().session || null; }
  function memberships(email) {
    const w = world();
    const out = [];
    for (const [venue, people] of Object.entries(w.team)) {
      const person = people.find((p) => p.email === email);
      if (person) out.push({ venue, role: person.role, name: person.name, mustChange: !!person.mustChange });
    }
    return out;
  }
  function signInCustomer(email, name) {
    const w = world();
    let profile = w.customers.find((c) => c.email === email);
    if (memberships(email).length) throw new CommandError("STAFF_EMAIL", "Este correo es de una cuenta del equipo. Entrá por el acceso del equipo.");
    frame.set({ session: { kind: "customer", email, name: profile ? profile.name : name || "", onboarded: !!profile }, expired: false });
  }
  function signInStaff(email) {
    const list = memberships(email);
    if (!list.length) {
      const w = world();
      if (w.customers.some((c) => c.email === email)) throw new CommandError("CUSTOMER_EMAIL", "Esta es una cuenta personal. Para pedir, usá el acceso de clientes.");
      throw new CommandError("BAD_CREDENTIALS", "Correo o contraseña incorrectos.");
    }
    frame.set({ session: { kind: "staff", email, name: list[0].name }, expired: false });
    return list;
  }
  function signOut() {
    const s = session();
    // Logout voluntario: limpia datos locales de la cuenta (R6). La apariencia se conserva.
    if (s) try { localStorage.removeItem(cartKey(s.email)); } catch (e) { /* */ }
    const keep = readFrame();
    writeFrame({ theme: keep.theme });
  }
  function completeOnboarding(profile) {
    const w = world();
    if (w.customers.some((c) => c.username === profile.username) || window.ONZA_DEMO.takenUsernames.includes(profile.username))
      throw new CommandError("USERNAME_TAKEN", "Ese usuario ya existe. Probá con otro.");
    const s = session();
    w.customers.push({ email: s.email, name: profile.name, username: profile.username });
    writeWorld(w);
    frame.set({ session: { ...s, name: profile.name, onboarded: true } });
  }

  /* Comprobación común de cada comando (equivale al servidor). */
  function guard(kind) {
    const f = readFrame();
    if (f.offline) throw new CommandError("OFFLINE", "Sin conexión. No se hizo ningún cambio.");
    if (!f.session) throw new CommandError("SESSION_EXPIRED", "Tu sesión venció.");
    if (f.expired) throw new CommandError("SESSION_EXPIRED", "Tu sesión venció.");
    if (kind && f.session.kind !== kind) throw new CommandError("NOT_AUTHORIZED", "Esta cuenta no puede hacer esto.");
    return f.session;
  }
  function staffGuard(venue, adminOnly) {
    const s = guard("staff");
    const m = memberships(s.email).find((x) => x.venue === venue);
    if (!m) throw new CommandError("NOT_AUTHORIZED", "Ya no tenés acceso a este local.");
    if (m.mustChange) throw new CommandError("PASSWORD_CHANGE_REQUIRED", "Cambiá tu contraseña temporal para continuar.");
    if (adminOnly && m.role !== "admin") throw new CommandError("NOT_AUTHORIZED", "Solo el administrador del local puede hacer esto.");
    return { s, m };
  }

  /* ---------- Carrito (por cuenta; R6) ---------- */
  function cartKey(email) { return "onza-maqueta-v1-cart-" + (email || "anon"); }
  function cart() {
    const s = session();
    if (!s) return null;
    try { return JSON.parse(localStorage.getItem(cartKey(s.email))) || null; } catch (e) { return null; }
  }
  function saveCart(next) {
    const s = session();
    if (!s) return;
    try {
      if (next && next.items.length) localStorage.setItem(cartKey(s.email), JSON.stringify(next));
      else localStorage.removeItem(cartKey(s.email));
    } catch (e) { /* */ }
  }
  function cartQty(pid) {
    const c = cart();
    const line = c && c.items.find((i) => i.pid === pid);
    return line ? line.qty : 0;
  }
  /* Devuelve "conflict" si el carrito es de otro local (la UI pregunta reemplazar/conservar). */
  function addToCart(pid, replace) {
    const w = world();
    const p = w.products[pid];
    let c = cart();
    if (c && c.venue !== p.venue && !replace) return "conflict";
    if (!c || c.venue !== p.venue) c = { venue: p.venue, items: [] };
    const line = c.items.find((i) => i.pid === pid);
    if (line) line.qty = Math.min(line.qty + 1, 20);
    else c.items.push({ pid, qty: 1, price: p.price, version: p.version });
    saveCart(c);
    return "ok";
  }
  /* El stepper siempre permite bajar hasta quitar la línea: nada queda atrapado. */
  function setQty(pid, qty) {
    const c = cart();
    if (!c) return;
    const line = c.items.find((i) => i.pid === pid);
    if (!line) return;
    if (qty <= 0) c.items = c.items.filter((i) => i.pid !== pid);
    else line.qty = Math.min(qty, 20);
    saveCart(c);
  }
  function clearCart() { saveCart(null); }
  function acceptNewPrice(pid) {
    const c = cart();
    const p = world().products[pid];
    const line = c && c.items.find((i) => i.pid === pid);
    if (!line) return;
    line.price = p.price;
    line.version = p.version;
    saveCart(c);
  }
  function cartTotals(c) {
    if (!c) return { count: 0, total: 0 };
    return c.items.reduce((acc, i) => ({ count: acc.count + i.qty, total: acc.total + i.qty * i.price }), { count: 0, total: 0 });
  }

  /* ---------- Pedido: crear (idempotente) ---------- */
  function placeOrder(attemptKey) {
    const s = guard("customer");
    const w = world();
    if (w.attempts[attemptKey]) return w.orders.find((o) => o.id === w.attempts[attemptKey]); // doble envío → mismo pedido
    const c = cart();
    if (!c || !c.items.length) throw new CommandError("EMPTY_CART", "Tu carrito está vacío.");
    const venue = w.venues[c.venue];
    if (venue.openState === "closed") throw new CommandError("VENUE_CLOSED", `${venue.name} cerró. Tu carrito se guarda.`);
    if (venue.openState === "paused") throw new CommandError("VENUE_PAUSED", `${venue.name} pausó los pedidos. Probá en unos minutos.`);
    const active = w.orders.filter((o) => o.venue === c.venue && ["queued", "preparing"].includes(o.status)).length;
    if (active >= venue.capacity) throw new CommandError("VENUE_CAPACITY", "El local está al máximo de pedidos. Probá en unos minutos.");
    const issues = [];
    for (const line of c.items) {
      const p = w.products[line.pid];
      if (!p || !p.available) issues.push({ pid: line.pid, code: "OUT_OF_STOCK" });
      else if (p.version !== line.version) issues.push({ pid: line.pid, code: "PRICE_CHANGED", price: p.price });
    }
    if (issues.length) {
      const code = issues.some((i) => i.code === "OUT_OF_STOCK") ? "OUT_OF_STOCK" : "PRICE_CHANGED";
      throw new CommandError(code, code === "OUT_OF_STOCK" ? "Un producto se agotó. Quitalo para seguir." : "Cambió un precio. Revisalo para seguir.", issues);
    }
    const order = buildOrder(w, c.venue, { email: s.email, name: s.name || "Cliente" }, c.items.map((i) => [i.pid, i.qty]));
    w.orders.push(order);
    w.attempts[attemptKey] = order.id;
    writeWorld(w);
    clearCart();
    return order;
  }

  /* ---------- Pedido: transiciones con versión (un ganador) ---------- */
  function transition(orderId, expectedVersion, from, to, patch) {
    const w = world();
    const o = w.orders.find((x) => x.id === orderId);
    if (!o) throw new CommandError("NOT_FOUND", "No encontramos el pedido.");
    if (o.version !== expectedVersion || !from.includes(o.status)) {
      throw new CommandError("VERSION_CONFLICT", conflictMessage(o), { status: o.status });
    }
    Object.assign(o, patch || {}, { status: to, version: o.version + 1 });
    writeWorld(w);
    return o;
  }
  function conflictMessage(o) {
    return {
      preparing: "El local ya aceptó este pedido.",
      ready: "Este pedido ya está listo.",
      canceled: "Este pedido ya fue cancelado.",
      delivered: "Este pedido ya se entregó.",
    }[o.status] || "El pedido cambió. Mostramos su estado actual.";
  }
  function cancelByCustomer(orderId, version) {
    const s = guard("customer");
    const o = world().orders.find((x) => x.id === orderId);
    if (!o || o.customer !== s.email) throw new CommandError("NOT_AUTHORIZED", "Este pedido no es tuyo.");
    return transition(orderId, version, ["queued"], "canceled", { reason: "Cancelado por vos", canceledBy: "customer" });
  }
  function staffAction(orderId, version, action, reason) {
    const o = world().orders.find((x) => x.id === orderId);
    staffGuard(o.venue, false);
    if (action === "accept") return transition(orderId, version, ["queued"], "preparing", { acceptedAt: Date.now() });
    if (action === "ready") return transition(orderId, version, ["preparing"], "ready", { readyAt: Date.now() });
    if (action === "reject") {
      if (!reason || reason.trim().length < 3) throw new CommandError("REASON_REQUIRED", "Escribí un motivo de al menos 3 caracteres.");
      return transition(orderId, version, ["queued"], "canceled", { reason: reason.trim(), canceledBy: "venue" });
    }
    throw new CommandError("INVALID", "Acción no válida.");
  }
  /* Validar retiro: código privado de 12 caracteres, un solo uso, del local correcto. Nunca el número público. */
  function validatePickup(venue, raw) {
    staffGuard(venue, false);
    const input = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const w = world();
    if (/^\d{1,4}$/.test(input)) throw new CommandError("PUBLIC_NUMBER", "Ese es el número público del pedido. Pedí el código privado del ticket o escaneá el QR.");
    if (input.length !== 12) throw new CommandError("INVALID_CODE", "El código tiene 12 caracteres. Revisalo con el cliente.");
    const order = w.orders.find((o) => o.pickupCode === input);
    if (!order) throw new CommandError("INVALID_CODE", "Código no válido. Revisalo con el cliente.");
    if (order.venue !== venue) throw new CommandError("OTHER_VENUE", "Este código es de otro local.");
    if (order.codeConsumed || order.status === "delivered") throw new CommandError("CONSUMED", `Este código ya se usó: #${order.number} se entregó.`);
    if (order.status !== "ready") throw new CommandError("NOT_READY", `#${order.number} todavía no está listo.`);
    order.codeConsumed = true;
    order.status = "delivered";
    order.version += 1;
    order.deliveredAt = Date.now();
    writeWorld(w);
    return order;
  }
  function setVenueState(venue, state) {
    const { m } = staffGuard(venue, false);
    if (state === "closed" && m.role !== "admin") throw new CommandError("NOT_AUTHORIZED", "Solo el administrador puede cerrar el local.");
    const w = world();
    w.venues[venue].openState = state;
    writeWorld(w);
  }

  /* ---------- Administración ---------- */
  function saveProduct(venue, data) {
    staffGuard(venue, true);
    const w = world();
    const price = Number(data.price);
    if (!data.name || data.name.trim().length < 1) throw new CommandError("INVALID", "Escribí un nombre.");
    if (!Number.isInteger(price) || price < 0) throw new CommandError("INVALID", "El precio debe ser un número entero en colones.");
    if (data.id) {
      const p = w.products[data.id];
      const priceChanged = p.price !== price;
      Object.assign(p, { name: data.name.trim(), desc: data.desc.trim(), price, cat: Number(data.cat) });
      if (priceChanged) p.version += 1; // invalida carritos con el precio anterior
    } else {
      const id = `${venue}-n${Date.now()}`;
      w.products[id] = { id, venue, cat: Number(data.cat), name: data.name.trim(), desc: data.desc.trim(), price, img: "cocktail", available: true, version: 1 };
    }
    writeWorld(w);
  }
  function setAvailable(pid, available) {
    const w = world();
    staffGuard(w.products[pid].venue, false);
    w.products[pid].available = available;
    writeWorld(w);
  }
  function tempPassword() {
    const words = ["barra", "ronda", "hielo", "limon", "copa", "noche"];
    return words[Math.floor(Math.random() * words.length)] + "-" + Math.floor(1000 + Math.random() * 9000) + "-" + code12().slice(0, 4).toLowerCase();
  }
  function addMember(venue, data) {
    staffGuard(venue, true);
    const w = world();
    const email = String(data.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new CommandError("INVALID_EMAIL", "Escribí un correo válido.");
    if (!data.name || data.name.trim().length < 2) throw new CommandError("INVALID_NAME", "Escribí el nombre de la persona.");
    if (w.customers.some((c) => c.email === email)) throw new CommandError("CUSTOMER_EMAIL", "Ese correo ya es de una cuenta personal. Usá otro correo para la cuenta laboral.");
    if (w.team[venue].some((p) => p.email === email)) throw new CommandError("ALREADY_MEMBER", "Esa persona ya es parte del equipo.");
    const existing = memberships(email);
    const password = existing.length ? null : tempPassword();
    w.team[venue].push({ email, name: data.name.trim(), role: data.role === "admin" ? "admin" : "employee", mustChange: !existing.length || existing.some((m) => m.mustChange) });
    writeWorld(w);
    return { password, existing: existing.length > 0 };
  }
  function adminsOf(w, venue) { return w.team[venue].filter((p) => p.role === "admin"); }
  function setRole(venue, email, role) {
    const { s } = staffGuard(venue, true);
    const w = world();
    const person = w.team[venue].find((p) => p.email === email);
    if (person.role === "admin" && role !== "admin" && adminsOf(w, venue).length === 1) throw new CommandError("LAST_ADMIN", "El local necesita al menos un administrador.");
    if (email === s.email && role !== "admin") throw new CommandError("SELF", "No podés quitarte tu propio permiso de administrador.");
    person.role = role;
    writeWorld(w);
  }
  /* Revocar: borra solo la membresía de ESTE local. Las demás quedan intactas. */
  function revoke(venue, email) {
    const { s } = staffGuard(venue, true);
    const w = world();
    const person = w.team[venue].find((p) => p.email === email);
    if (!person) return;
    if (email === s.email) throw new CommandError("SELF", "No podés quitarte tu propio acceso.");
    if (person.role === "admin" && adminsOf(w, venue).length === 1) throw new CommandError("LAST_ADMIN", "El local necesita al menos un administrador.");
    w.team[venue] = w.team[venue].filter((p) => p.email !== email);
    writeWorld(w);
  }
  function changePassword(pw, repeat) {
    const s = guard("staff");
    if (!pw || pw.length < 10) throw new CommandError("WEAK", "Usá al menos 10 caracteres.");
    if (pw !== repeat) throw new CommandError("MISMATCH", "Las contraseñas no coinciden.");
    const w = world();
    for (const people of Object.values(w.team)) for (const p of people) if (p.email === s.email) delete p.mustChange;
    writeWorld(w);
  }

  /* ---------- Simulaciones de la barra de revisión ---------- */
  function simulateIncoming(venue) {
    const w = world();
    const ids = Object.values(w.products).filter((p) => p.venue === venue && p.available).map((p) => p.id);
    const pick = () => ids[Math.floor(Math.random() * ids.length)];
    const names = ["Luis", "Andrea", "Pablo", "Valeria", "Tomás"];
    const order = buildOrder(w, venue, { email: "sim@correo.demo", name: names[Math.floor(Math.random() * names.length)] }, [[pick(), 1 + Math.floor(Math.random() * 2)]]);
    w.orders.push(order);
    writeWorld(w);
  }
  function simulateSoldOut() {
    const c = cart();
    const w = world();
    if (!c) return "Agregá algo al carrito primero.";
    w.products[c.items[0].pid].available = false;
    writeWorld(w);
    return `${w.products[c.items[0].pid].name} quedó agotado.`;
  }
  function simulatePriceChange() {
    const c = cart();
    const w = world();
    if (!c) return "Agregá algo al carrito primero.";
    const p = w.products[c.items[c.items.length - 1].pid];
    p.price += 500;
    p.version += 1;
    writeWorld(w);
    return `${p.name} ahora cuesta ₡${p.price}.`;
  }
  function simulateVenueState(state) {
    const c = cart();
    const w = world();
    const slug = c ? c.venue : "mil948";
    w.venues[slug].openState = state;
    writeWorld(w);
    return `${w.venues[slug].name}: ${state === "open" ? "abierto" : state === "paused" ? "pausado" : "cerrado"}.`;
  }
  function simulateVenueAccepts() {
    const s = session();
    const w = world();
    const o = w.orders.filter((x) => x.status === "queued" && (!s || x.customer === s.email)).pop();
    if (!o) return "No hay un pedido tuyo esperando aceptación.";
    o.status = "preparing";
    o.version += 1;
    o.acceptedAt = Date.now();
    writeWorld(w);
    return `El local aceptó #${o.number}.`;
  }
  function reset() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("onza-maqueta-v1")).forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* */ }
    memoryWorld = null;
    if (channel) channel.postMessage({ type: "reset" });
  }

  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); }
  if (channel) channel.onmessage = (event) => listeners.forEach((fn) => fn(event.data));
  window.addEventListener("storage", (event) => {
    if (event.key === WORLD_KEY || event.key === null) listeners.forEach((fn) => fn({ type: "world" }));
  });

  window.OnzaStore = {
    FRAME, CommandError, world, frame, session, memberships,
    signInCustomer, signInStaff, signOut, completeOnboarding,
    cart, cartQty, addToCart, setQty, clearCart, acceptNewPrice, cartTotals,
    placeOrder, cancelByCustomer, staffAction, validatePickup, setVenueState,
    saveProduct, setAvailable, addMember, setRole, revoke, changePassword, staffGuard,
    simulateIncoming, simulateSoldOut, simulatePriceChange, simulateVenueState, simulateVenueAccepts,
    reset, onChange,
  };
})();
