/* ==========================================================================
   My Oracle — Serverless Insight Endpoint (/api/insight.js)
   Runs ONLY on the server (Vercel Serverless or Express server.ts).
   Pulls live Singapore weather, Western daily horoscope, and Zi Wei Dou Shu
   (Purple Star) chart data via /api/live-data.ts, validates and redacts all
   inputs, and synthesizes 3 auspicious activities (with Gemini when configured).
   ========================================================================== */

import { GoogleGenAI, Type } from "@google/genai";
import { fetchAllLiveData, sendJson } from "./live-data.ts";

const ALLOWED_MODES = new Set(["affirm", "inspire"]);
const ALLOWED_SEGMENTS = new Set(["adult", "teen", "elderly"]);
const ALLOWED_REGIONS = new Set(["central", "east", "west", "north", "south"]);

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

  const regionRaw = typeof body.region === "string" ? body.region.trim().toLowerCase() : "central";
  const region = ALLOWED_REGIONS.has(regionRaw) ? regionRaw : "central";

  const location = sanitizeAndRedact(body.location || "Singapore");
  if (location.length > 60) {
    return { valid: false, error: "Location must be 60 characters or fewer." };
  }

  const targetDate = typeof body.targetDate === "string" ? body.targetDate.trim() : "";
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { valid: false, error: "Target date must use YYYY-MM-DD format." };
  }

  const dob = typeof body.dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dob.trim())
    ? body.dob.trim()
    : "";

  let birthHour = "";
  let birthMinute = "";
  if (typeof body.birthTime === "string" && /^\d{2}:\d{2}$/.test(body.birthTime.trim())) {
    const [h, m] = body.birthTime.trim().split(":");
    birthHour = h;
    birthMinute = m;
  }

  const birthPlace = sanitizeAndRedact(body.birthPlace || "Singapore").slice(0, 60);
  const westernSign = sanitizeAndRedact(body.westernSign || "").slice(0, 24);
  const chineseZodiac = sanitizeAndRedact(body.chineseZodiac || "").slice(0, 40);
  const gender = body.gender === "male" ? "male" : "female";

  return {
    valid: true,
    data: {
      mode,
      feeling,
      segment,
      region,
      location,
      targetDate: targetDate || new Date().toISOString().slice(0, 10),
      dob,
      birthHour,
      birthMinute,
      birthPlace,
      westernSign,
      chineseZodiac,
      gender,
    },
  };
}

/**
 * Deterministic fallback reading builder grounded in the live weather,
 * Western horoscope, and Purple Star chart data when Gemini is unavailable.
 */
