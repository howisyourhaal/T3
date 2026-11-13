import type { IncomingMessage, ServerResponse } from "node:http";

export const DATA_SOURCE_ENDPOINTS = {
  weather: "https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast",
  horoscope: "https://freehoroscopeapi.com/api/v1/get-horoscope/daily",
  purpleStar: "https://www.14mainstars.com/api/public/chart",
} as const;

export const ALLOWED_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;

export type ZodiacSign = (typeof ALLOWED_SIGNS)[number];
export type SgRegion = "central" | "east" | "west" | "north" | "south";

export interface ApiRequest extends IncomingMessage {
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => ApiResponse | void;
}

export interface NormalizedWeather {
  ok: boolean;
  sourceUrl: string;
  region: SgRegion;
  date: string;
  updatedAt: string;
  validPeriod: string;
  periodLabel: string;
  code: string;
  condition: string;
  tempLowC: number | null;
  tempHighC: number | null;
  tempC: number;
  humidityLow: number | null;
  humidityHigh: number | null;
  windDirection: string;
  windSpeedRange: string;
  isOutdoorFriendly: boolean;
  advice: string;
  error?: string;
}

export interface NormalizedHoroscope {
  ok: boolean;
  sourceUrl: string;
  sign: string;
  date: string;
  period: string;
  horoscope: string;
  error?: string;
}

export interface NormalizedPurpleStar {
  ok: boolean;
  sourceUrl: string;
  usingDefaultSample: boolean;
  city: {
    id: string;
    name: string;
    nameEn: string;
  };
  trueSolarTime: string;
  mainStar: {
    zh: string;
    pinyin: string;
    meaning: string;
    tagline: string;
    rarity: string;
  } | null;
  companionStars: Array<{ zh: string; pinyin: string }>;
  selfPalace: {
    name: string;
    branch: string;
    ganzhi: string;
    mainStars: string[];
  } | null;
  careerPalace: {
    name: string;
    branch: string;
    ganzhi: string;
    mainStars: string[];
  } | null;
  wealthPalace: {
    name: string;
    branch: string;
    ganzhi: string;
    mainStars: string[];
  } | null;
  bazi: {
    dayMaster: string;
    dayMasterElement: string;
    lunarDate: string;
    fourPillars: Record<string, string>;
    elementCount: Record<string, number>;
  } | null;
  provenance: string;
  disclaimer: string;
  error?: string;
}

export interface LiveDataRequestParams {
  region?: string;
  sign?: string;
  date?: string;
  hour?: number | string;
  minute?: number | string;
  gender?: string;
  cityId?: string;
  birthPlace?: string;
}

export interface LiveDataBundle {
  ok: boolean;
  fetchedAt: string;
  partial: boolean;
  sources: {
    weather: NormalizedWeather;
    horoscope: NormalizedHoroscope;
    purpleStar: NormalizedPurpleStar;
  };
  errors: Record<string, string>;
}

export function sendJson(res: ApiResponse, statusCode: number, payload: unknown): void {
  if (typeof res.status === "function" && typeof res.json === "function") {
    const nextRes = res.status(statusCode);
    if (nextRes && typeof nextRes.json === "function") {
      nextRes.json(payload);
      return;
    }
    res.json(payload);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function parseQueryParams(req: ApiRequest): Record<string, string> {
  const result: Record<string, string> = {};
  if (req.query && typeof req.query === "object") {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") {
        result[k] = v;
      } else if (Array.isArray(v) && typeof v[0] === "string") {
        result[k] = v[0];
      }
    }
    return result;
  }
  if (req.url) {
    const url = new URL(req.url, "http://localhost");
    url.searchParams.forEach((value, key) => {
      result[key] = value;
    });
  }
  return result;
}

export function normalizeRegion(raw?: string): SgRegion {
  const val = (raw || "").trim().toLowerCase();
  if (val === "east" || val === "west" || val === "north" || val === "south" || val === "central") {
    return val;
  }
  return "central";
}

export function normalizeSign(raw?: string): ZodiacSign {
  const val = (raw || "").trim().toLowerCase();
  if ((ALLOWED_SIGNS as readonly string[]).includes(val)) {
    return val as ZodiacSign;
  }
  return "aquarius";
}

