/* ==========================================================================
   My Oracle — Client-Side Front-End Logic (Vanilla JavaScript)
   Note for HTML readers:
   This file listens for clicks and form submissions from index.html, updates
   the visible HTML text on the page, and saves your demo profile & coin
   wallet inside your browser's localStorage. No external APIs are called yet.
   ========================================================================== */

const STORAGE_KEY = "my_oracle_app_state_v1";

/**
 * Sample weather states for Singapore neighbourhoods so users can preview
 * how different weather conditions reshape today's top 3 auspicious activities.
 */
const WEATHER_PRESETS = [
  {
    id: "partly-cloudy",
    tempC: 31,
    condition: "Partly Cloudy · Breezy",
    advice: "Great for breezy walks before 4 PM; carry a compact umbrella.",
    isOutdoorFriendly: true,
  },
  {
    id: "sunny",
    tempC: 33,
    condition: "Sunny · High UV",
    advice: "Best to stay indoors between 12 PM and 3 PM; seek shaded cafes.",
    isOutdoorFriendly: false,
  },
  {
    id: "rainy",
    tempC: 27,
    condition: "Afternoon Thundershowers",
    advice: "Cosy indoor focus wins today—museums, home resets, or warm kopi.",
    isOutdoorFriendly: false,
  },
  {
    id: "cool-evening",
    tempC: 26,
    condition: "Cool & Clear Skies",
    advice: "Ideal weather for park connectors, outdoor dining, or evening strolls.",
    isOutdoorFriendly: true,
  },
];

const LOCATION_LABELS = {
  central: "Singapore · Central",
  east: "Singapore · East Coast",
  west: "Singapore · West",
  north: "Singapore · North",
  south: "Singapore · South",
  custom: "Custom Location",
};

const BUNDLES = {
  15: { coins: 15, price: "2.90" },
  50: { coins: 50, price: "7.90" },
  120: { coins: 120, price: "14.90" },
};

/**
 * Loads saved user state from browser localStorage, or returns fresh starter data.
 * Think of this as opening the user's notebook when the HTML page loads.
 */
function loadInitialState() {
  const todayStr = getTodayDateString();
  const fallback = {
    activeView: "today",
    user: {
      signedIn: false,
      name: "Guest",
      email: "",
      dob: "",
      birthTime: "",
      birthPlace: "Singapore",
      segment: "adult",
      interests: ["career", "wellness"],
    },
    locationKey: "central",
    customLocation: "",
    weatherIndex: 0,
    coins: 12,
    lastCheckInDate: "",
    selectedBundleCoins: 15,
    paymentMethod: "card",
    trackerFilter: "all",
    lastReading: null,
    ledger: [
      {
        id: "starter-bonus",
        date: todayStr,
        label: "Welcome starter coins",
        delta: 12,
      },
    ],
    trackedActivities: [],
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      lastReading: null,
      user: { ...fallback.user, ...(parsed.user || {}) },
    };
  } catch {
    return fallback;
  }
}

let appState = loadInitialState();
let lastFocusedElement = null;
let isAstroPanelOpen = false;
let liveContextState = {
  useLiveWeather: true,
  isLoadingLive: false,
  weather: null,
  horoscope: null,
  purpleStar: null,
  lastFetchedAt: "",
};

/**
 * Saves the current appState object into the browser's localStorage so refreshes
 * keep the user's coins, birthday chart, and tracked activities.
 */
function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch {
    // Ignore storage quota errors in restricted browsing modes
  }
}

/**
 * Returns today's calendar date as YYYY-MM-DD so date inputs and daily check-ins match.
 */
function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formats a YYYY-MM-DD date string into a friendly Singapore-style label
 * such as "Fri, 13 Nov 2026".
 */
function formatReadableDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return "Today";
  }
  const [y, m, d] = dateString.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Reads the current local time of day so "Inspire Me" recommends activities
 * and time windows that make sense from right now onward.
 */
function getTimeOfDayContext() {
  const now = new Date();
  const hour = now.getHours();
  const formattedTime = now.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (hour >= 5 && hour < 12) {
    return {
      period: "morning",
      label: "Morning",
      formattedTime,
      windows: ["09:30 – 11:30", "11:30 – 13:30", "15:00 – 17:00"],
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      period: "afternoon",
      label: "Afternoon",
      formattedTime,
      windows: ["14:00 – 16:00", "16:30 – 18:30", "19:00 – 20:30"],
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      period: "evening",
      label: "Evening",
      formattedTime,
      windows: ["18:30 – 20:00", "20:00 – 21:15", "21:15 – 22:15"],
    };
  }
  return {
    period: "night",
    label: "Late Night",
    formattedTime,
    windows: ["21:30 – 22:30", "22:30 – 23:15", "Tomorrow 08:30 – 10:00"],
  };
}

/**
 * Updates the visible time-of-day indicator inside the Inspire Me box.
 */
function renderTimeOfDayLabel() {
  const el = document.getElementById("time-of-day-label");
  if (!el) return;
  const ctx = getTimeOfDayContext();
  el.textContent = `${ctx.label} · ${ctx.formattedTime}`;
}

/**
 * Removes accidental sensitive personal details (like emails or phone numbers)
 * from user-entered text before echoing any summary back into the HTML page.
 */
function redactPersonalInfo(rawText) {
  if (!rawText) return "";
  return rawText
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}\b/g, "[redacted number]")
    .replace(/\b[STFG]\d{7}[A-Z]\b/gi, "[redacted id]")
    .trim();
}

/**
 * Calculates the user's Western Zodiac Sun Sign from a YYYY-MM-DD birthday string.
 * Returns null if the user has not entered a birthday yet.
 */
function getWesternSign(dobString) {
  if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return null;
  const parts = dobString.split("-");
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const signs = [
    { name: "Capricorn", element: "Earth", cutoff: [1, 19] },
    { name: "Aquarius", element: "Air", cutoff: [2, 18] },
    { name: "Pisces", element: "Water", cutoff: [3, 20] },
    { name: "Aries", element: "Fire", cutoff: [4, 19] },
    { name: "Taurus", element: "Earth", cutoff: [5, 20] },
    { name: "Gemini", element: "Air", cutoff: [6, 20] },
    { name: "Cancer", element: "Water", cutoff: [7, 22] },
    { name: "Leo", element: "Fire", cutoff: [8, 22] },
    { name: "Virgo", element: "Earth", cutoff: [9, 22] },
    { name: "Libra", element: "Air", cutoff: [10, 22] },
    { name: "Scorpio", element: "Water", cutoff: [11, 21] },
    { name: "Sagittarius", element: "Fire", cutoff: [12, 21] },
    { name: "Capricorn", element: "Earth", cutoff: [12, 31] },
  ];

  for (let i = 0; i < signs.length; i += 1) {
    const [m, d] = signs[i].cutoff;
    if (month < m || (month === m && day <= d)) {
      return signs[i];
    }
  }
  return signs[0];
}

/**
 * Calculates the Chinese Zodiac animal and Five-Element stem from a birth year,
 * plus a simplified Zi Wei Dou Shu (Purple Star) palace focus based on birth hour.
 */
function getChineseAstrology(dobString, birthTimeString) {
  if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return null;
  const year = Number(dobString.split("-")[0]);
  const animals = [
    "Rat",
    "Ox",
    "Tiger",
    "Rabbit",
    "Dragon",
    "Snake",
    "Horse",
    "Goat",
    "Monkey",
    "Rooster",
    "Dog",
    "Pig",
  ];
  const elements = ["Metal", "Metal", "Water", "Water", "Wood", "Wood", "Fire", "Fire", "Earth", "Earth"];
  const animalIndex = ((year - 4) % 12 + 12) % 12;
  const elementIndex = ((year % 10) + 10) % 10;

  const palaces = [
    "Career & Ambition Palace",
    "Wealth & Resource Palace",
    "Travel & Opportunity Palace",
    "Social & Allies Palace",
    "Wellness & Inner Peace Palace",
    "Creativity & Joy Palace",
  ];

  let palaceIndex = year % palaces.length;
  if (birthTimeString && /^\d{2}:\d{2}$/.test(birthTimeString)) {
    const hour = Number(birthTimeString.split(":")[0]);
    palaceIndex = Math.floor(hour / 4) % palaces.length;
  }

  return {
    animal: animals[animalIndex],
    element: elements[elementIndex],
    palace: palaces[palaceIndex],
  };
}

