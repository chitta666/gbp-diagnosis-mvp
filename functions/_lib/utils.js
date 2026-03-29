export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function fetchJson(u) {
  const res = await fetch(u);

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`FETCH_FAILED status=${res.status}`);
  }

  if (!ct.includes("application/json")) {
    throw new Error(`NOT_JSON content-type=${ct}`);
  }

  return JSON.parse(text);
}

export function mapGooglePlacesApiError({ status, errorMessage } = {}) {
  const upstreamStatus = String(status || "").trim() || null;
  const upstreamErrorMessage = String(errorMessage || "").trim() || null;
  const details = String(upstreamErrorMessage || "").toLowerCase();

  if (upstreamStatus === "OK") return null;

  if (upstreamStatus === "ZERO_RESULTS") {
    return {
      code: "PLACE_NOT_FOUND",
      message: "We couldn't find that business. Try the business name with the full address.",
      hint: "Try the business name with the full address.",
      httpStatus: 404,
      upstreamStatus,
      upstreamErrorMessage,
    };
  }

  if (upstreamStatus === "INVALID_REQUEST") {
    return {
      code: "BAD_INPUT",
      message: "The business query is incomplete. Enter a business name and address.",
      hint: "Enter a business name and address.",
      httpStatus: 400,
      upstreamStatus,
      upstreamErrorMessage,
    };
  }

  if (upstreamStatus === "OVER_QUERY_LIMIT") {
    return {
      code: "OVER_QUERY_LIMIT",
      message: "Google Maps quota has been reached. Please try again later.",
      hint: "Check the Google Maps quota and daily limits for this project.",
      httpStatus: 429,
      upstreamStatus,
      upstreamErrorMessage,
    };
  }

  if (upstreamStatus === "REQUEST_DENIED") {
    if (details.includes("billing")) {
      return {
        code: "BILLING_NOT_ENABLED",
        message: "Google Maps access is blocked because billing is not enabled for this project.",
        hint: "Enable billing for the Google Cloud project used by this API key.",
        httpStatus: 503,
        upstreamStatus,
        upstreamErrorMessage,
      };
    }

    if (
      details.includes("not authorized to use this api") ||
      details.includes("api project is not authorized") ||
      details.includes("api has not been used") ||
      details.includes("must enable")
    ) {
      return {
        code: "PLACES_API_DISABLED",
        message:
          "Google Maps access is blocked because the required Places API is not enabled for this project.",
        hint: "Enable the required Places API for the Google Cloud project used by this API key.",
        httpStatus: 503,
        upstreamStatus,
        upstreamErrorMessage,
      };
    }

    return {
      code: "API_DENIED",
      message:
        "Google Maps access is denied. Check billing, Places API enablement, and API key restrictions.",
      hint: "Verify billing, Places API enablement, and API key restrictions for the Google Cloud project.",
      httpStatus: 503,
      upstreamStatus,
      upstreamErrorMessage,
    };
  }

  if (upstreamStatus === "UNKNOWN_ERROR") {
    return {
      code: "UPSTREAM_TEMPORARY",
      message: "Google Maps returned a temporary error. Please try again.",
      hint: "Retry after a short wait.",
      httpStatus: 502,
      upstreamStatus,
      upstreamErrorMessage,
    };
  }

  return {
    code: "PLACES_LOOKUP_FAILED",
    message: "Google Maps lookup failed.",
    hint: "Check the Google Maps API response and project restrictions.",
    httpStatus: 502,
    upstreamStatus,
    upstreamErrorMessage,
  };
}

export function mapGooglePlacesTransportError(error) {
  return {
    code: "GOOGLE_FETCH_FAILED",
    message: "Google Maps request failed before a valid response was returned.",
    hint: "Check upstream connectivity and the Google Maps project configuration for this API key.",
    httpStatus: 502,
    upstreamStatus: null,
    upstreamErrorMessage: error?.message || String(error),
  };
}

export function looksLikeUrl(s) {
  return /^https?:\/\//i.test(s);
}

export async function expandUrl(u) {
  try {
    const res = await fetch(u, { redirect: "follow" });
    return res.url || u;
  } catch {
    return u;
  }
}
