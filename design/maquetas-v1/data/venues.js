/* Datos de las maquetas.
   FACTS = datos reales del negocio, con fuente. Sin coordenadas, fotos ni logos: la red de esta sesión
   bloqueó OpenStreetMap, Wikimedia y los sitios de los locales, y no se inventan (ver GUIA.md §8).
   DEMO = todo lo simulado: estado de apertura, horario, menú, precios, distancias de maqueta y pedidos.
   Onza no tiene relación comercial ni autorización de estos locales; revisión de permisos pendiente antes del lanzamiento. */
window.ONZA_FACTS = [
  {
    slug: "mil948",
    name: "Mil948",
    zone: "Barrio Escalante",
    addressPublished: "Edificio B, Calle Negritos, Barrio Escalante, San José",
    sources: [
      "https://www.theworlds50best.com/discovery/Establishments/Costa-Rica/San-José/Mil948.html",
      "https://www.larepublica.net/mil948-brinda-cultura-y-experiencia-de-consumo-con-mixologia/",
    ],
    coordinates: null,
    coordinatesStatus: "por verificar",
    photo: null,
    logo: null,
    assetStatus: "pendiente de aporte o fuente con uso permitido",
  },
  {
    slug: "stiefel-pub",
    name: "Stiefel Pub",
    zone: "Barrio Otoya",
    addressPublished: "Junto a la Embajada de México, frente al CENAC, San José",
    sources: ["https://ticotimes.net/2013/10/08/stiefel-pub-raises-the-craft-beer-bar"],
    coordinates: null,
    coordinatesStatus: "por verificar",
    photo: null,
    logo: null,
    assetStatus: "pendiente de aporte o fuente con uso permitido",
  },
  {
    slug: "wilk",
    name: "Wilk Craft Beer",
    zone: "Barrio Escalante",
    addressPublished: "Avenida 9, Barrio Escalante, San José",
    sources: [
      "https://www.lonelyplanet.com/articles/best-things-to-do-in-barrio-escalante",
      "https://delfino.cr/2026/01/wilk-donde-la-cerveza-artesanal-se-encuentra-con-el-buen-rock",
    ],
    coordinates: null,
    coordinatesStatus: "por verificar",
    photo: null,
    logo: null,
    assetStatus: "pendiente de aporte o fuente con uso permitido",
  },
  {
    slug: "apotecario",
    name: "Apotecario",
    zone: "Barrio Escalante",
    addressPublished: "300 m este de la Iglesia Santa Teresita, Barrio Escalante",
    sources: ["https://www.kupi.com/en-ae/explore/costa-rica/san-jose/apotecario"],
    coordinates: null,
    coordinatesStatus: "por verificar (confirmar también en apotecario.cr)",
    photo: null,
    logo: null,
    assetStatus: "pendiente de aporte o fuente con uso permitido",
  },
  {
    slug: "otro-bar",
    name: "Otro Bar",
    zone: "Barrio Escalante",
    addressPublished: "Barrio Escalante, San José (dirección exacta por verificar)",
    sources: ["https://www.theworlds50best.com/discovery/Establishments/Costa-Rica/San-José/Otro-Bar.html"],
    coordinates: null,
    coordinatesStatus: "por verificar",
    photo: null,
    logo: null,
    assetStatus: "pendiente de aporte o fuente con uso permitido",
  },
];

