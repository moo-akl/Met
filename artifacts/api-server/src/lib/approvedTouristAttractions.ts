import {
  CURATED_OSM_ATTRACTIONS,
  type OpenStreetMapAttraction,
} from "./openStreetMapAttractions.js";

type AttractionDetails = {
  venueType: "culture" | "outdoors" | "other";
  tagline: string;
  description: string;
  informationSourceUrl: string;
  websiteUrl?: string | null;
  includeAttributionInDescription?: boolean;
  photo: {
    imageUrl: string;
    sourceUrl: string;
    artist: string;
    license: string;
    licenseUrl: string | null;
  };
};

const detailsByPlaceId: Record<string, AttractionDetails> = {
  "osm-node-2707025319": {
    venueType: "outdoors",
    tagline: "Limestone karsts and islands in northern Vietnam",
    description: "A northern Vietnamese bay of limestone karsts and islands, recognized as a UNESCO World Heritage site.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/H%E1%BA%A1_Long_Bay",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Ha_Long_Bay%2C_Vietnam%2C_Islands.jpg/1280px-Ha_Long_Bay%2C_Vietnam%2C_Islands.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ha_Long_Bay,_Vietnam,_Islands.jpg",
      artist: "Vyacheslav Argenberg",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  "osm-node-4611306993": {
    venueType: "culture",
    tagline: "Historic trading port and UNESCO World Heritage site",
    description: "A preserved trading port with historic houses and the Japanese Covered Bridge. Hoi An Old Town is a UNESCO World Heritage site.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/H%E1%BB%99i_An_Old_Town",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/H%E1%BB%99i_An%2C_Ancient_Town%2C_2020-01_CN-05.jpg/1280px-H%E1%BB%99i_An%2C_Ancient_Town%2C_2020-01_CN-05.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:H%E1%BB%99i_An,_Ancient_Town,_2020-01_CN-05.jpg",
      artist: "Steffen Schmitz",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-relation-7039289": {
    venueType: "outdoors",
    tagline: "Central Vietnam karst and cave landscape",
    description: "A protected karst landscape in central Vietnam, known for its cave systems and limestone forest. The national park is a UNESCO World Heritage site.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Phong_Nha%E2%80%93K%E1%BA%BB_B%C3%A0ng_National_Park",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Phongnhakebang6.jpg/1280px-Phongnhakebang6.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Phongnhakebang6.jpg",
      artist: "Genghiskhanviet",
      license: "Public domain",
      licenseUrl: null,
    },
  },
  "osm-node-1388480068": {
    venueType: "culture",
    tagline: "Historic underground tunnel network near Ho Chi Minh City",
    description: "A network of underground tunnels used during Vietnam War-era campaigns, now interpreted at the historic site near Ho Chi Minh City.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/C%E1%BB%A7_Chi_tunnels",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Cu_Chi_Tunnels_Vietnam_war.jpg/1280px-Cu_Chi_Tunnels_Vietnam_war.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Cu_Chi_Tunnels_Vietnam_war.jpg",
      artist: "Andre Hospers",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-1362978856": {
    venueType: "outdoors",
    tagline: "Boat routes through limestone valleys and caves",
    description: "A UNESCO-listed cultural and natural landscape in Ninh Bình, explored by boat through limestone valleys, caves and waterways.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Tr%C3%A0ng_An_Scenic_Landscape_Complex",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Trang_An_Landscape_Complex%2C_Ninh_Binh_Province%2C_Vietnam%2C_20240202_1456_5313.jpg/1280px-Trang_An_Landscape_Complex%2C_Ninh_Binh_Province%2C_Vietnam%2C_20240202_1456_5313.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Trang_An_Landscape_Complex,_Ninh_Binh_Province,_Vietnam,_20240202_1456_5313.jpg",
      artist: "Jakub Hałun",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  "osm-way-279944536": {
    venueType: "other",
    tagline: "Kuala Lumpur's landmark twin skyscrapers",
    description: "An interlinked pair of 88-storey towers and a major Kuala Lumpur landmark. At 451.9 metres, they remain the world's tallest twin skyscrapers.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Petronas_Towers",
    photo: {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/85/Petronas_Panorama_II.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Petronas_Panorama_II.jpg",
      artist: "Someformofhuman",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-1362025121": {
    venueType: "culture",
    tagline: "Limestone cave temples and Murugan statue",
    description: "A limestone cave complex in Selangor with Hindu shrines and a prominent Murugan statue. The site is a major focus of Malaysia's Thaipusam pilgrimage.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Batu_Caves",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Gombak_Selangor_Batu-Caves-01.jpg/1280px-Gombak_Selangor_Batu-Caves-01.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Gombak_Selangor_Batu-Caves-01.jpg",
      artist: "CEphoto, Uwe Aranas",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  "osm-relation-18435780": {
    venueType: "culture",
    tagline: "Historic port city on the Strait of Malacca",
    description: "A historic port shaped by the Malacca Sultanate and later colonial periods. The historic centre of Melaka is part of a UNESCO World Heritage site.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Malacca_City",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Old_Street_Melaka_3.jpg/1280px-Old_Street_Melaka_3.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Old_Street_Melaka_3.jpg",
      artist: "Philip Nalangan",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  "osm-way-429428102": {
    venueType: "outdoors",
    tagline: "UNESCO-listed park surrounding Mount Kinabalu",
    description: "A UNESCO World Heritage park on Sabah's west coast that surrounds Mount Kinabalu and protects rich mountain biodiversity.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Kinabalu_Park",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Kinabalu_Park%2C_Ranau%2C_Sabah%2C_Malaysia_-_panoramio.jpg/1280px-Kinabalu_Park%2C_Ranau%2C_Sabah%2C_Malaysia_-_panoramio.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Kinabalu_Park,_Ranau,_Sabah,_Malaysia_-_panoramio.jpg",
      artist: "mohigan",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  "osm-way-112477895": {
    venueType: "outdoors",
    tagline: "Curved pedestrian bridge above Langkawi",
    description: "A curved pedestrian bridge on Gunung Mat Cincang, reached from the cable-car upper station on Pulau Langkawi.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Langkawi_Sky_Bridge",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Langkawi_cablecar_bridge.jpg/1280px-Langkawi_cablecar_bridge.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Langkawi_cablecar_bridge.jpg",
      artist: "Cheon Fong Liew",
      license: "CC BY-SA 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    },
  },
  "osm-node-116056557": {
    venueType: "culture",
    tagline: "Former royal capital with temples and Lao architecture",
    description: "Laos' former royal capital, recognized for its Buddhist temples and blend of traditional Lao and colonial-era architecture. The protected town is a UNESCO World Heritage site.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Luang_Prabang",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Luang_Prabang_Views..._%28LAOS%29_%286690010989%29.jpg/1280px-Luang_Prabang_Views..._%28LAOS%29_%286690010989%29.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Luang_Prabang_Views..._(LAOS)_(6690010989).jpg",
      artist: "Chi King",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  "osm-way-1347235970": {
    venueType: "outdoors",
    tagline: "Multi-tier waterfall south of Luang Prabang",
    description: "A multi-tier waterfall about 29 kilometres south of Luang Prabang. Shallow pools on the hillside lead to the main cascade.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Kuang_Si_Falls",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Kuang_Si_Falls_with_submerged_tree_in_turquoise_water_near_Luang_Prabang_Laos.jpg/1280px-Kuang_Si_Falls_with_submerged_tree_in_turquoise_water_near_Luang_Prabang_Laos.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Kuang_Si_Falls_with_submerged_tree_in_turquoise_water_near_Luang_Prabang_Laos.jpg",
      artist: "Basile Morin",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-relation-273288": {
    venueType: "culture",
    tagline: "Gold-covered Buddhist stupa in Vientiane",
    description: "A gold-covered Buddhist stupa in Vientiane, widely regarded as a national symbol of Laos.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Pha_That_Luang",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Pha_That_Luang_Vientiane_Laos_Wikimedia_Commons.jpg/1280px-Pha_That_Luang_Vientiane_Laos_Wikimedia_Commons.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Pha_That_Luang_Vientiane_Laos_Wikimedia_Commons.jpg",
      artist: "Benh LIEU SONG",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  "osm-way-1564547716": {
    venueType: "culture",
    tagline: "Ancient stone jars on the Xiangkhoang Plateau",
    description: "An archaeological landscape in Laos marked by clusters of ancient stone jars scattered across upland valleys and the Xiangkhoang Plateau.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Plain_of_Jars",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/20171115_Plain_of_Jars_Laos_2654_DxO.jpg/1280px-20171115_Plain_of_Jars_Laos_2654_DxO.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:20171115_Plain_of_Jars_Laos_2654_DxO.jpg",
      artist: "Jakub Hałun",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-272647001": {
    venueType: "culture",
    tagline: "Important 16th-century Buddhist temple in Luang Prabang",
    description: "A historic Buddhist temple at the northern tip of Luang Prabang's peninsula, built between 1559 and 1560.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Wat_Xieng_Thong",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/20171111_Wat_Xieng_Thong_Luang_Prabang_1214_DxO.jpg/1280px-20171111_Wat_Xieng_Thong_Luang_Prabang_1214_DxO.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:20171111_Wat_Xieng_Thong_Luang_Prabang_1214_DxO.jpg",
      artist: "Jakub Hałun",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-1113380295": {
    venueType: "culture",
    tagline: "Monumental Khmer temple complex in Siem Reap",
    description: "A monumental temple complex built in the 12th century for King Suryavarman II, known for its scale, Khmer architecture and extensive bas-reliefs.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Angkor_Wat",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/2014-Cambodge_Angkor_Wat_%2821%29.jpg/1280px-2014-Cambodge_Angkor_Wat_%2821%29.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:2014-Cambodge_Angkor_Wat_(21).jpg",
      artist: "Pierre André Leclercq",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-1221842998": {
    venueType: "culture",
    tagline: "Last enduring capital of the Khmer Empire",
    description: "The last and most enduring capital of the Khmer Empire, established by Jayavarman VII in the late 12th century and centered on the Bayon.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Angkor_Thom",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Bayon%2C_Angkor_Thom%2C_Camboya%2C_2013-08-17%2C_DD_37.JPG/1280px-Bayon%2C_Angkor_Thom%2C_Camboya%2C_2013-08-17%2C_DD_37.JPG",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Bayon,_Angkor_Thom,_Camboya,_2013-08-17,_DD_37.JPG",
      artist: "Diego Delso",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  "osm-relation-6987298": {
    venueType: "culture",
    tagline: "Angkor temple known for tree roots among its ruins",
    description: "A 12th-century Khmer temple within Angkor, known for trees and roots growing among its stone structures.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Ta_Prohm",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Ta_Phrom%2C_Angkor%2C_Camboya%2C_2013-08-16%2C_DD_41.JPG/1280px-Ta_Phrom%2C_Angkor%2C_Camboya%2C_2013-08-16%2C_DD_41.JPG",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ta_Phrom,_Angkor,_Camboya,_2013-08-16,_DD_41.JPG",
      artist: "Diego Delso",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
  "osm-way-370804236": {
    venueType: "culture",
    tagline: "Khmer temple complex in the Dangrek Mountains",
    description: "An ancient Khmer Hindu temple on a cliff in the Dangrek Mountains. Its long north–south layout is unusual among Khmer temples; the site is UNESCO-listed.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Preah_Vihear",
    photo: {
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/86/Preah_Vihear_Cambodia_004.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Preah_Vihear_Cambodia_004.jpg",
      artist: "Tetsuya Kitahata",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "osm-way-227968458": {
    venueType: "culture",
    tagline: "Intricate red-sandstone temple northeast of Angkor",
    description: "A 10th-century Hindu temple dedicated to Shiva and Parvati, known for detailed red-sandstone carvings and its miniature-scale buildings.",
    informationSourceUrl: "https://en.wikipedia.org/wiki/Banteay_Srei",
    photo: {
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Cambodge_Banteay_Srei_Temple_%282%29.jpg/1280px-Cambodge_Banteay_Srei_Temple_%282%29.jpg",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Cambodge_Banteay_Srei_Temple_(2).jpg",
      artist: "Pierre André Leclercq",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
};

export type TouristAttractionImportEntry = Pick<
  OpenStreetMapAttraction,
  "placeId" | "placeName" | "lat" | "lng"
> & AttractionDetails & Partial<Pick<OpenStreetMapAttraction, "sourceUrl">>;

export type ApprovedTouristAttraction = TouristAttractionImportEntry;

export const APPROVED_TOURIST_ATTRACTIONS: ApprovedTouristAttraction[] =
  Object.values(CURATED_OSM_ATTRACTIONS)
    .flat()
    .map((attraction) => {
      const details = detailsByPlaceId[attraction.placeId];
      if (!details) {
        throw new Error(`Missing approved attraction details for ${attraction.placeId}`);
      }
      return { ...attraction, ...details };
    });

if (APPROVED_TOURIST_ATTRACTIONS.length !== 20) {
  throw new Error("The approved tourist attraction shortlist must contain exactly 20 places.");
}
