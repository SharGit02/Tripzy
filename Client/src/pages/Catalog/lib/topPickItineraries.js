import { addDays, nextSaturday, toIsoDate } from "./weekendDates";

function act(time, type, title, description, cost, place) {
  return {
    time,
    type,
    title,
    description,
    cost,
    ...(place
      ? {
          place: {
            name: place.name,
            category: place.category,
            location: place.location,
            visitDurationHours: place.hours,
          },
        }
      : {}),
  };
}

function datedDays(start, templates) {
  return templates.map((day, i) => ({
    ...day,
    day: i + 1,
    date: toIsoDate(addDays(start, i)),
  }));
}

const GOA_DAYS = [
  {
    theme: "Arrive & Calangute",
    dailyBudget: 4500,
    activities: [
      act("11:00", "transport", "Land in Goa", "Arrive at Dabolim or Mopa and transfer to North Goa.", 1800),
      act("14:00", "accommodation", "Check in near Calangute", "Drop bags and settle into a beachside stay.", 0),
      act("16:30", "visit", "Calangute & Baga sunset", "Walk the beach belt and watch the sun drop over the Arabian Sea.", 0, {
        name: "Calangute Beach",
        category: "beach",
        location: "North Goa",
        hours: 2,
      }),
      act("20:00", "meal", "Seafood dinner in Baga", "Try prawns, recahedo fish, and a Goan thali.", 1200),
    ],
  },
  {
    theme: "North Goa circuit",
    dailyBudget: 3800,
    activities: [
      act("09:00", "meal", "Beach breakfast", "Light breakfast near the hotel before the fort run.", 400),
      act("10:30", "visit", "Fort Aguada", "Old Portuguese fort and lighthouse views over the Mandovi.", 50, {
        name: "Fort Aguada",
        category: "heritage",
        location: "Candolim",
        hours: 1.5,
      }),
      act("13:30", "visit", "Anjuna & Vagator", "Cafes, cliff views, and a swim if the tide is kind.", 600, {
        name: "Vagator Beach",
        category: "beach",
        location: "North Goa",
        hours: 3,
      }),
      act("19:30", "meal", "Sunset cafe dinner", "Casual dinner in Anjuna or Assagao.", 1100),
    ],
  },
  {
    theme: "South Goa slow day",
    dailyBudget: 4200,
    activities: [
      act("09:30", "transport", "Drive south", "Cross to South Goa for quieter beaches.", 2200),
      act("12:00", "visit", "Palolem or Colva", "Swim, hammock time, and a long lunch by the water.", 800, {
        name: "Palolem Beach",
        category: "beach",
        location: "South Goa",
        hours: 4,
      }),
      act("17:00", "free_time", "Spice farm or old Goa stop", "Optional spice plantation or Basilica of Bom Jesus on the way back.", 500),
      act("20:30", "meal", "Return dinner in Panjim", "Fontainhas streets and a Goan meal in the capital.", 1000),
    ],
  },
  {
    theme: "Last swim & fly out",
    dailyBudget: 2500,
    activities: [
      act("08:30", "meal", "Hotel breakfast", "Easy morning and checkout.", 0),
      act("10:00", "visit", "One last beach hour", "A short dip or souvenir stop in Calangute market.", 400),
      act("13:00", "transport", "Airport transfer", "Buffer time for Dabolim or Mopa departure.", 1800),
    ],
  },
];

