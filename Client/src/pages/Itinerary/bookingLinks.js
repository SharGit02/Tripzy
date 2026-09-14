/** Deep links into official booking search. Params only where those sites read them. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CITIES = {
  nagpur: { iata: "NAG", label: "Nagpur", rail: "NGP", railName: "NAGPUR", slug: "nagpur" },
  delhi: { iata: "DEL", label: "Delhi", rail: "NDLS", railName: "NEW DELHI", slug: "delhi" },
  "new delhi": { iata: "DEL", label: "Delhi", rail: "NDLS", railName: "NEW DELHI", slug: "delhi" },
  bengaluru: { iata: "BLR", label: "Bangalore", rail: "SBC", railName: "KSR BENGALURU", slug: "bangalore" },
  bangalore: { iata: "BLR", label: "Bangalore", rail: "SBC", railName: "KSR BENGALURU", slug: "bangalore" },
  hyderabad: { iata: "HYD", label: "Hyderabad", rail: "SC", railName: "SECUNDERABAD JN", slug: "hyderabad" },
  mumbai: { iata: "BOM", label: "Mumbai", rail: "LTT", railName: "LOKMANYA TILAK T", slug: "mumbai" },
  bombay: { iata: "BOM", label: "Mumbai", rail: "LTT", railName: "LOKMANYA TILAK T", slug: "mumbai" },
  pune: { iata: "PNQ", label: "Pune", rail: "PUNE", railName: "PUNE JN", slug: "pune" },
  kolkata: { iata: "CCU", label: "Kolkata", rail: "HWH", railName: "HOWRAH JN", slug: "kolkata" },
  calcutta: { iata: "CCU", label: "Kolkata", rail: "HWH", railName: "HOWRAH JN", slug: "kolkata" },
  chennai: { iata: "MAA", label: "Chennai", rail: "MAS", railName: "MGR CHENNAI CTL", slug: "chennai" },
  jaipur: { iata: "JAI", label: "Jaipur", rail: "JP", railName: "JAIPUR", slug: "jaipur" },
  goa: { iata: "GOI", label: "Goa", rail: "MAO", railName: "MADGAON", slug: "goa" },
  varanasi: { iata: "VNS", label: "Varanasi", rail: "BSB", railName: "VARANASI JN", slug: "varanasi" },
  kochi: { iata: "COK", label: "Kochi", rail: "ERS", railName: "ERNAKULAM JN", slug: "kochi" },
  cochin: { iata: "COK", label: "Kochi", rail: "ERS", railName: "ERNAKULAM JN", slug: "kochi" },
  kerala: { iata: "COK", label: "Kochi", rail: "ERS", railName: "ERNAKULAM JN", slug: "kochi" },
  munnar: { iata: "COK", label: "Kochi", rail: "ERS", railName: "ERNAKULAM JN", slug: "munnar" },
  srinagar: { iata: "SXR", label: "Srinagar", rail: "SINA", railName: "SRINAGAR", slug: "srinagar" },
  kashmir: { iata: "SXR", label: "Srinagar", rail: "SINA", railName: "SRINAGAR", slug: "srinagar" },
  udaipur: { iata: "UDR", label: "Udaipur", rail: "UDZ", railName: "UDAIPUR CITY", slug: "udaipur" },
  jodhpur: { iata: "JDH", label: "Jodhpur", rail: "JU", railName: "JODHPUR JN", slug: "jodhpur" },
  jaisalmer: { iata: "JSA", label: "Jaisalmer", rail: "JSM", railName: "JAISALMER", slug: "jaisalmer" },
  rajasthan: { iata: "JAI", label: "Jaipur", rail: "JP", railName: "JAIPUR", slug: "jaipur" },
  leh: { iata: "IXL", label: "Leh", rail: null, railName: null, slug: "leh" },
  ladakh: { iata: "IXL", label: "Leh", rail: null, railName: null, slug: "leh" },
  ahmedabad: { iata: "AMD", label: "Ahmedabad", rail: "ADI", railName: "AHMEDABAD JN", slug: "ahmedabad" },
  chandigarh: { iata: "IXC", label: "Chandigarh", rail: "CDG", railName: "CHANDIGARH", slug: "chandigarh" },
  agra: { iata: "AGR", label: "Agra", rail: "AGC", railName: "AGRA CANTT", slug: "agra" },
  amritsar: { iata: "ATQ", label: "Amritsar", rail: "ASR", railName: "AMRITSAR JN", slug: "amritsar" },
  rishikesh: { iata: "DED", label: "Dehradun", rail: "RKSH", railName: "RISHIKESH", slug: "rishikesh" },
  mysuru: { iata: "MYQ", label: "Mysore", rail: "MYS", railName: "MYSURU JN", slug: "mysore" },
  mysore: { iata: "MYQ", label: "Mysore", rail: "MYS", railName: "MYSURU JN", slug: "mysore" },
  pondicherry: { iata: "PNY", label: "Pondicherry", rail: "PDY", railName: "PUDUCHERRY", slug: "pondicherry" },
  puducherry: { iata: "PNY", label: "Pondicherry", rail: "PDY", railName: "PUDUCHERRY", slug: "pondicherry" },
  lucknow: { iata: "LKO", label: "Lucknow", rail: "LKO", railName: "LUCKNOW NR", slug: "lucknow" },
  indore: { iata: "IDR", label: "Indore", rail: "INDB", railName: "INDORE JN BG", slug: "indore" },
  manali: { iata: "KUU", label: "Kullu", rail: null, railName: null, slug: "manali" },
  shimla: { iata: "SLV", label: "Shimla", rail: "SML", railName: "SHIMLA", slug: "shimla" },
  himachal: { iata: "DHM", label: "Dharamshala", rail: "PTK", railName: "PATHANKOT", slug: "dharamshala" },
  dharamshala: { iata: "DHM", label: "Dharamshala", rail: "PTK", railName: "PATHANKOT", slug: "dharamshala" },
  shillong: { iata: "SHL", label: "Shillong", rail: "GHY", railName: "GUWAHATI", slug: "shillong" },
  meghalaya: { iata: "GAU", label: "Guwahati", rail: "GHY", railName: "GUWAHATI", slug: "guwahati" },
};

function cityKey(name) {
  return String(name || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function cityFor(name) {
  return CITIES[cityKey(name)] || null;
}

function parseTripDate(value) {
  const s = String(value || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDdMmYyyy(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatRedbusDate(date) {
  return `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function formatRailYatriDate(date) {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function paxCount(adults) {
  const n = Number(adults);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(9, Math.floor(n));
}

function withQuery(base, params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    qs.set(key, String(value));
  });
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

export function getBookingPlatforms({
  origin,
  destination,
  startDate,
  endDate,
  adults = 1,
} = {}) {
  const from = cityFor(origin);
  const to = cityFor(destination);
  const depart = parseTripDate(startDate);
  const ret = parseTripDate(endDate);
  const pax = paxCount(adults);
  const hasAir = Boolean(from?.iata && to?.iata && from.iata !== to.iata);
  const hasDepart = Boolean(hasAir && depart);
  const isRound = Boolean(hasDepart && ret && ret > depart);
  const hasBus = Boolean(from?.slug && to?.slug && from.slug !== to.slug);
  const hasRail = Boolean(from?.rail && to?.rail && from.rail !== to.rail);

  const mmtUrl = (() => {
    if (!hasDepart) return "https://www.makemytrip.com/flights/";
    const outbound = `${from.iata}-${to.iata}-${formatDdMmYyyy(depart)}`;
    const itinerary = isRound
      ? `${outbound}_${to.iata}-${from.iata}-${formatDdMmYyyy(ret)}`
      : outbound;
    return withQuery("https://www.makemytrip.com/flight/search", {
      itinerary,
      tripType: isRound ? "R" : "O",
      paxType: `A-${pax}_C-0_I-0`,
      intl: "false",
      cabinClass: "E",
      ccde: "IN",
      lang: "eng",
    });
  })();

  const emtUrl = (() => {
    if (!hasDepart) return "https://www.easemytrip.com/flights.html";
    return withQuery("https://flight.easemytrip.com/FlightList/Index", {
      org: `${from.iata}-${from.label}, India`,
      dept: `${to.iata}-${to.label}, India`,
      adt: String(pax),
      chd: "0",
      inf: "0",
      cabin: "0",
      airline: "Any",
      deptDT: formatDdMmYyyy(depart),
      arrDT: isRound ? formatDdMmYyyy(ret) : "undefined",
      isOneway: isRound ? "false" : "true",
      isDomestic: "true",
    });
  })();

  // Airline sites do not document a working GET search. Pass what they might
  // read, and land on the official book page with cities in the path when possible.
  const indigoUrl = hasDepart
    ? withQuery("https://www.goindigo.in/", {
        orig: from.iata,
        dest: to.iata,
        dd1: formatIsoDate(depart),
        ...(isRound ? { dd2: formatIsoDate(ret) } : {}),
        adults: String(pax),
        tripType: isRound ? "R" : "O",
      })
    : "https://www.goindigo.in/";

  const airIndiaUrl = hasAir
    ? withQuery(
        `https://www.airindia.com/en-in/book-flights/${from.label.toLowerCase()}-to-${to.label.toLowerCase()}-flights`,
        {
          origin: from.iata,
          destination: to.iata,
          ...(depart ? { departureDate: formatIsoDate(depart) } : {}),
          ...(isRound ? { returnDate: formatIsoDate(ret) } : {}),
          adults: String(pax),
          tripType: isRound ? "RT" : "OW",
        },
      )
    : "https://www.airindia.com/en-in/book-flights";

  const railYatriUrl = (() => {
    if (!hasRail) return "https://www.railyatri.in/train-ticket";
    return withQuery("https://www.railyatri.in/booking/trains-between-stations", {
      from_code: from.rail.toLowerCase(),
      from_name: from.railName.toLowerCase(),
      to_code: to.rail.toLowerCase(),
      to_name: to.railName.toLowerCase(),
      ...(depart ? { journey_date: formatRailYatriDate(depart) } : {}),
      src: "ttb_landing",
    });
  })();

  const redbusUrl = (() => {
    if (!hasBus) return "https://www.redbus.in/bus-tickets";
    const path = `https://www.redbus.in/bus-tickets/${from.slug}-to-${to.slug}`;
    return withQuery(path, {
      fromCityName: from.label,
      toCityName: to.label,
      ...(depart ? { onward: formatRedbusDate(depart) } : {}),
      srcCountry: "IND",
      destCountry: "IND",
      opId: "0",
      busType: "Any",
    });
  })();

  const abhiBusUrl = hasBus
    ? withQuery("https://www.abhibus.com/", {
        from: from.label,
        to: to.label,
        ...(depart ? { doj: formatIsoDate(depart) } : {}),
      })
    : "https://www.abhibus.com/";

  return [
    {
      category: "Flights",
      icon: "✈️",
      links: [
        { name: "MakeMyTrip", color: "#E63946", url: mmtUrl },
        { name: "IndiGo", color: "#13599A", url: indigoUrl },
        { name: "Air India", color: "#C8102E", url: airIndiaUrl },
        { name: "EaseMyTrip", color: "#FF6D00", url: emtUrl },
      ],
    },
    {
      category: "Trains",
      icon: "🚆",
      links: [
        // IRCTC blocks third-party prefill. Search form is the official book page.
        { name: "IRCTC", color: "#1A4B8C", url: "https://www.irctc.co.in/nget/train-search" },
        { name: "RailYatri", color: "#E54B4B", url: railYatriUrl },
      ],
    },
    {
      category: "Buses",
      icon: "🚌",
      links: [
        { name: "redBus", color: "#D84E43", url: redbusUrl },
        { name: "AbhiBus", color: "#2E7D32", url: abhiBusUrl },
      ],
    },
  ];
}
