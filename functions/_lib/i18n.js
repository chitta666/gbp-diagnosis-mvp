const SUPPORTED_LANGUAGES = new Set(["en", "ja"]);

export function normalizeLanguage(value, fallback = "en") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;

  if (raw === "jp") return "ja";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("en")) return "en";

  return SUPPORTED_LANGUAGES.has(raw) ? raw : fallback;
}

export function parseAcceptLanguage(headerValue) {
  const raw = String(headerValue || "").trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((part) => {
      const [languagePart, ...params] = part.trim().split(";");
      let quality = 1;

      params.forEach((param) => {
        const trimmed = param.trim();
        if (!trimmed.startsWith("q=")) return;
        const parsed = Number(trimmed.slice(2));
        if (Number.isFinite(parsed)) quality = parsed;
      });

      return {
        raw: languagePart || "",
        normalized: normalizeLanguage(languagePart, ""),
        quality,
      };
    })
    .filter((entry) => entry.normalized)
    .sort((a, b) => b.quality - a.quality);
}

export function detectRequestLanguage(request, fallback = "en") {
  const acceptLanguage = parseAcceptLanguage(request?.headers?.get("accept-language"));
  const preferred = acceptLanguage[0]?.normalized || null;
  if (preferred === "ja") {
    return {
      lang: "ja",
      source: "accept_language",
    };
  }

  const country =
    String(
      request?.headers?.get("cf-ipcountry") ||
      request?.cf?.country ||
      ""
    )
      .trim()
      .toUpperCase();

  if (country === "JP") {
    return {
      lang: "ja",
      source: "cf_ipcountry",
    };
  }

  return {
    lang: normalizeLanguage(preferred, fallback),
    source: preferred ? "accept_language" : "fallback",
  };
}

export function resolveRequestLanguage({ request, fallback = "en" }) {
  const url = request ? new URL(request.url) : null;
  const urlLang = normalizeLanguage(url?.searchParams?.get("lang"), "");

  if (urlLang) {
    return {
      lang: urlLang,
      source: "url_param",
    };
  }

  return detectRequestLanguage(request, fallback);
}
