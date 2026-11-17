/* Bocetos Onza · prototipo estático. Datos ficticios en memoria: sin autenticación, pagos ni red. */
(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), layer = $('#layer');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₡' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---------- Iconos (trazos estilo Lucide) ---------- */
const IC = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8M16 12H8M13 16H8"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  wine: '<path d="M8 22h8M7 10h10M12 15v7M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>',
  store: '<path d="m3 9 1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
};
const ico = (n, c = '') => `<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const GOOGLE = '<svg class="gmark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const logo = (cls = '') => `<img class="logo-light ${cls}" src="assets/brand/onza-wordmark.svg" alt="onza"><img class="logo-dark ${cls}" src="assets/brand/onza-wordmark-white.svg" alt="onza">`;

/* ---------- Datos ficticios ---------- */
const VENUES = {
  'sala-norte': { name: 'Sala Norte', zone: 'Barrio Escalante', open: true, dist: 350, hours: 'Hasta las 2:00 a. m.', pickup: 'Barra principal', logo: 'sala-norte-logo.png', cover: 'sala-norte-cover.jpg', addr: 'Av. 9, calle 33, Escalante', lat: '9.9366', lng: '-84.0634' },
  'patio-central': { name: 'Patio Central', zone: 'Centro de San José', open: true, dist: 1200, hours: 'Hasta la 1:00 a. m.', pickup: 'Barra del patio', logo: 'patio-central-logo.png', cover: 'patio-central-cover.jpg', addr: 'Calle 7, avenida 1', lat: '9.9341', lng: '-84.0778' },
  'club-cero': { name: 'Club Cero', zone: 'Barrio Amón', open: false, dist: 2100, hours: 'Abre a las 9:00 p. m.', pickup: 'Barra', logo: 'club-cero-logo.png', cover: 'club-cero-cover.jpg' },
  'la-ultima': { name: 'La Última', zone: 'Los Yoses', open: false, dist: 3400, hours: 'Abre el viernes', pickup: 'Barra', logo: null }
};
const CATS = ['Cocteles', 'Cerveza y vino', 'Shots', 'Sin alcohol'];
const mkProducts = () => ({
  'sala-norte': [
    { id: 'p1', cat: 0, name: 'Margarita', desc: 'Tequila, limón y sal en el borde.', price: 4500, img: 'cocktail.png', on: true },
    { id: 'p2', cat: 0, name: 'Negroni', desc: 'Gin, vermut rojo y Campari, con naranja.', price: 5000, img: 'cocktail.png', on: true },
    { id: 'p3', cat: 0, name: 'Gin tonic', desc: 'Gin, tónica y pepino.', price: 4800, img: 'highball.png', on: true },
    { id: 'p4', cat: 1, name: 'Cerveza Imperial', desc: 'Botella fría, 350 ml.', price: 2500, img: 'beer.png', on: true },
    { id: 'p5', cat: 1, name: 'Vino tinto', desc: 'Copa de la casa, Malbec.', price: 3800, img: 'wine.png', on: true },
    { id: 'p6', cat: 2, name: 'Shot de tequila', desc: 'Reposado, con limón y sal.', price: 2200, img: 'shot.png', on: true },
    { id: 'p7', cat: 2, name: 'Shot de mezcal', desc: 'Joven, con naranja y sal de gusano.', price: 2800, img: 'shot.png', on: true },
    { id: 'p8', cat: 3, name: 'Limonada de hierbabuena', desc: 'Con soda, sin azúcar añadida.', price: 1800, img: 'soft.png', on: false },
    { id: 'p9', cat: 3, name: 'Soda con limón', desc: 'Botella de 355 ml.', price: 1500, img: 'soft.png', on: true }
  ],
  'patio-central': [
    { id: 'q1', cat: 0, name: 'Mojito', desc: 'Ron blanco, hierbabuena y lima.', price: 4200, img: 'highball.png', on: true },
    { id: 'q2', cat: 1, name: 'Cerveza artesanal', desc: 'Pale ale local, 330 ml.', price: 3200, img: 'beer.png', on: true },
    { id: 'q3', cat: 3, name: 'Agua mineral', desc: 'Con o sin gas.', price: 1200, img: 'soft.png', on: true }
  ]
});
const now0 = Date.now();
const ago = (m) => now0 - m * 60000;
const seedOrders = () => [
  { id: 'o424', no: '0424', venue: 'sala-norte', who: 'Sofía', items: [{ n: 'Gin tonic', q: 2, p: 4800 }], status: 'ready', t: ago(9), st: ago(2), code: 'H4NP-7WQ2-MX8D', mine: false },
  { id: 'o421', no: '0421', venue: 'sala-norte', who: 'Diego', items: [{ n: 'Negroni', q: 1, p: 5000 }, { n: 'Cerveza Imperial', q: 2, p: 2500 }], status: 'preparing', t: ago(6), st: ago(4), code: 'R8TC-2KDM-PW5Z', mine: false },
  { id: 'o422', no: '0422', venue: 'sala-norte', who: 'Luis', items: [{ n: 'Cerveza Imperial', q: 2, p: 2500 }], status: 'new', t: ago(3), st: ago(3), code: 'D9XM-4HQA-J6NE', mine: false },
  { id: 'o423', no: '0423', venue: 'sala-norte', who: 'Camila', items: [{ n: 'Margarita', q: 1, p: 4500 }, { n: 'Shot de tequila', q: 1, p: 2200 }], status: 'new', t: ago(1), st: ago(1), code: 'W3FB-8MRT-C2YK', mine: false },
  { id: 'o420', no: '0420', venue: 'sala-norte', who: 'Andrés', items: [{ n: 'Vino tinto', q: 2, p: 3800 }], status: 'done', t: ago(41), st: ago(30), code: 'N5ZP-6TQD-A9GH', mine: false },
  { id: 'o419', no: '0419', venue: 'sala-norte', who: 'Valeria', items: [{ n: 'Margarita', q: 2, p: 4500 }], status: 'cancelled', t: ago(55), st: ago(52), code: 'B7KE-3XJW-S4MC', mine: false },
  { id: 'o398', no: '0398', venue: 'patio-central', who: 'Ana', items: [{ n: 'Mojito', q: 2, p: 4200 }], status: 'done', t: ago(60 * 24 * 3), st: ago(60 * 24 * 3), code: 'T2HG-9PLV-E7QX', mine: true, day: 'Hace 3 días' }
];
const seedMembers = () => [
  { id: 'm1', name: 'Marta Solano', email: 'marta@salanorte.cr', role: 'administrador', me: true },
  { id: 'm2', name: 'Jorge Mora', email: 'jorge@salanorte.cr', role: 'empleado' },
  { id: 'm3', name: 'Paola Vega', email: 'paola@salanorte.cr', role: 'empleado' }
];
const fresh = () => ({
  session: null, onboarded: false, google: null, next: null, want: null, authMode: 'in',
  theme: 'system', loc: false, search: '', cat: 0, cart: { venue: null, lines: {} },
  orders: seedOrders(), products: mkProducts(), members: seedMembers(), venues: JSON.parse(JSON.stringify(VENUES)),
  last: null, no: 427, prefs: { news: false, offers: false },
  profile: { name: 'Ana Rojas', user: 'anarojas', email: 'ana.rojas@gmail.com', phone: '8888 1234', cc: '+506' },
  recv: true, barTab: 'new', adminFilter: 'all', draftEmail: ''
});
let S = fresh();
const venueOf = (id) => S.venues[id];

/* ---------- Utilidades de estado ---------- */
const cartCount = () => Object.values(S.cart.lines).reduce((a, b) => a + b, 0);
const prod = (v, id) => (S.products[v] || []).find((p) => p.id === id);
const cartItems = () => Object.entries(S.cart.lines).map(([id, q]) => ({ p: prod(S.cart.venue, id), q })).filter((x) => x.p);
const cartTotal = () => cartItems().reduce((a, x) => a + x.p.price * x.q, 0);
const orderTotal = (o) => o.items.reduce((a, i) => a + i.p * i.q, 0);
const orderQty = (o) => o.items.reduce((a, i) => a + i.q, 0);
const mins = (t) => Math.max(0, Math.round((Date.now() - t) / 60000));
const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const myOrders = () => S.orders.filter((o) => o.mine);
const ACTIVE = ['new', 'preparing', 'ready'];
const STATUS_LABEL = { new: 'Recibido', preparing: 'Preparando', ready: 'Listo para recoger', done: 'Entregado', cancelled: 'Cancelado', rejected: 'Rechazado' };
const home = () => (S.session && S.session.kind === 'staff' ? (S.session.role === 'administrador' ? '#/equipo/barra' : '#/equipo/barra') : '#/explorar');

/* ---------- Tema ---------- */
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
}

/* ---------- Router y guardas ---------- */
const CUSTOMER_PROTECTED = /^\/(explorar|local\/|carrito|checkout|pedido|pedidos|cuenta)/;
function parse() {
  const raw = (location.hash || '#/').slice(1) || '/';
  return raw.split('?')[0];
}
function guard(path) {
  const s = S.session;
  if (path === '/' ) return s ? (s.kind === 'staff' ? home().slice(1) : '/explorar') : '/acceso';
  if (path.startsWith('/qr/')) return path;
  if (CUSTOMER_PROTECTED.test(path)) {
    if (!s) { S.next = '#' + path; return '/acceso'; }
    if (s.kind === 'staff') { S.want = 'customer'; return '/sesion-activa'; }
    if (!S.onboarded) return '/onboarding';
    return path;
  }
  if (['/acceso', '/confirmar', '/recuperar'].includes(path)) {
    if (s && s.kind === 'staff') { S.want = 'customer'; return '/sesion-activa'; }
    if (s && S.onboarded) return S.next ? S.next.slice(1) : '/explorar';
    return path;
  }
  if (path === '/onboarding') return (s || S.google) ? path : '/acceso';
  if (path === '/equipo/acceso') {
    if (s && s.kind === 'customer') { S.want = 'staff'; return '/sesion-activa'; }
    if (s && s.kind === 'staff') return home().slice(1);
    return path;
  }
  if (path.startsWith('/equipo/')) {
    if (!s) return '/equipo/acceso';
    if (s.kind === 'customer') { S.want = 'staff'; return '/sesion-activa'; }
    if (path.startsWith('/equipo/admin') && s.role !== 'administrador') return '/equipo/barra';
    return path;
  }
  return path;
}
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  let path = parse();
  const g = guard(path);
  if (g !== path) { history.replaceState(null, '', '#' + g); path = g; }
  const key = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  const y = window.scrollY;
  const r = routes(path);
  document.title = (r.title ? r.title + ' · ' : '') + 'Onza · Bocetos';
  app.innerHTML = r.html;
  if (r.after) r.after();
  window.scrollTo(0, r.keepScroll ? y : (render.last === path ? y : 0));
  render.last = path;
  if (key) { const el = app.querySelector(`[data-k="${key}"]`); if (el) el.focus({ preventScroll: true }); }
  syncBx(path);
}

function routes(p) {
  let m;
  if (p === '/acceso') return vAcceso();
  if (p === '/confirmar') return vConfirmar();
  if (p === '/recuperar') return vRecuperar();
  if (p === '/onboarding') return vOnboarding();
  if (p === '/explorar') return vExplorar();
  if ((m = p.match(/^\/local\/([\w-]+)$/))) return vLocal(m[1]);
  if (p === '/carrito') return vCarrito();
  if (p === '/checkout') return vCheckout();
  if ((m = p.match(/^\/pedido\/([\w-]+)$/))) return vPedido(m[1]);
  if (p === '/pedidos') return vPedidos();
  if (p === '/cuenta') return vCuenta();
  if ((m = p.match(/^\/legal\/(condiciones|privacidad)$/))) return vLegal(m[1]);
  if (p === '/sesion-activa') return vSesionActiva();
  if ((m = p.match(/^\/qr\/([\w-]+)$/))) return vQr(m[1]);
  if (p === '/equipo/acceso') return vEquipoAcceso();
  if (p === '/equipo/barra') return vBarra();
  if ((m = p.match(/^\/equipo\/admin\/(resumen|pedidos|menu|local|equipo)$/))) return vAdmin(m[1]);
  return { title: 'No encontrado', html: `<div class="auth"><div class="box">${logo('logo')}<h1 class="title">No encontramos esa pantalla</h1><a class="btn" href="#/">Volver al inicio</a></div></div>` };
}

/* ---------- Estructuras compartidas ---------- */
function customerShell(inner, o = {}) {
  const tab = o.tab !== false;
  const cur = (k) => (o.active === k ? ' aria-current="page"' : '');
  const showCart = cartCount() > 0 && !o.hideCart;
  const cl = showCart ? `<a class="cartlink" href="#/carrito" aria-label="Carrito de ${esc(venueOf(S.cart.venue).name)}, ${cartCount()} productos">${ico('bag')}<span class="t">${esc(venueOf(S.cart.venue).name)}</span><span class="num">· ${cartCount()}</span></a>` : '';
  return `<header class="cs-top"><div class="in-top"><a class="brand-mark" href="#/explorar" aria-label="onza, Explorar">${logo()}</a>
    <nav class="nav-d" aria-label="Principal"><a href="#/explorar"${cur('explorar')}>Explorar</a><a href="#/pedidos"${cur('pedidos')}>Pedidos</a><a href="#/cuenta"${cur('cuenta')}>Cuenta</a></nav>${cl}</div></header>
    <main class="page ${o.cls || ''}">${inner}</main>
    ${tab ? `<nav class="tabbar" aria-label="Principal"><a href="#/explorar"${cur('explorar')}>${ico('compass')}Explorar</a><a href="#/pedidos"${cur('pedidos')}>${ico('receipt')}Pedidos</a><a href="#/cuenta"${cur('cuenta')}>${ico('user')}Cuenta</a></nav>` : ''}`;
}
function teamShell(inner, o = {}) {
  const s = S.session; const v = venueOf('sala-norte');
  const admin = s.role === 'administrador';
  const links = admin ? `<a class="btn sm ghost" href="#/equipo/barra"${o.where === 'barra' ? ' aria-current="page"' : ''}>Barra</a><a class="btn sm ghost" href="#/equipo/admin/resumen"${o.where === 'admin' ? ' aria-current="page"' : ''}>Administración</a>` : '';
  return `<header class="ts-top"><div class="in-top"><span class="brand-mark" style="height:auto">${logo()}</span><span class="lab">Equipo</span>
    <div class="grow"><div style="font-weight:600;line-height:20px">${esc(v.name)}</div><div class="hint">${esc(s.name)} · ${admin ? 'Administrador' : 'Empleado'}</div></div>
    ${links}<button class="btn sm sec" data-a="logout" data-k="out">${ico('out')}<span>Salir</span></button></div></header>${inner}`;
}
function backBtn(h, label = 'Volver') { return `<button class="back" data-a="go" data-h="${h}" aria-label="${label}">${ico('left')}</button>`; }
function avatar(id, cls = '') {
  const v = venueOf(id);
  return v.logo ? `<img class="av ${cls}" src="assets/venues/${v.logo}" alt="">` : `<div class="av ${cls}" aria-hidden="true">${esc(v.name[0])}</div>`;
}
function statusBadge(v) { return v.open ? '<span class="badge ok"><span class="dot"></span>Abierto</span>' : '<span class="badge">Cerrado</span>'; }
function distTxt(d) { return d < 1000 ? d + '\u00a0m' : (d / 1000).toFixed(1).replace('.', ',') + '\u00a0km'; }

/* ---------- Acceso cliente ---------- */
function vAcceso() {
  const up = S.authMode === 'up';
  const qr = S.next && S.next.startsWith('#/local/') ? venueOf(S.next.split('/')[2]) : null;
  return { title: 'Acceso', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    ${qr ? `<div class="rowf"><span class="badge brand">${ico('pin')}Menú de ${esc(qr.name)}</span></div>` : ''}
    <h1 class="title">${up ? 'Creá tu cuenta' : 'Ingresá a Onza'}</h1>
    <div class="seg" role="group" aria-label="Modo de acceso"><button type="button" data-a="authmode" data-m="in" aria-pressed="${!up}">Ingresar</button><button type="button" data-a="authmode" data-m="up" aria-pressed="${up}">Crear cuenta</button></div>
    <form class="stack t" id="f-acceso" novalidate>
      <div class="field"><label for="a-mail">Correo</label><input class="in" id="a-mail" type="email" autocomplete="email" inputmode="email" value="${esc(S.draftEmail)}" placeholder="nombre@correo.com"><span class="err" id="e-mail" hidden></span></div>
      <div class="field"><label for="a-pass">Contraseña</label><input class="in" id="a-pass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"><span class="err" id="e-pass" hidden></span></div>
      ${up ? `<div class="field"><label for="a-pass2">Confirmá la contraseña</label><input class="in" id="a-pass2" type="password" autocomplete="new-password"><span class="err" id="e-pass2" hidden></span></div>` : ''}
      <button class="btn block" type="submit">${up ? 'Crear cuenta' : 'Ingresar'}</button>
      ${up ? '' : '<a class="btn ghost block" href="#/recuperar">¿Olvidaste tu contraseña?</a>'}
    </form>
    <div class="or">o</div>
    <div class="stack t">
      <button class="btn sec block g" type="button" data-a="google">${GOOGLE}Continuar con Google</button>
      <button class="btn sec block g" type="button" disabled aria-disabled="true">Continuar con Apple <span class="badge">Próximamente</span></button>
    </div>
    <p class="foot meta">¿Sos personal? <a href="#/equipo/acceso">Acceso para el equipo</a></p>
  </div></main>` };
}
function vConfirmar() {
  return { title: 'Confirmá tu correo', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    <div class="ini" style="width:56px;height:56px">${ico('mail')}</div>
    <h1 class="title">Revisá tu correo</h1>
    <p class="muted">Te enviamos un enlace de confirmación a <b style="color:var(--onza-text)">${esc(S.draftEmail || 'tu correo')}</b>.</p>
    <div class="stack t">
      <button class="btn block" data-a="confirmed">Abrir el enlace del correo</button>
      <button class="btn sec block" data-a="resend">Reenviar correo</button>
      <a class="btn ghost block" href="#/acceso">Usar otro correo</a>
    </div></div></main>` };
}
function vRecuperar() {
  return { title: 'Recuperar contraseña', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    <h1 class="title">Recuperá tu contraseña</h1>
    <p class="muted">Ingresá tu correo y te enviamos un enlace para crear una nueva.</p>
    <form class="stack t" id="f-rec" novalidate>
      <div class="field"><label for="r-mail">Correo</label><input class="in" id="r-mail" type="email" autocomplete="email" inputmode="email" placeholder="nombre@correo.com"><span class="err" id="e-rmail" hidden></span></div>
      <button class="btn block" type="submit">Enviar enlace</button>
      <a class="btn ghost block" href="#/acceso">Volver</a>
    </form></div></main>` };
}

