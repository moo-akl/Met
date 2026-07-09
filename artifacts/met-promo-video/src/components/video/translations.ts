export type Lang = 'en' | 'es' | 'ar';

export interface Translations {
  dir: 'ltr' | 'rtl';
  scene1: {
    line1: string;
    line2: string;
  };
  scene2: {
    section: string;
    headline: string;
    headlineAccent: string;
    radarLabel: string;
    nearby: string;
    connections: string;
    pending: string;
    liveScan: string;
  };
  scene3: {
    section: string;
    headline: string;
    headlineAccent: string;
    encountersLabel: string;
    nodes: string;
    encounters: Array<{ name: string; loc: string; time: string }>;
  };
  scene4: {
    section: string;
    headline: string;
    headlineAccent: string;
    modalTitle: string;
    modalBody: string;
    accept: string;
    notNow: string;
  };
  scene5: {
    section: string;
    headline: string;
    headlineAccent: string;
    connectionsLabel: string;
    searchPlaceholder: string;
    chats: Array<{ name: string; msg: string; time: string }>;
  };
  scene6: {
    tagline: string;
    tags: string[];
  };
  scene7: {
    section: string;
    headline: string;
    headlineAccent: string;
    profileLabel: string;
    userName: string;
    userBio: string;
    socialsLabel: string;
    confirmed: string;
  };
  scene8: {
    section: string;
    headline: string;
    headlineAccent: string;
    networksLabel: string;
    networks: Array<{ label: string; members: string }>;
    privateLabel: string;
    note: string;
  };
  scene9: {
    section: string;
    headline1: string;
    headline2: string;
    points: string[];
  };
}

const en: Translations = {
  dir: 'ltr',
  scene1: {
    line1: 'You walk past them every day.',
    line2: 'What if you could actually meet them?',
  },
  scene2: {
    section: '// PROXIMITY DETECTION',
    headline: "Detect who's",
    headlineAccent: 'nearby.',
    radarLabel: '// RADAR',
    nearby: 'Nearby',
    connections: 'Connections',
    pending: 'Pending',
    liveScan: 'LIVE SCAN',
  },
  scene3: {
    section: '// ENCOUNTER LOG',
    headline: 'Every crossing.',
    headlineAccent: 'Logged.',
    encountersLabel: '// ENCOUNTERS',
    nodes: '3 NODES',
    encounters: [
      { name: 'Sarah J.', loc: 'Blue Bottle Coffee', time: '2m ago' },
      { name: 'Mike K.', loc: 'Dolores Park', time: '14m ago' },
      { name: 'Alex L.', loc: 'Whole Foods Market', time: '1h ago' },
    ],
  },
  scene4: {
    section: '// MUTUAL REVEAL',
    headline: "Reveal when",
    headlineAccent: "you're ready.",
    modalTitle: 'Reveal Request',
    modalBody: "Someone from Dolores Park\nwants to connect with you.",
    accept: 'Accept Reveal',
    notNow: 'Not Now',
  },
  scene5: {
    section: '// CONNECTIONS',
    headline: 'Turn encounters into',
    headlineAccent: 'real connections.',
    connectionsLabel: '// CONNECTIONS',
    searchPlaceholder: 'Search connections',
    chats: [
      { name: 'Sarah J.', msg: 'Hey! Nice meeting you earlier 👋', time: '2m' },
      { name: 'Alex L.', msg: 'Going to that tech meetup?', time: '1h' },
      { name: 'David M.', msg: 'Cool jacket btw ✌️', time: '3h' },
    ],
  },
  scene6: {
    tagline: 'Find your people.',
    tags: ['Radar', 'Encounters', 'Networks', 'Privacy'],
  },
  scene7: {
    section: '// SOCIAL LINKING',
    headline: 'Link your socials.',
    headlineAccent: 'Connect for real.',
    profileLabel: '// PROFILE',
    userName: 'Alex Rivera',
    userBio: 'Designer · SF Bay Area',
    socialsLabel: 'Socials',
    confirmed: '✓ Profile shared with new connection',
  },
  scene8: {
    section: '// PRIVATE NETWORKS',
    headline: 'Your circles.',
    headlineAccent: 'Your rules.',
    networksLabel: '// NETWORKS',
    networks: [
      { label: 'University', members: '340 members' },
      { label: 'Work', members: '128 members' },
      { label: 'Friends', members: '52 members' },
      { label: 'Neighborhood', members: '87 members' },
    ],
    privateLabel: 'PRIVATE',
    note: 'Only members can see each other within a network',
  },
  scene9: {
    section: '// PRIVACY FIRST',
    headline1: 'Your privacy.',
    headline2: 'Non-negotiable.',
    points: [
      'No location ever stored',
      'Anonymous until you reveal',
      'You control who sees you',
      'Delete your data anytime',
    ],
  },
};

