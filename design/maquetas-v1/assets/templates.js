/* Onza V1 · plantillas compartidas. Cada función = un componente de la app (GUIA.md §4).
   Íconos: trazos de Lucide (ISC), los mismos de lucide-react. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "₡" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const IC = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8M16 12H8M13 16H8"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z"/>',
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
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    toggle: '<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="16" cy="12" r="2"/>',
    wifiOff: '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20"/>',
    volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    volumeOff: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="m22 9-6 6M16 9l6 6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    apple: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  };
  const ico = (name, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[name] || ""}</svg>`;
  const GOOGLE = '<svg class="ico" viewBox="0 0 48 48" aria-hidden="true" style="stroke:none"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  const isDark = () => document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const wordmark = (forceWhite) => `<img src="assets/brand/onza-wordmark${forceWhite || isDark() ? "-white" : ""}.svg" alt="onza" height="22">`;
  const shot = (forceWhite) => `assets/brand/onza-shot${forceWhite || isDark() ? "-white" : ""}.svg`;

  /* ---------- Estado del local ---------- */
  const venueStatus = (v) => v.openState === "closed"
    ? { cls: "", label: "Cerrado", sub: v.hours }
    : v.openState === "paused"
      ? { cls: "paused", label: "Pausado", sub: "No recibe pedidos por ahora" }
      : { cls: "open", label: "Abierto", sub: v.hours };
  const badge = (label, cls = "", plain = false) => `<span class="badge ${cls} ${plain ? "plain" : ""}">${esc(label)}</span>`;

  /* VenueMedia: foto real si existe; si no, "Foto pendiente" (nunca un genérico de stock). */
  const media = (v, ratio = "ratio-16x9") => v.photo
    ? `<div class="media ${ratio}"><img class="photo" src="${esc(v.photo)}" alt=""></div>`
    : `<div class="media pending ${ratio}" role="img" aria-label="Foto de ${esc(v.name)} pendiente"><div class="ghost"><img src="${shot()}" alt=""></div><span class="note">Foto pendiente</span></div>`;
  const mono = (v, size = "") => v.logo
    ? `<img class="mono ${size}" src="${esc(v.logo)}" alt="">`
    : `<span class="mono ${size}" aria-hidden="true">${esc(v.monogram || v.name[0])}</span>`;
  const distance = (m) => m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

  function venueCard(v, opts = {}) {
    const st = venueStatus(v);
    const closed = v.openState === "closed";
    const meta = [v.zone, opts.withDistance ? distance(v.demoDistanceM) : null].filter(Boolean).join(" · ");
    // Con foto: imagen protagonista 16:9 y texto debajo. Sin foto: tarjeta compacta (nunca un placeholder gigante).
    if (!v.photo) {
      return `<a class="vcard compact ${closed ? "closed" : ""}" href="#/local/${v.slug}">${mono(v, "lg")}
        <div class="grow"><div class="row between"><span class="name">${esc(v.name)}</span>${badge(st.label, st.cls)}</div>
        <div class="meta">${esc(meta)}</div><div class="meta">${esc(st.sub)}</div></div></a>`;
    }
    return `<a class="vcard ${closed ? "closed" : ""}" href="#/local/${v.slug}">
      ${media(v)}
      <div class="body">${mono(v)}<div class="grow"><div class="row between"><span class="name">${esc(v.name)}</span>${badge(st.label, st.cls)}</div>
      <div class="meta">${esc(meta)}</div><div class="meta">${esc(st.sub)}</div></div></div></a>`;
  }
  function venueRow(v, opts = {}) {
    const st = venueStatus(v);
    const meta = [v.zone, opts.withDistance ? distance(v.demoDistanceM) : null, st.sub].filter(Boolean).join(" · ");
    return `<a class="vrow ${v.openState === "closed" ? "closed" : ""}" href="#/local/${v.slug}">${mono(v)}<div class="grow"><div class="t-label" style="font-weight:600;font-size:16px">${esc(v.name)}</div><div class="meta muted t-label" style="font-weight:400">${esc(meta)}</div></div>${badge(st.label, st.cls)}${ico("right", "sm")}</a>`;
  }
  function venueHero(v) {
    const st = venueStatus(v);
    return `<header class="vhero">${v.photo ? media(v, "ratio-3x2") : ""}
      <div class="id">${mono(v, "lg")}<div class="grow"><h1 class="t-title">${esc(v.name)}</h1>
      <div class="facts"><span>${esc(v.zone)}</span><span>Retiro: ${esc(v.pickup)}</span><span>${esc(v.hours)}</span></div></div>${badge(st.label, st.cls)}</div>
      <p class="demo-note">Demo · menú y precios simulados${v.photo ? "" : " · foto y logo pendientes"} · sin relación comercial con el local</p></header>`;
  }

  /* ProductRow + QuantityStepper. El − con cantidad 1 es "Quitar": nunca deja un artículo atrapado. */
  function stepper(pid, qty, enter) {
    return `<div class="stepper ${enter ? "enter" : ""}" role="group" aria-label="Cantidad">
      <button type="button" data-act="qty" data-pid="${pid}" data-delta="-1" aria-label="${qty === 1 ? "Quitar" : "Quitar uno"}">${ico(qty === 1 ? "trash" : "minus", "sm")}</button>
      <span class="qty num" role="status" aria-live="polite">${qty}</span>
      <button type="button" data-act="qty" data-pid="${pid}" data-delta="1" aria-label="Agregar uno" ${qty >= 20 ? "disabled" : ""}>${ico("plus", "sm")}</button></div>`;
  }
  function productRow(p, opts = {}) {
    const qty = opts.qty || 0;
    const blocked = opts.blocked; // local cerrado/pausado
    let action;
    if (!p.available) action = qty ? stepper(p.id, qty) : badge("Agotado", "", true);
    else if (qty) action = stepper(p.id, qty, opts.justAdded);
    else action = `<button class="btn secondary sm add-btn" data-act="add" data-pid="${p.id}" ${blocked ? 'aria-disabled="true" title="' + esc(blocked) + '"' : ""}>Agregar</button>`;
    return `<div class="prow ${p.available ? "" : "soldout"}" id="p-${p.id}">
      <button class="thumb" data-act="product" data-pid="${p.id}" aria-label="Ver ${esc(p.name)}" style="border:0;padding:0;cursor:pointer"><img src="assets/products/${p.img}.png" alt=""></button>
      <div class="grow"><div class="name">${esc(p.name)}</div><div class="desc">${esc(p.desc)}</div><div class="price">${money(p.price)}</div>
      ${!p.available && qty ? '<span class="flag">Se agotó · quitalo del carrito</span>' : ""}</div>
      <div>${action}</div></div>`;
  }

  function dock(v, totals, bump) {
    return `<a class="dock" href="#/carrito" aria-label="Ver carrito: ${totals.count} productos, ${money(totals.total)}">
      <span class="bag ${bump ? "drop" : ""}">${ico("bag")}</span><span class="t-label" style="font-weight:600">${totals.count} ${totals.count === 1 ? "producto" : "productos"}</span>
      <span class="total num ${bump ? "tick" : ""}">${money(totals.total)}</span><span class="go">Ver carrito ${ico("right", "sm")}</span></a>`;
  }

  /* ConnectionBanner y avisos persistentes. */
  function banner(kind, text, action) {
    const icon = kind === "offline" ? "wifiOff" : kind === "reconnecting" ? "refresh" : "alert";
    const cls = kind === "danger" ? "danger" : kind === "info" ? "info" : "";
    return `<div class="banner ${cls}" role="status">${ico(icon, "sm")}<span class="grow">${esc(text)}</span>${action || ""}</div>`;
  }
  function notice(kind, title, text, action) {
    return `<div class="notice ${kind}" role="${kind === "danger" ? "alert" : "status"}">${ico(kind === "success" ? "check" : "alert")}<div class="grow">${title ? `<strong>${esc(title)}</strong>` : ""}${esc(text)}${action ? `<div style="margin-top:12px">${action}</div>` : ""}</div></div>`;
  }
  function emptyState(title, text, action, glyph) {
    return `<div class="state"><div class="glyph">${glyph === "brand" ? `<img src="${shot()}" alt="">` : ico(glyph || "receipt", "lg")}</div><h2 class="t-heading">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${action || ""}</div>`;
  }
  function errorState(title, text, action) {
    return `<div class="state error" role="alert"><div class="glyph">${ico("alert", "lg")}</div><h2 class="t-heading">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}${action || ""}</div>`;
  }
  function skeletonCards(n = 3) {
    return `<div class="vgrid three" aria-busy="true" aria-label="Cargando">${Array.from({ length: n }, () => `<div class="stack tight"><div class="sk ratio-16x9" style="border-radius:16px"></div><div class="row"><div class="sk" style="width:48px;height:48px"></div><div class="grow stack tight"><div class="sk title"></div><div class="sk line" style="width:80%"></div></div></div></div>`).join("")}</div>`;
  }

  function sheet(title, body, actions, opts = {}) {
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="grabber"></div><div class="sheet-head"><div class="grow"><h2 class="t-heading" id="sheet-title">${esc(title)}</h2>${opts.sub ? `<p class="muted t-label" style="font-weight:400;margin-top:4px">${esc(opts.sub)}</p>` : ""}</div>
      ${opts.noClose ? "" : `<button class="icon-btn" data-act="close-sheet" aria-label="Cerrar">${ico("x")}</button>`}</div>
      ${body}${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
  }

  function field(id, label, input, hint, error) {
    return `<div class="field"><label for="${id}">${esc(label)}</label>${input}${hint ? `<span class="hint" id="${id}-hint">${esc(hint)}</span>` : ""}${error ? `<span class="field-error" id="${id}-err">${ico("alert", "sm")}${esc(error)}</span>` : ""}</div>`;
  }
  const input = (id, attrs = "", invalid) => `<input class="input" id="${id}" name="${id}" ${attrs} ${invalid ? `aria-invalid="true" aria-describedby="${id}-err"` : ""}>`;
  const seg = (name, options, value, attrs = "") => `<div class="seg" role="group" ${attrs}>${options.map(([v, l]) => `<button type="button" data-act="seg" data-name="${name}" data-value="${v}" aria-pressed="${v === value}">${esc(l)}</button>`).join("")}</div>`;
  const toggle = (id, label, checked, attrs = "") => `<label class="toggle" for="${id}"><input type="checkbox" id="${id}" ${checked ? "checked" : ""} ${attrs}><span class="grow">${label}</span></label>`;
  const btn = (label, cls, attrs = "", icon) => `<button class="btn ${cls}" ${attrs}>${icon ? ico(icon) : ""}<span class="label">${label}</span></button>`;

  /* Línea de tiempo del pedido. */
  function timeline(order) {
    const steps = [
      ["queued", "Recibido", "Esperando que el local lo acepte"],
      ["preparing", "Preparando", "El local está haciendo tu pedido"],
      ["ready", "Listo para retirar", "Mostrá el código en la barra"],
      ["delivered", "Entregado", ""],
    ];
    const idx = steps.findIndex((s) => s[0] === order.status);
    return `<ol class="tl">${steps.map((s, i) => {
      const cls = i < idx || order.status === "delivered" ? "done" : i === idx ? "now" : "";
      return `<li class="${cls}"><span class="dot">${cls === "done" ? ico("check", "sm") : ""}</span><div><div class="t">${s[1]}</div>${cls === "now" && s[2] ? `<div class="s">${s[2]}</div>` : ""}</div></li>`;
    }).join("")}</ol>`;
  }

  /* QR ilustrativo: patrón determinista NO válido (la app usa el QR real de pickup-service). */
  function fakeQr(seedText) {
    let h = 0;
    for (const ch of seedText) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const n = 25, cells = [];
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = (h * 1103515245 + 12345) >>> 0;
      if ((h >> 16) & 1) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    const fp = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="#0d0d0e" role="img" aria-label="Código QR ilustrativo">${fp(0, 0)}${fp(n - 7, 0)}${fp(0, n - 7)}${cells.join("")}</svg>`;
  }
  const groupCode = (c) => c.match(/.{1,4}/g).map((g) => `<span>${g}</span>`).join("");
  function ticket(order, venue) {
    return `<section class="ticket" aria-label="Ticket de retiro">
      <div><div class="small">Retirá en</div><div class="where">${esc(venue.pickup)} · ${esc(venue.name)}</div></div>
      <div class="qr">${fakeQr(order.pickupCode)}</div>
      <div><div class="small">Código privado</div><div class="code num" aria-label="Código ${order.pickupCode.split("").join(" ")}">${groupCode(order.pickupCode)}</div></div>
      <div class="small">Pedido #${order.number} · El número no sirve para retirar. QR ilustrativo de maqueta.</div></section>`;
  }

  const statusLabel = { pending_authorization: "Procesando pago", queued: "Recibido", preparing: "Preparando", ready: "Listo", delivered: "Entregado", canceled: "Cancelado", expired: "Vencido", uncollected: "No retirado" };
  const statusClass = { queued: "", preparing: "warning", ready: "brand", delivered: "success", canceled: "danger", expired: "danger", uncollected: "danger" };
  const minutes = (ts) => Math.max(0, Math.round((Date.now() - ts) / 60000));

  /* OrderCard (variante barra). Una sola acción primaria por estado. */
  function staffCard(o, opts = {}) {
    const wait = o.status === "ready" ? `Listo hace ${minutes(o.readyAt || o.createdAt)} min` : `Espera ${minutes(o.createdAt)} min`;
    const late = o.status !== "ready" && minutes(o.createdAt) >= 10;
    const items = o.items.map((i) => `<div><span class="q">${i.qty}×</span>${esc(i.name)}</div>`).join("");
    const dis = opts.offline ? "disabled" : "";
    let acts = "";
    if (o.status === "queued") acts = `<div class="acts">${btn("Rechazar", "danger lg", `data-act="reject" data-id="${o.id}" ${dis}`)}${btn("Aceptar", "primary lg", `data-act="staff" data-do="accept" data-id="${o.id}" data-v="${o.version}" ${dis}`)}</div>`;
    if (o.status === "preparing") acts = `<div class="acts one">${btn("Marcar listo", "primary lg", `data-act="staff" data-do="ready" data-id="${o.id}" data-v="${o.version}" ${dis}`)}</div>`;
    if (o.status === "ready") acts = `<div class="acts one">${btn("Validar retiro", "secondary lg", `data-act="pickup" ${dis}`, "scan")}</div>`;
    return `<article class="ocard ${opts.anim || ""}" id="o-${o.id}" aria-label="Pedido ${o.number}">
      <div class="row between"><span class="num">#${o.number}</span><span class="wait ${late ? "late" : ""}">${ico("clock", "sm")}${wait}</span></div>
      <div class="items">${items}</div><div class="by">${esc(o.customerName)} · ${o.items.reduce((s, i) => s + i.qty, 0)} productos</div>
      ${opts.error ? `<div class="inline-error" role="alert">${esc(opts.error)}</div>` : ""}${acts}</article>`;
  }

  window.OnzaUI = { esc, money, ico, GOOGLE, wordmark, shot, isDark, venueStatus, badge, media, mono, distance, venueCard, venueRow, venueHero, stepper, productRow, dock, banner, notice, emptyState, errorState, skeletonCards, sheet, field, input, seg, toggle, btn, timeline, ticket, fakeQr, statusLabel, statusClass, minutes, staffCard };
})();
