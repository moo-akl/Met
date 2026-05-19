/**
 * Shared interest translations for the Met app.
 *
 * Single source of truth for interest label translations consumed by both the
 * mobile client (`@workspace/met`) and the API server (`@workspace/api-server`).
 *
 * Interests are stored in Postgres as title-cased English strings (e.g. "Music",
 * "Travel"). The i18n key is the lower-cased version (e.g. "music", "travel").
 */

export type InterestKey =
  | "sport" | "music" | "art" | "travel" | "food" | "gaming" | "tech"
  | "fitness" | "photography" | "reading" | "film" | "nature" | "cooking"
  | "fashion" | "hiking" | "yoga" | "dancing" | "coffee" | "dogs" | "cats"
  | "movies" | "cycling" | "wine" | "volunteering" | "podcasts" | "wellness"
  | "running" | "board games";

export type InterestLabels = Record<InterestKey, string>;

export const interestLocales: Record<string, InterestLabels> = {
  en: {
    sport: "Sport", music: "Music", art: "Art", travel: "Travel", food: "Food",
    gaming: "Gaming", tech: "Tech", fitness: "Fitness", photography: "Photography",
    reading: "Reading", film: "Film", nature: "Nature", cooking: "Cooking",
    fashion: "Fashion", hiking: "Hiking", yoga: "Yoga", dancing: "Dancing",
    coffee: "Coffee", dogs: "Dogs", cats: "Cats",
    movies: "Movies", cycling: "Cycling", wine: "Wine", volunteering: "Volunteering",
    podcasts: "Podcasts", wellness: "Wellness", running: "Running", "board games": "Board Games",
  },
  es: {
    sport: "Deporte", music: "Música", art: "Arte", travel: "Viajes", food: "Gastronomía",
    gaming: "Videojuegos", tech: "Tecnología", fitness: "Fitness", photography: "Fotografía",
    reading: "Lectura", film: "Cine", nature: "Naturaleza", cooking: "Cocina",
    fashion: "Moda", hiking: "Senderismo", yoga: "Yoga", dancing: "Baile",
    coffee: "Café", dogs: "Perros", cats: "Gatos",
    movies: "Películas", cycling: "Ciclismo", wine: "Vino", volunteering: "Voluntariado",
    podcasts: "Podcasts", wellness: "Bienestar", running: "Running", "board games": "Juegos de Mesa",
  },
  fr: {
    sport: "Sport", music: "Musique", art: "Art", travel: "Voyages", food: "Gastronomie",
    gaming: "Jeux vidéo", tech: "Technologie", fitness: "Fitness", photography: "Photographie",
    reading: "Lecture", film: "Cinéma", nature: "Nature", cooking: "Cuisine",
    fashion: "Mode", hiking: "Randonnée", yoga: "Yoga", dancing: "Danse",
    coffee: "Café", dogs: "Chiens", cats: "Chats",
    movies: "Films", cycling: "Cyclisme", wine: "Vin", volunteering: "Bénévolat",
    podcasts: "Podcasts", wellness: "Bien-être", running: "Running", "board games": "Jeux de Société",
  },
  ar: {
    sport: "رياضة", music: "موسيقى", art: "فن", travel: "سفر", food: "طعام",
    gaming: "ألعاب", tech: "تقنية", fitness: "لياقة", photography: "تصوير",
    reading: "قراءة", film: "أفلام", nature: "طبيعة", cooking: "طبخ",
    fashion: "موضة", hiking: "تنزّه", yoga: "يوغا", dancing: "رقص",
    coffee: "قهوة", dogs: "كلاب", cats: "قطط",
    movies: "أفلام سينما", cycling: "ركوب الدراجات", wine: "نبيذ", volunteering: "تطوع",
    podcasts: "بودكاست", wellness: "عافية", running: "جري", "board games": "ألعاب الطاولة",
  },
  zh: {
    sport: "运动", music: "音乐", art: "艺术", travel: "旅行", food: "美食",
    gaming: "游戏", tech: "科技", fitness: "健身", photography: "摄影",
    reading: "阅读", film: "电影", nature: "自然", cooking: "烹饪",
    fashion: "时尚", hiking: "徒步", yoga: "瑜伽", dancing: "舞蹈",
    coffee: "咖啡", dogs: "狗狗", cats: "猫咪",
    movies: "看电影", cycling: "骑行", wine: "红酒", volunteering: "志愿服务",
    podcasts: "播客", wellness: "健康养生", running: "跑步", "board games": "桌游",
  },
  ru: {
    sport: "Спорт", music: "Музыка", art: "Искусство", travel: "Путешествия", food: "Еда",
    gaming: "Игры", tech: "Технологии", fitness: "Фитнес", photography: "Фотография",
    reading: "Чтение", film: "Кино", nature: "Природа", cooking: "Кулинария",
    fashion: "Мода", hiking: "Походы", yoga: "Йога", dancing: "Танцы",
    coffee: "Кофе", dogs: "Собаки", cats: "Кошки",
    movies: "Фильмы", cycling: "Велоспорт", wine: "Вино", volunteering: "Волонтёрство",
    podcasts: "Подкасты", wellness: "Здоровье", running: "Бег", "board games": "Настольные игры",
  },
  pt: {
    sport: "Esporte", music: "Música", art: "Arte", travel: "Viagens", food: "Gastronomia",
    gaming: "Jogos", tech: "Tecnologia", fitness: "Fitness", photography: "Fotografia",
    reading: "Leitura", film: "Cinema", nature: "Natureza", cooking: "Culinária",
    fashion: "Moda", hiking: "Trilhas", yoga: "Yoga", dancing: "Dança",
    coffee: "Café", dogs: "Cachorros", cats: "Gatos",
    movies: "Filmes", cycling: "Ciclismo", wine: "Vinho", volunteering: "Voluntariado",
    podcasts: "Podcasts", wellness: "Bem-estar", running: "Corrida", "board games": "Jogos de Tabuleiro",
  },
  nl: {
    sport: "Sport", music: "Muziek", art: "Kunst", travel: "Reizen", food: "Eten",
    gaming: "Gaming", tech: "Technologie", fitness: "Fitness", photography: "Fotografie",
    reading: "Lezen", film: "Film", nature: "Natuur", cooking: "Koken",
    fashion: "Mode", hiking: "Wandelen", yoga: "Yoga", dancing: "Dansen",
    coffee: "Koffie", dogs: "Honden", cats: "Katten",
    movies: "Films", cycling: "Fietsen", wine: "Wijn", volunteering: "Vrijwilligerswerk",
    podcasts: "Podcasts", wellness: "Welzijn", running: "Hardlopen", "board games": "Bordspellen",
  },
  vi: {
    sport: "Thể thao", music: "Âm nhạc", art: "Nghệ thuật", travel: "Du lịch", food: "Ẩm thực",
    gaming: "Trò chơi", tech: "Công nghệ", fitness: "Thể dục", photography: "Nhiếp ảnh",
    reading: "Đọc sách", film: "Phim ảnh", nature: "Thiên nhiên", cooking: "Nấu ăn",
    fashion: "Thời trang", hiking: "Leo núi", yoga: "Yoga", dancing: "Khiêu vũ",
    coffee: "Cà phê", dogs: "Chó", cats: "Mèo",
    movies: "Xem phim", cycling: "Đạp xe", wine: "Rượu vang", volunteering: "Tình nguyện",
    podcasts: "Podcast", wellness: "Sức khỏe", running: "Chạy bộ", "board games": "Cờ bàn",
  },
};

/**
 * Return the localised display label for a stored interest string.
 *
 * @param storedValue - The raw interest string as stored in Postgres
 *   (title-cased English, e.g. "Music", "Travel").
 * @param locale - BCP-47 language code (e.g. "en", "es"). Unknown locales
 *   fall back to English.
 * @returns The translated label, or the original stored value if no
 *   translation is found (safe fallback).
 */
export function localiseInterest(storedValue: string, locale: string | null | undefined): string {
  const lang = locale ?? "en";
  const key = storedValue.toLowerCase() as InterestKey;
  const langLabels = interestLocales[lang] ?? interestLocales["en"];
  return langLabels[key] ?? storedValue;
}