const KASHMIR_DAYS = [
  {
    theme: "Srinagar arrival",
    dailyBudget: 5200,
    activities: [
      act("12:00", "transport", "Arrive Srinagar", "Airport transfer to a Dal Lake houseboat or boulevard hotel.", 1200),
      act("15:00", "accommodation", "Houseboat check-in", "Settle in and chai on the deck.", 0),
      act("16:30", "visit", "Shikara on Dal Lake", "Floating gardens, lotus, and sunset from the water.", 1500, {
        name: "Dal Lake",
        category: "nature",
        location: "Srinagar",
        hours: 2,
      }),
      act("20:00", "meal", "Wazwan tasting", "Rogan josh, yakhni, and noon chai.", 1400),
    ],
  },
  {
    theme: "Mughal gardens",
    dailyBudget: 3600,
    activities: [
      act("09:00", "visit", "Shalimar & Nishat", "Terraced Mughal gardens on the lake shore.", 200, {
        name: "Nishat Bagh",
        category: "garden",
        location: "Srinagar",
        hours: 3,
      }),
      act("13:00", "meal", "Boulevard lunch", "Lakeside lunch after the gardens.", 800),
      act("15:30", "visit", "Old Srinagar & spice market", "Khanqah, old city lanes, and dry fruit shops.", 400),
      act("19:30", "meal", "Houseboat dinner", "Quiet dinner back on the water.", 1200),
    ],
  },
  {
    theme: "Gulmarg day",
    dailyBudget: 6500,
    activities: [
      act("07:30", "transport", "Drive to Gulmarg", "About 2 hours through Tangmarg.", 2500),
      act("10:30", "visit", "Gondola & meadows", "Phase 1 gondola and a walk on the meadow or snow.", 1800, {
        name: "Gulmarg Gondola",
        category: "adventure",
        location: "Gulmarg",
        hours: 4,
      }),
      act("14:00", "meal", "Gulmarg lunch", "Hot lunch before the descent.", 700),
      act("18:30", "transport", "Return to Srinagar", "Back to the houseboat for the night.", 0),
    ],
  },
  {
    theme: "Pahalgam",
    dailyBudget: 5800,
    activities: [
      act("08:00", "transport", "Drive to Pahalgam", "Lidder valley road, about 2.5 hours.", 2800),
      act("11:30", "visit", "Betaab & Aru valleys", "River views, short walks, optional pony ride.", 1200, {
        name: "Betaab Valley",
        category: "nature",
        location: "Pahalgam",
        hours: 3,
      }),
      act("15:00", "accommodation", "Check in Pahalgam", "Riverside hotel for the night.", 0),
      act("19:30", "meal", "Valley dinner", "Simple Kashmiri dinner by the Lidder.", 900),
    ],
  },
  {
    theme: "Pahalgam to Srinagar",
    dailyBudget: 3200,
    activities: [
      act("09:00", "visit", "Morning by the Lidder", "Easy walk before checkout.", 0),
      act("11:00", "transport", "Drive back to Srinagar", "Stop at saffron fields near Pampore if in season.", 2500),
      act("16:00", "free_time", "Boulevard stroll", "Last evening on the lake promenade.", 300),
      act("20:00", "meal", "Farewell wazwan", "One more Kashmiri spread.", 1300),
    ],
  },
  {
    theme: "Fly out",
    dailyBudget: 1800,
    activities: [
      act("08:00", "meal", "Breakfast & checkout", "Leave time for airport security.", 0),
      act("09:30", "free_time", "Dry fruit & saffron pickup", "Last shop on Residency Road before the airport.", 800),
      act("11:00", "transport", "Srinagar airport", "Buffer for domestic departure.", 1200),
    ],
  },
];