export function resolveCityId(rawCityId?: string, rawBirthPlace?: string): string {
  const direct = (rawCityId || "").trim().toLowerCase();
  if (/^[a-z0-9-]{2,24}$/.test(direct)) {
    if (direct === "singapore") return "sg";
    if (direct === "kuala-lumpur") return "kl";
    return direct;
  }

  const place = (rawBirthPlace || "").trim().toLowerCase();
  if (!place) return "kl";
  if (place.includes("singapore") || place === "sg") return "sg";
  if (place.includes("kuala lumpur") || place === "kl") return "kl";
  if (place.includes("petaling jaya") || place === "pj") return "pj";
  if (place.includes("johor") || place === "jb") return "jb";
  if (place.includes("penang")) return "penang";
  if (place.includes("hong kong") || place === "hk") return "hk";
  if (place.includes("taipei")) return "tw-taipei";
  if (place.includes("shanghai")) return "shanghai";
  if (place.includes("beijing")) return "beijing";
  return "sg";
}

function isRainyOrStormy(code: string, text: string): boolean {
  const c = code.toUpperCase();
  const t = text.toLowerCase();
  const rainyCodes = new Set(["TL", "TS", "TH", "RA", "LR", "MR", "HR", "SH", "LS", "HS", "DR", "WR", "SR"]);
  if (rainyCodes.has(c)) return true;
  return (
    t.includes("rain") ||
    t.includes("shower") ||
    t.includes("thunder") ||
    t.includes("storm") ||
    t.includes("drizzle")
  );
}

function buildWeatherAdvice(condition: string, isOutdoorFriendly: boolean, tempHigh: number | null): string {
  if (!isOutdoorFriendly) {
    return `${condition} expected—prioritise sheltered cafes, indoor reset tasks, or keep a compact umbrella handy.`;
  }
  if (tempHigh !== null && tempHigh >= 34) {
    return `${condition} with warm highs (${tempHigh}°C). Best for morning walks or shaded spots after 5 PM.`;
  }
  return `${condition} ahead—great window for neighbourhood walks, outdoor errands, or breezy cafe catch-ups.`;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 7000): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "MyOracleServerless/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchWeatherForecast(regionInput?: string): Promise<NormalizedWeather> {
  const region = normalizeRegion(regionInput);
  const url = DATA_SOURCE_ENDPOINTS.weather;

  try {
    const raw = (await fetchJsonWithTimeout(url)) as {
      code?: number;
      errorMsg?: string;
      data?: {
        records?: Array<{
          date?: string;
          updatedTimestamp?: string;
          periods?: Array<{
            regions?: Record<string, { code?: string; text?: string }>;
            timePeriod?: { start?: string; end?: string; text?: string };
          }>;
          general?: {
            forecast?: { code?: string; text?: string };
            relativeHumidity?: { high?: number; low?: number };
            temperature?: { high?: number; low?: number };
            validPeriod?: { text?: string };
            wind?: { direction?: string; speed?: { high?: number; low?: number } };
          };
        }>;
      };
    };

    const record = raw?.data?.records?.[0];
    if (!record) {
      throw new Error(raw?.errorMsg || "Weather API returned no forecast records.");
    }

    const nowMs = Date.now();
    const periods = Array.isArray(record.periods) ? record.periods : [];
    const activePeriod =
      periods.find((p) => {
        const start = p.timePeriod?.start ? Date.parse(p.timePeriod.start) : NaN;
        const end = p.timePeriod?.end ? Date.parse(p.timePeriod.end) : NaN;
        return Number.isFinite(start) && Number.isFinite(end) && nowMs >= start && nowMs <= end;
      }) || periods[0];

    const regionForecast = activePeriod?.regions?.[region] || record.general?.forecast;
    const code = String(regionForecast?.code || record.general?.forecast?.code || "");
    const condition = String(regionForecast?.text || record.general?.forecast?.text || "Partly Cloudy");

    const tempLow = typeof record.general?.temperature?.low === "number" ? record.general.temperature.low : null;
    const tempHigh = typeof record.general?.temperature?.high === "number" ? record.general.temperature.high : null;
    const tempC =
      tempLow !== null && tempHigh !== null
        ? Math.round((tempLow + tempHigh) / 2)
        : tempHigh ?? tempLow ?? 30;

    const humLow =
      typeof record.general?.relativeHumidity?.low === "number" ? record.general.relativeHumidity.low : null;
    const humHigh =
      typeof record.general?.relativeHumidity?.high === "number" ? record.general.relativeHumidity.high : null;

    const windDir = String(record.general?.wind?.direction || "");
    const windLow = record.general?.wind?.speed?.low;
    const windHigh = record.general?.wind?.speed?.high;
    const windSpeedRange =
      typeof windLow === "number" && typeof windHigh === "number" ? `${windLow}–${windHigh} km/h` : "";

    const outdoorFriendly = !isRainyOrStormy(code, condition);

    return {
      ok: true,
      sourceUrl: url,
      region,
      date: String(record.date || ""),
      updatedAt: String(record.updatedTimestamp || ""),
      validPeriod: String(record.general?.validPeriod?.text || ""),
      periodLabel: String(activePeriod?.timePeriod?.text || ""),
      code,
      condition,
      tempLowC: tempLow,
      tempHighC: tempHigh,
      tempC,
      humidityLow: humLow,
      humidityHigh: humHigh,
      windDirection: windDir,
      windSpeedRange,
      isOutdoorFriendly: outdoorFriendly,
      advice: buildWeatherAdvice(condition, outdoorFriendly, tempHigh),
    };
  } catch (err) {
    return {
      ok: false,
      sourceUrl: url,
      region,
      date: "",
      updatedAt: "",
      validPeriod: "",
      periodLabel: "",
      code: "",
      condition: "Unavailable",
      tempLowC: null,
      tempHighC: null,
      tempC: 30,
      humidityLow: null,
      humidityHigh: null,
      windDirection: "",
      windSpeedRange: "",
      isOutdoorFriendly: true,
      advice: "Live weather feed temporarily unavailable.",
      error: err instanceof Error ? err.message : "Failed to load Singapore weather forecast.",
    };
  }
}

