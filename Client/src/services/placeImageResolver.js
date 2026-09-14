/**
 * Place Image Resolver Service
 * Free Wikimedia Commons + Wikipedia API pipeline for travel places & attractions across India & worldwide.
 * 
 * Pipeline:
 *  1. In-memory & localStorage cache check
 *  2. Stage 1: Wikipedia Pageimages Search API
 *  3. Stage 2: Wikimedia Commons Geosearch / Keyword Search API
 *  4. Stage 3: Curated thematic category fallbacks (Nature, Beach, Monument, Temple, Market, Mountain, City)
 */

const CACHE_KEY = "tripzee_place_images_v2";
const memoryCache = new Map();

// Load initial cache from localStorage
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([k, v]) => memoryCache.set(k, v));
  }
} catch (e) {
  // localStorage might be unavailable or disabled
}

function saveToStorage() {
  try {
    const obj = {};
    // Keep max 200 items in localStorage to avoid storage quota issues
    const entries = Array.from(memoryCache.entries()).slice(-200);
    entries.forEach(([k, v]) => {
      obj[k] = v;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    // Ignore quota errors
  }
}

// Curated high quality travel imagery for category fallbacks
const CATEGORY_FALLBACKS = {
  heritage: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600&auto=format&fit=crop&q=80",
  monument: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&auto=format&fit=crop&q=80",
  beach: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&auto=format&fit=crop&q=80",
  nature: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80",
  temple: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80",
  market: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=600&auto=format&fit=crop&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
  lake: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80"
};

export function getCategoryFallbackImage(category = "") {
  const cat = (category || "").toLowerCase();
  for (const [key, url] of Object.entries(CATEGORY_FALLBACKS)) {
    if (cat.includes(key)) return url;
  }
  return CATEGORY_FALLBACKS.default;
}

function cleanPlaceName(name = "") {
  return name
    .replace(/^visit(\s+the)?\s+/i, "")
    .replace(/^explore(\s+the)?\s+/i, "")
    .replace(/^tour(\s+of)?\s+/i, "")
    .replace(/^walk(\s+through)?\s+/i, "")
    .replace(/\s*\([^)]*\)/g, "") // remove parenthetical notes
    .trim();
}

/**
 * Fetch image from Wikipedia Pageimages
 */
async function fetchWikipediaImage(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=1&prop=pageimages|description&pithumbsize=600&format=json&origin=*`;
    
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    if (pages.length > 0 && pages[0]?.thumbnail?.source) {
      return {
        url: pages[0].thumbnail.source,
        title: pages[0].title,
        description: pages[0].description || "",
        source: "Wikipedia",
        author: "Wikimedia Commons",
        license: "CC BY-SA 4.0"
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch image from Wikimedia Commons Search
 */
async function fetchCommonsImage(query) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600&format=json&origin=*`;
    
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const thumb = info?.thumburl || info?.url;
      // Skip SVGs and PDF/audio/video files
      if (thumb && !thumb.toLowerCase().endsWith(".svg") && (thumb.includes(".jpg") || thumb.includes(".jpeg") || thumb.includes(".png") || thumb.includes(".webp"))) {
        const rawArtist = info.extmetadata?.Artist?.value || "";
        const cleanArtist = rawArtist.replace(/<[^>]*>/g, "").trim() || "Wikimedia Contributor";
        const license = info.extmetadata?.LicenseShortName?.value || "CC BY-SA";
        return {
          url: thumb,
          title: page.title.replace(/^File:/i, ""),
          description: "",
          source: "Wikimedia Commons",
          author: cleanArtist,
          license
        };
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Main resolution function
 * Returns { url, source, author, license, isFallback }
 */
export async function resolvePlaceImage(placeName, destination = "", category = "") {
  if (!placeName) {
    return { url: getCategoryFallbackImage(category), isFallback: true };
  }

  const cleanName = cleanPlaceName(placeName);
  const cacheKey = `${cleanName.toLowerCase()}_${(destination || "").toLowerCase()}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // Stage 1: Wikipedia Search (Name + Destination)
  let result = null;
  if (destination) {
    result = await fetchWikipediaImage(`${cleanName} ${destination}`);
  }

  // Stage 1b: Wikipedia Search (Name only)
  if (!result) {
    result = await fetchWikipediaImage(cleanName);
  }

  // Stage 2: Wikimedia Commons Search
  if (!result) {
    result = await fetchCommonsImage(destination ? `${cleanName} ${destination}` : cleanName);
  }

  // Stage 2b: Wikimedia Commons Search (Name only)
  if (!result) {
    result = await fetchCommonsImage(cleanName);
  }

  // Stage 3: Curated thematic category fallback
  if (!result || !result.url) {
    result = {
      url: getCategoryFallbackImage(category),
      source: "Tripzy Curated Collection",
      author: "Unsplash Contributor",
      license: "Free to Use",
      isFallback: true
    };
  } else {
    result.isFallback = false;
  }

  // Save in memory & localStorage
  memoryCache.set(cacheKey, result);
  saveToStorage();

  return result;
}