const es: Translations = {
  dir: 'ltr',
  scene1: {
    line1: 'Te cruzas con ellos cada día.',
    line2: '¿Y si pudieras conocerlos de verdad?',
  },
  scene2: {
    section: '// DETECCIÓN DE PROXIMIDAD',
    headline: 'Detecta quién está',
    headlineAccent: 'cerca.',
    radarLabel: '// RADAR',
    nearby: 'Cercanos',
    connections: 'Conexiones',
    pending: 'Pendientes',
    liveScan: 'ESCANEO EN VIVO',
  },
  scene3: {
    section: '// REGISTRO DE ENCUENTROS',
    headline: 'Cada cruce.',
    headlineAccent: 'Registrado.',
    encountersLabel: '// ENCUENTROS',
    nodes: '3 NODOS',
    encounters: [
      { name: 'Sarah J.', loc: 'Blue Bottle Coffee', time: 'hace 2m' },
      { name: 'Mike K.', loc: 'Dolores Park', time: 'hace 14m' },
      { name: 'Alex L.', loc: 'Whole Foods Market', time: 'hace 1h' },
    ],
  },
  scene4: {
    section: '// REVELACIÓN MUTUA',
    headline: 'Revélate cuando',
    headlineAccent: 'estés listo.',
    modalTitle: 'Solicitud de revelación',
    modalBody: 'Alguien del Parque Dolores\nquiere conectar contigo.',
    accept: 'Aceptar revelación',
    notNow: 'Ahora no',
  },
  scene5: {
    section: '// CONEXIONES',
    headline: 'Convierte encuentros en',
    headlineAccent: 'conexiones reales.',
    connectionsLabel: '// CONEXIONES',
    searchPlaceholder: 'Buscar conexiones',
    chats: [
      { name: 'Sarah J.', msg: '¡Hola! Un placer conocerte 👋', time: '2m' },
      { name: 'Alex L.', msg: '¿Vas al meetup de tecnología?', time: '1h' },
      { name: 'David M.', msg: 'Chaqueta genial, por cierto ✌️', time: '3h' },
    ],
  },
  scene6: {
    tagline: 'Encuentra a tu gente.',
    tags: ['Radar', 'Encuentros', 'Redes', 'Privacidad'],
  },
  scene7: {
    section: '// REDES SOCIALES',
    headline: 'Vincula tus redes.',
    headlineAccent: 'Conecta de verdad.',
    profileLabel: '// PERFIL',
    userName: 'Alex Rivera',
    userBio: 'Diseñador · Área de la Bahía',
    socialsLabel: 'Redes sociales',
    confirmed: '✓ Perfil compartido con nueva conexión',
  },
  scene8: {
    section: '// REDES PRIVADAS',
    headline: 'Tus círculos.',
    headlineAccent: 'Tus reglas.',
    networksLabel: '// REDES',
    networks: [
      { label: 'Universidad', members: '340 miembros' },
      { label: 'Trabajo', members: '128 miembros' },
      { label: 'Amigos', members: '52 miembros' },
      { label: 'Vecindario', members: '87 miembros' },
    ],
    privateLabel: 'PRIVADA',
    note: 'Solo los miembros pueden verse dentro de una red',
  },
  scene9: {
    section: '// PRIVACIDAD PRIMERO',
    headline1: 'Tu privacidad.',
    headline2: 'Innegociable.',
    points: [
      'Nunca se almacena tu ubicación',
      'Anónimo hasta que te reveles',
      'Tú controlas quién te ve',
      'Elimina tus datos cuando quieras',
    ],
  },
};

