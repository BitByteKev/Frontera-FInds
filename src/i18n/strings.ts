// English is the source of truth. `as const` lets TranslationKey be derived
// from these keys, and the `es` Record below is forced to cover every one.
export const en = {
  "common.loading": "Loading…",

  "nav.logoAria": "Frontera Finds — home",
  "header.searchPlaceholder": "Search items…",
  "header.sell": "Sell",

  "footer.tag": "El swapmeet sin fronteras — two cities, one marketplace.",
  "footer.meta": "Shipping across the USA · Local pickup & delivery in San Diego ⟷ Tijuana · ",
  "footer.howItWorks": "How it works",
  "footer.instagramAria": "Frontera Finds on Instagram (@fronterafind.s)",

  "home.heroTitle": "Two cities. One marketplace.",
  "home.heroSub": "El swapmeet sin fronteras",
  "home.shippingUsa": "Shipping across the USA",
  "home.searchPlaceholder": "Search items…",
  "home.sortNewest": "Newest",
  "home.sortPriceAsc": "Price: low to high",
  "home.sortPriceDesc": "Price: high to low",
  "home.minPrice": "Min $",
  "home.maxPrice": "Max $",
  "home.filterShips": "Ships USA",
  "home.filterLocal": "Local pickup / delivery",
  "home.filterHideSold": "Hide sold",
  "home.loadErrorPrefix": "Couldn't load items: ",
  "home.noResults": "No items match your filters.",

  "about.kicker": "El swapmeet sin fronteras",
  "about.title": "Two cities. One marketplace.",
  "about.intro":
    "Frontera Finds is my personal online swapmeet for the San Diego–Tijuana border — a Sunday garage sale that stretches across the line. Everything here is mine, one-of-one, priced to move.",
  "about.shippingHeading": "Shipping across the USA 🇺🇸",
  "about.shippingBody":
    "Most items can ship anywhere in the United States. Message me with your ZIP and I’ll confirm shipping before you pay.",
  "about.localHeading": "Local pickup & delivery — San Diego ⟷ Tijuana 🌵",
  "about.localBody":
    "On either side of the line? Skip shipping — arrange free local pickup, or local delivery on bigger items. Just tap WhatsApp or text on any listing.",
  "about.howToBuyHeading": "How to buy",
  "about.howToBuyLead": "There’s no checkout here. Find something you like, hit",
  "about.orWord": "or",
  "about.howToBuyTail":
    ", and we’ll sort out payment (cash, Venmo, Zelle) and handoff directly.",

  "item.notFound": "Item not found.",
  "item.soldNotice": "This item has been sold.",

  "badge.sold": "SOLD",
  "badge.shipsUsa": "Ships USA",
  "badge.localSdTj": "Local · SD ⟷ TJ",

  "contact.whatsapp": "WhatsApp",
  "contact.sms": "Text / SMS",
  "contact.instagramDm": "Instagram DM",
  "contact.facebook": "Facebook Marketplace",
  "contact.messageSeller": "Message the seller",
  "contact.yourName": "Your name",
  "contact.yourEmail": "Your email (so the seller can reply)",
  "contact.messageLabel": "Message",
  "contact.send": "Send",
  "contact.sendError": "Couldn't send — please try WhatsApp or text instead.",
  "contact.sent": "Sent! The seller will get back to you.",
  "contact.defaultMessage": "Hi! Is \"{title}\" still available?",
  "contact.pitch": "Hi! I'm interested in \"{title}\" ({price}) on Frontera Finds: {url}",

  "gallery.prev": "Previous photo",
  "gallery.next": "Next photo",
  "gallery.showPhoto": "Show photo {n}",
  "gallery.photoAlt": "{title} — photo {n} of {total}",

  "theme.toLight": "Switch to light mode",
  "theme.toDark": "Switch to dark mode",
  "theme.lightTitle": "Light mode",
  "theme.darkTitle": "Dark mode",
} as const;

export type TranslationKey = keyof typeof en;