/**
 * Shows a friendly temporary notification banner at the top of the main page
 * so screen readers and sighted users both see confirmation messages.
 */
function showStatusBanner(message) {
  const banner = document.getElementById("status-banner");
  const textEl = document.getElementById("status-banner-text");
  if (!banner || !textEl) return;
  textEl.textContent = message;
  banner.classList.remove("is-hidden");
}

/**
 * Hides the top status notification banner when the user clicks Close.
 */
function hideStatusBanner() {
  const banner = document.getElementById("status-banner");
  if (banner) {
    banner.classList.add("is-hidden");
  }
}

/**
 * Switches between the four main pages/sections (Today, Profile, Top Up, Tracker)
 * by toggling CSS classes on the HTML <section> tags and updating active nav tabs.
 */
function switchView(targetView) {
  const allowedViews = new Set(["today", "profile", "topup"]);
  const safeView = allowedViews.has(targetView) ? targetView : "today";
  appState.activeView = safeView;
  saveState();

  const sections = document.querySelectorAll(".view-section");
  sections.forEach((sec) => {
    const isTarget = sec.id === `view-${safeView}`;
    sec.classList.toggle("is-active", isTarget);
  });

  const navButtons = document.querySelectorAll("[data-nav-target]");
  navButtons.forEach((btn) => {
    const target = btn.getAttribute("data-nav-target");
    const matches = target === safeView;
    if (btn.classList.contains("nav-link") || btn.classList.contains("mobile-tab")) {
      btn.classList.toggle("is-active", matches);
      if (matches) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    }
  });

  window.scrollTo({ top: 0, behavior: "auto" });
}

/**
 * Updates every coin balance number, check-in button state, and header Sign In
 * button across all views so everything stays synchronized.
 */
function renderHeaderAndWallet() {
  const headerCoin = document.getElementById("header-coin-count");
  const profileCoin = document.getElementById("profile-coin-balance");
  const authBtn = document.getElementById("header-auth-btn");

  if (headerCoin) headerCoin.textContent = String(appState.coins);
  if (profileCoin) profileCoin.textContent = String(appState.coins);

  if (authBtn) {
    const labelPrefix = appState.user.signedIn ? appState.user.name : "Sign In";
    authBtn.innerHTML = "";
    authBtn.appendChild(document.createTextNode(`${labelPrefix} · `));
    const span = document.createElement("span");
    span.id = "header-coin-count";
    span.className = "tabular-nums";
    span.textContent = String(appState.coins);
    authBtn.appendChild(span);
    authBtn.appendChild(document.createTextNode(" Coins"));
  }

  const todayStr = getTodayDateString();
  const alreadyCheckedIn = appState.lastCheckInDate === todayStr;

  const profileCheckInBtn = document.getElementById("profile-checkin-btn");
  if (profileCheckInBtn) {
    profileCheckInBtn.disabled = alreadyCheckedIn;
    profileCheckInBtn.textContent = alreadyCheckedIn ? "Checked In Today" : "Claim +5 Coins";
  }

  if (appState.coins >= 2) {
    const insufficientBar = document.getElementById("insufficient-coins-bar");
    if (insufficientBar) insufficientBar.classList.add("is-hidden");
  }

  renderLedger();
}

/**
 * Renders the list of coin transactions inside the Profile Wallet panel
 * by creating clean <li> elements with tabular coin deltas.
 */
function renderLedger() {
  const list = document.getElementById("wallet-ledger-list");
  if (!list) return;
  list.innerHTML = "";

  const recentItems = appState.ledger.slice(0, 8);
  if (recentItems.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No coin activity recorded yet.";
    list.appendChild(li);
    return;
  }

  recentItems.forEach((entry) => {
    const li = document.createElement("li");

    const leftWrap = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = entry.label;
    const dateEl = document.createElement("small");
    dateEl.className = "text-muted tabular-nums";
    dateEl.textContent = entry.date;
    leftWrap.appendChild(title);
    leftWrap.appendChild(dateEl);

    const deltaEl = document.createElement("span");
    deltaEl.className = entry.delta >= 0 ? "ledger-delta-plus tabular-nums" : "ledger-delta-minus tabular-nums";
    deltaEl.textContent = entry.delta >= 0 ? `+${entry.delta} Coins` : `${entry.delta} Coins`;

    li.appendChild(leftWrap);
    li.appendChild(deltaEl);
    list.appendChild(li);
  });
}

function getActiveWeatherSummary() {
  if (liveContextState.useLiveWeather && liveContextState.weather && liveContextState.weather.ok) {
    const w = liveContextState.weather;
    const tempDisplay =
      w.tempLowC !== null && w.tempHighC !== null ? `${w.tempLowC}–${w.tempHighC}°C` : `${w.tempC}°C`;
    return {
      tempText: tempDisplay,
      tempC: w.tempC,
      condition: w.periodLabel ? `${w.condition} (${w.periodLabel})` : w.condition,
      advice: w.advice,
      isOutdoorFriendly: w.isOutdoorFriendly,
    };
  }
  const preset = WEATHER_PRESETS[appState.weatherIndex % WEATHER_PRESETS.length];
  return {
    tempText: `${preset.tempC}°C`,
    tempC: preset.tempC,
    condition: preset.condition,
    advice: preset.advice,
    isOutdoorFriendly: preset.isOutdoorFriendly,
  };
}

/**
 * Updates the inline Singapore weather readout next to the date in the hero
 * using live NEA 24-hour forecast data (or fallback preset).
 */
function renderWeatherCard() {
  const weather = getActiveWeatherSummary();
  const tempEl = document.getElementById("weather-temp-display");
  const condEl = document.getElementById("weather-condition-display");

  if (tempEl) tempEl.textContent = weather.tempText;
  if (condEl) condEl.textContent = weather.condition;
}

/**
 * Syncs the birthday, birth time, birth location, and life stage inputs across
 * both the Main Page quick astrology panel and the Profile Subpage.
 */
