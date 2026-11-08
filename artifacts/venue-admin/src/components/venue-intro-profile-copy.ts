export const VENUE_INTRO_COPY_LIMITS = {
  venueName: 100,
  venueCategory: 70,
  venueLocation: 100,
  coverCopy: 240,
  slide2Heading: 100,
  slide2Copy: 300,
  slide3Heading: 100,
  slide3Copy: 300,
} as const;

export type VenueIntroProfileCopy = {
  [Field in keyof typeof VENUE_INTRO_COPY_LIMITS]: string;
};

export type VenueIntroCopyErrors = Partial<Record<keyof VenueIntroProfileCopy, string>>;
export type VenueIntroLanguage = "en" | "es";

function trimDefault(value: string, limit: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;

  const prefix = normalized.slice(0, limit - 1);
  const wordBoundary = prefix.lastIndexOf(" ");
  const safePrefix = wordBoundary >= limit * 0.6 ? prefix.slice(0, wordBoundary) : prefix;
  return `${safePrefix.trim()}…`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getShortVenueName(value: string, category = ""): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return value;

  let shortName = normalized;
  const separator = /[,;|–—]\s*(.+)$/u.exec(shortName);
  if (separator) {
    const suffix = separator[1].toLocaleLowerCase();
    const categoryWords = category.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const repeatsCategory = categoryWords.some((word) =>
      (suffix.match(/[\p{L}\p{N}]+/gu) ?? []).includes(word),
    );
    const looksLikeVenueDescription =
      /\b(?:venue|for events?|event space|café|cafe|coffee shop|restaurant|bar|pub|hotel|gallery|museum)\b/iu.test(suffix);
    if (repeatsCategory || looksLikeVenueDescription) {
      shortName = shortName.slice(0, separator.index).trim();
    }
  }

  const articleDescription =
    /\s+(?:a|an)\s+(?:(?:private|independent|specialty|speciality|boutique|neighborhood|neighbourhood|community|local|historic|event)\s+)*(?:café|cafe|coffee shop|restaurant|bar|pub|hotel|guesthouse|resort|gallery|museum|attraction|venue)(?=$|[^\p{L}\p{N}]).*$/iu.exec(shortName);
  if (articleDescription && /\b(?:venue|for events?|event space|private events?)\b/iu.test(articleDescription[0])) {
    shortName = shortName.slice(0, articleDescription.index).trim();
  }

  shortName = shortName.replace(
    /\s+(?:café|cafe|coffee shop|restaurant|bar|pub|hotel|gallery|museum|venue)\s+for\s+events?\b.*$/iu,
    "",
  ).trim();
  return shortName || normalized;
}