function buildLiveGroundedReading(context, liveData) {
  const weather = liveData.sources.weather;
  const horoscope = liveData.sources.horoscope;
  const purpleStar = liveData.sources.purpleStar;

  const pools = {
    adult: {
      indoor: [
        {
          title: "Tidy your workspace & map one bold career move",
          category: "Financial & Career Move",
          window: "10:30 – 12:30",
          rationale: "Keeps momentum sharp indoors while showers or midday heat pass outside.",
        },
        {
          title: "Unwind with a quiet kopi or matcha pause at a sheltered cafe",
          category: "Wellness & Recharge",
          window: "14:30 – 16:30",
          rationale: "Creates clear mental space to reflect on priorities without rushing.",
        },
        {
          title: "Send a warm voice note to an ally, colleague, or mentor",
          category: "Social & Networking",
          window: "17:00 – 19:00",
          rationale: "Strengthens supportive relationships effortlessly from anywhere.",
        },
      ],
      outdoor: [
        {
          title: "Morning walk along Marina Barrage or a neighbourhood park connector",
          category: "Wellness & Recharge",
          window: "08:00 – 10:00",
          rationale: "Fresh air and open skies help you reset before midday warmth builds.",
        },
        {
          title: "Coffee catch-up in Tiong Bahru or Joo Chiat",
          category: "Social & Networking",
          window: "11:00 – 13:00",
          rationale: "Lively neighbourhood energy invites timely ideas and good conversations.",
        },
        {
          title: "Browse a gallery or bookstore, then review your monthly savings goal",
          category: "Financial & Career Move",
          window: "15:00 – 17:30",
          rationale: "Blends creative inspiration with grounded financial clarity.",
        },
      ],
    },
    teen: {
      indoor: [
        {
          title: "25-minute focused study sprint with a calm playlist",
          category: "Study & Exam Preps",
          window: "10:00 – 12:00",
          rationale: "Sheltered indoor focus helps concepts stick faster with low stress.",
        },
        {
          title: "Sketch a moodboard or edit a short creative clip indoors",
          category: "Creative & Digital Expressions",
          window: "15:00 – 17:00",
          rationale: "Turns curious energy into something playful you can share.",
        },
        {
          title: "Bubble tea & board games hang at a sheltered mall",
          category: "Social Hangouts & Explorations",
          window: "17:30 – 19:30",
          rationale: "Easy, dry social plans with friends regardless of rain.",
        },
      ],
      outdoor: [
        {
          title: "Cycle or skate along East Coast Park before sunset",
          category: "Sports & Activity Plays",
          window: "17:00 – 18:45",
          rationale: "Breezy coastal air clears screen fatigue and lifts your mood.",
        },
        {
          title: "Photo walk past colourful murals in Haji Lane or Chinatown",
          category: "Creative & Digital Expressions",
          window: "10:00 – 11:45",
          rationale: "Bright daylight brings out crisp details for spontaneous snaps.",
        },
        {
          title: "Library session followed by a hawker lunch with friends",
          category: "Study & Exam Preps",
          window: "12:00 – 14:30",
          rationale: "Balances steady productivity with fun social energy.",
        },
      ],
    },
    elderly: {
      indoor: [
        {
          title: "Gentle indoor stretching & warm herbal tea ritual",
          category: "Health & Gentle Movement",
          window: "09:00 – 10:30",
          rationale: "Keeps joints comfortable indoors when skies turn rainy or humid.",
        },
        {
          title: "Call a family member or share a favourite home recipe",
          category: "Family & Grandparenting",
          window: "14:00 – 16:00",
          rationale: "Brings warmth and joyful connection into your household.",
        },
        {
          title: "Calm reading, calligraphy, or heritage music at home",
          category: "Spiritual & Cultural",
          window: "16:30 – 18:00",
          rationale: "Nurtures steady breath and unhurried peace of mind.",
        },
      ],
      outdoor: [
        {
          title: "Early morning Tai Chi or stroll at Botanic Gardens",
          category: "Outdoor Light Exercises",
          window: "07:30 – 09:00",
          rationale: "Gentle morning air supports circulation and calm vitality.",
        },
        {
          title: "Visit a neighbourhood heritage centre or peaceful temple",
          category: "Spiritual & Cultural",
          window: "09:30 – 11:00",
          rationale: "Aligns naturally with reflective almanac energy for gratitude.",
        },
        {
          title: "Late afternoon tea and fresh fruit market walk",
          category: "Family & Grandparenting",
          window: "16:30 – 18:00",
          rationale: "Pleasant late-day breeze makes errands light and enjoyable.",
        },
      ],
    },
  };

  const chosen = weather.isOutdoorFriendly
    ? pools[context.segment].outdoor
    : pools[context.segment].indoor;

  const starNote = purpleStar.ok && purpleStar.mainStar
    ? `Zi Wei Main Star: ${purpleStar.mainStar.pinyin} (${purpleStar.mainStar.meaning})${purpleStar.bazi?.dayMasterElement ? `, Day Master ${purpleStar.bazi.dayMaster} (${purpleStar.bazi.dayMasterElement})` : ""}.`
    : "";

  const horoNote = horoscope.ok && horoscope.horoscope
    ? `${horoscope.sign} note: ${horoscope.horoscope.split(".")[0]}.`
    : "";

  const weatherFit = weather.ok
    ? `${weather.tempLowC && weather.tempHighC ? `${weather.tempLowC}–${weather.tempHighC}°C` : `${weather.tempC}°C`} · ${weather.condition}`
    : "Singapore Weather";

  const activities = chosen.map((item, idx) => {
    let title = item.title;
    let rationale = [item.rationale, idx === 0 ? horoNote : "", idx === 1 ? starNote : ""]
      .filter(Boolean)
      .join(" ");

    if (context.mode === "affirm" && context.feeling && idx === 0) {
      title = `Green light: ${context.feeling}`;
      rationale = `Your plan aligns well with ${weather.condition.toLowerCase()} conditions (${weather.region}). ${horoNote} ${starNote}`.trim();
    }

    return {
      id: `${Date.now()}-${idx}`,
      rank: `0${idx + 1}`,
      title,
      category: item.category,
      window: item.window,
      weatherFit,
      rationale,
      targetDate: context.targetDate,
    };
  });

  const hues = ["Electric Violet", "Warm Marigold", "Jade Mint", "Crisp Ivory"];
  const luckyHue = hues[(weather.tempC + activities.length) % hues.length];

  return {
    mode: context.mode,
    date: context.targetDate,
    luckyWindow: activities[0].window,
    luckyHue,
    activities,
  };
}