export const es: Record<TranslationKey, string> = {
  "common.loading": "Cargando…",

  "nav.logoAria": "Frontera Finds — inicio",
  "header.searchPlaceholder": "Buscar artículos…",
  "header.sell": "Vender",

  "footer.tag": "El swapmeet sin fronteras — dos ciudades, un mercado.",
  "footer.meta": "Envíos a todo EE. UU. · Recogida y entrega local en San Diego ⟷ Tijuana · ",
  "footer.howItWorks": "Cómo funciona",
  "footer.instagramAria": "Frontera Finds en Instagram (@fronterafind.s)",

  "home.heroTitle": "Dos ciudades. Un mercado.",
  "home.heroSub": "El swapmeet sin fronteras",
  "home.shippingUsa": "Envíos a todo EE. UU.",
  "home.searchPlaceholder": "Buscar artículos…",
  "home.sortNewest": "Más recientes",
  "home.sortPriceAsc": "Precio: de menor a mayor",
  "home.sortPriceDesc": "Precio: de mayor a menor",
  "home.minPrice": "Mín $",
  "home.maxPrice": "Máx $",
  "home.filterShips": "Envío a EE. UU.",
  "home.filterLocal": "Recogida / entrega local",
  "home.filterHideSold": "Ocultar vendidos",
  "home.loadErrorPrefix": "No se pudieron cargar los artículos: ",
  "home.noResults": "Ningún artículo coincide con tus filtros.",

  "about.kicker": "El swapmeet sin fronteras",
  "about.title": "Dos ciudades. Un mercado.",
  "about.intro":
    "Frontera Finds es mi swapmeet personal en línea para la frontera entre San Diego y Tijuana — una venta de garaje dominguera que cruza la línea. Todo aquí es mío, único, y a precio de remate.",
  "about.shippingHeading": "Envíos a todo EE. UU. 🇺🇸",
  "about.shippingBody":
    "La mayoría de los artículos se pueden enviar a cualquier parte de Estados Unidos. Mándame tu código postal y te confirmo el envío antes de que pagues.",
  "about.localHeading": "Recogida y entrega local — San Diego ⟷ Tijuana 🌵",
  "about.localBody":
    "¿De cualquier lado de la línea? Olvídate del envío — coordina recogida local gratis, o entrega local en artículos más grandes. Solo toca WhatsApp o manda un mensaje en cualquier anuncio.",
  "about.howToBuyHeading": "Cómo comprar",
  "about.howToBuyLead": "Aquí no hay pago en línea. Encuentra algo que te guste y toca",
  "about.orWord": "o",
  "about.howToBuyTail":
    ", y arreglamos el pago (efectivo, Venmo, Zelle) y la entrega directamente.",

  "item.notFound": "Artículo no encontrado.",
  "item.soldNotice": "Este artículo ya se vendió.",

  "badge.sold": "VENDIDO",
  "badge.shipsUsa": "Envío a EE. UU.",
  "badge.localSdTj": "Local · SD ⟷ TJ",

  "contact.whatsapp": "WhatsApp",
  "contact.sms": "Texto / SMS",
  "contact.instagramDm": "Instagram DM",
  "contact.facebook": "Facebook Marketplace",
  "contact.messageSeller": "Mensaje al vendedor",
  "contact.yourName": "Tu nombre",
  "contact.yourEmail": "Tu correo (para que el vendedor pueda responder)",
  "contact.messageLabel": "Mensaje",
  "contact.send": "Enviar",
  "contact.sendError": "No se pudo enviar — intenta por WhatsApp o mensaje de texto.",
  "contact.sent": "¡Enviado! El vendedor se pondrá en contacto contigo.",
  "contact.defaultMessage": "¡Hola! ¿\"{title}\" sigue disponible?",
  "contact.pitch": "¡Hola! Me interesa \"{title}\" ({price}) en Frontera Finds: {url}",

  "gallery.prev": "Foto anterior",
  "gallery.next": "Foto siguiente",
  "gallery.showPhoto": "Mostrar foto {n}",
  "gallery.photoAlt": "{title} — foto {n} de {total}",

  "theme.toLight": "Cambiar a modo claro",
  "theme.toDark": "Cambiar a modo oscuro",
  "theme.lightTitle": "Modo claro",
  "theme.darkTitle": "Modo oscuro",
};