export async function fetchDailyHoroscope(signInput?: string): Promise<NormalizedHoroscope> {
  const sign = normalizeSign(signInput);
  const url = `${DATA_SOURCE_ENDPOINTS.horoscope}?sign=${encodeURIComponent(sign)}`;

  try {
    const raw = (await fetchJsonWithTimeout(url)) as {
      data?: {
        date?: string;
        period?: string;
        sign?: string;
        horoscope?: string;
      };
    };

    const data = raw?.data;
    if (!data || typeof data.horoscope !== "string") {
      throw new Error("Horoscope API returned an unexpected payload.");
    }

    return {
      ok: true,
      sourceUrl: url,
      sign: String(data.sign || sign),
      date: String(data.date || ""),
      period: String(data.period || "daily"),
      horoscope: data.horoscope.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      sourceUrl: url,
      sign,
      date: "",
      period: "daily",
      horoscope: "",
      error: err instanceof Error ? err.message : "Failed to load daily horoscope.",
    };
  }
}

export async function fetchPurpleStarChart(params: {
  date?: string;
  hour?: number | string;
  minute?: number | string;
  gender?: string;
  cityId?: string;
  birthPlace?: string;
}): Promise<NormalizedPurpleStar> {
  const hasCustomDate = Boolean(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date.trim()));
  const date = hasCustomDate ? params.date!.trim() : "1993-11-04";

  const parsedHour = Number(params.hour);
  const hour = Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour <= 23 ? parsedHour : 21;

  const parsedMinute = Number(params.minute);
  const minute = Number.isInteger(parsedMinute) && parsedMinute >= 0 && parsedMinute <= 59 ? parsedMinute : 15;

  const gender = params.gender === "male" ? "male" : "female";
  const cityId = resolveCityId(params.cityId, params.birthPlace || (hasCustomDate ? "Singapore" : "Kuala Lumpur"));

  const qs = new URLSearchParams({
    date,
    hour: String(hour),
    minute: String(minute),
    gender,
    cityId,
    lang: "en",
  });
  const url = `${DATA_SOURCE_ENDPOINTS.purpleStar}?${qs.toString()}`;

  try {
    const raw = (await fetchJsonWithTimeout(url)) as {
      ok?: boolean;
      error?: string;
      trueSolarTime?: string;
      city?: { id?: string; name?: string; nameEn?: string };
      ziwei?: {
        mainStar?: {
          zh?: string;
          pinyin?: string;
          meaning?: string;
          tagline?: string;
          rarity?: string;
        };
        companionStars?: Array<{ zh?: string; pinyin?: string }>;
        palaces?: Array<{
          name?: string;
          branch?: string;
          ganzhi?: string;
          mainStars?: string[];
        }>;
      };
      bazi?: {
        fourPillars?: Record<string, string>;
        dayMaster?: string;
        dayMasterElement?: string;
        elementCount?: Record<string, number>;
        lunarDate?: string;
      };
      provenance?: string;
      disclaimer?: string;
    };

    if (!raw?.ok) {
      throw new Error(raw?.error || "Purple Star API returned an error.");
    }

    const palaces = Array.isArray(raw.ziwei?.palaces) ? raw.ziwei!.palaces : [];
    const pickPalace = (zhName: string) => {
      const p = palaces.find((item) => item.name === zhName);
      if (!p) return null;
      return {
        name: String(p.name || ""),
        branch: String(p.branch || ""),
        ganzhi: String(p.ganzhi || ""),
        mainStars: Array.isArray(p.mainStars) ? p.mainStars.map(String) : [],
      };
    };

    return {
      ok: true,
      sourceUrl: url,
      usingDefaultSample: !hasCustomDate,
      city: {
        id: String(raw.city?.id || cityId),
        name: String(raw.city?.name || ""),
        nameEn: String(raw.city?.nameEn || cityId),
      },
      trueSolarTime: String(raw.trueSolarTime || ""),
      mainStar: raw.ziwei?.mainStar
        ? {
            zh: String(raw.ziwei.mainStar.zh || ""),
            pinyin: String(raw.ziwei.mainStar.pinyin || ""),
            meaning: String(raw.ziwei.mainStar.meaning || ""),
            tagline: String(raw.ziwei.mainStar.tagline || ""),
            rarity: String(raw.ziwei.mainStar.rarity || ""),
          }
        : null,
      companionStars: Array.isArray(raw.ziwei?.companionStars)
        ? raw.ziwei!.companionStars.map((s) => ({
            zh: String(s.zh || ""),
            pinyin: String(s.pinyin || ""),
          }))
        : [],
      selfPalace: pickPalace("命宫"),
      careerPalace: pickPalace("官禄"),
      wealthPalace: pickPalace("财帛"),
      bazi: raw.bazi
        ? {
            dayMaster: String(raw.bazi.dayMaster || ""),
            dayMasterElement: String(raw.bazi.dayMasterElement || ""),
            lunarDate: String(raw.bazi.lunarDate || ""),
            fourPillars: raw.bazi.fourPillars || {},
            elementCount: raw.bazi.elementCount || {},
          }
        : null,
      provenance: String(raw.provenance || ""),
      disclaimer: String(raw.disclaimer || ""),
    };
  } catch (err) {
    return {
      ok: false,
      sourceUrl: url,
      usingDefaultSample: !hasCustomDate,
      city: { id: cityId, name: "", nameEn: cityId },
      trueSolarTime: "",
      mainStar: null,
      companionStars: [],
      selfPalace: null,
      careerPalace: null,
      wealthPalace: null,
      bazi: null,
      provenance: "",
      disclaimer: "",
      error: err instanceof Error ? err.message : "Failed to load Zi Wei Dou Shu chart.",
    };
  }
}