/**
 * Optional Gemini synthesis using @google/genai when GEMINI_API_KEY is available.
 */
async function synthesizeWithGemini(context, liveData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const weather = liveData.sources.weather;
  const horoscope = liveData.sources.horoscope;
  const purpleStar = liveData.sources.purpleStar;

  const prompt = [
    `Generate 3 practical, Singapore-relevant auspicious activities for ${context.targetDate}.`,
    `Mode: ${context.mode}.`,
    context.feeling ? `User mood/intention: "${context.feeling}".` : "Mode is 'inspire': suggest 3 fresh ideas.",
    `Life stage: ${context.segment}. Region/Location: ${context.location} (${weather.region}).`,
    `Live Weather (${weather.ok ? "NEA 24h forecast" : "fallback"}): ${weather.condition}, ${weather.tempLowC ?? weather.tempC}-${weather.tempHighC ?? weather.tempC}°C, outdoorFriendly=${weather.isOutdoorFriendly}.`,
    horoscope.ok ? `Live Western Horoscope (${horoscope.sign}): ${horoscope.horoscope}` : "",
    purpleStar.ok && purpleStar.mainStar
      ? `Live Zi Wei Dou Shu Main Star: ${purpleStar.mainStar.pinyin} (${purpleStar.mainStar.meaning} — ${purpleStar.mainStar.tagline}), BaZi Day Master: ${purpleStar.bazi?.dayMaster} (${purpleStar.bazi?.dayMasterElement}), Lunar Date: ${purpleStar.bazi?.lunarDate}.`
      : "",
    "Rules: Never repeat raw dates of birth, emails, phone numbers, or IDs. Keep titles crisp (< 75 chars) and rationales 1–2 sentences referencing the live weather and astrology.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: prompt,
    config: {
      systemInstruction:
        "You are My Oracle, a playful yet grounded Gen Z Singapore daily auspicious activity guide. Return concise, non-superstitious, plain-English recommendations.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          luckyWindow: { type: Type.STRING },
          luckyHue: { type: Type.STRING },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                window: { type: Type.STRING },
                rationale: { type: Type.STRING },
              },
              required: ["title", "category", "window", "rationale"],
            },
          },
        },
        required: ["luckyWindow", "luckyHue", "activities"],
      },
    },
  });

  const parsed = JSON.parse((response.text || "{}").trim());
  if (!Array.isArray(parsed.activities) || parsed.activities.length === 0) {
    return null;
  }

  const weatherFit = weather.ok
    ? `${weather.tempLowC && weather.tempHighC ? `${weather.tempLowC}–${weather.tempHighC}°C` : `${weather.tempC}°C`} · ${weather.condition}`
    : "Singapore Weather";

  return {
    mode: context.mode,
    date: context.targetDate,
    luckyWindow: String(parsed.luckyWindow || parsed.activities[0].window || "10:30 – 12:30"),
    luckyHue: String(parsed.luckyHue || "Electric Violet"),
    activities: parsed.activities.slice(0, 3).map((act, idx) => ({
      id: `${Date.now()}-${idx}`,
      rank: `0${idx + 1}`,
      title: String(act.title),
      category: String(act.category),
      window: String(act.window),
      weatherFit,
      rationale: String(act.rationale),
      targetDate: context.targetDate,
    })),
  };
}

/**
 * Main serverless request handler for POST /api/insight.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST." });
  }

  const validation = validateRequestBody(req.body);
  if (!validation.valid) {
    return sendJson(res, 400, { ok: false, error: validation.error });
  }

  const ctx = validation.data;
  const liveData = await fetchAllLiveData({
    region: ctx.region,
    sign: ctx.westernSign || "aquarius",
    date: ctx.dob || undefined,
    hour: ctx.birthHour || undefined,
    minute: ctx.birthMinute || undefined,
    gender: ctx.gender,
    birthPlace: ctx.birthPlace,
  });

  let reading = null;
  let aiGenerated = false;
  let source = "live-apis";

  if (process.env.GEMINI_API_KEY) {
    try {
      reading = await synthesizeWithGemini(ctx, liveData);
      if (reading) {
        aiGenerated = true;
        source = "gemini+live-apis";
      }
    } catch (err) {
      console.warn("Gemini synthesis fallback triggered:", err instanceof Error ? err.message : err);
    }
  }

  if (!reading) {
    reading = buildLiveGroundedReading(ctx, liveData);
  }

  return sendJson(res, 200, {
    ok: true,
    aiGenerated,
    source,
    liveData,
    reading,
  });
}
