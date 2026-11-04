import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "public", "articles", "asia");
const published = "2026-11-02";
const baseUrl = "https://met-app.org/articles/asia";

const articles = [
  {
    slug: "where-to-visit-vietnam",
    title: "Where to Visit in Vietnam: 10 Places to Know | Met",
    description:
      "Explore ten Vietnam destinations, from Hanoi, Ha Long Bay, and Ninh Binh to Hue, Hoi An, Ho Chi Minh City, and the Mekong Delta. Plan by region and interest.",
    h1: "Where to visit in <em>Vietnam</em>",
    kicker: "Vietnam · country guide",
    image: {
      file: "vietnam.jpg",
      alt: "Limestone islands rise from the water of Ha Long Bay, Vietnam",
      width: 1280,
      height: 853,
      source: "https://commons.wikimedia.org/wiki/File:Ha_Long_Bay,_Vietnam,_Islands.jpg",
      artist: "Vyacheslav Argenberg",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    },
    intro:
      "Vietnam is long enough that a short trip works better when you choose a region rather than trying to cross the whole country. This shortlist mixes first-trip landmarks with slower landscapes and food-focused city days.",
    sections: [
      {
        id: "north-and-central",
        title: "Northern and central essentials",
        intro:
          "These stops pair history and dramatic scenery. Choose two or three that fit your route instead of treating the distances as day trips.",
        items: [
          {
            name: "Hanoi",
            label: "CAN’T-MISS",
            detail:
              "Start with the Old Quarter, Hoan Kiem Lake, and the Temple of Literature. The city is a strong base for northern food, museums, and onward rail or road journeys.",
            fit: "Go for: street food, history, and a walkable first-city stay.",
          },
          {
            name: "Ha Long Bay",
            label: "LANDSCAPE",
            detail:
              "Limestone islands rise from the bay, best understood from the water. Compare the route, group size, and environmental practices of boat operators before booking.",
            fit: "Go for: karst scenery and an overnight boat itinerary.",
          },
          {
            name: "Ninh Binh",
            label: "SLOWER PICK",
            detail:
              "River routes, limestone formations, and rural roads make this a slower counterpoint to Hanoi. Trang An and Tam Coc are popular gateways; plan around transport between sites.",
            fit: "Go for: landscapes, cycling, and a quieter pace.",
          },
          {
            name: "Hue",
            label: "HISTORY",
            detail:
              "The former imperial capital is known for its citadel, royal tombs, and distinctive central Vietnamese food. Give the historic sites more than a rushed stopover.",
            fit: "Go for: architecture, history, and regional dishes.",
          },
        ],
      },
      {
        id: "coast-and-caves",
        title: "Coast, old towns, and caves",
        intro:
          "Central Vietnam brings together heritage streets, beaches, and protected cave landscapes; season and transport connections can shape the order.",
        items: [
          {
            name: "Hoi An",
            label: "CAN’T-MISS",
            detail:
              "The preserved trading-port center is most rewarding on foot, especially when you look beyond the busiest lanes to workshops and quieter streets. Respect residential areas and heritage rules.",
            fit: "Go for: architecture, craft, and an evening walk.",
          },
          {
            name: "Da Nang",
            label: "COAST",
            detail:
              "Use the city for a mix of beaches, local food, and access to nearby heritage sites. It works well as a practical base when you want city services without giving up the coast.",
            fit: "Go for: beach time, seafood, and an easy travel base.",
          },
          {
            name: "Phong Nha–Ke Bang",
            label: "NATURE",
            detail:
              "The national park is known for caves and karst terrain. Cave access is managed through different operators and routes, so check current requirements and choose an outing that matches your ability.",
            fit: "Go for: cave landscapes and guided outdoor activities.",
          },
        ],
      },
      {
        id: "southern-vietnam",
        title: "Southern city life and river routes",
        intro:
          "The south is a good fit for museums, markets, river scenery, and an island finish. Leave time for transfers; distances on a map can hide slow journeys.",
        items: [
          {
            name: "Ho Chi Minh City",
            label: "CITY ENERGY",
            detail:
              "Pair the city’s museums and historic buildings with a neighborhood food walk. A local guide or small-group class can add context without promising that any venue is a guaranteed social scene.",
            fit: "Go for: museums, modern history, and late-day food stops.",
          },
          {
            name: "Mekong Delta",
            label: "RIVER LIFE",
            detail:
              "The delta is a region rather than a single attraction. Choose a route that spends time with local communities and farms, and ask how the visit supports the people hosting it.",
            fit: "Go for: waterways, local food, and a slower overnight.",
          },
          {
            name: "Phu Quoc",
            label: "ISLAND",
            detail:
              "The island combines beaches with forest and fishing communities. Look beyond resort zones, follow local conservation guidance, and check ferry or flight details close to departure.",
            fit: "Go for: a beach break and a few unhurried days.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Build a short list around Hanoi, Hue, and Ho Chi Minh City; let each region’s dishes guide the route."],
      ["History", "Allow separate time for Hanoi, Hue, and Hoi An rather than squeezing every site into one day."],
      ["Nature", "Choose one landscape focus—bay, karst countryside, caves, delta, or island—then check access conditions."],
      ["Meeting people", "Look for small-group cooking, craft, or walking experiences run by local hosts; confirm the organizer and meeting point."],
    ],
    sources: [
      ["Vietnam National Authority of Tourism", "https://vietnam.travel/"],
      ["Ha Long Bay – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/672/"],
      ["Complex of Hue Monuments – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/678/"],
      ["Hoi An Ancient Town – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/948/"],
      ["Phong Nha-Ke Bang National Park – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/951/"],
    ],
  },
  {
    slug: "where-to-visit-thailand",
    title: "Where to Visit in Thailand: 10 Places to Know | Met",
    description:
      "Plan a Thailand trip with ten varied stops: Bangkok, Chiang Mai, Ayutthaya, Sukhothai, Khao Sok, and southern beaches, matched to your pace. Plan by region.",
    h1: "Where to visit in <em>Thailand</em>",
    kicker: "Thailand · country guide",
    image: {
      file: "thailand.jpg",
      alt: "Ornate elephant sculptures at Wat Chiang Man in Chiang Mai",
      width: 1280,
      height: 993,
      contain: true,
      source: "https://commons.wikimedia.org/wiki/File:20171105_Wat_Chiang_Man,_Chiang_Mai_0047_DxO.jpg",
      artist: "Jakub Hałun",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    },
    intro:
      "Thailand rewards a region-by-region plan: historic capitals and city neighborhoods in the center, mountain culture in the north, and very different coastlines in the south. These ten stops are a menu, not a ranking.",
    sections: [
      {
        id: "central-thailand",
        title: "Central Thailand: temples, rivers, and old capitals",
        intro:
          "The central route balances Bangkok’s scale with smaller historic centers. Check site rules and transport connections before choosing a day trip.",
        items: [
          {
            name: "Bangkok",
            label: "CAN’T-MISS",
            detail:
              "Begin with the Chao Phraya riverfront, historic temple district, and a neighborhood food market. The city is easier to enjoy when you plan by area rather than crossing it repeatedly.",
            fit: "Go for: temples, markets, river views, and varied food.",
          },
          {
            name: "Ayutthaya",
            label: "HISTORY",
            detail:
              "The former capital’s temple and palace ruins are spread across a large area. Plan a route between sites and take care around fragile brick structures.",
            fit: "Go for: historic architecture and a focused day trip.",
          },
          {
            name: "Sukhothai",
            label: "SLOWER PICK",
            detail:
              "The historic park offers a quieter way to explore early Thai architecture, often by bicycle. Give yourself time between monuments instead of treating it as a quick photo stop.",
            fit: "Go for: cycling, history, and open green space.",
          },
          {
            name: "Kanchanaburi",
            label: "LANDSCAPE",
            detail:
              "River scenery and historical sites make this more than a single bridge stop. Read the history before visiting and leave room for travel beyond the town center.",
            fit: "Go for: river landscapes and a history-led itinerary.",
          },
        ],
      },
      {
        id: "northern-thailand",
        title: "Northern Thailand: craft, food, and mountain scenery",
        intro:
          "Northern destinations are distinct from one another. Avoid reducing the region to a single temple loop; markets, craft traditions, and landscapes are part of the experience.",
        items: [
          {
            name: "Chiang Mai",
            label: "CAN’T-MISS",
            detail:
              "Use the old city for temples and food, then explore craft neighborhoods or a responsible, locally guided outdoor activity. Confirm animal-welfare standards before booking any wildlife experience.",
            fit: "Go for: temples, northern food, and craft workshops.",
          },
          {
            name: "Chiang Rai",
            label: "ART AND CULTURE",
            detail:
              "The city and surrounding province are known for distinctive contemporary temple art and rural landscapes. Treat prominent modern sites as working cultural spaces, not just backdrops.",
            fit: "Go for: art, architecture, and a northern road trip.",
          },
        ],
      },
      {
        id: "southern-thailand",
        title: "Southern Thailand: forest and coast",
        intro:
          "Pick a coast based on the kind of days you want. Island transfers and weather can change plans, so verify current schedules and local guidance.",
        items: [
          {
            name: "Khao Sok National Park",
            label: "NATURE",
            detail:
              "Rainforest, limestone formations, and lake-based trips create a strong nature stop. Use licensed local operators and follow park rules around wildlife and waste.",
            fit: "Go for: forest, lake scenery, and guided outdoor time.",
          },
          {
            name: "Krabi and Railay",
            label: "COAST",
            detail:
              "Limestone cliffs and boat-accessible beaches are the draw. Choose a base that fits your plans and check sea conditions before arranging transfers or outdoor activities.",
            fit: "Go for: coastal views, climbing, and boat trips.",
          },
          {
            name: "Phuket",
            label: "CITY AND BEACH",
            detail:
              "The island combines resort areas with Phuket Old Town’s architecture and food culture. Look at the map before booking; different beaches and neighborhoods feel far apart.",
            fit: "Go for: a flexible base with food, heritage, and beaches.",
          },
          {
            name: "Ko Samui",
            label: "ISLAND",
            detail:
              "A larger island with beaches, local markets, and nature stops. Choose a quieter area if you want slower evenings and verify ferry or flight details for onward travel.",
            fit: "Go for: an island stay with room to explore.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Compare regional dishes in Bangkok and Chiang Mai; market tours can make unfamiliar ingredients easier to understand."],
      ["History", "Pair Ayutthaya or Sukhothai with a thoughtful visit to Bangkok’s historic district."],
      ["Nature", "Choose one national park or coast and plan around local conservation and weather guidance."],
      ["Meeting people", "Try a public cooking class, craft workshop, or small-group walk hosted by a local operator."],
    ],
    sources: [
      ["Tourism Authority of Thailand", "https://www.tourismthailand.org/"],
      ["Historic City of Ayutthaya – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/576/"],
      ["Historic Town of Sukhothai – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/574/"],
    ],
  },
  {
    slug: "where-to-visit-japan",
    title: "Japan Travel Guide: 10 Places to Visit for Travelers | Met",
    description:
      "Choose ten Japan stops by interest, from Tokyo, Kyoto, Osaka, and Nara to Kanazawa, Hiroshima, Hokkaido, Okinawa, and Koyasan. Plan around your trip time.",
    h1: "Where to visit in <em>Japan</em>",
    kicker: "Japan · country guide",
    image: {
      file: "japan.jpg",
      alt: "Yasaka-dori street and the pagoda of Hokan-ji Temple in Kyoto",
      width: 1280,
      height: 853,
      source: "https://commons.wikimedia.org/wiki/File:Yasaka-dori_early_morning_with_street_lanterns_and_the_Tower_of_Yasaka_(Hokan-ji_Temple),_Kyoto,_Japan.jpg",
      artist: "Basile Morin",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    },
    intro:
      "Japan is not one itinerary. A first trip can combine a major city with a historic town, while return visits may focus on islands, mountain routes, or regional food. This list helps you choose a shape for the trip.",
    sections: [
      {
        id: "classic-route",
        title: "A first route: Tokyo, Kyoto, Osaka, and Nara",
        intro:
          "These connected destinations are popular for a reason, but they deserve different kinds of days. Keep transit realistic and leave space between headline sights.",
        items: [
          {
            name: "Tokyo",
            label: "CAN’T-MISS",
            detail:
              "Choose a few neighborhoods—such as Asakusa, Ueno, Shibuya, or Kiyosumi-Shirakawa—rather than treating the metropolis as one walkable center.",
            fit: "Go for: city neighborhoods, museums, food, and late nights.",
          },
          {
            name: "Kyoto",
            label: "HISTORY",
            detail:
              "Temples, gardens, and historic streets are spread across the city. Start early at one area, respect residential lanes, and look beyond the most photographed approach.",
            fit: "Go for: temples, gardens, and traditional architecture.",
          },
          {
            name: "Osaka",
            label: "FOOD",
            detail:
              "Use Osaka for market browsing, local dishes, and lively neighborhoods. A short food walk can help you understand the city better than chasing a long list of restaurants.",
            fit: "Go for: casual food, shopping streets, and nightlife.",
          },
          {
            name: "Nara",
            label: "SLOWER PICK",
            detail:
              "Historic temples and parkland make Nara a natural contrast to larger cities. Keep a respectful distance from the deer and follow signs about feeding and handling them.",
            fit: "Go for: temple history and a green day outdoors.",
          },
        ],
      },
      {
        id: "regional-cities",
        title: "Regional cities with a different rhythm",
        intro:
          "These stops add craft, food, and local history to a route. Choose one rather than adding every city as a rushed overnight.",
        items: [
          {
            name: "Kanazawa",
            label: "CULTURE",
            detail:
              "A compact historic center, garden, and craft traditions make Kanazawa an appealing alternative to a second major-city stay.",
            fit: "Go for: gardens, crafts, and a more compact city day.",
          },
          {
            name: "Takayama",
            label: "MOUNTAIN TOWN",
            detail:
              "The old town and surrounding mountain scenery offer a slower inland stop. Check seasonal transport carefully if you are connecting through the Japanese Alps.",
            fit: "Go for: preserved streets, mountain air, and regional food.",
          },
          {
            name: "Hiroshima and Miyajima",
            label: "HISTORY",
            detail:
              "A visit can pair the Peace Memorial Park with a separate island day. Take time with the historical context and verify ferry and site information before setting the schedule.",
            fit: "Go for: reflection, history, and coastal scenery.",
          },
        ],
      },
      {
        id: "islands-and-retreats",
        title: "Islands, mountains, and a slower stay",
        intro:
          "Japan’s regions change with distance and season. These choices work best when they are the purpose of a trip segment, not an add-on between trains.",
        items: [
          {
            name: "Hokkaido",
            label: "NATURE",
            detail:
              "The northern island is known for wide landscapes, national parks, and seasonal outdoor activities. Distances are large, so plan around one area and the season you are visiting.",
            fit: "Go for: national parks, open landscapes, and seasonal food.",
          },
          {
            name: "Okinawa",
            label: "ISLAND CULTURE",
            detail:
              "Okinawa has a distinct island culture, history, and coastline. Learn about local history as well as beach options, and plan enough time for travel between islands.",
            fit: "Go for: subtropical coast, local history, and island time.",
          },
          {
            name: "Koyasan",
            label: "QUIETER PICK",
            detail:
              "A mountain temple town offers a different pace from the major cities. If you stay overnight, follow the host temple’s expectations and reserve through official channels.",
            fit: "Go for: a reflective overnight and mountain scenery.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Follow a regional specialty rather than looking for the same dishes in every city."],
      ["History", "Mix one major heritage site with a neighborhood walk that shows how the surrounding city lives today."],
      ["Nature", "Choose Hokkaido, Okinawa, or a mountain route based on season and available travel days."],
      ["Meeting people", "Join a small cooking, craft, or walking experience and check the host’s format before booking."],
    ],
    sources: [
      ["Japan National Tourism Organization", "https://www.japan.travel/en/"],
      ["Historic Monuments of Ancient Kyoto – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/688/"],
      ["Hiroshima Peace Memorial – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/775/"],
    ],
  },
  {
    slug: "10-places-in-hanoi",
    title: "10 Places You Can’t Miss in Hanoi: A City Guide | Met",
    description:
      "Find ten Hanoi stops for first visits, quieter walks, food, and history, with ideas for choosing a public group activity and planning by neighborhood.",
    h1: "10 places you can’t miss in <em>Hanoi</em>",
    kicker: "Hanoi · city guide",
    image: {
      file: "hanoi.jpg",
      alt: "A visitor sits beside Hoan Kiem Lake in Hanoi",
      width: 1280,
      height: 853,
      source: "https://commons.wikimedia.org/wiki/File:Hanoi,_Vietnam,_Hoan_Kiem_Lake.jpg",
      artist: "Vyacheslav Argenberg",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    },
    intro:
      "Hanoi is easier to read one neighborhood at a time. This list balances the city’s best-known landmarks with lakeside walks, museums, and places that give a day more local texture.",
    sections: [
      {
        id: "hanoi-landmarks",
        title: "Landmarks for a first visit",
        intro: "Begin with the old center and the city’s major cultural sites.",
        items: [
          {
            name: "Hoan Kiem Lake",
            label: "CAN’T-MISS",
            detail:
              "A central lakeside loop makes a useful orientation walk and connects to the Old Quarter. Visit at different times of day to see how the public space changes.",
            fit: "Go for: an easy walk, people-watching, and a city-center reset.",
          },
          {
            name: "Hanoi Old Quarter",
            label: "NEIGHBORHOOD",
            detail:
              "The dense streets reward slow wandering, but they are working streets as well as a visitor area. Keep shopfronts and doorways clear and cross roads carefully.",
            fit: "Go for: street food, small shops, and the city’s everyday pace.",
          },
          {
            name: "Temple of Literature",
            label: "HISTORY",
            detail:
              "Courtyards and historic buildings offer a calmer stop centered on Vietnam’s scholarly tradition. Check current visitor rules before photographing ceremonies or other visitors.",
            fit: "Go for: architecture, learning, and a quieter cultural visit.",
          },
          {
            name: "Imperial Citadel of Thang Long",
            label: "HERITAGE",
            detail:
              "The archaeological and historic complex adds a longer view of Hanoi’s political past. Allow time for the grounds and interpretive displays rather than only the main gate.",
            fit: "Go for: history and a more spacious walk.",
          },
        ],
      },
      {
        id: "hanoi-quieter",
        title: "Quieter walks and local texture",
        intro: "These stops make a useful change of pace from the busiest lanes.",
        items: [
          {
            name: "West Lake and Tran Quoc Pagoda",
            label: "SLOWER PICK",
            detail:
              "The lakeside area opens up the city’s scale and gives you room for a longer walk. Dress respectfully when visiting religious sites and check access signs.",
            fit: "Go for: water views, a slower morning, and temple architecture.",
          },
          {
            name: "Long Bien Bridge and the riverside",
            label: "CITY VIEWS",
            detail:
              "The bridge is an active transport route, not a pedestrian attraction at every point. Use designated walkways only and choose a safe riverside viewpoint.",
            fit: "Go for: industrial history and a different city perspective.",
          },
          {
            name: "Vietnam National Museum of Fine Arts",
            label: "ART",
            detail:
              "A focused museum visit offers an introduction to Vietnamese art across periods. Check current hours and exhibition access from the museum before going.",
            fit: "Go for: art, context, and an indoor break.",
          },
        ],
      },
      {
        id: "hanoi-food-culture",
        title: "Markets, performance, and a social plan",
        intro: "Choose one activity that fits the mood of your day rather than packing every stop into one route.",
        items: [
          {
            name: "Dong Xuan Market",
            label: "FOOD AND SHOPPING",
            detail:
              "A large market brings together wholesale trade and visitor browsing. Go with a clear plan, ask before photographing people, and compare prices before buying.",
            fit: "Go for: market atmosphere and a broad look at local goods.",
          },
          {
            name: "Thang Long Water Puppet Theatre",
            label: "PERFORMANCE",
            detail:
              "Water puppetry is a distinctive performance tradition. Confirm showtimes and ticket details directly with the venue instead of relying on old listings.",
            fit: "Go for: a seated cultural experience with a clear start time.",
          },
          {
            name: "A small-group food or craft walk",
            label: "MEET PEOPLE",
            detail:
              "For a low-pressure social plan, choose a group walk or class with a named local host and public meeting point. The activity is a better conversation starter than expecting a landmark to do the work.",
            fit: "Go for: shared interests and easy conversation.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Build a route around one meal and two nearby snack stops instead of crossing the city for every recommendation."],
      ["History", "Pair the Temple of Literature with the Imperial Citadel, then leave time to read the site context."],
      ["Quiet", "Try West Lake earlier in the day and keep the walk flexible."],
      ["Meeting people", "Book a small-group food, language, or craft activity with a clear host and public meeting place."],
    ],
    sources: [
      ["Vietnam National Authority of Tourism", "https://vietnam.travel/"],
      ["Central Sector of the Imperial Citadel of Thang Long – UNESCO World Heritage Centre", "https://whc.unesco.org/en/list/1328/"],
    ],
  },
  {
    slug: "10-places-in-ho-chi-minh-city",
    title: "10 Places You Can’t Miss in Ho Chi Minh City | Met",
    description:
      "Explore ten Ho Chi Minh City stops for history, markets, river views, art, and food, plus practical ways to choose a low-pressure group activity by district.",
    h1: "10 places you can’t miss in <em>Ho Chi Minh City</em>",
    kicker: "Ho Chi Minh City · city guide",
    image: {
      file: "ho-chi-minh-city.jpg",
      alt: "Ho Chi Minh City skyline reflected on the Saigon River at night",
      width: 1280,
      height: 675,
      source: "https://commons.wikimedia.org/wiki/File:Ho_Chi_Minh_City_Skyline_at_Night.jpg",
      artist: "Tran Van Ngoc",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    intro:
      "Ho Chi Minh City is a place to plan by district and leave room for unexpected food stops. This shortlist mixes major history sites with markets, public spaces, and a few slower corners.",
    sections: [
      {
        id: "hcmc-history",
        title: "History and architecture",
        intro: "Give the city’s modern history more than a photo stop.",
        items: [
          {
            name: "Independence Palace",
            label: "CAN’T-MISS",
            detail:
              "The former presidential palace is a significant modern-history site with preserved rooms and grounds. Check the official visitor information for current access and any event closures.",
            fit: "Go for: architecture and a structured history visit.",
          },
          {
            name: "War Remnants Museum",
            label: "HISTORY",
            detail:
              "The museum presents difficult material about the Vietnam War and its effects. Allow time to process the exhibits and consider whether the content is right for everyone in your group.",
            fit: "Go for: historical context and a thoughtful museum visit.",
          },
          {
            name: "Saigon Central Post Office",
            label: "ARCHITECTURE",
            detail:
              "This working building is known for its historic interior and central location. Be mindful of people using the post office for daily business while you visit.",
            fit: "Go for: architecture and an easy stop near other landmarks.",
          },
          {
            name: "Ho Chi Minh City Museum",
            label: "CITY HISTORY",
            detail:
              "The museum’s historic building and city-focused collections offer another perspective on local history. Verify current exhibits and access details before planning around it.",
            fit: "Go for: local history and a calmer indoor stop.",
          },
        ],
      },
      {
        id: "hcmc-neighborhoods",
        title: "Markets and neighborhood walks",
        intro: "A short neighborhood route is often more memorable than a long list of cross-city transfers.",
        items: [
          {
            name: "Ben Thanh Market",
            label: "MARKET",
            detail:
              "The central market is a familiar first stop for food and browsing. Compare prices, keep valuables secure, and ask before taking close-up photos of vendors.",
            fit: "Go for: snacks, souvenirs, and a compact market visit.",
          },
          {
            name: "Cho Lon and Binh Tay Market",
            label: "NEIGHBORHOOD",
            detail:
              "The city’s Chinatown area offers a different street rhythm, temples, and wholesale trading. Go with time to walk, eat, and observe rather than treating it as a single landmark.",
            fit: "Go for: neighborhood food, trade, and layered history.",
          },
          {
            name: "Nguyen Hue Walking Street",
            label: "PUBLIC SPACE",
            detail:
              "The pedestrian boulevard is an easy place to take an evening stroll and see the city’s central buildings. Check local event notices and keep shared walkways open.",
            fit: "Go for: people-watching and an evening walk.",
          },
        ],
      },
      {
        id: "hcmc-art-food",
        title: "Art, books, river views, and food",
        intro: "Choose one cultural stop, then keep the rest of the day within the same area.",
        items: [
          {
            name: "Ho Chi Minh City Book Street",
            label: "SLOWER PICK",
            detail:
              "A small pedestrian book lane near major central sights offers a quieter pause between museums and cafés. Browse respectfully and check for current events.",
            fit: "Go for: books, coffee, and a short reset.",
          },
          {
            name: "Ho Chi Minh City Museum of Fine Arts",
            label: "ART",
            detail:
              "The collection and historic building make this a worthwhile indoor stop for art and architecture. Verify current exhibitions and opening details before visiting.",
            fit: "Go for: Vietnamese art and a less hurried museum visit.",
          },
          {
            name: "Saigon River waterfront",
            label: "CITY VIEWS",
            detail:
              "Look for public riverfront promenades and designated viewing areas, especially around newer central developments. Confirm access and transport instead of assuming every edge is walkable.",
            fit: "Go for: skyline views and a late-day walk.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Choose a neighborhood food walk or market visit, and ask a local host about dishes before ordering."],
      ["History", "Pair Independence Palace with a museum and take time with the context of each site."],
      ["Art", "Use the Fine Arts Museum as an anchor, then explore cafés or galleries nearby."],
      ["Meeting people", "A public cooking class or small-group food walk offers a shared activity; confirm the host and meeting point."],
    ],
    sources: [
      ["Ho Chi Minh City tourism information", "https://visithcmc.vn/"],
      ["Vietnam National Authority of Tourism", "https://vietnam.travel/"],
    ],
  },
  {
    slug: "10-places-in-bangkok",
    title: "10 Places You Can’t Miss in Bangkok: A City Guide | Met",
    description:
      "Plan a Bangkok day around ten temples, markets, neighborhoods, and river views, with quieter stops and ideas for food, culture, and group activities locally.",
    h1: "10 places you can’t miss in <em>Bangkok</em>",
    kicker: "Bangkok · city guide",
    image: {
      file: "bangkok.jpg",
      alt: "A colorful guardian statue in the courtyard of Wat Arun in Bangkok",
      width: 1280,
      height: 1933,
      portrait: true,
      source: "https://commons.wikimedia.org/wiki/File:20160727_Bangkok_Wat_Arun_5513.jpg",
      artist: "Jakub Hałun",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    },
    intro:
      "Bangkok can feel huge when every stop is on a different side of town. This list groups famous landmarks with neighborhood finds so you can build a day around one river stretch or district.",
    sections: [
      {
        id: "bangkok-landmarks",
        title: "The river and temple landmarks",
        intro: "Start with the historic core and use the river to connect your stops.",
        items: [
          {
            name: "Grand Palace and Wat Phra Kaew",
            label: "CAN’T-MISS",
            detail:
              "The royal complex is a major cultural site with dress and visitor rules. Check official guidance, arrive prepared, and be cautious of unsolicited claims that the site is closed.",
            fit: "Go for: royal history, temple art, and architecture.",
          },
          {
            name: "Wat Pho",
            label: "HERITAGE",
            detail:
              "Known for its reclining Buddha and temple grounds, Wat Pho is close to the Grand Palace. Dress respectfully and give the courtyards more time than a quick entrance photo.",
            fit: "Go for: temple details and a walk through historic grounds.",
          },
          {
            name: "Wat Arun",
            label: "RIVER VIEW",
            detail:
              "The riverside temple is especially striking from across the water as well as from within its grounds. Check current access rules and be careful on steep stairways.",
            fit: "Go for: river scenery and distinctive architecture.",
          },
          {
            name: "Chao Phraya river piers",
            label: "CITY ROUTE",
            detail:
              "A public river boat can turn transport into a city-view route. Confirm the correct pier, service, and fare with the operator; avoid unofficial ticket sellers.",
            fit: "Go for: a practical link between sights and river views.",
          },
        ],
      },
      {
        id: "bangkok-neighborhoods",
        title: "Neighborhoods for food and slower wandering",
        intro: "Walk a small area and let the market, street, or local museum set the pace.",
        items: [
          {
            name: "Talat Noi",
            label: "QUIETER PICK",
            detail:
              "A historic riverside neighborhood known for small lanes, workshops, and street art. It is also a lived-in community, so keep noise low and respect homes and businesses.",
            fit: "Go for: old-town details, cafés, and a slower walk.",
          },
          {
            name: "Yaowarat and Bangkok Chinatown",
            label: "FOOD",
            detail:
              "Chinatown’s main streets and side lanes are a strong food-focused outing. Popular stalls can be busy; follow queues, keep sidewalks clear, and check current opening days.",
            fit: "Go for: Chinese-Thai food and evening street energy.",
          },
          {
            name: "Jim Thompson House Museum",
            label: "CULTURE",
            detail:
              "The traditional house and collection offer a quieter cultural visit within the city. Check the museum’s official visitor information for current tour and entry arrangements.",
            fit: "Go for: Thai silk, architecture, and a guided visit.",
          },
        ],
      },
      {
        id: "bangkok-parks-art",
        title: "Green space, art, and local events",
        intro: "Use these stops when you want a different pace from the main temple route.",
        items: [
          {
            name: "Bang Kachao",
            label: "NATURE",
            detail:
              "The green peninsula across the river is a change of pace from the central grid. Check ferry connections and weather, and use marked routes if you rent a bicycle.",
            fit: "Go for: greenery, cycling, and a half-day outdoors.",
          },
          {
            name: "Bangkok Art and Culture Centre",
            label: "ART",
            detail:
              "The central arts venue hosts exhibitions and public programs. Check what is on before you go and consider pairing the visit with nearby shopping and food streets.",
            fit: "Go for: contemporary art and an indoor break.",
          },
          {
            name: "Chatuchak Weekend Market",
            label: "MARKET",
            detail:
              "A large market rewards a short, focused shopping list and comfortable shoes. Verify operating days and current visitor guidance before building a weekend around it.",
            fit: "Go for: crafts, food, and a lively public market.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Choose one market or Chinatown stretch and build the outing around a few dishes."],
      ["History", "Visit the temple district with time for dress rules, queues, and quiet observation."],
      ["Quiet", "Try Talat Noi or Bang Kachao rather than adding another crowded landmark."],
      ["Meeting people", "Look for a small cooking class, public art walk, or neighborhood tour with a named local host."],
    ],
    sources: [
      ["Tourism Authority of Thailand", "https://www.tourismthailand.org/"],
      ["Bangkok visitor information", "https://www.tourismthailand.org/Destinations/Provinces/Bangkok/219"],
    ],
  },
  {
    slug: "10-places-in-tokyo",
    title: "10 Places You Can’t Miss in Tokyo: A City Guide | Met",
    description:
      "Find ten Tokyo places for classic landmarks, calmer neighborhood walks, museums, markets, and city views, then group them by the kind of day you want.",
    h1: "10 places you can’t miss in <em>Tokyo</em>",
    kicker: "Tokyo · city guide",
    image: {
      file: "tokyo.jpg",
      alt: "Aerial view of the Shibuya Scramble Crossing in Tokyo",
      width: 1280,
      height: 720,
      source: "https://commons.wikimedia.org/wiki/File:Shibuya_Crossing,_Aerial.jpg",
      artist: "David Kernan",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    },
    intro:
      "Tokyo is a collection of neighborhoods, not one sightseeing loop. Pick two nearby stops at a time and let the city’s food, public spaces, and local streets fill in the gaps.",
    sections: [
      {
        id: "tokyo-icons",
        title: "Classic Tokyo landmarks",
        intro: "These familiar stops are easiest when you visit them as neighborhood anchors.",
        items: [
          {
            name: "Sensō-ji and Asakusa",
            label: "CAN’T-MISS",
            detail:
              "Tokyo’s best-known Buddhist temple sits within a broader historic neighborhood. Visit respectfully, keep walkways moving, and explore beyond the busiest shopping approach.",
            fit: "Go for: temple architecture, old-town streets, and snacks.",
          },
          {
            name: "Shibuya Crossing and Hachiko",
            label: "CITY ICON",
            detail:
              "The crossing is a working intersection as well as a famous view. Use public viewpoints and sidewalks rather than stopping in traffic or blocking the station exits.",
            fit: "Go for: modern Tokyo energy and people-watching.",
          },
          {
            name: "Meiji Jingu",
            label: "SLOWER PICK",
            detail:
              "A wooded approach leads to a major Shinto shrine close to busy districts. Keep voices low and follow posted guidance around rituals and photography.",
            fit: "Go for: a quiet walk and shrine architecture.",
          },
          {
            name: "Ueno Park and its museums",
            label: "CULTURE",
            detail:
              "The park groups several museums and public spaces, so choose one collection rather than trying to see everything. Confirm exhibition schedules and entry details directly.",
            fit: "Go for: museums, art, and a longer park walk.",
          },
        ],
      },
      {
        id: "tokyo-neighborhoods",
        title: "Neighborhoods for a slower walk",
        intro: "These routes are less about a single landmark and more about street-level atmosphere.",
        items: [
          {
            name: "Shinjuku Gyoen",
            label: "GARDEN",
            detail:
              "A large garden offers a green break from dense city blocks. Check current opening days and garden rules before visiting, especially during seasonal events.",
            fit: "Go for: landscaped paths and a quieter afternoon.",
          },
          {
            name: "Yanaka Ginza and nearby lanes",
            label: "QUIETER PICK",
            detail:
              "The old shopping street and surrounding neighborhood have a more local scale than central Tokyo’s major hubs. Browse gently and remember the street is part of people’s daily lives.",
            fit: "Go for: small shops, snacks, and a nostalgic neighborhood walk.",
          },
          {
            name: "Kiyosumi-Shirakawa",
            label: "CAFÉ AND ART",
            detail:
              "A former warehouse area now has galleries, cafés, and the Museum of Contemporary Art Tokyo nearby. Check gallery schedules and keep the outing centered on one part of the district.",
            fit: "Go for: contemporary art and a slower coffee stop.",
          },
        ],
      },
      {
        id: "tokyo-food-nightlife",
        title: "Markets, waterfront, and going out",
        intro: "Choose one experience and verify the details rather than relying on old social posts.",
        items: [
          {
            name: "Tsukiji Outer Market",
            label: "FOOD",
            detail:
              "Small shops and food counters make the outer market a useful morning stop. Check the market’s visitor etiquette, avoid carrying food through narrow lanes, and follow vendor requests.",
            fit: "Go for: seafood, breakfast, and market browsing.",
          },
          {
            name: "Shimokitazawa",
            label: "MUSIC AND VINTAGE",
            detail:
              "Independent shops, small venues, and cafés make this west-side neighborhood good for an unstructured afternoon. Confirm live-music schedules directly with venues.",
            fit: "Go for: vintage finds, small venues, and cafés.",
          },
          {
            name: "Odaiba waterfront",
            label: "CITY VIEWS",
            detail:
              "The bayfront gives a broad view back toward the city and a different scale from central Tokyo. Check transit and current access for the specific museum or attraction you plan to visit.",
            fit: "Go for: waterfront walks and a wide skyline view.",
          },
        ],
      },
    ],
    interests: [
      ["Food", "Choose either Tsukiji or a neighborhood food walk for the morning; leave time to explore rather than queue-hop."],
      ["History", "Pair Asakusa with a museum or shrine visit, keeping the cultural context in view."],
      ["Quiet", "Try Meiji Jingu, Shinjuku Gyoen, or Yanaka, and respect local rules and residences."],
      ["Meeting people", "A small-group cooking class, language exchange, or neighborhood tour provides a shared activity and a clear host."],
    ],
    sources: [
      ["Tokyo tourism official site", "https://www.gotokyo.org/en/"],
      ["Japan National Tourism Organization", "https://www.japan.travel/en/"],
    ],
  },
];

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const safeJson = (value) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

function header(assetPrefix, articleIndexHref, asiaIndexHref) {
  return `<header class="guide-header"><div class="guide-wrap guide-header-inner"><a class="guide-brand" href="${assetPrefix}" aria-label="Met home"><span class="guide-mark" aria-hidden="true">M</span><span>met</span></a><nav class="guide-nav" aria-label="Main navigation"><a href="${articleIndexHref}">Articles</a><a href="${assetPrefix}guides/">Travel guides</a><a class="guide-download" href="#met">Get Met</a></nav></div></header>`;
}

function footer(assetPrefix, articleIndexHref, asiaIndexHref) {
  return `<footer class="guide-footer"><div class="guide-wrap guide-footer-inner"><a class="guide-brand" href="${assetPrefix}" aria-label="Met home"><span class="guide-mark" aria-hidden="true">M</span><span>met</span></a><nav aria-label="Footer navigation"><a href="${assetPrefix}">Met home</a><a href="${articleIndexHref}">Articles</a><a href="${asiaIndexHref}">Asia guides</a><a href="${assetPrefix}privacy">Privacy</a><a href="${assetPrefix}support">Terms</a></nav><span>© 2026 Met</span></div></footer>`;
}

function pageShell({ title, description, canonical, assetPrefix, articleIndexHref, asiaIndexHref, body, schema, pageType, ogImage, ogImageAlt }) {
  const socialType = pageType === "article" ? "article" : "website";
  const schemaMarkup = (Array.isArray(schema) ? schema : [schema])
    .map((block) => `<script type="application/ld+json">${safeJson(block)}</script>`)
    .join("\n    ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="${socialType}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link rel="icon" type="image/svg+xml" href="${assetPrefix}favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${assetPrefix}guides/guides.css" />
    ${schemaMarkup}
  </head>
  <body>
    ${header(assetPrefix, articleIndexHref, asiaIndexHref)}
    ${body}
    ${footer(assetPrefix, articleIndexHref, asiaIndexHref)}
  </body>
</html>
`;
}

function renderItem(item) {
  return `<li class="asia-place"><span class="asia-place-label">${escapeHtml(item.label)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.detail)}</p><p class="asia-place-fit"><strong>${escapeHtml(item.fit)}</strong></p></li>`;
}

function renderArticle(article) {
  const canonical = `${baseUrl}/${article.slug}/`;
  const assetPrefix = "../../../";
  const articleIndexHref = "../../";
  const asiaIndexHref = "../";
  const imageUrl = `https://met-app.org/images/articles/asia/${article.image.file}`;
  const imageClass = article.image.portrait ? "portrait-photo" : article.image.contain ? "contain-photo" : "";
  const photo = `<figure class="article-photo asia-hero-photo"><img${imageClass ? ` class="${imageClass}"` : ""} src="${assetPrefix}images/articles/asia/${escapeHtml(article.image.file)}" alt="${escapeHtml(article.image.alt)}" width="${article.image.width}" height="${article.image.height}" fetchpriority="high" decoding="async" /><figcaption>Photo by <a href="${escapeHtml(article.image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.image.artist)}</a> via Wikimedia Commons, licensed <a href="${escapeHtml(article.image.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.image.license)}</a>.</figcaption></figure>`;
  const sections = article.sections
    .map(
      (section) => `<section class="asia-destination-section" aria-labelledby="${escapeHtml(section.id)}"><h2 id="${escapeHtml(section.id)}">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.intro)}</p><ol class="asia-place-list">${section.items.map(renderItem).join("")}</ol></section>`,
    )
    .join("");
  const interestCards = article.interests
    .map(
      ([interest, recommendation]) => `<li><strong>${escapeHtml(interest)}:</strong> ${escapeHtml(recommendation)}</li>`,
    )
    .join("");
  const sourceLinks = article.sources
    .map(
      ([label, url]) => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`,
    )
    .join("");
  const toc = article.sections
    .map(
      (section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`,
    )
    .join("");
  const body = `<main class="guide-wrap asia-article">
      <div class="article-top">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${assetPrefix}">Met</a><span aria-hidden="true">/</span><a href="${articleIndexHref}">Articles</a><span aria-hidden="true">/</span><a href="${asiaIndexHref}">Asia guides</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(article.kicker.split(" · ")[0])}</span></nav>
        <header class="article-heading">
          <p class="guide-kicker">${escapeHtml(article.kicker)}</p>
          <h1>${article.h1}</h1>
          <p class="article-dek">${escapeHtml(article.intro)}</p>
          <div class="article-byline"><span>Met Field Notes</span><span>Updated November 2, 2026</span><span>7 minute read</span></div>
        </header>
      </div>
      ${photo}
      <div class="article-grid">
        <aside class="article-toc" aria-label="In this article"><h2>In this article</h2>${toc}<a href="#choose-by-interest">Choose by interest</a></aside>
        <article class="article-body">
          <div class="article-callout"><strong>How this guide is curated:</strong> It combines recognizable sights, less-visited alternatives, and ideas grouped by travel interest. It is editorial research, not a first-hand report or a ranking. Check official sources for current access, hours, tickets, and local guidance.</div>
          ${sections}
          <section class="asia-interest-section" aria-labelledby="choose-by-interest"><h2 id="choose-by-interest">Choose by what you want to find</h2><ul class="asia-interest-list">${interestCards}</ul></section>
          <section class="article-sources" aria-labelledby="asia-sources-title"><h2 id="asia-sources-title">Official sources to check before you go</h2><ul>${sourceLinks}</ul><p>Travel conditions, venue access, and opening information can change. Confirm details close to your visit.</p></section>
          <section id="met" class="article-cta met-final-cta" aria-labelledby="asia-met-title"><h2 id="asia-met-title">Make room for the people you meet.</h2><p>Met helps you remember places and encounters, and connect when both people choose to reveal. Participating locations vary, so check the map before planning around a check-in.</p><div class="guide-store-links"><a href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926" target="_blank" rel="noopener noreferrer">Download on the App Store</a><a href="https://play.google.com/store/apps/details?id=app.met.founders" target="_blank" rel="noopener noreferrer">Get it on Google Play</a></div></section>
          <nav class="related-guides" aria-label="Asia guides"><a href="../">All Asia guides</a><a href="../../">All articles</a></nav>
        </article>
      </div>
    </main>`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title.replace(/ \| Met$/, ""),
      description: article.description,
      datePublished: published,
      dateModified: published,
      image: [imageUrl],
      author: { "@type": "Organization", name: "Met" },
      publisher: { "@type": "Organization", name: "Met", url: "https://met-app.org/" },
      mainEntityOfPage: canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Met", item: "https://met-app.org/" },
        { "@type": "ListItem", position: 2, name: "Articles", item: "https://met-app.org/articles/" },
        { "@type": "ListItem", position: 3, name: "Asia guides", item: `${baseUrl}/` },
        { "@type": "ListItem", position: 4, name: article.kicker.split(" · ")[0], item: canonical },
      ],
    },
  ];
  return pageShell({
    title: article.title,
    description: article.description,
    canonical,
    assetPrefix,
    articleIndexHref,
    asiaIndexHref,
    body,
    schema,
    pageType: "article",
    ogImage: imageUrl,
    ogImageAlt: article.image.alt,
  });
}

function renderIndex() {
  const canonical = `${baseUrl}/`;
  const title = "Asia Travel Guides: Countries and City Highlights | Met";
  const description =
    "Explore curated Asia destination guides with essential sights, quieter discoveries, and ideas for food, history, nature, and meeting people. Start here.";
  const assetPrefix = "../../";
  const articleIndexHref = "../";
  const asiaIndexHref = "./";
  const ogImage = "https://met-app.org/images/articles/asia/vietnam.jpg";
  const cards = articles
    .map(
      (article, index) => `<article class="asia-guide-card"><p class="asia-guide-number">${String(index + 1).padStart(2, "0")} · ${escapeHtml(article.kicker.split(" · ")[0])}</p><a class="asia-guide-image-link" href="./${escapeHtml(article.slug)}/"><img class="asia-guide-image" src="../../images/articles/asia/${escapeHtml(article.image.file)}" alt="${escapeHtml(article.image.alt)}" width="${article.image.width}" height="${article.image.height}" loading="lazy" decoding="async" /></a><p class="asia-guide-credit">Photo by <a href="${escapeHtml(article.image.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.image.artist)}</a> via Wikimedia Commons · <a href="${escapeHtml(article.image.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.image.license)}</a></p><h2><a href="./${escapeHtml(article.slug)}/">${escapeHtml(article.title.replace(/ \| Met$/, ""))}</a></h2><p>${escapeHtml(article.description)}</p><a class="asia-guide-read" href="./${escapeHtml(article.slug)}/">Read the guide <span aria-hidden="true">→</span></a></article>`,
    )
    .join("");
  const body = `<main class="guide-wrap">
      <section class="asia-hero">
        <p class="guide-kicker">Met field notes · Asia</p>
        <h1>Find your kind of <em>Asia.</em></h1>
        <p class="guide-intro">A first collection of country and city guides: famous sights, lesser-known stops, and recommendations shaped around what you want to find. More Asian destinations will be added in later editorial batches.</p>
        <a class="guide-download" href="#asia-guides">Explore the guides</a>
      </section>
      <section id="asia-guides" class="asia-guide-grid" aria-label="Asia destination articles">${cards}</section>
      <section class="article-callout asia-editorial-note"><strong>Travel note:</strong> “Quieter” and “lesser-known” describe editorial picks, not a guarantee of empty or safe conditions. Confirm current travel advice and official site details before setting out.</section>
      <section id="met" class="article-cta met-final-cta" aria-labelledby="asia-index-met-title"><h2 id="asia-index-met-title">Remember the people and places along the way.</h2><p>Met helps you keep a note of an encounter and connect when you both choose to reveal.</p><div class="guide-store-links"><a href="https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926" target="_blank" rel="noopener noreferrer">Download on the App Store</a><a href="https://play.google.com/store/apps/details?id=app.met.founders" target="_blank" rel="noopener noreferrer">Get it on Google Play</a></div></section>
    </main>`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Met Asia Travel Guides",
    url: canonical,
    description,
    publisher: { "@type": "Organization", name: "Met", url: "https://met-app.org/" },
    image: ogImage,
    hasPart: articles.map((article) => ({
      "@type": "Article",
      headline: article.title.replace(/ \| Met$/, ""),
      url: `${baseUrl}/${article.slug}/`,
    })),
  };
  return pageShell({
    title,
    description,
    canonical,
    assetPrefix,
    articleIndexHref,
    asiaIndexHref,
    body,
    schema,
    pageType: "collection",
    ogImage,
    ogImageAlt: "Limestone islands in Ha Long Bay, featured in the Met Asia travel guides",
  });
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "index.html"), renderIndex());
for (const article of articles) {
  const directory = path.join(outputRoot, article.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), renderArticle(article));
}
console.log(`Generated ${articles.length} Asia articles and their index.`);
