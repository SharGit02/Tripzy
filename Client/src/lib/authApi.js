// Strip trailing slash(es) so `${API_BASE_URL}/api${path}` never doubles up
// on "//" if VITE_API_URL is set with a trailing slash on the hosting platform.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

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
  if (status === 503) {
    return serverMessage || "The trip planner isn't available right now. Please try again in a moment.";
  }
  if (status >= 500) {
    return serverMessage || "Tripzy ran into a problem on our side. Please try again in a moment.";
  }
  if (serverMessage) {
    return serverMessage;
  }
  return "Something went wrong. Please try again.";
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
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch {
    throw new Error("We couldn't reach Tripzy right now. Check your connection and try again.");
  }
}

export async function request(path, options = {}, { isRetry = false, planFallbackDone = false } = {}) {
  const { response, data } = await rawFetch(path, options);

  // On a 401, transparently try to refresh the session and retry the request
  // once. Whether the retry succeeds or the refresh itself fails, we throw a
  // normal error either way — deciding what a final 401 means (redirect to
  // login vs. degrade quietly) is left to the caller, since some callers are
  // on public pages making a best-effort authenticated call, not gated pages.
  if (response.status === 401 && !isRetry && !AUTH_PATHS_EXEMPT_FROM_REFRESH.includes(path)) {
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

export function fetchFlightFarePrediction(payload) {
  return request("/flight-fare/predict", {
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
export function generateItinerary(payload) {
  return request("/plan/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  let lastData = {};

  for (const url of urls) {
    response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (response.status !== 404) break;
  }

  if (!response.ok) {
    let message = "We couldn't download the itinerary PDF. Please try again.";

    try {
      lastData = await response.json();
      message = lastData.message || flattenApiFieldErrors(lastData) || message;
    } catch {
      // Response wasn't JSON.
    }

    throw new Error(message);
  }

  return response;
}

export function regenerateItinerary(id, modifications) {
  return request(`/plan/${id}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ modifications, preserveStructure: true }),
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