function renderAstrologyAndProfileForms() {
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);

  const heroDate = document.getElementById("hero-date-text");

  if (heroDate) {
    const formatted = new Date().toLocaleDateString("en-SG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    heroDate.textContent = `${formatted} · Singapore`;
  }

  const wEl = document.getElementById("chart-western-sign");
  const cEl = document.getElementById("chart-chinese-sign");
  const zEl = document.getElementById("chart-ziwei-palace");
  const pStarEl = document.getElementById("chart-purple-star");
  const horoEl = document.getElementById("chart-horoscope-snippet");

  if (wEl) wEl.textContent = western ? `${western.name} (${western.element})` : "Not set yet";
  if (cEl) cEl.textContent = chinese ? `${chinese.element} ${chinese.animal}` : "Not set yet";
  if (zEl) zEl.textContent = chinese ? chinese.palace : "General Fortune";

  const promptTitle = document.getElementById("personalise-prompt-title");
  const promptDesc = document.getElementById("personalise-prompt-desc");
  const toggleAstroBtn = document.getElementById("toggle-astro-btn");
  const hasChart = Boolean(western && chinese);

  if (promptTitle) {
    promptTitle.textContent = hasChart
      ? `Personalised for ${western.name} · ${chinese.element} ${chinese.animal}`
      : "For best & tailored results, personalise with your birthday";
  }
  if (promptDesc) {
    promptDesc.textContent = hasChart
      ? `Zi Wei focus: ${chinese.palace}. Tailored results are active for Inspire Me and Affirm.`
      : "Unlock Western Zodiac & Chinese Zi Wei Dou Shu insights before you ask.";
  }
  if (toggleAstroBtn) {
    toggleAstroBtn.textContent = isAstroPanelOpen
      ? "Hide Astrology"
      : hasChart
        ? "Edit Birthday"
        : "Personalise with Birthday";
  }

  if (pStarEl) {
    const ps = liveContextState.purpleStar;
    if (ps && ps.ok && ps.mainStar) {
      const prefix = ps.usingDefaultSample ? "Sample: " : "";
      const dm = ps.bazi?.dayMasterElement ? ` · ${ps.bazi.dayMaster}${ps.bazi.dayMasterElement}` : "";
      pStarEl.textContent = `${prefix}${ps.mainStar.pinyin} (${ps.mainStar.meaning})${dm}`;
    } else if (liveContextState.isLoadingLive) {
      pStarEl.textContent = "Loading chart…";
    } else {
      pStarEl.textContent = "Unavailable";
    }
  }

  if (horoEl) {
    const h = liveContextState.horoscope;
    if (h && h.ok && h.horoscope) {
      const sentences = h.horoscope.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
      horoEl.textContent = `${h.sign} (${h.date || "Today"}): ${sentences}`;
    } else if (liveContextState.isLoadingLive) {
      horoEl.textContent = "Loading today's live horoscope…";
    } else {
      horoEl.textContent = "Live daily horoscope will appear here once connected.";
    }
  }

  const quickDob = document.getElementById("quick-dob");
  const quickTime = document.getElementById("quick-birth-time");
  const quickPlace = document.getElementById("quick-birth-place");
  if (quickDob) quickDob.value = appState.user.dob;
  if (quickTime) quickTime.value = appState.user.birthTime;
  if (quickPlace) quickPlace.value = appState.user.birthPlace;

  const pName = document.getElementById("profile-name");
  const pEmail = document.getElementById("profile-email");
  const pDob = document.getElementById("profile-dob");
  const pTime = document.getElementById("profile-birth-time");
  const pPlace = document.getElementById("profile-birth-place");
  const pSeg = document.getElementById("profile-segment");
  if (pName) pName.value = appState.user.name === "Guest" ? "" : appState.user.name;
  if (pEmail) pEmail.value = appState.user.email;
  if (pDob) pDob.value = appState.user.dob;
  if (pTime) pTime.value = appState.user.birthTime;
  if (pPlace) pPlace.value = appState.user.birthPlace;
  if (pSeg) pSeg.value = appState.user.segment;

  const checkboxes = document.querySelectorAll('input[name="interest"]');
  checkboxes.forEach((box) => {
    box.checked = appState.user.interests.includes(box.value);
  });
}

/**
 * Evaluates whether a chosen calendar date (today or a particular future date)
 * is the best day to act on a user's wish, or suggests a stronger nearby day.
 */
function evaluateDayForWish(wishText, dateStr, western, chinese, weather) {
  const chosenDate = dateStr || getTodayDateString();
  const [y, m, d] = chosenDate.split("-").map(Number);
  const baseDate = new Date(y, m - 1, d);
  const seedInput = `${chosenDate}|${wishText.toLowerCase()}|${western ? western.name : "guest"}|${chinese ? chinese.animal : "general"}`;

  let hash = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash = (hash * 31 + seedInput.charCodeAt(i)) % 997;
  }

  const tier = hash % 3;
  const formattedChosen = formatReadableDate(chosenDate);
  const isToday = chosenDate === getTodayDateString();

  const altDate = new Date(baseDate);
  altDate.setDate(baseDate.getDate() + (tier === 1 ? 1 : 2));
  const altStr = `${altDate.getFullYear()}-${String(altDate.getMonth() + 1).padStart(2, "0")}-${String(altDate.getDate()).padStart(2, "0")}`;
  const formattedAlt = formatReadableDate(altStr);

  const weatherNote = isToday
    ? `Singapore weather (${weather.tempC}°C, ${weather.condition.toLowerCase()}) supports steady pacing.`
    : "Check Singapore weather closer to the day for indoor vs outdoor timing.";

  if (tier === 0) {
    return {
      verdictLabel: "Best Day — Go Ahead",
      title: `Best day confirmed: ${formattedChosen}`,
      window: "10:30 – 12:30",
      rationale: `${formattedChosen} aligns strongly with "${wishText}". Your momentum is clear and steady—take the lead during the auspicious window. ${weatherNote}`,
      prepTitle: `Warm-up step before ${formattedChosen}`,
      prepRationale: `Write down your top 2 priorities for "${wishText}" ahead of time so you step in calm and prepared.`,
    };
  }

  if (tier === 1) {
    return {
      verdictLabel: "Good with Right Timing",
      title: `${formattedChosen} works well in the afternoon window`,
      window: "14:30 – 16:30",
      rationale: `${formattedChosen} is supportive for "${wishText}" if you wait for calmer afternoon energy, though ${formattedAlt} carries slightly higher momentum. ${weatherNote}`,
      prepTitle: `Keep an eye on ${formattedAlt} as a backup`,
      prepRationale: `If anything feels rushed on ${formattedChosen}, shifting the key move to ${formattedAlt} gives you extra breathing room.`,
    };
  }

  return {
    verdictLabel: "Better on a Nearby Day",
    title: `Consider ${formattedAlt} instead of ${formattedChosen}`,
    window: "11:00 – 13:00",
    rationale: `${formattedChosen} carries slightly scattered energy for "${wishText}". Preparing today and making your main move on ${formattedAlt} gives a smoother outcome. ${weatherNote}`,
    prepTitle: `Use ${formattedChosen} for quiet groundwork`,
    prepRationale: `Draft notes, gather facts, or rehearse your plan on ${formattedChosen} without forcing an immediate decision.`,
  };
}

/**
 * Generates three Singapore-tailored auspicious activities locally on the front end.
 * - "inspire": targets today and accounts for the current time of day + weather + chart.
 * - "affirm": evaluates whether today or a chosen particular day is best for the user's wish.
 */