export function removeRepeatedVenueName(
  copy: string,
  venueName: string,
  language: VenueIntroLanguage = "en",
): string {
  const normalizedCopy = copy.trim().replace(/\s+/g, " ");
  const normalizedName = venueName.trim().replace(/\s+/g, " ");
  if (!normalizedCopy || normalizedName.length < 3) return normalizedCopy;

  const namePattern = new RegExp(
    `(^|[^\\p{L}\\p{N}-])(${escapeRegExp(normalizedName)})(['’]s)?(?=$|[^\\p{L}\\p{N}-])`,
    "giu",
  );
  return normalizedCopy
    .replace(namePattern, (_match, prefix: string, _name: string, possessive?: string) => {
      const startsSentence = !prefix || /[.!?]\s*$/u.test(prefix);
      const replacement = language === "es"
        ? startsSentence ? "Su local" : "su local"
        : startsSentence ? "Your venue" : "your venue";
      return `${prefix}${replacement}${language === "en" ? possessive ?? "" : ""}`;
    })
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function categoryCopy(category: string, fitReason: string, language: VenueIntroLanguage = "en") {
  const signals = `${category} ${fitReason}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase();
  if (language === "es") {
    if (/\b(?:hotel|hostal|alojamiento|resort)\b/u.test(signals)) {
      return {
        heading: "Haz que la estancia se recuerde",
        copy: "Los huéspedes pueden registrar su visita y dejar un recuerdo en el Libro de Visitas para volver a disfrutarlo.",
      };
    }
    if (/\b(?:evento|musica|teatro|galeria|museo|taller|arte|cultural|cine|concierto|club)\b/u.test(signals)) {
      return {
        heading: "Mantén la conexión entre eventos",
        copy: "Los visitantes pueden registrar su visita, compartir un recuerdo en el Libro de Visitas y enterarse de las próximas actividades.",
      };
    }
    if (/\b(?:cafe|cafeteria|panaderia|pasteleria|reposteria)\b/u.test(signals)) {
      return {
        heading: "Dales a tus clientes motivos para volver",
        copy: "Pueden registrar su visita, dejar un recuerdo en el Libro de Visitas y guardar tu cafetería para su próximo café.",
      };
    }
    if (/\b(?:restaurante|restobar|comida|gastronomia)\b/u.test(signals)) {
      return {
        heading: "Convierte una buena comida en una nueva visita",
        copy: "Los clientes pueden registrar su visita, compartir un recuerdo en el Libro de Visitas y guardar el restaurante para su próxima comida.",
      };
    }
    if (/\b(?:bar|pub|cerveceria|cerveza|cocteleria|discoteca)\b/u.test(signals)) {
      return {
        heading: "Dales un lugar familiar para su próximo plan",
        copy: "Los visitantes pueden registrar su visita, compartir un recuerdo en el Libro de Visitas y descubrir lo que viene en tu local.",
      };
    }
    if (/\b(?:atraccion|turismo|hito|historico|naturaleza|parque|jardin)\b/u.test(signals)) {
      return {
        heading: "Conserva el recuerdo después de la visita",
        copy: "Los visitantes pueden registrar su visita, guardar un recuerdo en el Libro de Visitas y tener presente tu espacio para volver.",
      };
    }
    return {
      heading: "Convierte las visitas en una conexión duradera",
      copy: "Los visitantes pueden registrar su visita, guardar un recuerdo en el Libro de Visitas y seguir conectados con tu local.",
    };
  }
  if (/\b(?:hotel|guesthouse|resort|lodging|accommodation)\b/u.test(signals)) {
    return {
      heading: "Make the stay worth remembering",
      copy: "Guests can check in during a stay and leave a Guest Book memory, giving them something personal to revisit.",
    };
  }
  if (/\b(?:event|music|theatre|theater|gallery|museum|workshop|arts|cultural|cinema)\b/u.test(signals)) {
    return {
      heading: "Keep the connection going between events",
      copy: "Guests can check in at your venue, share a Guest Book memory, and keep up with what is happening next.",
    };
  }
  if (/\b(?:café|cafe|coffee|bakery)\b/u.test(signals)) {
    return {
      heading: "Give café regulars a reason to return",
      copy: "Guests can check in, leave a Guest Book memory, and keep your place saved for another cup.",
    };
  }
  if (/\b(?:restaurant|dining)\b/u.test(signals)) {
    return {
      heading: "Make a good meal the start of a return visit",
      copy: "Guests can check in, share a Guest Book memory, and save your restaurant for their next meal.",
    };
  }
  if (/\b(?:bar|pub|brewery)\b/u.test(signals)) {
    return {
      heading: "Give the next night out a familiar place",
      copy: "Guests can check in, share a Guest Book memory, and keep up with what is happening at your venue.",
    };
  }
  if (/\b(?:attraction|tour|landmark|historic|nature|park|garden)\b/u.test(signals)) {
    return {
      heading: "Keep the memory after the visit",
      copy: "Visitors can check in, save a Guest Book memory of the experience, and keep your venue in mind for another visit.",
    };
  }
  return {
    heading: "Turn real visits into lasting connections",
    copy: "Guests can check in, save a Guest Book memory, and stay connected with your venue after they leave.",
  };
}

export function createDefaultVenueIntroCopy({
  venueName,
  pdfDisplayName,
  venueCategory,
  venueLocation,
  coverCopy,
  pdfHook,
  language = "en",
}: {
  venueName: string;
  pdfDisplayName?: string;
  venueCategory: string;
  venueLocation: string;
  coverCopy: string;
  pdfHook?: string;
  language?: VenueIntroLanguage;
}): VenueIntroProfileCopy {
  const tailored = categoryCopy(venueCategory, coverCopy, language);
  const shortVenueName = pdfDisplayName?.trim() || getShortVenueName(venueName, venueCategory);
  const cleanCoverCopy = removeRepeatedVenueName(
    removeRepeatedVenueName(pdfHook?.trim() || coverCopy, venueName, language),
    shortVenueName,
    language,
  );
  return {
    venueName: trimDefault(shortVenueName, VENUE_INTRO_COPY_LIMITS.venueName),
    venueCategory: trimDefault(venueCategory, VENUE_INTRO_COPY_LIMITS.venueCategory),
    venueLocation: trimDefault(venueLocation, VENUE_INTRO_COPY_LIMITS.venueLocation),
    coverCopy: trimDefault(cleanCoverCopy, VENUE_INTRO_COPY_LIMITS.coverCopy) ||
      (language === "es"
        ? "Tu comunidad puede crear motivos para que las personas vuelvan."
        : "Your community can create reasons for local visitors to return."),
    slide2Heading: tailored.heading,
    slide2Copy: tailored.copy,
    slide3Heading: language === "es" ? "Empieza con un código QR de Met en tu local" : "Start with one Met QR at your venue",
    slide3Copy: language === "es"
      ? "Coloca un código QR de Met donde tus clientes puedan verlo. Lo escanean en el local, abren o descargan Met, registran su visita, ganan puntos y se suman a tu comunidad de visitantes."
      : "Place a Met QR where guests can see it. They scan on site, open or download Met, check in, earn points, and join your visitor list—so your team can reconnect later.",
  };
}

export function createPreviousVenueIntroCopyDefaults({
  venueName,
  venueCategory,
  venueLocation,
  coverCopy,
}: {
  venueName: string;
  venueCategory: string;
  venueLocation: string;
  coverCopy: string;
}): VenueIntroProfileCopy[] {
  const name = trimDefault(venueName, 100);
  const category = trimDefault(venueCategory, 70);
  const location = trimDefault(venueLocation, 100);
  const previousHelperDefaults: VenueIntroProfileCopy = {
    venueName: name,
    venueCategory: category,
    venueLocation: location,
    coverCopy: trimDefault(coverCopy, 240) ||
      "Your community can create reasons for local visitors to return.",
    slide2Heading: "Make every visit memorable",
    slide2Copy: "Give guests reasons to return and keep the relationship going between visits.",
    slide3Heading: "Build connections from real visits",
    slide3Copy: "Guests scan your venue QR on site. Met helps your team reconnect with real visitors.",
  };
  const coverLead = `For ${name}, a ${category}:`;
  const safePrefix = coverLead.trim().slice(0, 240);
  const availableReasonLength = Math.max(0, 240 - safePrefix.length - 1);
  const safeReason = coverCopy.trim().slice(0, availableReasonLength);
  const previousGeneratedProfile: VenueIntroProfileCopy = {
    venueName: name,
    venueCategory: category,
    venueLocation: location,
    coverCopy: `${safePrefix}${safeReason ? ` ${safeReason}` : ""}`.trim().slice(0, 240),
    slide2Heading: `At ${name}`.slice(0, 100) || "At this venue",
    slide2Copy: `${name.slice(0, 90)} is a ${category}. A distinctive place in ${location}.`.slice(0, 300),
    slide3Heading: "Make visits memorable",
    slide3Copy: `Met helps guests remember visits to ${name}, a ${category}.`.slice(0, 300),
  };
  return [previousHelperDefaults, previousGeneratedProfile];
}

export function restoreVenueIntroCopy(
  saved: unknown,
  defaults: VenueIntroProfileCopy,
  previousDefaults: VenueIntroProfileCopy[] = [],
): VenueIntroProfileCopy {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...defaults };
  const record = saved as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(VENUE_INTRO_COPY_LIMITS).map((field) => [
      field,
      typeof record[field] === "string" &&
      !previousDefaults.some((previous) => record[field] === previous[field as keyof VenueIntroProfileCopy])
        ? record[field]
        : defaults[field as keyof VenueIntroProfileCopy],
    ]),
  ) as VenueIntroProfileCopy;
}

export function validateVenueIntroCopy(copy: VenueIntroProfileCopy): VenueIntroCopyErrors {
  const errors: VenueIntroCopyErrors = {};
  for (const [field, limit] of Object.entries(VENUE_INTRO_COPY_LIMITS) as Array<
    [keyof VenueIntroProfileCopy, number]
  >) {
    const text = copy[field];
    if (text.trim().length < 2) {
      errors[field] = "Enter at least 2 characters.";
    } else if (text.trim().length > limit) {
      errors[field] = `Keep this to ${limit} characters or fewer.`;
    }
  }
  return errors;
}
