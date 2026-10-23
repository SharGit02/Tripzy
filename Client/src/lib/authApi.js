// Use relative URL in production to leverage Vercel rewrites (avoids cross-domain cookie issues)
const isProd = import.meta.env.MODE === "production";
const API_BASE_URL = isProd ? "" : (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

// Render free/starter instances spin down when idle and can take ~30-50s to
// wake, so the first request after a quiet period is slow rather than broken.
const REQUEST_TIMEOUT_MS = 50_000;

const AUTH_PATHS_EXEMPT_FROM_REFRESH = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout"];

function flattenApiFieldErrors(data) {
  const errors = data?.errors;
  if (!errors || typeof errors !== "object") return "";
  return Object.values(errors)
    .flat()
    .filter((msg) => typeof msg === "string" && msg.trim())
    .join(" ");
}

function toUserError(path, status, data) {
  const fieldMessage = flattenApiFieldErrors(data);
  const serverMessage =
    typeof data?.message === "string" && data.message.trim() && data.message !== "Request failed." && data.message !== "Invalid input"
      ? data.message.trim()
      : "";

  if (status === 401 && path === "/auth/login") {
    return "That email or password doesn't match our records.";
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 409) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (status === 400 || status === 422) {
    return fieldMessage || serverMessage || "Please check the trip details you entered and try again.";
  }
  if (status === 404) {
    return serverMessage || "We couldn't find that on the server. Please try again.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (status === 502 || status === 504) {
    return "Our server isn't responding yet. It may still be starting up — please try again in a moment.";
  }
  if (status === 503) {
    return serverMessage || "Our server is temporarily unavailable. Please try again in a moment.";
  }
  if (status >= 500) {
    return serverMessage || "Tripzy ran into a problem on our side. Please try again in a moment.";
  }
  if (serverMessage) {
    return serverMessage;
  }
  return "Something went wrong. Please try again.";
}

function toNetworkError(error) {
  // AbortSignal.timeout fires a TimeoutError; an explicit abort fires AbortError.
  if (error?.name === "TimeoutError") {
    return new Error(
      `Our server took too long to respond (over ${Math.round(
        REQUEST_TIMEOUT_MS / 1000
      )}s). It may be waking up from idle — please try again.`
    );
  }
  if (error?.name === "AbortError") {
    return new Error("That request was cancelled. Please try again.");
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new Error("You appear to be offline. Check your internet connection and try again.");
  }
  // fetch() rejects with a TypeError for DNS failures, refused connections,
  // TLS problems and CORS blocks — from the browser they're indistinguishable.
  return new Error("We couldn't reach the Tripzy server. It may be down or restarting — please try again shortly.");
}

async function rawFetch(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
      ...options,
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    throw toNetworkError(error);
  }
}

export async function request(path, options = {}, { isRetry = false, planFallbackDone = false } = {}) {
  const { response, data } = await rawFetch(path, options);

  // On a 401, transparently try to refresh the session and retry the request
  // once. Whether the retry succeeds or the refresh itself fails, we throw a
  // normal error either way — deciding what a final 401 means (redirect to
  // login vs. degrade quietly) is left to the caller, since some callers are
  // on public pages making a best-effort authenticated call, not gated pages.
  if (
    response.status === 401 &&
    !isRetry &&
    !AUTH_PATHS_EXEMPT_FROM_REFRESH.includes(path) &&
    !path.includes("/public")
  ) {
    const { response: refreshResponse } = await rawFetch("/auth/refresh", { method: "POST" });

    if (refreshResponse.ok) {
      return request(path, options, { isRetry: true, planFallbackDone });
    }
  }

  // Older API images only mount itinerary routes at /api/itinerary.
  if (response.status === 404 && !planFallbackDone && path.startsWith("/plan")) {
    const rest = path.slice("/plan".length);
    return request(`/itinerary${rest}`, options, { isRetry, planFallbackDone: true });
  }

  if (!response.ok) {
    throw new Error(toUserError(path, response.status, data));
  }

  return data;
}