function buildLocalOracleReading(mode, feelingRaw, targetDate) {
  const weather = WEATHER_PRESETS[appState.weatherIndex % WEATHER_PRESETS.length];
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);
  const segment = appState.user.segment || "adult";
  const safeMood = redactPersonalInfo(feelingRaw);
  const timeCtx = getTimeOfDayContext();

  const signNote = western && chinese
    ? `Tailored for ${western.name} (${western.element}) & ${chinese.element} ${chinese.animal} under ${chinese.palace}.`
    : "Personalise with your birthday above for tailored Western & Zi Wei Dou Shu insights.";

  if (mode === "affirm") {
    const chosenDate = targetDate || getTodayDateString();
    const formattedDate = formatReadableDate(chosenDate);
    const evalResult = evaluateDayForWish(safeMood, chosenDate, western, chinese, weather);

    const affirmActivities = [
      {
        id: `${Date.now()}-0`,
        rank: "01",
        title: evalResult.title,
        category: evalResult.verdictLabel,
        window: evalResult.window,
        weatherFit: chosenDate === getTodayDateString() ? `${weather.tempC}°C · ${weather.condition}` : `Target: ${formattedDate}`,
        rationale: `${evalResult.rationale} ${signNote}`,
        targetDate: chosenDate,
      },
      {
        id: `${Date.now()}-1`,
        rank: "02",
        title: evalResult.prepTitle,
        category: "Preparation Move",
        window: "09:30 – 11:00",
        weatherFit: chosenDate === getTodayDateString() ? `${weather.tempC}°C · ${weather.condition}` : `Target: ${formattedDate}`,
        rationale: `${evalResult.prepRationale} ${signNote}`,
        targetDate: chosenDate,
      },
      {
        id: `${Date.now()}-2`,
        rank: "03",
        title: segment === "teen"
          ? "Share your plan with a trusted friend before acting"
          : segment === "elderly"
            ? "Take a calm tea break to double-check details"
            : "Pair your move with a 15-minute reset walk or kopi break",
        category: "Supportive Luck Boost",
        window: "16:30 – 18:00",
        weatherFit: chosenDate === getTodayDateString() ? `${weather.tempC}°C · ${weather.condition}` : `Target: ${formattedDate}`,
        rationale: `Keeps your mindset grounded around "${safeMood}" on ${formattedDate}. ${signNote}`,
        targetDate: chosenDate,
      },
    ];

    const hues = ["Electric Violet", "Warm Marigold", "Jade Mint", "Crisp Ivory"];
    const luckyHue = hues[(weather.tempC + chosenDate.charCodeAt(chosenDate.length - 1)) % hues.length];

    return {
      mode,
      date: chosenDate,
      dateLabel: formattedDate,
      verdictLabel: evalResult.verdictLabel,
      luckyWindow: evalResult.window,
      luckyHue,
      activities: affirmActivities,
    };
  }

  // "Inspire Me" mode: strictly for today, taking note of current time of day
  const todayStr = getTodayDateString();
  const timePools = {
    adult: {
      morning: [
        {
          title: weather.isOutdoorFriendly ? "Breezy morning walk along MacRitchie or Marina Barrage" : "Tidy your desk & map one bold career move",
          category: weather.isOutdoorFriendly ? "Wellness & Recharge" : "Financial & Career Move",
          rationale: "Morning clarity sets an energetic tone before midday heat or meetings kick in.",
        },
        {
          title: "Coffee catch-up in Tiong Bahru or a focused inbox clear",
          category: "Social & Networking",
          rationale: "Late-morning hours favour crisp communication and timely introductions.",
        },
        {
          title: "Review one personal finance or savings milestone over lunch",
          category: "Financial & Career Move",
          rationale: "Midday resource energy helps practical money decisions feel effortless.",
        },
      ],
      afternoon: [
        {
          title: "Solo kopi or matcha reset at a quiet neighbourhood cafe",
          category: "Wellness & Recharge",
          rationale: "Afternoon stillness gives your mind breathing room away from nonstop notifications.",
        },
        {
          title: "Send a warm voice note to an ally or mentor",
          category: "Social & Networking",
          rationale: "Late-afternoon social energy strengthens supportive connections without crossing town.",
        },
        {
          title: weather.isOutdoorFriendly ? "Sunset museum or waterfront stroll before dinner" : "Knock out one creative task indoors before 6 PM",
          category: "Career & Inspiration",
          rationale: "Turns the afternoon dip into an easy, rewarding win.",
        },
      ],
      evening: [
        {
          title: weather.isOutdoorFriendly ? "Cool evening stroll along East Coast or Singapore River" : "Cook or pick up a warm comforting dinner nearby",
          category: "Wellness & Recharge",
          rationale: "Evening temperatures ease up, helping your mind unwind from the workday.",
        },
        {
          title: "Declutter 15 items in your room or living corner",
          category: "Home & Decluttering",
          rationale: "Clears stagnant energy at home and sets up calmer Fengshui for tomorrow.",
        },
        {
          title: "Jot down 3 wins from today & prep tomorrow's top priority",
          category: "Mindset & Planning",
          rationale: "Nighttime reflection locks in confidence without rushing.",
        },
      ],
      night: [
        {
          title: "10-minute digital sunset & herbal tea wind-down",
          category: "Wellness & Recharge",
          rationale: "Late-night hours favour gentle rest over heavy decisions.",
        },
        {
          title: "Lay out tomorrow's outfit and top 1 goal before bed",
          category: "Home & Preparation",
          rationale: "Reduces morning friction so tomorrow starts auspiciously.",
        },
        {
          title: "Read 10 pages or listen to calm ambient tracks",
          category: "Inner Peace",
          rationale: "Supports deeper sleep and fresh intuition tomorrow morning.",
        },
      ],
    },
    teen: {
      morning: [
        {
          title: "25-minute focused study sprint with a lo-fi playlist",
          category: "Study & Exam Preps",
          rationale: "Morning focus boosts memory retention while keeping stress low.",
        },
        {
          title: weather.isOutdoorFriendly ? "Photo walk through Haji Lane or Chinatown murals" : "Curate a moodboard or creative clip indoors",
          category: "Creative & Digital Expressions",
          rationale: "Channels fresh morning curiosity into something fun to share.",
        },
        {
          title: "Hawker lunch & catch-up with classmates",
          category: "Social Hangouts & Explorations",
          rationale: "Balances productive focus with upbeat social energy.",
        },
      ],
      afternoon: [
        {
          title: "Library or cafe study sprint + iced matcha treat",
          category: "Study & Exam Preps",
          rationale: "Keeps afternoon momentum steady in a comfortable sheltered spot.",
        },
        {
          title: weather.isOutdoorFriendly ? "Cycle or skate along East Coast Park before sunset" : "Bubble tea & board games hang at a sheltered mall",
          category: "Sports & Social Plays",
          rationale: "Shakes off screen fatigue and lifts your mood for the evening.",
        },
        {
          title: "Organise your notes or creative project folder",
          category: "Creative & Digital Expressions",
          rationale: "Gives you a clean slate before dinner.",
        },
      ],
      evening: [
        {
          title: weather.isOutdoorFriendly ? "Evening jog or basketball shootaround with friends" : "Cozy gaming or playlist swap with friends",
          category: "Social Hangouts & Explorations",
          rationale: "Cooler evening air or sheltered hangouts keep energy playful.",
        },
        {
          title: "Sketch, journal, or edit a short reel from today",
          category: "Creative & Digital Expressions",
          rationale: "Evening calm sparks authentic creative ideas.",
        },
        {
          title: "Pack your bag and set a chill morning alarm",
          category: "Study & Prep",
          rationale: "Makes tomorrow's start effortless.",
        },
      ],
      night: [
        {
          title: "Screen-off stretch & chill music before sleep",
          category: "Wellness & Recharge",
          rationale: "Protects your rest so tomorrow's energy stays sharp.",
        },
        {
          title: "Write 3 quick thoughts in your notes app",
          category: "Creative & Reflection",
          rationale: "Clears your head before lights out.",
        },
        {
          title: "Pick one fun thing to look forward to tomorrow morning",
          category: "Mindset & Prep",
          rationale: "Sets an optimistic tone for tomorrow.",
        },
      ],
    },
    elderly: {
      morning: [
        {
          title: weather.isOutdoorFriendly ? "Morning Tai Chi or stroll at Botanic Gardens" : "Light indoor stretching & warm herbal tea ritual",
          category: "Health & Gentle Movement",
          rationale: "Morning energy supports vitality and gentle circulation.",
        },
        {
          title: "Visit a neighbourhood heritage spot or market for fresh fruit",
          category: "Spiritual & Cultural",
          rationale: "Aligns peacefully with morning almanac energy.",
        },
        {
          title: "Enjoy warm kopi & chat with a neighbour or friend",
          category: "Family & Community",
          rationale: "Brings cheerful connection to the start of your day.",
        },
      ],
      afternoon: [
        {
          title: "Calm calligraphy, reading, or heritage music indoors",
          category: "Spiritual & Cultural",
          rationale: "Keeps you cool and peaceful during the warmer afternoon.",
        },
        {
          title: "Call a grandchild or share a favourite family recipe photo",
          category: "Family & Grandparenting",
          rationale: "Brings warmth and auspicious harmony to your household.",
        },
        {
          title: weather.isOutdoorFriendly ? "Late-afternoon park stroll as breeze picks up" : "Gentle seated mobility stretches at home",
          category: "Health & Gentle Movement",
          rationale: "Keeps joints comfortable before dinner.",
        },
      ],
      evening: [
        {
          title: "Warm nourishing soup dinner with family",
          category: "Family & Grandparenting",
          rationale: "Evening family meals nourish gratitude and closeness.",
        },
        {
          title: weather.isOutdoorFriendly ? "Short post-dinner walk around the neighbourhood" : "Relaxing herbal tea & favourite classic show",
          category: "Health & Gentle Movement",
          rationale: "Supports easy digestion and restful sleep.",
        },
        {
          title: "Quiet gratitude reflection before bedtime",
          category: "Spiritual & Cultural",
          rationale: "Centers calm breath and peaceful thoughts.",
        },
      ],
      night: [
        {
          title: "Warm foot soak or gentle breathing exercise",
          category: "Health & Gentle Movement",
          rationale: "Relaxes tired muscles for deeper rest tonight.",
        },
        {
          title: "Sip warm water and dim room lights early",
          category: "Wellness & Recharge",
          rationale: "Supports steady sleep rhythms overnight.",
        },
        {
          title: "Set out comfortable walking shoes for tomorrow morning",
          category: "Tomorrow Prep",
          rationale: "Welcomes fresh morning luck tomorrow.",
        },
      ],
    },
  };

  const chosenPool = timePools[segment][timeCtx.period] || timePools.adult.afternoon;
  const activities = chosenPool.slice(0, 3).map((item, idx) => ({
    id: `${Date.now()}-${idx}`,
    rank: `0${idx + 1}`,
    title: item.title,
    category: item.category,
    window: timeCtx.windows[idx] || timeCtx.windows[0],
    weatherFit: `${weather.tempC}°C · ${weather.condition}`,
    rationale: `${item.rationale} ${signNote}`,
    targetDate: todayStr,
  }));

  const hues = ["Electric Violet", "Warm Marigold", "Jade Mint", "Crisp Ivory"];
  const luckyHue = hues[(weather.tempC + activities.length) % hues.length];

  return {
    mode,
    date: todayStr,
    dateLabel: formatReadableDate(todayStr),
    timePeriodLabel: `${timeCtx.label} (${timeCtx.formattedTime})`,
    luckyWindow: activities[0].window,
    luckyHue,
    activities,
  };
}

