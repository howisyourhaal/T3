import {
  DATA_SOURCE_ENDPOINTS,
  parseQueryParams,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "./live-data.ts";

interface ProbeResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  url: string;
  error?: string;
}

async function probeEndpoint(url: string, timeoutMs = 5000): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "MyOracleHealthCheck/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - start,
      url,
      ...(response.ok ? {} : { error: `HTTP ${response.status} ${response.statusText}` }),
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - start,
      url,
      error: err instanceof Error ? err.message : "Upstream unreachable",
    };
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { ok: false, error: "Method not allowed. Use GET." });
    return;
  }

  const query = parseQueryParams(req);
  const shouldProbe = query.probe === "true" || query.probe === "1" || query.deep === "true";

  const basePayload = {
    ok: true,
    status: "healthy" as "healthy" | "degraded",
    service: "my-oracle-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime() * 100) / 100,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    endpoints: {
      weather: DATA_SOURCE_ENDPOINTS.weather,
      horoscope: `${DATA_SOURCE_ENDPOINTS.horoscope}?sign=aquarius`,
      purpleStar: `${DATA_SOURCE_ENDPOINTS.purpleStar}?date=1993-11-04&hour=21&minute=15&gender=female&cityId=kl&lang=en`,
    },
  };

  if (!shouldProbe) {
    sendJson(res, 200, basePayload);
    return;
  }

  const [weather, horoscope, purpleStar] = await Promise.all([
    probeEndpoint(basePayload.endpoints.weather),
    probeEndpoint(basePayload.endpoints.horoscope),
    probeEndpoint(basePayload.endpoints.purpleStar),
  ]);

  const allHealthy = weather.ok && horoscope.ok && purpleStar.ok;

  sendJson(res, 200, {
    ...basePayload,
    ok: allHealthy,
    status: allHealthy ? "healthy" : "degraded",
    upstream: {
      weather,
      horoscope,
      purpleStar,
    },
  });
}
