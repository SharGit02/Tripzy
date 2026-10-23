/**
 * Returns the URL only if it is an absolute http(s) URL, else null.
 *
 * Itinerary documents carry URLs that came from third parties (SerpApi hotel
 * photos and booking links, Wikimedia place photos) and are then persisted and
 * re-rendered — including on the public share page (/share/:id). Any of those
 * values reaching an `href` or `src` unchecked is an injection sink, so the
 * scheme is validated at the sink, where it cannot be bypassed by a code path
 * that forgets to validate upstream.
 *
 * The server validates these fields too (HttpUrlSchema in itinerary.schema.ts);
 * this is the second half of that pair, not a replacement for it.
 */
export function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    // Not an absolute URL at all.
    return null;
  }
}