/**
 * Displays the generated Top 3 Auspicious Activities inside the results grid
 * and attaches working click handlers to every "Accept Activity (+2 Coins)" button.
 */
function renderResultsSection() {
  const resultsSection = document.getElementById("results-section");
  const emptyBox = document.getElementById("results-empty");
  const loadingBox = document.getElementById("results-loading");
  const grid = document.getElementById("results-grid");
  const luckInfo = document.getElementById("results-luck-info");
  const disclosure = document.getElementById("ai-disclosure");
  const metaLine = document.getElementById("results-meta-line");

  if (loadingBox) loadingBox.classList.add("is-hidden");

  if (!appState.lastReading) {
    if (resultsSection) resultsSection.classList.add("is-hidden");
    if (emptyBox) emptyBox.classList.add("is-hidden");
    if (grid) grid.classList.add("is-hidden");
    if (luckInfo) luckInfo.classList.add("is-hidden");
    if (disclosure) disclosure.classList.add("is-hidden");
    return;
  }

  const reading = appState.lastReading;
  if (resultsSection) resultsSection.classList.remove("is-hidden");
  if (emptyBox) emptyBox.classList.add("is-hidden");
  if (grid) {
    grid.classList.remove("is-hidden");
    grid.innerHTML = "";
  }
  if (luckInfo) luckInfo.classList.remove("is-hidden");
  if (disclosure) {
    disclosure.classList.remove("is-hidden");
    disclosure.textContent = reading.aiGenerated
      ? "AI-generated guidance (Gemini) grounded in live Singapore 24-hour weather, daily horoscope, and Zi Wei Dou Shu chart feeds."
      : "Generated for daily inspiration and entertainment using live Singapore 24-hour weather, daily horoscope, and Zi Wei Dou Shu chart feeds.";
  }

  const windowText = document.getElementById("lucky-window-text");
  const hueText = document.getElementById("lucky-hue-text");
  if (windowText) windowText.textContent = reading.luckyWindow;
  if (hueText) hueText.textContent = reading.luckyHue;
  if (metaLine) {
    const formattedDate = reading.dateLabel || formatReadableDate(reading.date);
    const periodChunk = reading.timePeriodLabel ? ` ${reading.timePeriodLabel}` : "";
    metaLine.textContent =
      reading.mode === "affirm"
        ? `Best-day check for ${formattedDate} (${reading.verdictLabel || "Affirmation"}) · Accept any move below to earn +2 Coins.`
        : `Today's${periodChunk} inspiration (${formattedDate}) · Accept any move below to earn +2 Coins.`;
  }

  reading.activities.forEach((act) => {
    const alreadyAccepted = appState.trackedActivities.some((t) => t.id === act.id);

    const card = document.createElement("article");
    card.className = "activity-card";

    const top = document.createElement("div");
    top.className = "activity-top";

    const kicker = document.createElement("div");
    kicker.className = "activity-kicker";
    const idxSpan = document.createElement("span");
    idxSpan.className = "activity-index";
    idxSpan.textContent = act.rank;
    const sep = document.createElement("span");
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "·";
    const catSpan = document.createElement("span");
    catSpan.textContent = act.category;
    kicker.appendChild(idxSpan);
    kicker.appendChild(sep);
    kicker.appendChild(catSpan);

    const title = document.createElement("h3");
    title.className = "activity-title";
    title.textContent = act.title;

    const rationale = document.createElement("p");
    rationale.className = "activity-rationale";
    rationale.textContent = act.rationale;

    const metaGrid = document.createElement("div");
    metaGrid.className = "activity-meta-grid";
    const winLine = document.createElement("span");
    winLine.innerHTML = `Best window: <strong class="tabular-nums"></strong>`;
    winLine.querySelector("strong").textContent = act.window;
    const wxLine = document.createElement("span");
    wxLine.innerHTML = `Weather match: <strong></strong>`;
    wxLine.querySelector("strong").textContent = act.weatherFit;
    metaGrid.appendChild(winLine);
    metaGrid.appendChild(wxLine);

    top.appendChild(kicker);
    top.appendChild(title);
    top.appendChild(rationale);
    top.appendChild(metaGrid);

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = alreadyAccepted ? "btn btn-secondary btn-full" : "btn btn-mint btn-full";
    acceptBtn.disabled = alreadyAccepted;
    acceptBtn.textContent = alreadyAccepted ? "Accepted (+2 Coins)" : "Accept Activity (+2 Coins)";
    acceptBtn.addEventListener("click", () => handleAcceptActivity(act));

    card.appendChild(top);
    card.appendChild(acceptBtn);
    grid.appendChild(card);
  });
}

/**
 * Adds a proposed activity to the user's accepted list and rewards +2 Coins
 * to their wallet, as described in the project brief.
 */
function handleAcceptActivity(activity) {
  const exists = appState.trackedActivities.some((item) => item.id === activity.id);
  if (exists) return;

  appState.trackedActivities.unshift({
    ...activity,
    status: "planned",
    note: "",
  });
  appState.coins += 2;
  appState.ledger.unshift({
    id: `accept-${Date.now()}`,
    date: getTodayDateString(),
    label: "Accepted auspicious activity",
    delta: 2,
  });

  saveState();
  renderHeaderAndWallet();
  renderResultsSection();
  renderTrackerList();
  showStatusBanner("Activity accepted! You earned +2 Coins.");
}

/**
 * Pulls live weather, Western horoscope, and Purple Star chart data from the
 * serverless /api/live-data endpoint and updates the Today view.
 */