const RAJASTHAN_DAYS = [
  {
    theme: "Jaipur pink city",
    dailyBudget: 4800,
    activities: [
      act("11:00", "transport", "Arrive Jaipur", "Airport or station transfer to the old city.", 900),
      act("14:00", "accommodation", "Check in", "Hotel near Bani Park or C-Scheme.", 0),
      act("16:00", "visit", "City Palace & Jantar Mantar", "Royal courtyards and the stone observatory.", 700, {
        name: "City Palace",
        category: "heritage",
        location: "Jaipur",
        hours: 2.5,
      }),
      act("19:30", "meal", "LMB or old-city thali", "Rajasthani thali in Johari Bazaar.", 900),
    ],
  },
  {
    theme: "Amber & bazaars",
    dailyBudget: 4500,
    activities: [
      act("08:30", "visit", "Amber Fort", "Go early, skip the worst queues, walk the ramparts.", 500, {
        name: "Amber Fort",
        category: "heritage",
        location: "Amer, Jaipur",
        hours: 3,
      }),
      act("13:00", "meal", "Lunch in Amer", "Simple lunch after the fort.", 600),
      act("15:30", "visit", "Hawa Mahal & bazaars", "Photo stop and textiles in Bapu Bazaar.", 400),
      act("20:00", "meal", "Dinner & light-and-sound optional", "Evening meal near the hotel.", 1000),
    ],
  },
  {
    theme: "Jaipur to Jaisalmer",
    dailyBudget: 3500,
    activities: [
      act("07:00", "transport", "Overnight-style day train or flight", "Long transfer west to the desert. Fly if you can; train if you prefer.", 2200),
      act("16:00", "accommodation", "Check in Jaisalmer", "Haveli stay inside or just outside the fort.", 0),
      act("17:30", "visit", "Jaisalmer Fort sunset", "Living fort, Jain temples, and golden stone.", 200, {
        name: "Jaisalmer Fort",
        category: "heritage",
        location: "Jaisalmer",
        hours: 2,
      }),
      act("20:00", "meal", "Fort-view dinner", "Dal baati churma on a rooftop.", 800),
    ],
  },
  {
    theme: "Desert safari",
    dailyBudget: 5200,
    activities: [
      act("09:00", "visit", "Patwon ki Haveli", "Carved merchant houses in town.", 250, {
        name: "Patwon ki Haveli",
        category: "heritage",
        location: "Jaisalmer",
        hours: 1.5,
      }),
      act("15:00", "visit", "Sam dunes safari", "Camel or jeep, sunset on the dunes, folk music camp.", 2800, {
        name: "Sam Sand Dunes",
        category: "adventure",
        location: "Jaisalmer",
        hours: 5,
      }),
      act("20:00", "meal", "Desert camp dinner", "Rajasthani dinner under the stars.", 0),
    ],
  },
  {
    theme: "Fly or train out",
    dailyBudget: 2200,
    activities: [
      act("08:30", "meal", "Breakfast & checkout", "Leave the haveli with time to spare.", 0),
      act("09:30", "visit", "Gadsisar lake stop", "Short stop at the lake if your departure is after noon.", 0, {
        name: "Gadsisar Lake",
        category: "nature",
        location: "Jaisalmer",
        hours: 1,
      }),
      act("12:00", "transport", "Depart Jaisalmer", "Airport or station for the journey home.", 1800),
    ],
  },
];

