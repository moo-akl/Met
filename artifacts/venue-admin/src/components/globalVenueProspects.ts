import { STRONG_FIT_VENUE_PROSPECTS } from "./globalVenueStrongFitProspects";
import { ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS } from "./globalVenueAdditionalStrongFitProspects";
import { ADDITIONAL_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueAdditionalTopFitProspects";
import { NEWEST_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueNewestTopFitProspects";
import { BATCH2_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueBatch2Prospects";
import { SPANISH_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueSpanishTopFitProspects";
import { ENGLISH_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueEnglishTopFitProspects";
import { NOVEMBER_2026_HOSPITALITY_PROSPECTS } from "./globalVenueNov2026HospitalityProspects";

export type GlobalVenueProspectData = {
  id: string;
  name: string;
  location: string;
  category: string;
  email: string;
  websiteUrl: string;
  emailEvidenceUrl: string;
  emailEvidenceQuote: string;
  contactUrl?: string;
  contactFormDraft?: string;
  outreachHoldReason?: string;
  pdfDisplayName?: string;
  fitEvidenceUrl?: string;
  fitEvidenceQuote?: string;
  discoverySourceUrl?: string;
  fitRank?: number;
  region?: string;
  outreachLanguage?: "en" | "es";
  fitReason: string;
  pdfHook?: string;
  pdfHookSourceUrl?: string;
  pdfHookEvidenceQuote?: string;
};

export type VenueFitTier = "top" | "strong";

export type GlobalVenueProspect = GlobalVenueProspectData & {
  fitTier: VenueFitTier;
};

const TOP_FIT_VENUE_PROSPECTS: GlobalVenueProspectData[] = [
  {
    id: "artist-house-bangkok",
    name: "Artist House Bangkok",
    location: "Bangkok, Thailand",
    category: "Art workshop café · cultural venue",
    email: "artisthousebangkok@gmail.com",
    websiteUrl: "https://www.artisthousebangkok.com/",
    emailEvidenceUrl: "https://www.artisthousebangkok.com/",
    emailEvidenceQuote: "Email: artisthousebangkok@gmail.com",
    fitReason: "your community-focused art workshops and cultural programming give guests a natural reason to check in and share a visit memory.",
    pdfHook: "Your restored century-old wooden house in Khlong Bang Luang makes the art-workshop café part of the experience.",
    pdfHookSourceUrl: "https://www.artisthousebangkok.com/",
    pdfHookEvidenceQuote: "Artist House Bangkok is an art workshop cafe located in the Khlong Bang Luang community. Lovingly restored from a century-old, two-story traditional Manila-style wooden house.",
  },
  {
    id: "cafe-neundrei",
    name: "cafe neundrei",
    location: "Berlin, Germany",
    category: "Independent café · bakery",
    email: "cafe@neundrei.com",
    websiteUrl: "https://neundrei.com/",
    emailEvidenceUrl: "https://neundrei.com/policies/contact-information",
    emailEvidenceQuote: "cafe neundrei … Monbijouplatz 2, 10178 Berlin … cafe@neundrei.com",
    fitReason: "your neighborhood café and handmade cakes bring people back regularly, which makes simple visit check-ins and guest rewards a natural fit.",
    pdfHook: "Your coffee, matcha, and handmade plant-based cakes have made this café part of the Monbijouplatz neighborhood since 2015.",
    pdfHookSourceUrl: "https://neundrei.com/",
    pdfHookEvidenceQuote: "Coffee, matcha & handmade plant-based cakes and sweets. Since March 2015, we’ve been part of the neighbourhood around Monbijouplatz.",
  },
  {
    id: "espacio-en-blanco",
    name: "Espacio en Blanco",
    location: "Bogotá, Colombia",
    category: "Creative cultural · event venue",
    email: "info@espacioenblanco.com.co",
    websiteUrl: "https://espacioenblanco.co/",
    emailEvidenceUrl: "https://espacioenblanco.co/",
    emailEvidenceQuote: "INFO@ESPACIOENBLANCO.COM.CO",
    fitReason: "your mix of art, music, fairs, and workshops gives guests a reason to discover upcoming events and leave a memory of each visit.",
    pdfHook: "Your creative venue brings art and music projects together in a community centered on creativity, culture, and collaboration.",
    pdfHookSourceUrl: "https://espacioenblanco.co/",
    pdfHookEvidenceQuote: "Más que un espacio de eventos, somos una comunidad donde la creatividad, la cultura y la colaboración cobran vida.",
  },
  {
    id: "bilbo-cafe",
    name: "Bilbo Café",
    location: "Buenos Aires, Argentina",
    category: "Café · bakery",
    email: "info@bilbocafe.com",
    websiteUrl: "https://www.bilbocafe.com.ar/",
    emailEvidenceUrl: "https://www.bilbocafe.com.ar/menu",
    emailEvidenceQuote: "info@bilbocafe.com",
    fitReason: "your Buenos Aires locations and Bilbox offering point to a repeat-visitor community that could benefit from easy check-ins and rewards.",
    pdfHook: "Your seasonal kitchen and signature pastries make this a place to linger for breakfast, work, or a conversation with friends.",
    pdfHookSourceUrl: "https://www.bilbocafe.com.ar/",
    pdfHookEvidenceQuote: "Pastelería de autor, cocina de estación y un espacio pensado para quedarte: para desayunar, para trabajar o para encontrarte con quien quieras.",
  },
  {
    id: "sonder-cafe",
    name: "Sonder Café",
    location: "Cape Town, South Africa",
    category: "Independent café",
    email: "sonderobz@gmail.com",
    websiteUrl: "https://www.sonderobz.com/",
    emailEvidenceUrl: "https://www.sonderobz.com/",
    emailEvidenceQuote: "Contact us for more info — sonderobz@gmail.com",
    fitReason: "your local, creative gathering-place atmosphere is a natural setting for guests to check in and leave a note about their visit.",
    pdfHook: "Your fair-trade Ethiopian–Burundi Arabica blend, New York-style bagels, and sourdough sandwiches give Cape Town guests a distinctive café stop.",
    pdfHookSourceUrl: "https://www.sonderobz.com/",
    pdfHookEvidenceQuote: "Our coffee is a 100% Arabica, fair trade Ethiopian and Burundi blend sourced from Bean There. New York-style bagels and sourdough sandwiches are our speciality.",
  },
  {
    id: "cafe-1001",
    name: "Café 1001",
    location: "London, United Kingdom",
    category: "Independent café · events venue",
    email: "info@cafe1001.co.uk",
    websiteUrl: "https://www.cafe1001.co.uk/",
    emailEvidenceUrl: "https://www.cafe1001.co.uk/contact/",
    emailEvidenceQuote: "If you have any enquiries about any of our upcoming events, our food and drink menus, bookings… info@cafe1001.co.uk",
    fitReason: "your Brick Lane café combines everyday food and drink with frequent events, so guests could use Met to discover what’s on and mark each visit.",
    pdfHook: "Your Brick Lane café shifts from daytime coffee and food to a HiFi bar, lounge, and disco at night—a distinctive reason to return.",
    pdfHookSourceUrl: "https://www.cafe1001.co.uk/",
    pdfHookEvidenceQuote: "A combined Café, cocktail bar, lounge and disco. CAFE by day. HIFI by NIGHT.",
  },
  {
    id: "heritage-square-museum",
    name: "Heritage Square Museum",
    location: "Los Angeles, California, USA",
    category: "Historic museum · cultural attraction",
    email: "info@heritagesquare.org",
    websiteUrl: "https://www.heritagesquare.org/",
    emailEvidenceUrl: "https://www.heritagesquare.org/contact",
    emailEvidenceQuote: "For general inquiries, email info@heritagesquare.org",
    fitReason: "your weekend tours of historic buildings give visitors a memorable, place-based experience that fits QR check-ins and guestbook memories.",
    pdfHook: "Your Victorian-era buildings bring Los Angeles history to life through guided tours, movie nights, and haunted ghost tours.",
    pdfHookSourceUrl: "https://www.heritagesquare.org/",
    pdfHookEvidenceQuote: "We offer many ways to enjoy the grounds – including general outdoor admission, guided tours of the buildings, movie nights, haunted ghost tours, holiday events, and more!",
  },
  {
    id: "uptown-jazz-cafe",
    name: "Uptown Jazz Cafe",
    location: "Melbourne, Australia",
    category: "Live music café · events venue",
    email: "uptownjazzcafe@email.com",
    websiteUrl: "https://www.uptownjazzcafe.com/",
    emailEvidenceUrl: "https://www.uptownjazzcafe.com/contact.php",
    emailEvidenceQuote: "Bookings and enquiries — email: uptownjazzcafe@email.com",
    fitReason: "your regular live-jazz gigs and published gig guide give local visitors a reason to find events and come back.",
    pdfHook: "Your live jazz and improvised-music lineup gives Melbourne listeners new performances to find in your gig guide.",
    pdfHookSourceUrl: "https://www.uptownjazzcafe.com/",
    pdfHookEvidenceQuote: "Uptown Jazz Cafe — Melbourne’s newest jazz and improvised music venue. The home of live jazz and improvised music in Melbourne.",
  },
  {
    id: "constela-cafe",
    name: "Constela Café",
    location: "Mexico City, Mexico",
    category: "Independent specialty café",
    email: "info@constelacafe.com",
    websiteUrl: "https://www.constelacafe.com/",
    emailEvidenceUrl: "https://www.constelacafe.com/contacto",
    emailEvidenceQuote: "info@constelacafe.com",
    fitReason: "your three Mexico City cafés and community-centered approach make local discovery and repeat-visit rewards especially relevant.",
    pdfHook: "Your coffee omakase takes guests through coffee’s origin, transformation, and preparation as a sensory experience—not just a drink.",
    pdfHookSourceUrl: "https://www.constelacafe.com/omakase",
    pdfHookEvidenceQuote: "Queremos ofrecerte una experiencia sensorial única, donde cada fase del proceso del café se vuelve especial y en un momento para explorar, aprender y degustar.",
  },
  {
    id: "shamba-cafe",
    name: "Shamba Cafe & Shop",
    location: "Nairobi, Kenya",
    category: "Café · events venue",
    email: "info@shambacafe.co.ke",
    websiteUrl: "https://www.shambacafe.co.ke/",
    emailEvidenceUrl: "https://www.shambacafe.co.ke/restaurant-1",
    emailEvidenceQuote: "info@shambacafe.co.ke",
    fitReason: "your functions, weekend farmers’ markets, and children’s activities create recurring events for guests to discover and revisit.",
    pdfHook: "Your Saturday farmers’ market sits alongside a farm shop, garden center, and farm-to-table café—a full outing for families and neighbors.",
    pdfHookSourceUrl: "https://www.shambacafe.co.ke/",
    pdfHookEvidenceQuote: "Shamba Café & Shop organically grew into a farm-to-table restaurant, farm shop and garden center. Saturday: Farmer’s Market 9 a.m.–5 p.m.",
  },
  {
    id: "casa-antonieta",
    name: "Casa Antonieta",
    location: "Oaxaca de Juárez, Mexico",
    category: "Boutique hotel",
    email: "reservaciones@casaantonieta.com",
    websiteUrl: "https://www.casaantonieta.com/",
    emailEvidenceUrl: "https://www.casaantonieta.com/contact",
    emailEvidenceQuote: "reservaciones@casaantonieta.com",
    fitReason: "your boutique hotel, on-site café, and terrace give guests several distinct moments to check in and share a memory of Oaxaca.",
    pdfHook: "Your calm retreat in Oaxaca Centro pairs the simplicity of a traditional Oaxacan home with boutique-hotel design and service.",
    pdfHookSourceUrl: "https://www.casaantonieta.com/casa-antonieta-english",
    pdfHookEvidenceQuote: "Casa Antonieta is a calm retreat in the heart of Oaxaca Centro, where the simplicity of a traditional Oaxacan home meets the thoughtful design and service of a boutique hotel.",
  },
  {
    id: "cafe-lamas",
    name: "Café Lamas",
    location: "Rio de Janeiro, Brazil",
    category: "Historic café · restaurant",
    email: "contato@cafelamas.com.br",
    websiteUrl: "https://cafelamas.com.br/",
    emailEvidenceUrl: "https://cafelamas.com.br/contato",
    emailEvidenceQuote: "contato@cafelamas.com.br",
    fitReason: "your long history as a Rio dining landmark offers visitors a memorable story to record and share after a visit.",
    pdfHook: "Your historic Rio café serves Filé Mignon à Oswaldo Aranha, a signature dish within a long-standing local dining tradition.",
    pdfHookSourceUrl: "https://cafelamas.com.br/",
    pdfHookEvidenceQuote: "O Café Lamas tem 150 anos de tradição. Nosso tradicional menu: Filé Mignon à Oswaldo Aranha.",
  },
  {
    id: "aracely-cafe",
    name: "Aracely Cafe",
    location: "San Francisco, California, USA",
    category: "Café · private event venue",
    email: "hello@aracelysf.com",
    websiteUrl: "https://www.aracelysf.com/",
    emailEvidenceUrl: "https://www.aracelysf.com/home",
    emailEvidenceQuote: "CONTACT + Giftcards — 415.366.5091 | Hello@aracelysf.com",
    fitReason: "your garden café and private-event setting make each visit a memorable occasion guests can share with friends.",
    pdfHook: "Your Treasure Island garden patio, outdoor fireplace nook, and string lights set a memorable scene for brunch and private dinners.",
    pdfHookSourceUrl: "https://www.aracelysf.com/",
    pdfHookEvidenceQuote: "Our inviting space features a spacious garden patio with lounge seating, a cozy outdoor fireplace nook, string lights, and heat lamps.",
  },
  {
    id: "old-skool-cafe",
    name: "Old Skool Cafe",
    location: "San Francisco, California, USA",
    category: "Café · live-music venue",
    email: "contact@oldskoolcafe.org",
    websiteUrl: "https://www.oldskoolcafe.org/",
    emailEvidenceUrl: "https://www.oldskoolcafe.org/yelp",
    emailEvidenceQuote: "CONTACT: contact@oldskoolcafe.org",
    fitReason: "your youth-led dining experience and live jazz create memorable evenings and recurring events for guests to discover.",
    pdfHook: "Your nightly live jazz accompanies a youth-led dining experience built around job training, mentorship, and global comfort food.",
    pdfHookSourceUrl: "https://www.oldskoolcafe.org/",
    pdfHookEvidenceQuote: "Each night at Old Skool Cafe, talented youth musicians take the stage to share soulful jazz performances. At-risk youth find purpose through job training, mentorship, and community.",
  },
  {
    id: "the-mind-cafe",
    name: "The Mind Cafe",
    location: "Singapore",
    category: "Board-game café",
    email: "admin@themindcafe.sg",
    websiteUrl: "https://themindcafe.sg/",
    emailEvidenceUrl: "https://themindcafe.sg/contact-us/",
    emailEvidenceQuote: "Email — admin@themindcafe.sg",
    fitReason: "your social, board-game café is built around repeat visits, making guest check-ins and rewards a natural fit.",
    pdfHook: "Your collection of 970+ board games makes every visit a chance to share a game, not just stop for coffee.",
    pdfHookSourceUrl: "https://themindcafe.sg/",
    pdfHookEvidenceQuote: "With 970+ board games to choose from, 20+ years of satisfied customers & 300+ corporate events hosted.",
  },
  {
    id: "centro-da-terra",
    name: "Centro da Terra",
    location: "São Paulo, Brazil",
    category: "Independent cultural venue · theatre",
    email: "teatro@centrodaterra.org.br",
    websiteUrl: "https://www.centrodaterra.com.br/centro-da-terra",
    emailEvidenceUrl: "https://www.centrodaterra.com.br/centro-da-terra",
    emailEvidenceQuote: "teatro@centrodaterra.org.br",
    fitReason: "your theatre, music, cinema, and arts programming gives local audiences regular events to discover and revisit.",
    pdfHook: "Your underground Sumaré cultural space brings music, cinema, and performing and visual arts into one independent program.",
    pdfHookSourceUrl: "https://www.centrodaterra.com.br/centro-da-terra",
    pdfHookEvidenceQuote: "Nossa programação tem como foco produções, apresentações e ações de formação em Música, Cinema, Artes Cênicas e Visuais.",
  },
  {
    id: "water-st-cafe",
    name: "Water St. Cafe",
    location: "Vancouver, British Columbia, Canada",
    category: "Independent restaurant · live-music venue",
    email: "info@waterstreetcafe.ca",
    websiteUrl: "https://www.waterstreetcafe.ca/",
    emailEvidenceUrl: "https://www.waterstreetcafe.ca/contact",
    emailEvidenceQuote: "Contact: 604-689-2832, info@waterstreetcafe.ca",
    fitReason: "your independently owned restaurant, live music, and private events give visitors multiple reasons to check in and return.",
    pdfHook: "Your 1906 Gastown heritage building pairs live music with Italian cuisine influenced by Vancouver’s West Coast ingredients.",
    pdfHookSourceUrl: "https://www.waterstreetcafe.ca/",
    pdfHookEvidenceQuote: "A Vancouver landmark since 1988, Water St. Café and 2nd Floor Gastown is housed in a 1906 heritage building. We offer classic Italian cuisine with influence from our beautiful West Coast, and live music.",
  },
];

export const GLOBAL_VENUE_PROSPECTS: GlobalVenueProspect[] = [
  ...TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "top" as const })),
  ...ADDITIONAL_TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "top" as const })),
  ...NEWEST_TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "top" as const })),
  ...BATCH2_TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "top" as const })),
  ...SPANISH_TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({
    ...prospect,
    fitTier: "top" as const,
    outreachLanguage: "es" as const,
  })),
  ...ENGLISH_TOP_FIT_VENUE_PROSPECTS.map((prospect) => ({
    ...prospect,
    fitTier: "top" as const,
    outreachLanguage: "en" as const,
  })),
  ...NOVEMBER_2026_HOSPITALITY_PROSPECTS.map((prospect) => ({
    ...prospect,
    fitTier: "top" as const,
  })),
  ...STRONG_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "strong" as const })),
  ...ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS.map((prospect) => ({ ...prospect, fitTier: "strong" as const })),
];