async function fetchLiveOracleContext() {
  liveContextState.isLoadingLive = true;
  renderAstrologyAndProfileForms();

  const western = getWesternSign(appState.user.dob);
  const region = ["central", "east", "west", "north", "south"].includes(appState.locationKey)
    ? appState.locationKey
    : "central";

  const params = new URLSearchParams({
    region,
    sign: (western ? western.name : "aquarius").toLowerCase(),
  });

  if (appState.user.dob) {
    params.set("date", appState.user.dob);
  }
  if (appState.user.birthTime && /^\d{2}:\d{2}$/.test(appState.user.birthTime)) {
    const [h, m] = appState.user.birthTime.split(":");
    params.set("hour", h);
    params.set("minute", m);
  }
  if (appState.user.birthPlace) {
    params.set("birthPlace", appState.user.birthPlace);
  }

  try {
    const res = await fetch(`/api/live-data?${params.toString()}`);
    if (res.ok) {
      const payload = await res.json();
      if (payload && payload.sources) {
        liveContextState.weather = payload.sources.weather || null;
        liveContextState.horoscope = payload.sources.horoscope || null;
        liveContextState.purpleStar = payload.sources.purpleStar || null;
        liveContextState.lastFetchedAt = payload.fetchedAt || "";
      }
    }
  } catch {
    // Keep existing or fallback local data if offline
  } finally {
    liveContextState.isLoadingLive = false;
    renderWeatherCard();
    renderAstrologyAndProfileForms();
  }
}

/**
 * Runs a reading ("affirm" costs 1 coin, "inspire" costs 2 coins) via the
 * serverless /api/insight endpoint (with local fallback), updates the UI,
 * and logs the coin transaction.
 */
async function runOracleReading(mode) {
  const feelingInput = document.getElementById("feeling-input");
  const feelingError = document.getElementById("feeling-error");
  const targetDateInput = document.getElementById("reading-date-input");
  const insufficientBar = document.getElementById("insufficient-coins-bar");
  const insufficientText = document.getElementById("insufficient-coins-text");
  const resultsSection = document.getElementById("results-section");
  const loadingBox = document.getElementById("results-loading");
  const emptyBox = document.getElementById("results-empty");
  const grid = document.getElementById("results-grid");
  const affirmBtn = document.getElementById("affirm-submit-btn");
  const inspireBtn = document.getElementById("inspire-btn");

  if (feelingError) {
    feelingError.classList.add("is-hidden");
    feelingError.textContent = "";
  }
  if (insufficientBar) {
    insufficientBar.classList.add("is-hidden");
  }

  const feelingText = feelingInput ? feelingInput.value.trim() : "";
  if (mode === "affirm" && !feelingText) {
    if (feelingError) {
      feelingError.textContent = "Please tell My Oracle what you feel like doing today, or click Inspire Me.";
      feelingError.classList.remove("is-hidden");
    }
    if (feelingInput) feelingInput.focus();
    return;
  }

  const cost = mode === "affirm" ? 1 : 2;
  if (appState.coins < cost) {
    const actionName = mode === "affirm" ? "Affirm" : "Inspire Me";
    const msg = `You need ${cost} ${cost === 1 ? "Coin" : "Coins"} for ${actionName} (you have ${appState.coins}). Top up to continue.`;
    if (insufficientText) insufficientText.textContent = msg;
    if (insufficientBar) insufficientBar.classList.remove("is-hidden");
    const topupBtn = document.getElementById("insufficient-topup-btn");
    if (topupBtn) topupBtn.focus();
    showStatusBanner(msg);
    return;
  }

  const targetDate =
    mode === "inspire"
      ? getTodayDateString()
      : targetDateInput && targetDateInput.value
        ? targetDateInput.value
        : getTodayDateString();
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);
  const timeCtx = getTimeOfDayContext();

  if (resultsSection) resultsSection.classList.remove("is-hidden");
  if (loadingBox) loadingBox.classList.remove("is-hidden");
  if (emptyBox) emptyBox.classList.add("is-hidden");
  if (grid) grid.classList.add("is-hidden");
  if (affirmBtn) affirmBtn.disabled = true;
  if (inspireBtn) inspireBtn.disabled = true;

  let reading = null;
  try {
    const response = await fetch("/api/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        feeling: feelingText,
        segment: appState.user.segment || "adult",
        region: "central",
        location: "Singapore",
        targetDate,
        timeOfDay: `${timeCtx.label} (${timeCtx.formattedTime})`,
        westernSign: western ? western.name.toLowerCase() : "aquarius",
        chineseZodiac: chinese ? `${chinese.element} ${chinese.animal}` : "",
        dob: appState.user.dob || "",
        birthTime: appState.user.birthTime || "",
        birthPlace: appState.user.birthPlace || "Singapore",
      }),
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload?.liveData?.sources) {
        liveContextState.weather = payload.liveData.sources.weather || liveContextState.weather;
        liveContextState.horoscope = payload.liveData.sources.horoscope || liveContextState.horoscope;
        liveContextState.purpleStar = payload.liveData.sources.purpleStar || liveContextState.purpleStar;
        renderWeatherCard();
        renderAstrologyAndProfileForms();
      }
      if (payload?.reading) {
        reading = { ...payload.reading, aiGenerated: Boolean(payload.aiGenerated) };
      }
    }
  } catch {
    // Fallback to local reading below if serverless call is unreachable
  } finally {
    if (affirmBtn) affirmBtn.disabled = false;
    if (inspireBtn) inspireBtn.disabled = false;
  }

  if (!reading) {
    reading = buildLocalOracleReading(mode, feelingText, targetDate);
  }

  appState.coins -= cost;
  appState.ledger.unshift({
    id: `spend-${Date.now()}`,
    date: getTodayDateString(),
    label: mode === "affirm" ? "Seek Affirmation reading" : "Inspire Me reading",
    delta: -cost,
  });

  appState.lastReading = reading;

  saveState();
  renderTimeOfDayLabel();
  renderHeaderAndWallet();
  renderResultsSection();
  showStatusBanner(
    mode === "affirm"
      ? "Affirmation ready! (-1 Coin)"
      : "Fresh Top 3 inspiration ready! (-2 Coins)"
  );

  if (resultsSection) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsSection.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }
}

/**
 * Renders the Activity Tracker list filtered by All / Planned / Completed,
 * allowing users to type comments on sentiments or encounters and mark tasks done.
 */
function renderTrackerList() {
  const listEl = document.getElementById("tracker-list");
  const emptyEl = document.getElementById("tracker-empty");
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";
  const filtered = appState.trackedActivities.filter((item) => {
    if (appState.trackerFilter === "all") return true;
    return item.status === appState.trackerFilter;
  });

  if (filtered.length === 0) {
    emptyEl.classList.remove("is-hidden");
    listEl.classList.add("is-hidden");
    return;
  }

  emptyEl.classList.add("is-hidden");
  listEl.classList.remove("is-hidden");

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "tracker-card";

    const head = document.createElement("div");
    head.className = "tracker-card-head";

    const titleWrap = document.createElement("div");
    const meta = document.createElement("p");
    meta.className = "eyebrow-meta";
    meta.textContent = `${item.targetDate} · ${item.category} · ${item.window}`;
    const title = document.createElement("h2");
    title.className = "activity-title";
    title.textContent = item.title;
    titleWrap.appendChild(meta);
    titleWrap.appendChild(title);

    const statusBadge = document.createElement("span");
    statusBadge.className =
      item.status === "completed" ? "tracker-status-label" : "tracker-status-label is-planned";
    statusBadge.textContent = item.status === "completed" ? "Completed" : "Planned";

    head.appendChild(titleWrap);
    head.appendChild(statusBadge);

    const noteForm = document.createElement("form");
    noteForm.className = "tracker-note-form";

    const label = document.createElement("label");
    const textareaId = `note-${item.id}`;
    label.setAttribute("for", textareaId);
    label.className = "field-label";
    label.textContent = "Sentiments or encounters";

    const textarea = document.createElement("textarea");
    textarea.id = textareaId;
    textarea.className = "field-control";
    textarea.rows = 2;
    textarea.maxLength = 240;
    textarea.placeholder = "How did it go? Any lucky encounters or mood shifts?";
    textarea.value = item.note || "";

    const actions = document.createElement("div");
    actions.className = "tracker-note-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Save Note";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-secondary btn-sm";
    toggleBtn.textContent = item.status === "completed" ? "Mark Planned" : "Mark Completed";
    toggleBtn.addEventListener("click", () => {
      item.status = item.status === "completed" ? "planned" : "completed";
      saveState();
      renderTrackerList();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(toggleBtn);

    noteForm.appendChild(label);
    noteForm.appendChild(textarea);
    noteForm.appendChild(actions);

    noteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      item.note = redactPersonalInfo(textarea.value);
      textarea.value = item.note;
      saveState();
      showStatusBanner("Reflection saved to your Activity Tracker.");
    });

    card.appendChild(head);
    card.appendChild(noteForm);
    listEl.appendChild(card);
  });
}