export const TOP_PICKS = [
  {
    slug: "goa",
    title: "Goa",
    destination: "Goa",
    totalDays: 4,
    nights: 3,
    category: "Beach Destination",
    categoryEmoji: "🌴",
    rating: "4.8",
    reviews: "1,254",
    includes: ["Flights Included", "Breakfast Included", "Hotel Included", "Sightseeing Included"],
    idealFor: "Ideal for Friends & Couples",
    idealDesc: "Perfect for a fun getaway with your loved ones.",
    price: "₹9,999",
    tripType: "friends",
    interests: ["beaches", "food"],
    adults: 2,
    overview:
      "A ready 4-day North-and-South Goa plan timed for the coming Saturday. Beaches, a fort, one slow South Goa day, and a buffer morning before you fly out. Built so you can open booking links with dates already set.",
    budgetBreakdown: {
      accommodation: 12000,
      food: 8000,
      transport: 9000,
      activities: 4000,
      miscellaneous: 2000,
      total: 35000,
      currency: "INR",
    },
    accommodations: [
      {
        name: "Calangute beach stay",
        type: "hotel",
        pricePerNight: 4000,
        currency: "INR",
        location: "Calangute, North Goa",
        amenities: ["Breakfast", "Wi-Fi", "Pool"],
        description: "Walkable to Calangute and Baga, easy for a first Goa trip.",
      },
    ],
    placesToVisit: [
      { name: "Calangute Beach", description: "Main North Goa beach belt.", category: "beach", location: "North Goa", visitDurationHours: 2, bestTimeToVisit: "Late afternoon" },
      { name: "Fort Aguada", description: "Portuguese fort and lighthouse.", category: "heritage", location: "Candolim", visitDurationHours: 1.5, bestTimeToVisit: "Morning" },
      { name: "Palolem Beach", description: "Quieter crescent in South Goa.", category: "beach", location: "South Goa", visitDurationHours: 4, bestTimeToVisit: "Midday" },
    ],
    tips: [
      "Keep a buffer to the airport; Mopa and Dabolim are far from each other.",
      "Rent a scooter only if you are used to Indian traffic.",
      "Sunday markets in Arpora are seasonal — check the week you travel.",
    ],
    emergencyInfo: {
      nearestHospital: "Goa Medical College, Bambolim",
      policeStation: "Calangute Police Station",
      emergencyNumber: "112",
    },
    dayTemplates: GOA_DAYS,
  },
  {
    slug: "kashmir",
    title: "Kashmir",
    destination: "Srinagar",
    totalDays: 6,
    nights: 5,
    category: "Scenic Escape",
    categoryEmoji: "❄️",
    rating: "4.9",
    reviews: "2,143",
    includes: ["Flights Included", "Hotel + Houseboat Stay", "Breakfast & Dinner", "Gulmarg, Sonmarg & Pahalgam"],
    idealFor: "Ideal for Honeymooners & Nature Lovers",
    idealDesc: "Breathtaking snow peaks, pristine valleys & houseboats.",
    price: "₹18,999",
    tripType: "couple",
    interests: ["nature", "adventure"],
    adults: 2,
    overview:
      "A 6-day Kashmir outline starting the coming Saturday: Dal Lake and Mughal gardens, a full Gulmarg day, then Pahalgam and back to Srinagar. Dates are suggested so flights and stays can be searched immediately.",
    budgetBreakdown: {
      accommodation: 28000,
      food: 14000,
      transport: 16000,
      activities: 9000,
      miscellaneous: 4000,
      total: 71000,
      currency: "INR",
    },
    accommodations: [
      {
        name: "Dal Lake houseboat",
        type: "hotel",
        pricePerNight: 5500,
        currency: "INR",
        location: "Nigeen / Dal, Srinagar",
        amenities: ["Meals", "Shikara pickup", "Heating"],
        description: "Classic first stay in Srinagar with lake views.",
      },
      {
        name: "Pahalgam riverside hotel",
        type: "hotel",
        pricePerNight: 4800,
        currency: "INR",
        location: "Pahalgam",
        amenities: ["Breakfast", "Mountain view"],
        description: "One night in the Lidder valley after the day trips.",
      },
    ],
    placesToVisit: [
      { name: "Dal Lake", description: "Shikara and floating gardens.", category: "nature", location: "Srinagar", visitDurationHours: 2, bestTimeToVisit: "Sunset" },
      { name: "Gulmarg Gondola", description: "Meadows and mountain views.", category: "adventure", location: "Gulmarg", visitDurationHours: 4, bestTimeToVisit: "Morning" },
      { name: "Betaab Valley", description: "River valley near Pahalgam.", category: "nature", location: "Pahalgam", visitDurationHours: 3, bestTimeToVisit: "Late morning" },
    ],
    tips: [
      "Carry warm layers even in shoulder season; Gulmarg is colder than Srinagar.",
      "Gondola tickets can sell out — book the morning slot.",
      "Check local advisories before road days to Gulmarg and Pahalgam.",
    ],
    emergencyInfo: {
      nearestHospital: "SKIMS Soura, Srinagar",
      policeStation: "Srinagar Police Control Room",
      emergencyNumber: "112",
    },
    dayTemplates: KASHMIR_DAYS,
  },
  {
    slug: "rajasthan",
    title: "Rajasthan (Jaipur + Jaisalmer)",
    destination: "Jaipur",
    totalDays: 5,
    nights: 4,
    category: "Heritage Destination",
    categoryEmoji: "🏜️",
    rating: "4.7",
    reviews: "1,032",
    includes: ["Hotel Included", "Breakfast Included", "Desert Safari", "Fort & Palace Tour"],
    idealFor: "Ideal for Families & History Enthusiasts",
    idealDesc: "Explore royal palaces, grand forts & golden sand dunes.",
    price: "₹11,999",
    tripType: "family",
    interests: ["history", "adventure"],
    adults: 2,
    overview:
      "A 5-day Jaipur and Jaisalmer loop from the coming Saturday: Pink City palaces, Amber Fort, then the desert, havelis, and Sam dunes. Suggested dates are already wired into flight, train, and bus booking links.",
    budgetBreakdown: {
      accommodation: 16000,
      food: 9000,
      transport: 12000,
      activities: 7000,
      miscellaneous: 3000,
      total: 47000,
      currency: "INR",
    },
    accommodations: [
      {
        name: "Jaipur city hotel",
        type: "hotel",
        pricePerNight: 3800,
        currency: "INR",
        location: "C-Scheme / Bani Park, Jaipur",
        amenities: ["Breakfast", "Wi-Fi", "AC"],
        description: "Base for Amber and the old city.",
      },
      {
        name: "Jaisalmer haveli",
        type: "hotel",
        pricePerNight: 4200,
        currency: "INR",
        location: "Near Jaisalmer Fort",
        amenities: ["Breakfast", "Rooftop"],
        description: "Stone haveli stay before the dune camp evening.",
      },
    ],
    placesToVisit: [
      { name: "Amber Fort", description: "Hill fort above Jaipur.", category: "heritage", location: "Amer, Jaipur", visitDurationHours: 3, bestTimeToVisit: "Morning" },
      { name: "Jaisalmer Fort", description: "Living fort of golden sandstone.", category: "heritage", location: "Jaisalmer", visitDurationHours: 2, bestTimeToVisit: "Sunset" },
      { name: "Sam Sand Dunes", description: "Sunset safari and camp.", category: "adventure", location: "Jaisalmer", visitDurationHours: 5, bestTimeToVisit: "Late afternoon" },
    ],
    tips: [
      "Amber Fort is easier before 10am.",
      "Jaipur to Jaisalmer is a long land day — a flight saves the trip.",
      "Book the dune camp with hotel pickup so you are not driving after dark.",
    ],
    emergencyInfo: {
      nearestHospital: "SMS Hospital, Jaipur",
      policeStation: "Jaipur Police Control Room",
      emergencyNumber: "112",
    },
    dayTemplates: RAJASTHAN_DAYS,
  },
];

export function getTopPick(slug) {
  return TOP_PICKS.find((pick) => pick.slug === slug) || null;
}

export function buildTopPickItinerary(slug, origin = "Delhi") {
  const pick = getTopPick(slug);
  if (!pick) return null;
  const start = nextSaturday();
  const end = addDays(start, pick.totalDays - 1);
  const fromCity = origin && origin.toLowerCase() !== pick.destination.toLowerCase() ? origin : "Delhi";

  return {
    id: `pick-${pick.slug}`,
    destination: pick.destination,
    origin: fromCity,
    fromCity,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    totalDays: pick.totalDays,
    overview: pick.overview,
    budgetBreakdown: pick.budgetBreakdown,
    accommodations: pick.accommodations,
    placesToVisit: pick.placesToVisit,
    transportOptions: [
      {
        type: "flight",
        from: fromCity,
        to: pick.destination,
        durationMinutes: 150,
        estimatedCost: 6500,
        currency: "INR",
        frequency: "Daily",
      },
    ],
    days: datedDays(start, pick.dayTemplates),
    tips: pick.tips,
    emergencyInfo: pick.emergencyInfo,
    adults: pick.adults,
    tripType: pick.tripType,
  };
}
