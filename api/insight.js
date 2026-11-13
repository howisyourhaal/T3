/* ==========================================================================
   My Oracle — Vercel Serverless Function Template (/api/insight.js)
   Note for HTML readers:
   This file runs ONLY on the server (Vercel), never in the user's browser.
   That keeps your GEMINI_API_KEY private inside process.env.
   All user inputs are validated here before any AI or external API call runs.
   ========================================================================== */

const ALLOWED_MODES = new Set(["affirm", "inspire"]);
const ALLOWED_SEGMENTS = new Set(["adult", "teen", "elderly"]);

/**
 * Removes personal identifiers (emails, Singapore phone numbers, NRIC patterns)
 * so user personal data is never echoed back or stored in AI prompts.
 */
function sanitizeAndRedact(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\b(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b/g, "[redacted]")
    .replace(/\b[STFG]\d{7}[A-Z]\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates every incoming field from the browser form and returns either
 * a clean validated object or a plain-English error message.
 */
function validateRequestBody(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!ALLOWED_MODES.has(mode)) {
    return { valid: false, error: "Mode must be either 'affirm' or 'inspire'." };
  }

  const feeling = sanitizeAndRedact(body.feeling || "");
  if (mode === "affirm" && feeling.length === 0) {
    return { valid: false, error: "Please enter what you feel like doing today." };
  }
  if (feeling.length > 240) {
    return { valid: false, error: "Feeling input must be 240 characters or fewer." };
  }

  const segment = typeof body.segment === "string" ? body.segment.trim() : "adult";
  if (!ALLOWED_SEGMENTS.has(segment)) {
    return { valid: false, error: "Invalid life stage segment." };
  }

  const location = sanitizeAndRedact(body.location || "Singapore");
  if (location.length > 60) {
    return { valid: false, error: "Location must be 60 characters or fewer." };
  }

  const targetDate = typeof body.targetDate === "string" ? body.targetDate.trim() : "";
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { valid: false, error: "Target date must use YYYY-MM-DD format." };
  }

  const westernSign = sanitizeAndRedact(body.westernSign || "");
  const chineseZodiac = sanitizeAndRedact(body.chineseZodiac || "");

  return {
    valid: true,
    data: {
      mode,
      feeling,
      segment,
      location,
      targetDate,
      westernSign,
      chineseZodiac,
    },
  };
}

/**
 * Main Vercel serverless request handler for POST /api/insight.
 * Reads GEMINI_API_KEY strictly from process.env and never exposes it to clients.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const validation = validateRequestBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Server API key is not configured yet. Front-end preview mode is active.",
    });
  }

  /*
   * UNCERTAINTY & BACKEND INTEGRATION NOTE:
   * External APIs listed in discovery notes (freehoroscopeapi.com and
   * 14mainstars.com) have not been verified against live schemas yet.
   * When connecting the backend later:
   *   1. Verify exact endpoint paths and response JSON fields for weather,
   *      Western horoscope, and Zi Wei Dou Shu APIs before parsing them.
   *   2. Use @google/genai on the server with `apiKey` from process.env.GEMINI_API_KEY
   *      to synthesize the validated context into 3 auspicious activities.
   *   3. Always include `aiGenerated: true` in the response payload.
   */

  return res.status(501).json({
    aiGenerated: true,
    message: "Server-side Gemini and external astrology/weather APIs are not wired yet. Validate input succeeded.",
    validatedContext: validation.data,
  });
}