/**
 * Awards +5 daily check-in coins once per calendar date and updates the wallet.
 */
function handleDailyCheckIn() {
  const todayStr = getTodayDateString();
  if (appState.lastCheckInDate === todayStr) {
    showStatusBanner("You already claimed today's +5 Check-In Coins. Come back tomorrow!");
    return;
  }

  appState.lastCheckInDate = todayStr;
  appState.coins += 5;
  appState.ledger.unshift({
    id: `checkin-${Date.now()}`,
    date: todayStr,
    label: "Daily check-in reward",
    delta: 5,
  });

  saveState();
  renderHeaderAndWallet();
  showStatusBanner("Daily Check-In complete! +5 Coins added to your wallet.");
}

/**
 * Opens the accessible Sign In / Sign Up modal and remembers which button
 * opened it so keyboard focus returns there cleanly when closed.
 */
function openAuthModal() {
  const backdrop = document.getElementById("auth-modal-backdrop");
  const form = document.getElementById("auth-form");
  const signedInPanel = document.getElementById("auth-signed-in-panel");
  const signedInName = document.getElementById("signed-in-name");
  const modalTitle = document.getElementById("auth-modal-title");
  const closeBtn = document.getElementById("auth-close-btn");

  lastFocusedElement = document.activeElement;

  if (appState.user.signedIn) {
    if (form) form.classList.add("is-hidden");
    if (signedInPanel) signedInPanel.classList.remove("is-hidden");
    if (signedInName) signedInName.textContent = appState.user.name;
    if (modalTitle) modalTitle.textContent = "Your Oracle Account";
  } else {
    if (form) form.classList.remove("is-hidden");
    if (signedInPanel) signedInPanel.classList.add("is-hidden");
    if (modalTitle) modalTitle.textContent = "Welcome to My Oracle";
  }

  if (backdrop) {
    backdrop.classList.remove("is-hidden");
  }
  if (closeBtn) {
    closeBtn.focus();
  }
}

/**
 * Closes the Sign In / Sign Up modal and restores keyboard focus.
 */