export function loginUser(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signupUser(payload) {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser() {
  return request("/auth/me");
}

export function logoutUser() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export function fetchUserProfile() {
  return request("/users/profile");
}

export function updateUserProfile(payload) {
  return request("/users/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function fetchBookings() {
  return request("/bookings");
}

export function deleteBooking(id) {
  return request(`/bookings/${id}`, {
    method: "DELETE",
  });
}

export function fetchSearchHistory() {
  return request("/search-history");
}

export function createSearchHistory(payload) {
  return request("/search-history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchWeather(city) {
  return request(`/weather?city=${encodeURIComponent(city)}`);
}

export function fetchHotels({ destination, checkIn, checkOut, adults = 2 }) {
  const params = new URLSearchParams({
    destination,
    checkIn,
    checkOut,
    adults: String(adults),
  });
  return request(`/hotels?${params.toString()}`);
}

export function fetchFlightFarePrediction(payload) {
  return request("/flight-fare/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Rail fares are not persisted server-side (no history endpoint): the chosen
// train is stored inside the itinerary's selections instead.
export function fetchRailFarePrediction(payload) {
  return request("/rail-fare/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Same deal as rail: not persisted server-side, the chosen bus lives in the
// itinerary's selections instead.
export function fetchBusFarePrediction(payload) {
  return request("/bus-fare/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchFlightFareHistory() {
  return request("/flight-fare/history");
}

export function fetchFlightFarePredictionById(id) {
  return request(`/flight-fare/${id}`);
}

// Itinerary API functions - Direct generation only
export function createBooking(payload) {
  return request("/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPublicItinerary(id) {
  return request(`/plan/${id}/public`);
}

export function generateItinerary(payload) {
  return request("/plan/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Streams generation progress as Server-Sent Events. EventSource can't send a
// POST body, so the response is read as a stream directly; `onProgress` fires
// for every `{stage}` event, and the returned promise resolves with the final
// `{stage:"done", itineraryId, itinerary, ...}` event, or rejects on a
// `{stage:"error"}` event, a non-2xx response, or a network failure.
export async function generateItineraryStream(payload, onProgress) {
  const run = async (isRetry = false) => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw toNetworkError(error);
    }

    if (response.status === 401 && !isRetry) {
      const refreshed = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
      if (refreshed?.ok) return run(true);
    }

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw new Error(toUserError("/plan/generate", response.status, data));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalEvent = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        const event = JSON.parse(dataLine.slice(5).trim());
        if (event.stage === "error") {
          throw new Error(event.message || "Failed to generate itinerary. Please try again.");
        }
        if (event.stage === "done") finalEvent = event;
        onProgress?.(event);
      }
    }

    if (!finalEvent) {
      throw new Error("The connection closed before the itinerary finished. Please try again.");
    }
    return finalEvent;
  };

  return run();
}

export function fetchItineraries(limit = 20, offset = 0) {
  return request(`/plan?limit=${limit}&offset=${offset}`);
}

export function fetchItineraryById(id) {
  return request(`/plan/${id}`);
}

export async function downloadItineraryPdf(id) {
  const urls = [`${API_BASE_URL}/api/plan/${id}/pdf`, `${API_BASE_URL}/api/itinerary/${id}/pdf`];
  let response;

  for (const url of urls) {
    try {
      response = await fetch(url, {
        method: "GET",
        credentials: "include",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw toNetworkError(error);
    }
    if (response.status !== 404) break;
  }

  if (!response.ok) {
    let message = "We couldn't download the itinerary PDF. Please try again.";

    try {
      const data = await response.json();
      message = data.message || flattenApiFieldErrors(data) || message;
    } catch {
      // Response wasn't JSON.
    }

    throw new Error(message);
  }

  return response;
}

export function emailItineraryPdf(id) {
  return request(`/plan/${id}/email-pdf`, {
    method: "POST",
  });
}

export function regenerateItinerary(id, modifications) {
  return request(`/plan/${id}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ modifications, preserveStructure: true }),
  });
}

// Which items the traveler ticked. Patched on its own so toggling one checkbox
// never round-trips the whole itinerary document.
export function saveItinerarySelections(id, selections) {
  return request(`/plan/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ selections }),
  });
}

export function updateItinerary(id, fields) {
  return request(`/plan/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export function deleteItinerary(id) {
  return request(`/plan/${id}`, {
    method: "DELETE",
  });
}