/* ---------- Onboarding ---------- */
function vOnboarding() {
  const g = S.google; const pf = S.profile;
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const ms = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  const y0 = new Date().getFullYear();
  const ys = Array.from({ length: 90 }, (_, i) => `<option value="${y0 - i}">${y0 - i}</option>`).join('');
  const ccs = [['+506', 'CR +506'], ['+507', 'PA +507'], ['+505', 'NI +505'], ['+504', 'HN +504'], ['+503', 'SV +503'], ['+502', 'GT +502'], ['+52', 'MX +52'], ['+57', 'CO +57'], ['+34', 'ES +34'], ['+1', 'US/CA +1']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  const dest = S.next && S.next.startsWith('#/local/') ? venueOf(S.next.split('/')[2]).name : null;
  return { title: 'Completá tu perfil', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    <div><h1 class="title">Completá tu perfil</h1>${dest ? `<p class="muted" style="margin-top:8px">Después seguís al menú de ${esc(dest)}.</p>` : ''}</div>
    <form class="stack" id="f-onb" novalidate>
      ${g ? `<div class="summary"><div class="sumrow"><span class="muted">Correo</span><span>${esc(g.email)}</span></div></div>` : ''}
      <div class="field"><label for="o-name">Nombre</label><input class="in" id="o-name" autocomplete="name" value="${esc(g ? g.name : '')}"><span class="err" id="e-name" hidden></span></div>
      <div class="field"><label for="o-user">@usuario</label><input class="in" id="o-user" autocapitalize="none" autocomplete="username" placeholder="tuusuario"><span class="hint">Letras, números, punto o guion bajo. Es único.</span><span class="err" id="e-user" hidden></span></div>
      <div class="field"><label for="o-phone">Teléfono</label><div class="phone"><select class="in" id="o-cc" aria-label="Código de país">${ccs}</select><input class="in" id="o-phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="8888 1234"></div><span class="hint">No se verifica por SMS.</span><span class="err" id="e-phone" hidden></span></div>
      <div class="field"><span class="lbl" id="dob-l">Fecha de nacimiento</span><div class="dob" role="group" aria-labelledby="dob-l"><select class="in" id="o-d" aria-label="Día"><option value="">Día</option>${days}</select><select class="in" id="o-m" aria-label="Mes"><option value="">Mes</option>${ms}</select><select class="in" id="o-y" aria-label="Año"><option value="">Año</option>${ys}</select></div><span class="hint">Onza es para mayores de 18 años.</span><span class="err" id="e-dob" hidden></span></div>
      <div class="stack t">
        <label class="chk"><input type="checkbox" id="o-terms"><span>Acepto las <a href="#/legal/condiciones">condiciones</a> y la <a href="#/legal/privacidad">política de privacidad</a>.</span></label>
        <span class="err" id="e-terms" hidden></span>
        <hr class="divider">
        <label class="chk"><input type="checkbox" id="o-news"><span>Quiero recibir novedades de Onza</span></label>
        <label class="chk"><input type="checkbox" id="o-offers"><span>Quiero recibir ofertas de mis discotecas favoritas</span></label>
      </div>
      <button class="btn block" type="submit">Continuar</button>
    </form></div></main>` };
}

/* ---------- Explorar ---------- */
function vExplorar() {
  const q = S.search.trim().toLowerCase();
  let list = Object.entries(S.venues).map(([id, v]) => ({ id, ...v })).filter((v) => !q || (v.name + ' ' + v.zone).toLowerCase().includes(q));
  const open = list.filter((v) => v.open).sort((a, b) => (S.loc ? a.dist - b.dist : a.name.localeCompare(b.name)));
  const closed = list.filter((v) => !v.open).sort((a, b) => a.name.localeCompare(b.name));
  let feat = null;
  if (S.loc && !q && open.length && open[0].dist <= 2000) feat = open[0];
  const rest = feat ? open.filter((v) => v.id !== feat.id) : open;
  const row = (v, off) => off
    ? `<div class="item off" aria-disabled="true">${avatar(v.id)}<div class="grow"><div class="vname">${esc(v.name)}</div><div class="meta">${esc(v.zone)}</div><div class="meta">${esc(v.hours)}</div></div><span class="badge">Cerrado</span></div>`
    : `<a class="item" href="#/local/${v.id}">${avatar(v.id)}<div class="grow"><div class="vname">${esc(v.name)}</div><div class="meta">${esc(v.zone)}${S.loc ? ' · ' + distTxt(v.dist) : ''}</div><div class="meta">${esc(v.hours)}</div></div>${statusBadge(v)}${ico('right')}</a>`;
  const body = `
    <div class="stack t" style="margin-bottom:var(--onza-space-8)">
      <h1 class="title">Explorar</h1>
      <div class="srch"><label class="sr" for="x-q">Buscar local</label>${ico('search')}<input class="in" id="x-q" type="search" placeholder="Buscar local o zona" value="${esc(S.search)}" autocomplete="off"></div>
      <div class="rowf"><button class="btn sm sec" data-a="loc" data-k="loc">${ico('pin')}${S.loc ? 'Ubicación activa' : 'Usar ubicación'}</button>${S.loc ? '<span class="meta">Ordenado por cercanía</span>' : '<span class="meta">Ordenado por nombre</span>'}</div>
    </div>
    ${feat ? `<h2 class="sec-h">Más cerca de ti</h2><a class="feat" href="#/local/${feat.id}"><img class="cover" src="assets/venues/${feat.cover}" alt=""><div class="body">${avatar(feat.id, 'sm')}<div class="grow"><div class="vname">${esc(feat.name)}</div><div class="meta">${esc(feat.zone)} · ${distTxt(feat.dist)}</div><div class="meta">${esc(feat.hours)}</div></div>${statusBadge(feat)}</div></a>` : ''}
    ${rest.length ? `<h2 class="sec-h">${feat ? 'Otros abiertos' : 'Abiertos ahora'}</h2><div class="list venues">${rest.map((v) => row(v)).join('')}</div>` : (!feat && !closed.length ? '<div class="empty">No encontramos locales con esa búsqueda.</div>' : '')}
    ${closed.length ? `<h2 class="sec-h">Cerrados</h2><div class="list venues">${closed.map((v) => row(v, true)).join('')}</div>` : ''}`;
  return { title: 'Explorar', keepScroll: true, html: customerShell(body, { active: 'explorar' }),
    after() { const i = $('#x-q'); i.addEventListener('input', () => { S.search = i.value; const pos = i.selectionStart; render(); const n = $('#x-q'); n.focus(); n.setSelectionRange(pos, pos); }); } };
}

/* ---------- Menú ---------- */
function vLocal(id) {
  const v = venueOf(id);
  if (!v) return { title: 'Local', html: customerShell('<div class="empty">Este local no existe.</div>') };
  const items = S.products[id] || [];
  const mine = S.cart.venue === id && cartCount() > 0;
  const head = `<div class="vhead">${backBtn('#/explorar', 'Volver a Explorar')}${avatar(id, 'sm')}<div class="grow"><h1 class="h2" style="line-height:24px">${esc(v.name)}</h1><div class="meta">${esc(v.hours)}</div><div class="meta">Retiro: ${esc(v.pickup)}</div></div>${statusBadge(v)}</div>`;
  if (!v.open) return { title: v.name, html: customerShell(`${head}<div class="empty">${esc(v.name)} está cerrado.<br>${esc(v.hours)}.<a class="btn sec" href="#/explorar">Volver a Explorar</a></div>`, { tab: false, cls: 'menu nodock' }) };
  if (!S.recv && id === 'sala-norte') { /* pausado */ }
  const cats = CATS.map((c, i) => ({ c, i, list: items.filter((p) => p.cat === i) })).filter((x) => x.list.length);
  const chips = cats.map((x) => `<button class="chip" data-a="cat" data-c="${x.i}" aria-pressed="${S.cat === x.i}">${x.c}</button>`).join('');
  const row = (p) => {
    const q = S.cart.venue === id ? (S.cart.lines[p.id] || 0) : 0;
    const ctl = !p.on ? '<span class="badge">Agotado</span>' : q > 0
      ? `<div class="stepper" role="group" aria-label="Cantidad de ${esc(p.name)}"><button data-a="dec" data-p="${p.id}" data-k="d${p.id}" aria-label="Quitar uno">${ico(q === 1 ? 'trash' : 'minus')}</button><output aria-live="polite">${q}</output><button data-a="inc" data-p="${p.id}" data-k="i${p.id}" aria-label="Agregar uno">${ico('plus')}</button></div>`
      : `<button class="btn sec sm addbtn" data-a="add" data-p="${p.id}" data-k="a${p.id}" aria-label="Agregar ${esc(p.name)}">Agregar</button>`;
    return `<div class="pr${p.on ? '' : ' soldout'}"><img class="thumb" src="assets/products/${p.img}" alt=""><div class="tx"><div class="nm">${esc(p.name)}</div><div class="ds">${esc(p.desc)}</div><div class="pc">${money(p.price)}</div></div><div class="ctl">${ctl}</div></div>`;
  };
  const sections = cats.filter((x) => x.i === S.cat || !cats.some((y) => y.i === S.cat)).map((x) => `<h2 class="sec-h" style="margin-top:var(--onza-space-12)">${x.c}</h2><div>${x.list.map(row).join('')}</div>`).join('');
  const dock = mine ? `<div class="dock"><a class="btn xl" href="#/carrito"><span>Ver carrito · <span class="num">${cartCount()}</span></span><span class="num">${money(cartTotal())}</span></a></div>` : '';
  return { title: v.name, keepScroll: true, html: customerShell(`${head}<div class="catbar"><div class="chips" role="group" aria-label="Categorías">${chips}</div></div>${sections}`, { tab: false, cls: 'menu', hideCart: mine }) + dock };
}

/* ---------- Carrito ---------- */
function vCarrito() {
  const n = cartCount();
  if (!n) return { title: 'Carrito', html: customerShell(`<div class="vhead">${backBtn('#/explorar', 'Volver')}<h1 class="title" style="font-size:var(--onza-type-heading-size)">Carrito</h1></div><div class="empty">${ico('bag')}Tu carrito está vacío.<a class="btn" href="#/explorar">Explorar locales</a></div>`, { tab: false, cls: 'narrow nodock', hideCart: true }) };
  const v = venueOf(S.cart.venue);
  const lines = cartItems().map(({ p, q }) => `<div class="pr"><img class="thumb" src="assets/products/${p.img}" alt="" style="width:56px;height:56px"><div class="tx"><div class="nm">${esc(p.name)}</div><div class="pc num">${money(p.price * q)}</div><button class="btn ghost sm" style="padding:0;min-height:36px;color:var(--onza-danger-text)" data-a="rm" data-p="${p.id}" data-k="r${p.id}">Quitar</button></div><div class="ctl"><div class="stepper" role="group" aria-label="Cantidad de ${esc(p.name)}"><button data-a="dec" data-p="${p.id}" data-k="d${p.id}" aria-label="Quitar uno">${ico(q === 1 ? 'trash' : 'minus')}</button><output>${q}</output><button data-a="inc" data-p="${p.id}" data-k="i${p.id}" aria-label="Agregar uno">${ico('plus')}</button></div></div></div>`).join('');
  return { title: 'Carrito', keepScroll: true, html: customerShell(`
    <div class="vhead">${backBtn('#/local/' + S.cart.venue, 'Volver al menú')}<div class="grow"><h1 class="h2" style="line-height:24px">Carrito</h1><div class="meta">${esc(v.name)} · Retiro: ${esc(v.pickup)}</div></div><button class="btn ghost sm" data-a="clear" style="color:var(--onza-danger-text)">Vaciar</button></div>
    <div>${lines}</div>
    <div class="sumrow" style="margin-top:var(--onza-space-8)"><span class="total">Total</span><span class="total num">${money(cartTotal())}</span></div>
    <div class="stack t" style="margin-top:var(--onza-space-12)"><a class="btn xl block" href="#/checkout">Continuar</a><a class="btn sec block" href="#/local/${S.cart.venue}">Agregar más</a></div>`, { tab: false, cls: 'narrow nodock', hideCart: true }) };
}

/* ---------- Checkout ---------- */
function vCheckout() {
  if (!cartCount()) return { title: 'Checkout', html: customerShell('<div class="empty">No hay productos para confirmar.<a class="btn" href="#/explorar">Explorar locales</a></div>', { tab: false, cls: 'narrow nodock' }) };
  const v = venueOf(S.cart.venue);
  const rows = cartItems().map(({ p, q }) => `<div class="sumrow"><span><span class="num">${q}×</span> ${esc(p.name)}</span><span class="num">${money(p.price * q)}</span></div>`).join('');
  return { title: 'Confirmar pedido', html: customerShell(`
    <div class="vhead">${backBtn('#/carrito', 'Volver al carrito')}<div class="grow"><h1 class="h2" style="line-height:24px">Confirmar pedido</h1></div></div>
    <div class="stack">
      <div class="rowf">${avatar(S.cart.venue, 'sm')}<div class="grow"><div class="vname">${esc(v.name)}</div><div class="meta">Retiro: ${esc(v.pickup)}</div></div></div>
      <div class="summary">${rows}<div class="sumrow"><span class="total">Total</span><span class="total num">${money(cartTotal())}</span></div></div>
      <div class="stack t meta" style="color:var(--onza-text)">
        <div class="rowf" style="align-items:flex-start">${ico('clock')}<span>Podés cancelar solo hasta que el local acepte el pedido.</span></div>
        <div class="rowf" style="align-items:flex-start">${ico('scan')}<span>Retirás en la barra con el código que aparece al estar listo.</span></div>
        <a href="#/legal/condiciones">Cancelaciones y retiro</a>
      </div>
      <div class="stack t"><button class="btn xl block" data-a="confirm">Confirmar pedido · <span class="num">${money(cartTotal())}</span></button><p class="hint" style="text-align:center">Demo · sin cobros</p></div>
    </div>`, { tab: false, cls: 'narrow nodock', hideCart: true }) };
}

/* ---------- Pedido ---------- */
function qrSvg(seed) {
  const N = 25; let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const finder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  let d = '';
  const fp = (ox, oy) => { d += `M${ox} ${oy}h7v7h-7z`; return `M${ox + 1} ${oy + 1}v5h5v-5z`; };
  let holes = fp(0, 0) + fp(N - 7, 0) + fp(0, N - 7);
  const inner = (ox, oy) => `M${ox + 2} ${oy + 2}h3v3h-3z`;
  d += inner(0, 0) + inner(N - 7, 0) + inner(0, N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (finder(x, y)) continue; if (rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`; }
  return `<svg viewBox="0 0 ${N} ${N}" role="img" aria-label="Código QR de retiro (ficticio)" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${d} ${holes}"/></svg>`;
}
function vPedido(id) {
  const o = S.orders.find((x) => x.id === id && x.mine);
  if (!o) return { title: 'Pedido', html: customerShell('<div class="empty">No encontramos este pedido.<a class="btn" href="#/pedidos">Ver mis pedidos</a></div>', { tab: false }) };
  const v = venueOf(o.venue);
  const idx = { new: 0, preparing: 1, ready: 2, done: 3 }[o.status];
  const steps = ['Recibido', 'Preparando', 'Listo', 'Entregado'];
  const prog = idx === undefined ? '' : `<div class="prog" role="img" aria-label="Estado: ${steps[idx]}">${steps.map((s, i) => `<div class="${i < idx ? 'done' : i === idx ? 'cur' : ''}">${s}</div>`).join('')}</div>`;
  const titles = { new: ['Pedido recibido', `Esperando que ${v.name} lo acepte.`], preparing: ['Preparando tu pedido', 'Te avisamos cuando esté listo.'], ready: ['Listo para recoger', ''], done: ['Pedido entregado', 'Gracias. Este es tu comprobante.'], cancelled: ['Pedido cancelado', 'No se hizo ningún cobro.'], rejected: ['El local no pudo aceptar tu pedido', 'No se hizo ningún cobro.'] };
  const [t, sub] = titles[o.status];
  const lines = o.items.map((i) => `<div class="sumrow"><span><span class="num">${i.q}×</span> ${esc(i.n)}</span><span class="num">${money(i.p * i.q)}</span></div>`).join('') + `<div class="sumrow"><b>Total</b><b class="num">${money(orderTotal(o))}</b></div>`;
  const ticket = o.status === 'ready' ? `<section class="ticket" aria-label="Ticket de retiro"><div class="pt">${ico('pin')}Retirá en: ${esc(v.pickup)}</div><div class="qr">${qrSvg(o.code)}</div><div><div class="meta">Código de retiro</div><div class="code" aria-label="Código de retiro ${o.code.replace(/-/g, ' ')}">${o.code}</div></div><div class="pub">Pedido <b class="num">#${o.no}</b> · ${esc(v.name)}</div></section>` : '';
  const act = o.status === 'new' ? `<button class="btn danger block" data-a="cancelq">Cancelar pedido</button>` : o.status === 'preparing' ? '<p class="hint" style="text-align:center">Ya no se puede cancelar: el local empezó a prepararlo.</p>' : (['done', 'cancelled', 'rejected'].includes(o.status) ? '<a class="btn block" href="#/explorar">Volver a Explorar</a>' : '');
  return { title: 'Pedido #' + o.no, html: customerShell(`
    <div class="vhead">${backBtn('#/pedidos', 'Volver a pedidos')}<div class="grow"><div class="meta">${esc(v.name)} · Pedido <span class="num">#${o.no}</span></div></div></div>
    <div class="stack">
      <div><h1 class="title">${t}</h1>${sub ? `<p class="muted" style="margin-top:4px">${esc(sub)}</p>` : ''}</div>
      ${prog}${ticket}
      <details class="sum"${o.status === 'ready' ? '' : ' open'}><summary>Resumen del pedido<span class="num muted">${orderQty(o)} · ${money(orderTotal(o))}</span></summary><div>${lines}</div></details>
      ${act}
    </div>`, { active: 'pedidos', cls: 'narrow' }) };
}
function vPedidos() {
  const mine = myOrders().sort((a, b) => b.t - a.t);
  const act = mine.filter((o) => ACTIVE.includes(o.status)), hist = mine.filter((o) => !ACTIVE.includes(o.status));
  const row = (o) => { const v = venueOf(o.venue); return `<a class="item" href="#/pedido/${o.id}">${avatar(o.venue, 'sm')}<div class="grow"><div class="vname">${esc(v.name)} · <span class="num">#${o.no}</span></div><div class="meta">${orderQty(o)} ${orderQty(o) === 1 ? 'trago' : 'tragos'} · ${money(orderTotal(o))} · ${o.day || 'Hoy'}</div></div><span class="badge ${o.status === 'ready' ? 'ok' : o.status === 'cancelled' || o.status === 'rejected' ? '' : 'brand'}">${STATUS_LABEL[o.status]}</span></a>`; };
  return { title: 'Pedidos', html: customerShell(`<h1 class="title" style="margin-bottom:var(--onza-space-8)">Pedidos</h1>
    ${act.length ? `<h2 class="sec-h">Activos</h2><div class="list">${act.map(row).join('')}</div>` : ''}
    ${hist.length ? `<h2 class="sec-h">Historial</h2><div class="list">${hist.map(row).join('')}</div>` : ''}
    ${mine.length ? '' : '<div class="empty">Todavía no hiciste pedidos.<a class="btn" href="#/explorar">Explorar locales</a></div>'}`, { active: 'pedidos', cls: 'narrow' }) };
}

/* ---------- Cuenta ---------- */
function vCuenta() {
  const pf = S.profile;
  const th = (k, ic, l) => `<button type="button" data-a="theme" data-t="${k}" data-k="th${k}" aria-pressed="${S.theme === k}">${ico(ic)}${l}</button>`;
  const sw = (id, on, l) => `<label class="setrow" style="cursor:pointer"><span class="grow">${l}</span><span class="sw"><input type="checkbox" role="switch" data-a="pref" data-pf="${id}" ${on ? 'checked' : ''} aria-label="${esc(l)}"><i></i></span></label>`;
  return { title: 'Cuenta', keepScroll: true, html: customerShell(`
    <div class="acc-head"><div class="ini">${esc(initials(pf.name))}</div><div class="grow"><h1 class="h2">${esc(pf.name)}</h1><div class="meta">@${esc(pf.user)} · ${esc(pf.email)}</div></div></div>
    <h2 class="sec-h">Apariencia</h2>
    <div class="seg" role="group" aria-label="Apariencia">${th('system', 'monitor', 'Sistema')}${th('light', 'sun', 'Claro')}${th('dark', 'moon', 'Oscuro')}</div>
    <h2 class="sec-h">Preferencias</h2>
    <div>${sw('news', S.prefs.news, 'Novedades de Onza')}${sw('offers', S.prefs.offers, 'Ofertas de mis discotecas favoritas')}</div>
    <h2 class="sec-h">Privacidad</h2>
    <div><a class="setrow" href="#/legal/condiciones">${ico('file')}<span class="grow">Condiciones <span class="badge">Borrador</span></span>${ico('right')}</a>
    <a class="setrow" href="#/legal/privacidad">${ico('shield')}<span class="grow">Política de privacidad <span class="badge">Borrador</span></span>${ico('right')}</a>
    <button class="setrow" data-a="delq" style="color:var(--onza-danger-text)">${ico('trash')}<span class="grow">Eliminar cuenta</span>${ico('right')}</button></div>
    <div style="margin-top:var(--onza-space-24)"><button class="btn sec block" data-a="logout">${ico('out')}Cerrar sesión</button></div>`, { active: 'cuenta', cls: 'narrow' }) };
}
function vLegal(doc) {
  const t = doc === 'condiciones' ? 'Condiciones' : 'Política de privacidad';
  const body = doc === 'condiciones'
    ? '<h2>Pedidos y retiro</h2><p>Texto de ejemplo. Un pedido puede cancelarse solo antes de que el local lo acepte. El retiro se hace en la barra con el código del pedido.</p><h2>Cuenta</h2><p>Texto de ejemplo. Necesitás tener 18 años o más para usar Onza.</p>'
    : '<h2>Datos que guardamos</h2><p>Texto de ejemplo. Nombre, @usuario, teléfono (no verificado) y fecha de nacimiento. El personal del local no ve tu correo, teléfono ni fecha de nacimiento.</p><h2>Eliminar tu cuenta</h2><p>Texto de ejemplo. Podés eliminar tu cuenta desde Cuenta.</p>';
  return { title: t, html: `<main class="page narrow nodock"><div class="vhead">${backBtn('history', 'Volver')}<h1 class="h2" style="line-height:24px">${t}</h1><span class="badge">Borrador</span></div><div class="legal"><p class="meta">Versión de ejemplo 0.1 · 17 de noviembre de 2026</p>${body}</div></main>` };
}

/* ---------- Sesión activa / QR ---------- */
function vSesionActiva() {
  const s = S.session;
  if (!s) return { title: 'Acceso', html: '<main class="auth"><div class="box"><a class="btn" href="#/acceso">Ir al acceso</a></div></main>' };
  const staff = s.kind === 'staff';
  const name = staff ? s.name : S.profile.name;
  const sub = staff ? `Cuenta de equipo · Sala Norte · ${s.role === 'administrador' ? 'Administrador' : 'Empleado'}` : 'Cuenta personal';
  const want = S.want || (staff ? 'customer' : 'staff');
  const wrongHere = (want === 'customer' && staff) || (want === 'staff' && !staff);
  const msg = want === 'customer' && staff ? 'Esta cuenta es de equipo y no puede comprar.' : want === 'staff' && !staff ? 'Esta cuenta es personal y no tiene acceso al equipo.' : '';
  const cont = staff ? 'Continuar a la barra' : 'Continuar a Explorar';
  return { title: 'Sesión iniciada', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    <h1 class="title">Ya hay una sesión iniciada</h1>
    <div class="summary"><div class="rowf" style="padding:var(--onza-space-12) 0"><div class="ini">${esc(initials(name))}</div><div class="grow"><div class="vname">${esc(name)}</div><div class="meta">${esc(sub)}</div></div></div></div>
    ${wrongHere ? `<p class="muted">${msg}</p>` : ''}
    <div class="stack t"><a class="btn block" href="${staff ? '#/equipo/barra' : '#/explorar'}">${cont}</a><button class="btn sec block" data-a="switchacct">Usar otra cuenta</button></div>
  </div></main>` };
}
function vQr(slug) {
  const v = venueOf(slug);
  if (!v) return { title: 'QR', html: '<main class="auth"><div class="box"><a class="btn" href="#/">Inicio</a></div></main>' };
  S.next = '#/local/' + slug;
  return { title: 'QR', html: '<main class="auth"></main>', after() { setTimeout(() => { go(S.session && S.session.kind === 'customer' && S.onboarded ? S.next : '#/acceso'); }, 0); } };
}

/* ---------- Equipo: acceso ---------- */
function vEquipoAcceso() {
  return { title: 'Acceso del equipo', html: `<main class="auth"><div class="box">
    <div>${logo('logo')}</div>
    <div><span class="badge brand">Equipo</span><h1 class="title" style="margin-top:12px">Acceso del equipo</h1></div>
    <form class="stack t" id="f-team" novalidate>
      <div class="field"><label for="t-mail">Correo de trabajo</label><input class="in" id="t-mail" type="email" autocomplete="username" inputmode="email" placeholder="nombre@local.cr"><span class="err" id="e-tmail" hidden></span></div>
      <div class="field"><label for="t-pass">Contraseña</label><input class="in" id="t-pass" type="password" autocomplete="current-password"><span class="err" id="e-tpass" hidden></span></div>
      <button class="btn block" type="submit">Ingresar</button>
      <a class="btn ghost block" href="#/recuperar">¿Olvidaste tu contraseña?</a>
    </form>
    <p class="meta">Las cuentas del equipo las crea el administrador de tu local.</p>
    <p class="foot meta">¿Querés pedir tragos? <a href="#/acceso">Acceso para clientes</a></p>
  </div></main>` };
}

/* ---------- Barra ---------- */
function vBarra() {
  const v = venueOf('sala-norte');
  const all = S.orders.filter((o) => o.venue === 'sala-norte' && ACTIVE.includes(o.status));
  const by = (s) => all.filter((o) => o.status === s).sort((a, b) => a.t - b.t);
  const cols = [['new', 'Nuevos'], ['preparing', 'Preparando'], ['ready', 'Listos']];
  const oldest = all.filter((o) => o.status !== 'ready').reduce((a, o) => Math.max(a, mins(o.t)), 0);
  const card = (o) => {
    const w = o.status === 'ready' ? mins(o.st) : mins(o.t);
    const late = o.status !== 'ready' && w >= 8;
    const act = o.status === 'new' ? `<button class="btn danger" data-a="reject" data-o="${o.id}">Rechazar</button><button class="btn" data-a="accept" data-o="${o.id}">Aceptar</button>`
      : o.status === 'preparing' ? `<button class="btn" data-a="markready" data-o="${o.id}">Marcar listo</button>`
      : `<button class="btn" data-a="validate" data-o="${o.id}">${ico('scan')}Validar retiro</button>`;
    return `<article class="qc" aria-label="Pedido ${o.no}"><div class="top"><span class="no">#${o.no}</span><span class="wait${late ? ' late' : ''}">${ico('clock')}${o.status === 'ready' ? 'Listo hace ' : 'Espera '}${w} min</span></div>
      <div class="its">${o.items.map((i) => `<div><b class="num">${i.q}×</b> ${esc(i.n)}</div>`).join('')}</div>
      <div class="meta">${esc(o.who)} · ${orderQty(o)} ${orderQty(o) === 1 ? 'trago' : 'tragos'}</div><div class="acts">${act}</div></article>`;
  };
  const colHtml = (k, l) => { const list = by(k); return `<section class="col${S.barTab === k ? '' : ' hidem'}" aria-label="${l}"><h2 class="only-d">${l}<span class="badge brand cnt">${list.length}</span></h2>${list.length ? list.map(card).join('') : `<div class="qempty">Sin pedidos ${l === 'Nuevos' ? 'nuevos' : l === 'Preparando' ? 'en preparación' : 'listos'}</div>`}</section>`; };
  const inner = `<main class="bar">
    <div class="rowf" style="flex-wrap:wrap;margin-bottom:var(--onza-space-16)">
      <div class="grow" style="min-width:200px"><h1 class="title">Barra</h1><div class="meta">${esc(v.pickup)} · ${all.length ? `Espera más larga <b class="num" style="color:var(--onza-text)">${oldest} min</b>` : 'Sin pedidos activos'}</div></div>
      <label class="rowf" style="gap:12px"><span style="font-weight:600">${S.recv ? 'Recibiendo pedidos' : 'Pedidos pausados'}</span><span class="sw"><input type="checkbox" role="switch" data-a="recv" ${S.recv ? 'checked' : ''} aria-label="Recibir pedidos"><i></i></span></label>
      <button class="btn xl" data-a="validate" data-o="">${ico('scan')}Validar retiro</button>
    </div>
    <div class="seg only-m" role="tablist" aria-label="Estado" style="margin-bottom:var(--onza-space-16)">${cols.map(([k, l]) => `<button role="tab" data-a="bartab" data-t="${k}" aria-selected="${S.barTab === k}">${l} <span class="cnt">${by(k).length}</span></button>`).join('')}</div>
    <div class="cols">${cols.map(([k, l]) => colHtml(k, l)).join('')}</div></main>`;
  return { title: 'Barra', keepScroll: true, html: teamShell(inner, { where: 'barra' }) };
}

/* ---------- Administración ---------- */
function vAdmin(tab) {
  const tabs = [['resumen', 'Resumen', 'chart'], ['pedidos', 'Pedidos', 'list'], ['menu', 'Menú', 'wine'], ['local', 'Local', 'store'], ['equipo', 'Equipo', 'users']];
  const nav = `<nav class="adm-nav" aria-label="Administración">${tabs.map(([k, l, i]) => `<a href="#/equipo/admin/${k}"${tab === k ? ' aria-current="page"' : ''}>${ico(i)}${l}</a>`).join('')}</nav>`;
  const os = S.orders.filter((o) => o.venue === 'sala-norte');
  const valid = os.filter((o) => !['cancelled', 'rejected'].includes(o.status));
  let main = '';
  if (tab === 'resumen') {
    main = `<div><h1 class="title">Resumen</h1><p class="meta">Pedidos hechos con Onza hoy en ${esc(venueOf('sala-norte').name)}.</p></div>
      <div class="kpis"><div class="kpi"><div class="meta">Pedidos</div><div class="v">${valid.length}</div></div><div class="kpi"><div class="meta">Importe</div><div class="v">${money(valid.reduce((a, o) => a + orderTotal(o), 0))}</div></div><div class="kpi"><div class="meta">Espera media</div><div class="v">7 min</div></div></div>
      <div><h2 class="h2" style="margin-bottom:var(--onza-space-8)">Últimos pedidos</h2>${ordersList(os.slice().sort((a, b) => b.t - a.t).slice(0, 4))}</div>`;
  } else if (tab === 'pedidos') {
    const f = S.adminFilter;
    const fl = os.filter((o) => f === 'all' || (f === 'active' && ACTIVE.includes(o.status)) || (f === 'done' && o.status === 'done') || (f === 'cancelled' && ['cancelled', 'rejected'].includes(o.status))).sort((a, b) => b.t - a.t);
    main = `<h1 class="title">Pedidos</h1><div class="chips" role="group" aria-label="Filtro">${[['all', 'Todos'], ['active', 'Activos'], ['done', 'Entregados'], ['cancelled', 'Cancelados']].map(([k, l]) => `<button class="chip" data-a="afilter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>${ordersList(fl)}`;
  } else if (tab === 'menu') {
    const rows = S.products['sala-norte'].map((p) => `<div class="pr"><img class="thumb" src="assets/products/${p.img}" alt="" style="width:56px;height:56px"><div class="tx"><div class="nm">${esc(p.name)}</div><div class="pc num">${money(p.price)} <span class="muted" style="font-weight:400">· ${CATS[p.cat]}</span></div></div><label class="rowf" style="gap:8px"><span class="meta hide-s">${p.on ? 'Disponible' : 'Agotado'}</span><span class="sw"><input type="checkbox" role="switch" data-a="avail" data-p="${p.id}" ${p.on ? 'checked' : ''} aria-label="Disponible: ${esc(p.name)}"><i></i></span></label><button class="btn sec sm" data-a="editp" data-p="${p.id}" aria-label="Editar ${esc(p.name)}">${ico('edit')}</button></div>`).join('');
    main = `<div class="rowf"><h1 class="title grow">Menú</h1></div><div>${rows}</div>`;
  } else if (tab === 'local') {
    const v = S.venues['sala-norte'];
    main = `<h1 class="title">Local</h1><form class="formgrid two panel" id="f-local" novalidate>
      <div class="field full"><label for="l-name">Nombre</label><input class="in" id="l-name" value="${esc(v.name)}"></div>
      <div class="field full"><label for="l-addr">Dirección</label><input class="in" id="l-addr" value="${esc(v.addr)}"></div>
      <div class="field"><label for="l-hours">Horario de hoy</label><input class="in" id="l-hours" value="${esc(v.hours)}"></div>
      <div class="field"><label for="l-pick">Barra de retiro</label><input class="in" id="l-pick" value="${esc(v.pickup)}"></div>
      <div class="field"><label for="l-lat">Latitud</label><input class="in" id="l-lat" inputmode="decimal" value="${esc(v.lat)}"></div>
      <div class="field"><label for="l-lng">Longitud</label><input class="in" id="l-lng" inputmode="decimal" value="${esc(v.lng)}"></div>
      <div class="full"><button class="btn" type="submit">Guardar cambios</button></div></form>`;
  } else {
    const rows = S.members.map((m) => `<div class="item"><div class="ini" style="width:48px;height:48px;font-size:var(--onza-type-body-size)">${esc(initials(m.name))}</div><div class="grow"><div class="vname">${esc(m.name)}${m.me ? ' <span class="muted" style="font-weight:400">(vos)</span>' : ''}</div><div class="meta">${esc(m.email)}</div></div><span class="badge ${m.role === 'administrador' ? 'brand' : ''}">${m.role === 'administrador' ? 'Administrador' : 'Empleado'}</span>${m.me ? '' : `<button class="btn danger sm" data-a="revoke" data-m="${m.id}">Quitar acceso</button>`}</div>`).join('');
    main = `<div class="rowf" style="flex-wrap:wrap"><h1 class="title grow">Equipo</h1><button class="btn" data-a="addm">${ico('plus')}Agregar persona</button></div><div class="list">${rows}</div>`;
  }
  return { title: 'Administración', keepScroll: true, html: teamShell(`<div class="adm">${nav}<main class="adm-main">${main}</main></div>`, { where: 'admin' }) };
}
function ordersList(list) {
  if (!list.length) return '<div class="qempty">No hay pedidos con este filtro.</div>';
  const badge = (s) => `<span class="badge ${s === 'ready' ? 'ok' : ACTIVE.includes(s) ? 'brand' : ''}">${STATUS_LABEL[s].replace(' para recoger', '')}</span>`;
  return `<table class="tbl"><thead><tr><th>Pedido</th><th>Productos</th><th>Estado</th><th class="r">Total</th></tr></thead><tbody>${list.map((o) => `<tr><td><b>#${o.no}</b><div class="hint">${mins(o.t) < 120 ? 'Hace ' + mins(o.t) + ' min' : o.day || 'Hoy'}</div></td><td>${o.items.map((i) => `${i.q}× ${esc(i.n)}`).join(', ')}</td><td>${badge(o.status)}</td><td class="r">${money(orderTotal(o))}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Diálogos y avisos ---------- */
let lastFocus = null;
function openDlg(html, onMount) {
  lastFocus = document.activeElement;
  layer.innerHTML = `<div class="scrim" data-a="scrim"><div class="dlg" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  const d = $('.dlg', layer); const f = d.querySelector('input,select,button'); (f || d).focus();
  if (onMount) onMount(d);
}
function closeDlg() { layer.innerHTML = ''; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
let toastT;
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
}
const showErr = (id, msg) => { const e = $('#' + id); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; const inp = e.previousElementSibling && e.previousElementSibling.matches('input,select') ? e.previousElementSibling : null; if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false'); };

/* ---------- Acciones ---------- */
function addToCart(v, pid) {
  if (cartCount() > 0 && S.cart.venue !== v) {
    const cur = venueOf(S.cart.venue).name, nw = venueOf(v).name;
    openDlg(`<h2 class="h2">Ya tenés un carrito en ${esc(cur)}</h2><p class="muted">Un pedido es de un solo local. ¿Querés reemplazarlo por uno de ${esc(nw)}?</p><div class="acts"><button class="btn" data-a="replace" data-v="${v}" data-p="${pid}">Reemplazar carrito</button><button class="btn sec" data-a="keep">Conservar el actual</button></div>`);
    return;
  }
  S.cart.venue = v; S.cart.lines[pid] = (S.cart.lines[pid] || 0) + 1; render();
}
function setQty(pid, d) {
  const q = (S.cart.lines[pid] || 0) + d;
  if (q <= 0) delete S.cart.lines[pid]; else S.cart.lines[pid] = q;
  if (!cartCount()) S.cart.venue = null;
  render();
}
function advance(o) {
  const nx = { new: 'preparing', preparing: 'ready', ready: 'done' }[o.status]; if (!nx) return false;
  o.status = nx; o.st = Date.now(); return true;
}
function validateDlg(target) {
  const to = target ? S.orders.find((o) => o.id === target) : null;
  openDlg(`<h2 class="h2">Validar retiro${to ? ' · #' + to.no : ''}</h2><p class="muted">Pedile al cliente el código de retiro o escaneá su QR.</p>
    <form class="stack t" id="f-val" novalidate><div class="field"><label for="v-code" class="sr">Código de retiro</label><input class="in codein" id="v-code" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" inputmode="text"><span class="err" id="e-vcode" hidden></span></div>
    <div class="acts"><button class="btn xl" type="submit">Validar</button><button class="btn sec xl" type="button" data-a="close">Cerrar</button></div></form>`, (d) => {
    $('#f-val', d).addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = $('#v-code', d).value.toUpperCase().replace(/[^A-Z0-9#]/g, '');
      const err = (m) => { const el = $('#e-vcode', d); el.hidden = false; el.textContent = m; $('#v-code', d).setAttribute('aria-invalid', 'true'); };
      if (!raw) return err('Ingresá el código de retiro.');
      if (/^#?\d{3,4}$/.test(raw)) return err('Ese es el número del pedido. Pedí el código de retiro.');
      const match = S.orders.find((o) => o.venue === 'sala-norte' && o.status === 'ready' && o.code.replace(/-/g, '') === raw && (!to || o.id === to.id));
      if (!match) return err('Código no válido para un pedido listo.');
      match.status = 'done'; match.st = Date.now(); closeDlg(); toast(`Pedido #${match.no} entregado`); render();
    });
  });
}
function editProduct(pid) {
  const p = prod('sala-norte', pid);
  openDlg(`<h2 class="h2">Editar producto</h2><form class="stack t" id="f-prod" novalidate>
    <div class="field"><label for="ep-n">Nombre</label><input class="in" id="ep-n" value="${esc(p.name)}"></div>
    <div class="field"><label for="ep-d">Descripción breve</label><input class="in" id="ep-d" maxlength="70" value="${esc(p.desc)}"></div>
    <div class="field"><label for="ep-p">Precio (₡)</label><input class="in" id="ep-p" inputmode="numeric" value="${p.price}"><span class="err" id="e-ep" hidden></span></div>
    <label class="rowf" style="gap:12px;min-height:44px"><span class="sw"><input type="checkbox" role="switch" id="ep-on" ${p.on ? 'checked' : ''}><i></i></span><span>Disponible</span></label>
    <div class="acts"><button class="btn" type="submit">Guardar</button><button class="btn sec" type="button" data-a="close">Cancelar</button></div></form>`, (d) => {
    $('#f-prod', d).addEventListener('submit', (e) => {
      e.preventDefault(); const pr = parseInt($('#ep-p', d).value.replace(/\D/g, ''), 10);
      if (!pr || pr < 100) { const el = $('#e-ep', d); el.hidden = false; el.textContent = 'Ingresá un precio válido.'; return; }
      p.name = $('#ep-n', d).value.trim() || p.name; p.desc = $('#ep-d', d).value.trim(); p.price = pr; p.on = $('#ep-on', d).checked;
      closeDlg(); toast('Producto guardado'); render();
    });
  });
}
function addMember() {
  openDlg(`<h2 class="h2">Agregar persona</h2><form class="stack t" id="f-mem" novalidate>
    <div class="field"><label for="am-n">Nombre</label><input class="in" id="am-n"><span class="err" id="e-amn" hidden></span></div>
    <div class="field"><label for="am-e">Correo de trabajo</label><input class="in" id="am-e" type="email" inputmode="email"><span class="hint">Debe ser distinto del correo con el que comprás.</span><span class="err" id="e-ame" hidden></span></div>
    <div class="field"><span class="lbl" id="am-rl">Permiso</span><div class="seg" role="group" aria-labelledby="am-rl"><button type="button" data-a="memrole" data-r="empleado" aria-pressed="true">Empleado</button><button type="button" data-a="memrole" data-r="administrador" aria-pressed="false">Administrador</button></div></div>
    <div class="acts"><button class="btn" type="submit">Crear acceso</button><button class="btn sec" type="button" data-a="close">Cancelar</button></div></form>`, (d) => {
    $('#f-mem', d).addEventListener('submit', (e) => {
      e.preventDefault(); const n = $('#am-n', d).value.trim(), em = $('#am-e', d).value.trim(); let bad = false;
      const set = (id, m) => { const el = $('#' + id, d); el.hidden = !m; el.textContent = m || ''; if (m) bad = true; };
      set('e-amn', n ? '' : 'Ingresá el nombre.');
      set('e-ame', !/^\S+@\S+\.\S+$/.test(em) ? 'Ingresá un correo válido.' : em.toLowerCase() === S.profile.email.toLowerCase() ? 'Usá otro correo para la cuenta laboral.' : '');
      if (bad) return;
      const role = $('[data-a="memrole"][aria-pressed="true"]', d).dataset.r;
      S.members.push({ id: 'm' + Date.now(), name: n, email: em, role }); closeDlg(); toast('Acceso creado'); render();
    });
  });
}
function logout() {
  S.session = null; S.onboarded = false; S.google = null; S.cart = { venue: null, lines: {} }; S.next = null; S.want = null; S.draftEmail = '';
  go('#/acceso'); toast('Sesión cerrada');
}