function closeAuthModal() {
  const backdrop = document.getElementById("auth-modal-backdrop");
  if (backdrop) {
    backdrop.classList.add("is-hidden");
  }
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

/**
 * Connects all HTML buttons, dropdowns, forms, and tabs to their JavaScript
 * event listeners once the HTML page finishes loading.
 */
function wireAllEventListeners() {
  // Navigation links & buttons
  document.querySelectorAll("[data-nav-target]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = el.getAttribute("data-nav-target");
      if (target) switchView(target);
    });
  });

  const brandHome = document.getElementById("brand-home-link");
  if (brandHome) {
    brandHome.addEventListener("click", (e) => {
      e.preventDefault();
      switchView("today");
    });
  }

  // Status banner dismiss
  const dismissBtn = document.getElementById("status-dismiss-btn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", hideStatusBanner);
  }

  // Profile Daily Check-In button
  const profileCheckInBtn = document.getElementById("profile-checkin-btn");
  if (profileCheckInBtn) {
    profileCheckInBtn.addEventListener("click", handleDailyCheckIn);
  }

  // Feeling character counter
  const feelingInput = document.getElementById("feeling-input");
  const charCount = document.getElementById("feeling-char-count");
  if (feelingInput && charCount) {
    feelingInput.addEventListener("input", () => {
      charCount.textContent = `${feelingInput.value.length}/240`;
    });
  }

  // Reading target date default
  const dateInput = document.getElementById("reading-date-input");
  if (dateInput) {
    dateInput.value = getTodayDateString();
  }

  // Affirm & Inspire Me actions
  const affirmForm = document.getElementById("affirm-form");
  if (affirmForm) {
    affirmForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runOracleReading("affirm");
    });
  }

  const inspireBtn = document.getElementById("inspire-btn");
  if (inspireBtn) {
    inspireBtn.addEventListener("click", () => runOracleReading("inspire"));
  }

  // Toggle Personalise with Astrology panel on Today page
  const toggleAstroBtn = document.getElementById("toggle-astro-btn");
  if (toggleAstroBtn) {
    toggleAstroBtn.addEventListener("click", () => {
      setAstroPanelOpen(!isAstroPanelOpen, true);
    });
  }

  const closeAstroBtn = document.getElementById("close-astro-btn");
  if (closeAstroBtn) {
    closeAstroBtn.addEventListener("click", () => {
      setAstroPanelOpen(false, true);
    });
  }

  // Quick Astrology Personalisation form on Today page
  const quickAstroForm = document.getElementById("quick-astro-form");
  if (quickAstroForm) {
    quickAstroForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const dobVal = document.getElementById("quick-dob")?.value || "";
      const timeVal = document.getElementById("quick-birth-time")?.value || "";
      const placeVal = document.getElementById("quick-birth-place")?.value || "Singapore";

      appState.user.dob = dobVal;
      appState.user.birthTime = timeVal;
      appState.user.birthPlace = placeVal;
      saveState();
      renderAstrologyAndProfileForms();
      void fetchLiveOracleContext();
      showStatusBanner("Astrology chart applied! Live horoscope & Zi Wei Dou Shu chart updated.");
    });
  }

  // Profile Subpage form
  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameVal = document.getElementById("profile-name")?.value.trim() || "Guest";
      const emailVal = document.getElementById("profile-email")?.value.trim() || "";
      const dobVal = document.getElementById("profile-dob")?.value || "";
      const timeVal = document.getElementById("profile-birth-time")?.value || "";
      const placeVal = document.getElementById("profile-birth-place")?.value.trim() || "Singapore";
      const segVal = document.getElementById("profile-segment")?.value || "adult";

      const selectedInterests = [];
      document.querySelectorAll('input[name="interest"]:checked').forEach((box) => {
        selectedInterests.push(box.value);
      });

      appState.user.name = nameVal || "Guest";
      appState.user.email = emailVal;
      appState.user.dob = dobVal;
      appState.user.birthTime = timeVal;
      appState.user.birthPlace = placeVal;
      appState.user.segment = segVal;
      appState.user.interests = selectedInterests;

      saveState();
      renderHeaderAndWallet();
      renderAstrologyAndProfileForms();
      void fetchLiveOracleContext();
      showStatusBanner("Profile & astrology preferences saved!");
    });
  }

  const profileResetBtn = document.getElementById("profile-reset-btn");
  if (profileResetBtn) {
    profileResetBtn.addEventListener("click", () => {
      appState.user.dob = "";
      appState.user.birthTime = "";
      appState.user.birthPlace = "Singapore";
      appState.user.segment = "adult";
      appState.user.interests = ["career", "wellness"];
      saveState();
      renderAstrologyAndProfileForms();
      showStatusBanner("Profile details reset to defaults.");
    });
  }

  // Coin Top Up Bundle selector
  document.querySelectorAll(".bundle-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const coins = Number(btn.getAttribute("data-bundle-coins")) || 15;
      appState.selectedBundleCoins = coins;
      saveState();

      document.querySelectorAll(".bundle-option").forEach((b) => {
        const selected = Number(b.getAttribute("data-bundle-coins")) === coins;
        b.classList.toggle("is-selected", selected);
        b.setAttribute("aria-pressed", String(selected));
      });

      const bundle = BUNDLES[coins];
      const sumText = document.getElementById("summary-bundle-text");
      const priceText = document.getElementById("summary-price-text");
      if (sumText && bundle) sumText.textContent = `${bundle.coins} Coins`;
      if (priceText && bundle) priceText.textContent = `S$${bundle.price}`;
    });
  });

  // Payment method tabs
  document.querySelectorAll("[data-pay-method]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const method = tab.getAttribute("data-pay-method") || "card";
      appState.paymentMethod = method;

      document.querySelectorAll("[data-pay-method]").forEach((t) => {
        const active = t.getAttribute("data-pay-method") === method;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });

      document.getElementById("card-fields")?.classList.toggle("is-hidden", method !== "card");
      document.getElementById("applepay-fields")?.classList.toggle("is-hidden", method !== "applepay");
      document.getElementById("paynow-fields")?.classList.toggle("is-hidden", method !== "paynow");
    });
  });

  // Top Up form submit
  const topupForm = document.getElementById("topup-form");
  if (topupForm) {
    topupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const errEl = document.getElementById("topup-error");
      if (errEl) {
        errEl.classList.add("is-hidden");
        errEl.textContent = "";
      }

      if (appState.paymentMethod === "card") {
        const cardName = document.getElementById("card-name")?.value.trim() || "";
        const cardNum = (document.getElementById("card-number")?.value || "").replace(/\s+/g, "");
        if (!cardName || cardNum.length < 12) {
          if (errEl) {
            errEl.textContent = "Please enter a name and a 12–16 digit demo card number, or switch to Apple Pay / PayNow.";
            errEl.classList.remove("is-hidden");
          }
          return;
        }
      }

      const bundle = BUNDLES[appState.selectedBundleCoins] || BUNDLES[15];
      appState.coins += bundle.coins;
      appState.ledger.unshift({
        id: `topup-${Date.now()}`,
        date: getTodayDateString(),
        label: `Coin Top Up (${appState.paymentMethod.toUpperCase()})`,
        delta: bundle.coins,
      });

      saveState();
      renderHeaderAndWallet();
      showStatusBanner(`Top Up complete! +${bundle.coins} Coins added to your wallet.`);
      switchView("today");
    });
  }

  // Tracker filter tabs
  document.querySelectorAll("[data-tracker-filter]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const filter = tab.getAttribute("data-tracker-filter") || "all";
      appState.trackerFilter = filter;
      document.querySelectorAll("[data-tracker-filter]").forEach((t) => {
        const active = t.getAttribute("data-tracker-filter") === filter;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });
      renderTrackerList();
    });
  });

  // Auth modal wiring
  const authBtn = document.getElementById("header-auth-btn");
  if (authBtn) authBtn.addEventListener("click", openAuthModal);

  const authCloseBtn = document.getElementById("auth-close-btn");
  if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);

  const backdrop = document.getElementById("auth-modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeAuthModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.classList.contains("is-hidden")) {
      closeAuthModal();
    }
  });

  let authMode = "login";
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const nameWrap = document.getElementById("auth-name-wrap");
  const authSubmitBtn = document.getElementById("auth-submit-btn");

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener("click", () => {
      authMode = "login";
      tabLogin.classList.add("is-active");
      tabSignup.classList.remove("is-active");
      tabLogin.setAttribute("aria-selected", "true");
      tabSignup.setAttribute("aria-selected", "false");
      nameWrap?.classList.add("is-hidden");
      if (authSubmitBtn) authSubmitBtn.textContent = "Log In";
    });

    tabSignup.addEventListener("click", () => {
      authMode = "signup";
      tabSignup.classList.add("is-active");
      tabLogin.classList.remove("is-active");
      tabSignup.setAttribute("aria-selected", "true");
      tabLogin.setAttribute("aria-selected", "false");
      nameWrap?.classList.remove("is-hidden");
      if (authSubmitBtn) authSubmitBtn.textContent = "Create Account";
    });
  }

  const authForm = document.getElementById("auth-form");
  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email")?.value.trim() || "";
      const password = document.getElementById("auth-password")?.value || "";
      const nameInput = document.getElementById("auth-name")?.value.trim() || "";
      const errEl = document.getElementById("auth-error");

      if (!email.includes("@") || password.length < 6) {
        if (errEl) {
          errEl.textContent = "Please enter a valid email address and a password with at least 6 characters.";
          errEl.classList.remove("is-hidden");
        }
        return;
      }

      if (errEl) errEl.classList.add("is-hidden");
      appState.user.signedIn = true;
      appState.user.email = email;
      appState.user.name =
        authMode === "signup" && nameInput
          ? nameInput
          : email.split("@")[0].slice(0, 18);

      saveState();
      renderHeaderAndWallet();
      renderAstrologyAndProfileForms();
      closeAuthModal();
      showStatusBanner(`Welcome, ${appState.user.name}! Your front-end session is active.`);
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      appState.user.signedIn = false;
      appState.user.name = "Guest";
      saveState();
      renderHeaderAndWallet();
      closeAuthModal();
      showStatusBanner("You have logged out.");
    });
  }
}

/**
 * Syncs the selected Coin Top Up pack and payment method tabs with appState
 * when the page loads.
 */
function renderTopUpControls() {
  const coins = appState.selectedBundleCoins || 15;
  const bundle = BUNDLES[coins] || BUNDLES[15];

  document.querySelectorAll(".bundle-option").forEach((b) => {
    const selected = Number(b.getAttribute("data-bundle-coins")) === bundle.coins;
    b.classList.toggle("is-selected", selected);
    b.setAttribute("aria-pressed", String(selected));
  });

  const sumText = document.getElementById("summary-bundle-text");
  const priceText = document.getElementById("summary-price-text");
  if (sumText) sumText.textContent = `${bundle.coins} Coins`;
  if (priceText) priceText.textContent = `S$${bundle.price}`;
}

/**
 * Shows or hides the "Personalise with Astrology" card on the Today page
 * so initial access remains focused on "Ask Your Oracle".
 */
function setAstroPanelOpen(open, shouldFocus = false) {
  isAstroPanelOpen = Boolean(open);
  const workspaceGrid = document.getElementById("workspace-grid");
  const astroCard = document.getElementById("astrology-card");
  const toggleBtn = document.getElementById("toggle-astro-btn");

  if (workspaceGrid) {
    workspaceGrid.classList.toggle("is-astro-open", isAstroPanelOpen);
  }
  if (astroCard) {
    astroCard.classList.toggle("is-hidden", !isAstroPanelOpen);
  }
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", String(isAstroPanelOpen));
  }

  renderAstrologyAndProfileForms();

  if (shouldFocus) {
    if (isAstroPanelOpen) {
      const dobInput = document.getElementById("quick-dob");
      if (dobInput) dobInput.focus();
    } else if (toggleBtn) {
      toggleBtn.focus();
    }
  }
}

/**
 * Starts the application once the browser finishes reading the HTML file.
 */
function initApp() {
  wireAllEventListeners();
  setAstroPanelOpen(false, false);
  switchView(appState.activeView || "today");
  renderWeatherCard();
  renderTimeOfDayLabel();
  renderAstrologyAndProfileForms();
  renderHeaderAndWallet();
  renderTopUpControls();
  renderResultsSection();
  renderTrackerList();
  void fetchLiveOracleContext();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