window.ONZA_DEMO = {
  /* Distancias solo para mostrar el diseño "Más cerca" en la maqueta; marcadas como simuladas. */
  venues: {
    mil948: { openState: "open", hours: "Hasta la 1:00 a. m.", pickup: "Barra principal", prepMin: 8, capacity: 25, demoDistanceM: 350, monogram: "M" },
    "stiefel-pub": { openState: "open", hours: "Hasta las 12:00 a. m.", pickup: "Barra de grifos", prepMin: 5, capacity: 30, demoDistanceM: 1300, monogram: "S" },
    wilk: { openState: "paused", hours: "Hasta las 12:00 a. m.", pickup: "Barra", prepMin: 6, capacity: 20, demoDistanceM: 600, monogram: "W" },
    apotecario: { openState: "open", hours: "Hasta las 11:00 p. m.", pickup: "Barra del patio", prepMin: 10, capacity: 15, demoDistanceM: 900, monogram: "A" },
    "otro-bar": { openState: "closed", hours: "Abre a las 6:00 p. m.", pickup: "Barra", prepMin: 8, capacity: 20, demoDistanceM: 450, monogram: "O" },
  },
  /* Menús y precios simulados (genéricos; no reproducen la carta real de ningún local). */
  menus: {
    mil948: [
      ["Cocteles", [["Negroni", "Gin, vermut rojo y bitter.", 6500, "cocktail"], ["Old fashioned", "Bourbon, azúcar y amargo de angostura.", 6800, "cocktail"], ["Margarita", "Tequila, limón y licor de naranja.", 6200, "cocktail"]]],
      ["Altos", [["Gin tonic", "Gin, tónica y cáscara de limón.", 5800, "highball"], ["Paloma", "Tequila, toronja y soda.", 5600, "highball"]]],
      ["Sin alcohol", [["Soda de jengibre", "Jengibre, limón y soda.", 3200, "soft"]]],
    ],
    "stiefel-pub": [
      ["Cervezas", [["IPA", "Pinta, 473 ml.", 3800, "beer"], ["Lager", "Pinta, 473 ml.", 3200, "beer"], ["Stout", "Pinta, 473 ml.", 3900, "beer"], ["Sour de frutas", "Copa, 330 ml.", 4200, "beer"]]],
      ["Shots", [["Shot de guaro", "Con limón.", 2000, "shot"]]],
      ["Sin alcohol", [["Agua con gas", "Botella, 500 ml.", 1500, "soft"]]],
    ],
    wilk: [
      ["Cervezas", [["Pale ale", "Pinta, 473 ml.", 3600, "beer"], ["Kölsch", "Pinta, 473 ml.", 3400, "beer"], ["Red IPA", "Pinta, 473 ml.", 3900, "beer"]]],
      ["Vino", [["Copa de tinto", "Malbec.", 4200, "wine"]]],
    ],
    apotecario: [
      ["Gin tonics", [["Gin tonic clásico", "Gin, tónica y enebro.", 6200, "highball"], ["Gin tonic cítrico", "Gin, tónica y toronja.", 6400, "highball"]]],
      ["Vino", [["Copa de blanco", "Sauvignon blanc.", 4500, "wine"], ["Copa de tinto", "Tempranillo.", 4500, "wine"]]],
      ["Sin alcohol", [["Limonada de hierbas", "Limón, albahaca y soda.", 3000, "soft"]]],
    ],
    "otro-bar": [
      ["Cocteles", [["Daiquiri", "Ron, limón y azúcar.", 5900, "cocktail"], ["Mezcal sour", "Mezcal, limón y clara.", 6600, "cocktail"]]],
      ["Shots", [["Shot de tequila", "Blanco, con sal y limón.", 2600, "shot"]]],
    ],
  },
  /* Cuentas ficticias de la maqueta (dominio .demo). Ninguna contraseña es real. */
  customers: [
    { email: "maria@correo.demo", name: "María Solís", username: "mariasolis" },
    { email: "sofia@correo.demo", name: "Sofía Vargas", username: "sofiav" },
  ],
  takenUsernames: ["mariasolis", "sofiav", "onza"],
  team: {
    mil948: [
      { email: "ana@equipo.demo", name: "Ana Rojas", role: "admin" },
      { email: "jorge@equipo.demo", name: "Jorge Mora", role: "employee" },
      { email: "luis@equipo.demo", name: "Luis Brenes", role: "employee", mustChange: true },
    ],
    "stiefel-pub": [
      { email: "ana@equipo.demo", name: "Ana Rojas", role: "employee" },
      { email: "carla@equipo.demo", name: "Carla Jiménez", role: "admin" },
    ],
    wilk: [{ email: "diego@equipo.demo", name: "Diego Castro", role: "admin" }],
    apotecario: [{ email: "elena@equipo.demo", name: "Elena Quesada", role: "admin" }],
    "otro-bar": [{ email: "fabian@equipo.demo", name: "Fabián Núñez", role: "admin" }],
  },
};