/* ---------- Eventos ---------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a;
  if (a === 'scrim') { if (ev.target === el) closeDlg(); return; }
  const d = el.dataset;
  switch (a) {
    case 'go': if (d.h === 'history') history.back(); else go(d.h); break;
    case 'close': closeDlg(); break;
    case 'authmode': S.authMode = d.m; render(); break;
    case 'google': S.google = { name: 'Ana Rojas', email: 'ana.rojas@gmail.com' }; S.session = { kind: 'customer' }; S.profile.email = 'ana.rojas@gmail.com'; go('#/onboarding'); break;
    case 'confirmed': S.session = { kind: 'customer' }; go('#/onboarding'); break;
    case 'resend': toast('Correo reenviado'); break;
    case 'loc': S.loc = !S.loc; render(); break;
    case 'cat': S.cat = +d.c; render(); break;
    case 'add': addToCart(S.pathVenue, d.p); break;
    case 'inc': setQty(d.p, 1); break;
    case 'dec': setQty(d.p, -1); break;
    case 'rm': setQty(d.p, -(S.cart.lines[d.p] || 0)); break;
    case 'clear': openDlg('<h2 class="h2">¿Vaciar el carrito?</h2><p class="muted">Se quitarán todos los productos.</p><div class="acts"><button class="btn danger" data-a="clearok">Vaciar carrito</button><button class="btn sec" data-a="close">Cancelar</button></div>'); break;
    case 'clearok': S.cart = { venue: null, lines: {} }; closeDlg(); go('#/explorar'); break;
    case 'replace': S.cart = { venue: d.v, lines: { [d.p]: 1 } }; closeDlg(); render(); break;
    case 'keep': closeDlg(); break;
    case 'confirm': {
      const o = { id: 'o' + S.no, no: String(S.no).padStart(4, '0'), venue: S.cart.venue, who: S.profile.name.split(' ')[0], items: cartItems().map(({ p, q }) => ({ n: p.name, q, p: p.price })), status: 'new', t: Date.now(), st: Date.now(), code: 'K7M2-X9PQ-4RTA', mine: true };
      S.no++; S.orders.push(o); S.last = o.id; S.cart = { venue: null, lines: {} }; go('#/pedido/' + o.id); break; }
    case 'cancelq': openDlg('<h2 class="h2">¿Cancelar el pedido?</h2><p class="muted">Todavía no fue aceptado, así que no se hará ningún cobro.</p><div class="acts"><button class="btn danger" data-a="cancelok">Cancelar pedido</button><button class="btn sec" data-a="close">Mantener pedido</button></div>'); break;
    case 'cancelok': { const o = S.orders.find((x) => x.id === S.last); if (o && o.status === 'new') { o.status = 'cancelled'; o.st = Date.now(); } closeDlg(); render(); break; }
    case 'theme': S.theme = d.t; applyTheme(); render(); break;
    case 'pref': S.prefs[d.pf] = el.checked; toast('Preferencia guardada'); break;
    case 'delq': openDlg('<h2 class="h2">Eliminar cuenta</h2><p class="muted">Se borrarán tus datos personales. Tus pedidos anteriores quedan sin tu nombre. Esta acción no se puede deshacer.</p><div class="field"><label for="dq-p">Confirmá tu contraseña</label><input class="in" id="dq-p" type="password" autocomplete="current-password"></div><div class="acts"><button class="btn danger" data-a="delok">Eliminar cuenta</button><button class="btn sec" data-a="close">Cancelar</button></div>'); break;
    case 'delok': if (!$('#dq-p').value) { $('#dq-p').setAttribute('aria-invalid', 'true'); $('#dq-p').focus(); break; } closeDlg(); logout(); toast('Cuenta eliminada'); break;
    case 'logout': logout(); break;
    case 'switchacct': { const w = S.want || (S.session.kind === 'staff' ? 'customer' : 'staff'); S.session = null; S.onboarded = false; S.google = null; go(w === 'staff' ? '#/equipo/acceso' : '#/acceso'); break; }
    case 'bartab': S.barTab = d.t; render(); break;
    case 'accept': case 'markready': { const o = S.orders.find((x) => x.id === d.o); if (o) { advance(o); S.barTab = o.status; } render(); break; }
    case 'reject': { const o = S.orders.find((x) => x.id === d.o); if (o) { o.status = 'rejected'; o.st = Date.now(); } render(); toast('Pedido rechazado'); break; }
    case 'validate': validateDlg(d.o); break;
    case 'recv': S.recv = el.checked; render(); break;
    case 'afilter': S.adminFilter = d.f; render(); break;
    case 'avail': { const p = prod('sala-norte', d.p); p.on = el.checked; render(); break; }
    case 'editp': editProduct(d.p); break;
    case 'addm': addMember(); break;
    case 'memrole': el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); break;
    case 'revoke': S.members = S.members.filter((m) => m.id !== d.m); render(); toast('Acceso quitado'); break;
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && layer.firstChild) closeDlg(); });
document.addEventListener('submit', (e) => {
  const f = e.target; e.preventDefault();
  const v = (id) => ($('#' + id) ? $('#' + id).value.trim() : '');
  const mailOk = (s) => /^\S+@\S+\.\S+$/.test(s);
  if (f.id === 'f-acceso') {
    const up = S.authMode === 'up'; let bad = false;
    const e1 = !mailOk(v('a-mail')) ? 'Ingresá un correo válido.' : ''; showErr('e-mail', e1);
    const e2 = v('a-pass').length < 8 ? 'Usá al menos 8 caracteres.' : ''; showErr('e-pass', e2);
    const e3 = up && $('#a-pass2').value !== $('#a-pass').value ? 'Las contraseñas no coinciden.' : ''; if (up) showErr('e-pass2', e3);
    bad = e1 || e2 || e3; if (bad) { f.querySelector('[aria-invalid="true"]').focus(); return; }
    S.draftEmail = v('a-mail'); S.profile.email = S.draftEmail;
    if (up) go('#/confirmar'); else { S.session = { kind: 'customer' }; S.onboarded = true; go(S.next || '#/explorar'); S.next = null; }
  } else if (f.id === 'f-rec') {
    if (!mailOk(v('r-mail'))) { showErr('e-rmail', 'Ingresá un correo válido.'); return; }
    openDlg(`<h2 class="h2">Revisá tu correo</h2><p class="muted">Si ${esc(v('r-mail'))} tiene una cuenta, te enviamos un enlace para crear una contraseña nueva.</p><div class="acts"><button class="btn" data-a="go" data-h="#/acceso">Volver al acceso</button></div>`);
  } else if (f.id === 'f-onb') {
    const name = v('o-name'), user = v('o-user'), ph = v('o-phone').replace(/\D/g, ''), dd = +$('#o-d').value, mm = +$('#o-m').value, yy = +$('#o-y').value;
    const errs = {
      'e-name': name.length < 2 ? 'Ingresá tu nombre.' : '',
      'e-user': !/^[a-z0-9_.]{3,20}$/i.test(user) ? 'Usá 3 a 20 letras, números, punto o guion bajo.' : ['onza', 'admin', 'salanorte'].includes(user.toLowerCase()) ? 'Ese @usuario ya existe.' : '',
      'e-phone': ph.length < 6 || ph.length > 12 ? 'Ingresá un teléfono válido.' : '',
      'e-dob': '', 'e-terms': !$('#o-terms').checked ? 'Necesitás aceptar para continuar.' : ''
    };
    if (!dd || !mm || !yy) errs['e-dob'] = 'Ingresá tu fecha de nacimiento.';
    else { const b = new Date(yy, mm - 1, dd); if (b.getMonth() !== mm - 1) errs['e-dob'] = 'Esa fecha no existe.'; else { const t = new Date(); let age = t.getFullYear() - yy; if (t < new Date(t.getFullYear(), mm - 1, dd)) age--; if (age < 18) errs['e-dob'] = 'Necesitás tener 18 años o más.'; } }
    Object.entries(errs).forEach(([k, m]) => showErr(k, m));
    const first = Object.entries(errs).find(([, m]) => m); if (first) { const el = $('#' + first[0]); const t = el.previousElementSibling; (t && t.matches('input,select') ? t : el.parentElement.querySelector('input,select')).focus(); return; }
    S.profile = { ...S.profile, name, user, phone: v('o-phone'), cc: $('#o-cc').value };
    S.prefs = { news: $('#o-news').checked, offers: $('#o-offers').checked };
    S.session = { kind: 'customer' }; S.onboarded = true; S.google = null;
    const n = S.next; S.next = null; go(n || '#/explorar');
  } else if (f.id === 'f-team') {
    const em = v('t-mail'); const e1 = !mailOk(em) ? 'Ingresá un correo válido.' : ''; showErr('e-tmail', e1);
    const e2 = !$('#t-pass').value ? 'Ingresá tu contraseña.' : ''; showErr('e-tpass', e2); if (e1 || e2) return;
    const adm = /marta|admin/i.test(em); S.session = { kind: 'staff', role: adm ? 'administrador' : 'empleado', name: adm ? 'Marta Solano' : 'Jorge Mora' };
    go(adm ? '#/equipo/admin/resumen' : '#/equipo/barra');
  } else if (f.id === 'f-local') {
    const vv = S.venues['sala-norte']; vv.name = v('l-name') || vv.name; vv.addr = v('l-addr'); vv.hours = v('l-hours'); vv.pickup = v('l-pick') || vv.pickup; vv.lat = v('l-lat'); vv.lng = v('l-lng'); toast('Cambios guardados'); render();
  }
});

/* ---------- Barra del boceto ---------- */
const JUMPS = [
  ['Cliente', [['/acceso', 'Acceso'], ['/qr/sala-norte', 'Acceso con QR (Sala Norte)'], ['/confirmar', 'Confirmar correo'], ['/recuperar', 'Recuperar contraseña'], ['/onboarding', 'Completar perfil'], ['/explorar', 'Explorar'], ['/local/sala-norte', 'Menú · Sala Norte'], ['/carrito', 'Carrito'], ['/checkout', 'Checkout'], ['/pedido', 'Pedido (último)'], ['/pedidos', 'Pedidos'], ['/cuenta', 'Cuenta'], ['/legal/condiciones', 'Condiciones (borrador)']]],
  ['Sesión', [['/sesion-activa', 'Sesión activa en el acceso equivocado']]],
  ['Equipo', [['/equipo/acceso', 'Acceso del equipo'], ['/equipo/barra', 'Barra'], ['/equipo/admin/resumen', 'Admin · Resumen'], ['/equipo/admin/pedidos', 'Admin · Pedidos'], ['/equipo/admin/menu', 'Admin · Menú'], ['/equipo/admin/local', 'Admin · Local'], ['/equipo/admin/equipo', 'Admin · Equipo']]]
];
const sel = $('#bx-go');
sel.innerHTML = '<option value="">Ir a…</option>' + JUMPS.map(([g, it]) => `<optgroup label="${g}">${it.map(([p, l]) => `<option value="${p}">${l}</option>`).join('')}</optgroup>`).join('');
function ensureCart() { if (!cartCount()) { S.cart = { venue: 'sala-norte', lines: { p1: 2, p4: 1 } }; } }
function jump(p) {
  closeDlg();
  const cust = () => { S.session = { kind: 'customer' }; S.onboarded = true; };
  if (['/acceso', '/confirmar', '/recuperar', '/equipo/acceso'].includes(p)) { S.session = null; S.onboarded = false; S.google = null; S.next = null; if (p === '/confirmar') S.draftEmail = S.draftEmail || 'ana.rojas@gmail.com'; }
  else if (p === '/qr/sala-norte') { S.session = null; S.onboarded = false; S.next = null; }
  else if (p === '/onboarding') { S.session = { kind: 'customer' }; S.onboarded = false; }
  else if (p === '/sesion-activa') { S.session = { kind: 'staff', role: 'empleado', name: 'Jorge Mora' }; S.want = 'customer'; }
  else if (p.startsWith('/equipo/')) { const a = p.startsWith('/equipo/admin'); S.session = { kind: 'staff', role: a ? 'administrador' : (S.session && S.session.kind === 'staff' ? S.session.role : 'empleado'), name: a ? 'Marta Solano' : (S.session && S.session.kind === 'staff' ? S.session.name : 'Jorge Mora') }; }
  else { cust(); if (p === '/carrito' || p === '/checkout') ensureCart(); }
  if (p === '/pedido') { cust(); if (!S.last || !S.orders.find((o) => o.id === S.last)) { const o = { id: 'o' + S.no, no: String(S.no).padStart(4, '0'), venue: 'sala-norte', who: 'Ana', items: [{ n: 'Margarita', q: 2, p: 4500 }, { n: 'Cerveza Imperial', q: 1, p: 2500 }], status: 'new', t: Date.now(), st: Date.now(), code: 'K7M2-X9PQ-4RTA', mine: true }; S.no++; S.orders.push(o); S.last = o.id; } p = '/pedido/' + S.last; }
  go('#' + p);
}
sel.addEventListener('change', () => { if (sel.value) jump(sel.value); sel.value = ''; });
$('#bx-adv').addEventListener('click', () => {
  const o = S.orders.find((x) => x.id === S.last);
  if (!o || !advance(o)) { toast(o ? 'El pedido ya terminó' : 'Todavía no hiciste un pedido'); return; }
  S.barTab = o.status; toast('Barra: ' + STATUS_LABEL[o.status]); render();
});
$('#bx-reset').addEventListener('click', () => { S = fresh(); applyTheme(); closeDlg(); go('#/acceso'); render(); });
function syncBx(path) {
  const m = path.match(/^\/local\/([\w-]+)$/); S.pathVenue = m ? m[1] : null;
}
window.addEventListener('hashchange', () => { closeDlg(); render(); });
window.__boceto = { jump, state: () => S };

/* Arranque: ?sesion=cliente|empleado|admin y ?tema=claro|oscuro (útil para revisar capturas) */
const qs = new URLSearchParams(location.search);
if (qs.get('tema')) { S.theme = qs.get('tema') === 'oscuro' ? 'dark' : qs.get('tema') === 'claro' ? 'light' : 'system'; applyTheme(); }
const ss = qs.get('sesion');
if (ss === 'cliente') { S.session = { kind: 'customer' }; S.onboarded = true; }
if (ss === 'empleado') S.session = { kind: 'staff', role: 'empleado', name: 'Jorge Mora' };
if (ss === 'admin') S.session = { kind: 'staff', role: 'administrador', name: 'Marta Solano' };
if (qs.get('carrito')) S.cart = { venue: 'sala-norte', lines: { p1: 2, p4: 1 } };
if (!location.hash) history.replaceState(null, '', '#/');
render();
})();