export async function fetchAllLiveData(params: LiveDataRequestParams = {}): Promise<LiveDataBundle> {
  const [weather, horoscope, purpleStar] = await Promise.all([
    fetchWeatherForecast(params.region),
    fetchDailyHoroscope(params.sign),
    fetchPurpleStarChart({
      date: params.date,
      hour: params.hour,
      minute: params.minute,
      gender: params.gender,
      cityId: params.cityId,
      birthPlace: params.birthPlace,
    }),
  ]);

  const errors: Record<string, string> = {};
  if (!weather.ok && weather.error) errors.weather = weather.error;
  if (!horoscope.ok && horoscope.error) errors.horoscope = horoscope.error;
  if (!purpleStar.ok && purpleStar.error) errors.purpleStar = purpleStar.error;

  const anyOk = weather.ok || horoscope.ok || purpleStar.ok;
  const allOk = weather.ok && horoscope.ok && purpleStar.ok;

  return {
    ok: anyOk,
    fetchedAt: new Date().toISOString(),
    partial: anyOk && !allOk,
    sources: {
      weather,
      horoscope,
      purpleStar,
    },
    errors,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { ok: false, error: "Method not allowed. Use GET or POST." });
    return;
  }

  const query = parseQueryParams(req);
  const body = req.method === "POST" && req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>)
    : {};

  const pickParam = (key: string): string | undefined => {
    const bVal = body[key];
    if (typeof bVal === "string" || typeof bVal === "number") return String(bVal);
    return query[key];
  };

  const bundle = await fetchAllLiveData({
    region: pickParam("region"),
    sign: pickParam("sign"),
    date: pickParam("date"),
    hour: pickParam("hour"),
    minute: pickParam("minute"),
    gender: pickParam("gender"),
    cityId: pickParam("cityId"),
    birthPlace: pickParam("birthPlace"),
  });

  const statusCode = bundle.ok ? 200 : 502;
  sendJson(res, statusCode, bundle);
}