const ar: Translations = {
  dir: 'rtl',
  scene1: {
    line1: 'تمر بهم كل يوم.',
    line2: 'ماذا لو أمكنك مقابلتهم فعلاً؟',
  },
  scene2: {
    section: '// كشف القرب',
    headline: 'اكتشف من',
    headlineAccent: 'بجانبك.',
    radarLabel: '// الرادار',
    nearby: 'قريبون',
    connections: 'اتصالات',
    pending: 'معلّق',
    liveScan: 'مسح مباشر',
  },
  scene3: {
    section: '// سجل اللقاءات',
    headline: 'كل تقاطع.',
    headlineAccent: 'موثّق.',
    encountersLabel: '// اللقاءات',
    nodes: '٣ عُقَد',
    encounters: [
      { name: 'Sarah J.', loc: 'مقهى بلو بوتل', time: 'منذ 2د' },
      { name: 'Mike K.', loc: 'حديقة دولوريس', time: 'منذ 14د' },
      { name: 'Alex L.', loc: 'هول فودز ماركت', time: 'منذ 1س' },
    ],
  },
  scene4: {
    section: '// الكشف المتبادل',
    headline: 'اكشف عن نفسك',
    headlineAccent: 'حين تكون جاهزاً.',
    modalTitle: 'طلب كشف',
    modalBody: 'شخص من حديقة دولوريس\nيريد التواصل معك.',
    accept: 'قبول الكشف',
    notNow: 'ليس الآن',
  },
  scene5: {
    section: '// الاتصالات',
    headline: 'حوّل اللقاءات إلى',
    headlineAccent: 'اتصالات حقيقية.',
    connectionsLabel: '// الاتصالات',
    searchPlaceholder: 'البحث عن اتصالات',
    chats: [
      { name: 'Sarah J.', msg: 'مرحباً! سعيد بلقائك 👋', time: '2د' },
      { name: 'Alex L.', msg: 'ستحضر اجتماع التقنية؟', time: '1س' },
      { name: 'David M.', msg: 'جاكيت رائع بالمناسبة ✌️', time: '3س' },
    ],
  },
  scene6: {
    tagline: 'ابحث عن أناسك.',
    tags: ['رادار', 'لقاءات', 'شبكات', 'خصوصية'],
  },
  scene7: {
    section: '// ربط الشبكات',
    headline: 'اربط حساباتك.',
    headlineAccent: 'تواصل حقاً.',
    profileLabel: '// الملف الشخصي',
    userName: 'Alex Rivera',
    userBio: 'مصمم · خليج سان فرانسيسكو',
    socialsLabel: 'الشبكات الاجتماعية',
    confirmed: '✓ تمت مشاركة الملف مع اتصال جديد',
  },
  scene8: {
    section: '// الشبكات الخاصة',
    headline: 'دوائرك.',
    headlineAccent: 'قواعدك.',
    networksLabel: '// الشبكات',
    networks: [
      { label: 'جامعة', members: '٣٤٠ عضواً' },
      { label: 'عمل', members: '١٢٨ عضواً' },
      { label: 'أصدقاء', members: '٥٢ عضواً' },
      { label: 'حي', members: '٨٧ عضواً' },
    ],
    privateLabel: 'خاصة',
    note: 'الأعضاء فقط يمكنهم رؤية بعضهم داخل الشبكة',
  },
  scene9: {
    section: '// الخصوصية أولاً',
    headline1: 'خصوصيتك.',
    headline2: 'غير قابلة للتفاوض.',
    points: [
      'لا يُخزَّن موقعك أبداً',
      'مجهول حتى تكشف عن نفسك',
      'أنت تتحكم في من يراك',
      'احذف بياناتك في أي وقت',
    ],
  },
};

export const TRANSLATIONS: Record<Lang, Translations> = { en, es, ar };
