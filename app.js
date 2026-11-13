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
      user: { ...fallback.user, ...(parsed.user || {}) },
    };
  } catch {
    return fallback;
  }
}

let appState = loadInitialState();
let lastFocusedElement = null;
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
  const todayCoin = document.getElementById("today-coin-balance");
  const profileCoin = document.getElementById("profile-coin-balance");
  const authBtn = document.getElementById("header-auth-btn");

  if (headerCoin) headerCoin.textContent = String(appState.coins);
  if (todayCoin) todayCoin.textContent = String(appState.coins);
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

  ["daily-checkin-btn", "profile-checkin-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = alreadyCheckedIn;
    btn.textContent = alreadyCheckedIn ? "Checked In Today" : id === "daily-checkin-btn" ? "Daily Check-In (+5)" : "Claim +5 Coins";
  });

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
 * Updates the Weather card text, location dropdown, and custom location input
 * based on live NEA 24-hour forecast data (or manual weather preview preset).
 */
function renderWeatherCard() {
  const weather = getActiveWeatherSummary();
  const tempEl = document.getElementById("weather-temp-display");
  const condEl = document.getElementById("weather-condition-display");
  const adviceEl = document.getElementById("weather-advice-text");
  const selectEl = document.getElementById("location-select");
  const customWrap = document.getElementById("custom-location-wrap");
  const customInput = document.getElementById("custom-location-input");

  if (tempEl) tempEl.textContent = weather.tempText;
  if (condEl) condEl.textContent = weather.condition;
  if (adviceEl) adviceEl.textContent = weather.advice;
  if (selectEl) selectEl.value = appState.locationKey;
  if (customWrap) customWrap.classList.toggle("is-hidden", appState.locationKey !== "custom");
  if (customInput) customInput.value = appState.customLocation;
}

/**
 * Syncs the birthday, birth time, birth location, and life stage inputs across
 * both the Main Page quick astrology panel and the Profile Subpage.
 */
function renderAstrologyAndProfileForms() {
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);

  const heroDate = document.getElementById("hero-date-text");
  const heroAstro = document.getElementById("hero-astro-summary");
  const locationLabel =
    appState.locationKey === "custom" && appState.customLocation.trim()
      ? redactPersonalInfo(appState.customLocation.trim())
      : LOCATION_LABELS[appState.locationKey] || "Singapore";

  if (heroDate) {
    const formatted = new Date().toLocaleDateString("en-SG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    heroDate.textContent = `${formatted} · ${locationLabel}`;
  }

  if (heroAstro) {
    if (western && chinese) {
      heroAstro.textContent = `${western.name} · Year of the ${chinese.animal} (${chinese.element})`;
    } else {
      heroAstro.textContent = "Set your birthday to personalise your chart";
    }
  }

  const wEl = document.getElementById("chart-western-sign");
  const cEl = document.getElementById("chart-chinese-sign");
  const zEl = document.getElementById("chart-ziwei-palace");
  const pStarEl = document.getElementById("chart-purple-star");
  const horoEl = document.getElementById("chart-horoscope-snippet");

  if (wEl) wEl.textContent = western ? `${western.name} (${western.element})` : "Not set yet";
  if (cEl) cEl.textContent = chinese ? `${chinese.element} ${chinese.animal}` : "Not set yet";
  if (zEl) zEl.textContent = chinese ? chinese.palace : "General Fortune";

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
  const segmentSelect = document.getElementById("segment-select");
  if (quickDob) quickDob.value = appState.user.dob;
  if (quickTime) quickTime.value = appState.user.birthTime;
  if (quickPlace) quickPlace.value = appState.user.birthPlace;
  if (segmentSelect) segmentSelect.value = appState.user.segment;

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
 * Generates three Singapore-tailored auspicious activities locally on the front end
 * using the user's weather preset, Western & Chinese astrology, segment, and mood.
 * Never calls external APIs yet and never repeats raw personal identifiers.
 */
function buildLocalOracleReading(mode, feelingRaw, targetDate) {
  const weather = WEATHER_PRESETS[appState.weatherIndex % WEATHER_PRESETS.length];
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);
  const segment = appState.user.segment || "adult";
  const safeMood = redactPersonalInfo(feelingRaw);

  const poolsBySegment = {
    adult: {
      indoor: [
        {
          title: "Tidy your desk & map one bold career move",
          category: "Financial & Career Move",
          window: "10:30 – 12:30",
          rationale: "Clears stagnant energy while rain or midday heat stays outside. Ideal for reviewing finances or sending a thoughtful proposal.",
        },
        {
          title: "Solo kopi or matcha reset at a quiet neighbourhood cafe",
          category: "Wellness & Recharge",
          window: "14:30 – 16:30",
          rationale: "Gives your mind breathing room away from back-to-back notifications and helps you make decisions without rush.",
        },
        {
          title: "Send a warm voice note to an ally or mentor",
          category: "Social & Networking",
          window: "17:00 – 19:00",
          rationale: "Strengthens helpful connections in your Social Palace without requiring heavy travel across town.",
        },
        {
          title: "Declutter 15 items in your wardrobe or living corner",
          category: "Home & Decluttering",
          window: "19:30 – 21:00",
          rationale: "Opens fresh Fengshui flow at home and reduces decision fatigue for the rest of the week.",
        },
      ],
      outdoor: [
        {
          title: "Breezy morning walk along MacRitchie or Marina Barrage",
          category: "Wellness & Recharge",
          window: "08:00 – 10:00",
          rationale: "Clear, comfortable skies support grounded thinking before the sun peaks.",
        },
        {
          title: "Coffee catch-up in Tiong Bahru or Joo Chiat",
          category: "Social & Networking",
          window: "11:00 – 13:00",
          rationale: "Fresh air and lively neighbourhood energy spark lucky conversations and timely introductions.",
        },
        {
          title: "Visit a museum gallery then review your monthly savings goal",
          category: "Financial & Career Move",
          window: "15:00 – 17:30",
          rationale: "Pairs visual inspiration with practical clarity so big plans feel effortless.",
        },
      ],
    },
    teen: {
      indoor: [
        {
          title: "25-minute focused study sprint with a lo-fi playlist",
          category: "Study & Exam Preps",
          window: "10:00 – 12:00",
          rationale: "Indoor calm boosts memory retention while keeping stress low.",
        },
        {
          title: "Curate a moodboard or shoot a short creative clip indoors",
          category: "Creative & Digital Expressions",
          window: "15:00 – 17:00",
          rationale: "Channels restless curiosity into something playful you can share with friends.",
        },
        {
          title: "Bubble tea & board games hang at a sheltered mall",
          category: "Social Hangouts & Explorations",
          window: "17:30 – 19:30",
          rationale: "Keeps plans dry and upbeat with zero weather hassle.",
        },
      ],
      outdoor: [
        {
          title: "Cycle or skate along East Coast Park before sunset",
          category: "Sports & Activity Plays",
          window: "17:00 – 18:45",
          rationale: "Breezy coastal weather lifts mood and shakes off screen fatigue.",
        },
        {
          title: "Photo walk through Haji Lane or Chinatown murals",
          category: "Creative & Digital Expressions",
          window: "10:00 – 11:45",
          rationale: "Bright natural light makes spontaneous street snaps pop.",
        },
        {
          title: "Library study session + hawker lunch with classmates",
          category: "Study & Exam Preps",
          window: "12:00 – 14:30",
          rationale: "Balances productive focus with fun social energy.",
        },
      ],
    },
    elderly: {
      indoor: [
        {
          title: "Light indoor stretching & warm herbal tea ritual",
          category: "Health & Gentle Movement",
          window: "09:00 – 10:30",
          rationale: "Keeps joints comfortable indoors when weather turns humid or rainy.",
        },
        {
          title: "Call a grandchild or share an old family recipe photo",
          category: "Family & Grandparenting",
          window: "14:00 – 16:00",
          rationale: "Brings warmth and connection to your household luck today.",
        },
        {
          title: "Calm calligraphy, reading, or listening to heritage tunes",
          category: "Spiritual & Cultural",
          window: "16:30 – 18:00",
          rationale: "Nurtures steady breath and peaceful focus.",
        },
      ],
      outdoor: [
        {
          title: "Early Tai Chi or stroll at Botanic Gardens",
          category: "Outdoor Light Exercises",
          window: "07:30 – 09:00",
          rationale: "Cool morning air supports vitality and gentle circulation.",
        },
        {
          title: "Visit a neighbourhood temple or heritage centre",
          category: "Spiritual & Cultural",
          window: "09:30 – 11:00",
          rationale: "Aligns peacefully with today's almanac energy for gratitude and clarity.",
        },
        {
          title: "Afternoon tea & fresh fruit market run with family",
          category: "Family & Grandparenting",
          window: "16:30 – 18:00",
          rationale: "Pleasant late-afternoon breeze makes errands enjoyable.",
        },
      ],
    },
  };

  const chosenPool = weather.isOutdoorFriendly
    ? poolsBySegment[segment].outdoor
    : poolsBySegment[segment].indoor;

  const signNote = western && chinese
    ? `Tailored for ${western.name} (${western.element}) & ${chinese.element} ${chinese.animal} under ${chinese.palace}.`
    : "Add your birthday above to layer Western & Zi Wei Dou Shu chart notes onto each card.";

  const activities = chosenPool.slice(0, 3).map((item, idx) => {
    let customTitle = item.title;
    let customRationale = `${item.rationale} ${signNote}`;

    if (mode === "affirm" && safeMood && idx === 0) {
      customTitle = `Green light: ${safeMood}`;
      customRationale = `Your intention aligns well with ${weather.condition.toLowerCase()} weather today. Take it step by step during the peak window. ${signNote}`;
    }

    return {
      id: `${Date.now()}-${idx}`,
      rank: `0${idx + 1}`,
      title: customTitle,
      category: item.category,
      window: item.window,
      weatherFit: `${weather.tempC}°C · ${weather.condition}`,
      rationale: customRationale,
      targetDate: targetDate || getTodayDateString(),
    };
  });

  const hues = ["Electric Violet", "Warm Marigold", "Jade Mint", "Crisp Ivory"];
  const luckyHue = hues[(weather.tempC + activities.length) % hues.length];

  return {
    mode,
    date: targetDate || getTodayDateString(),
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
  const emptyBox = document.getElementById("results-empty");
  const loadingBox = document.getElementById("results-loading");
  const grid = document.getElementById("results-grid");
  const luckInfo = document.getElementById("results-luck-info");
  const disclosure = document.getElementById("ai-disclosure");
  const metaLine = document.getElementById("results-meta-line");

  if (loadingBox) loadingBox.classList.add("is-hidden");

  if (!appState.lastReading) {
    if (emptyBox) emptyBox.classList.remove("is-hidden");
    if (grid) grid.classList.add("is-hidden");
    if (luckInfo) luckInfo.classList.add("is-hidden");
    if (disclosure) disclosure.classList.add("is-hidden");
    return;
  }

  const reading = appState.lastReading;
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
    metaLine.textContent =
      reading.mode === "affirm"
        ? `Affirmation reading for ${reading.date} · Accept any move below to earn +2 Coins.`
        : `Daily inspiration for ${reading.date} · Accept any move below to earn +2 Coins.`;
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
  const segmentSelect = document.getElementById("segment-select");
  const loadingBox = document.getElementById("results-loading");
  const emptyBox = document.getElementById("results-empty");
  const grid = document.getElementById("results-grid");
  const affirmBtn = document.getElementById("affirm-submit-btn");
  const inspireBtn = document.getElementById("inspire-btn");

  if (feelingError) {
    feelingError.classList.add("is-hidden");
    feelingError.textContent = "";
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
    showStatusBanner(`You need ${cost} Coin(s) for this reading. Claim Daily Check-In or Top Up!`);
    switchView("topup");
    return;
  }

  if (segmentSelect) {
    appState.user.segment = segmentSelect.value;
  }

  const targetDate = targetDateInput && targetDateInput.value ? targetDateInput.value : getTodayDateString();
  const western = getWesternSign(appState.user.dob);
  const chinese = getChineseAstrology(appState.user.dob, appState.user.birthTime);
  const region = ["central", "east", "west", "north", "south"].includes(appState.locationKey)
    ? appState.locationKey
    : "central";
  const locationLabel =
    appState.locationKey === "custom" && appState.customLocation.trim()
      ? redactPersonalInfo(appState.customLocation.trim())
      : LOCATION_LABELS[appState.locationKey] || "Singapore";

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
        segment: appState.user.segment,
        region,
        location: locationLabel,
        targetDate,
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
  renderHeaderAndWallet();
  renderResultsSection();
  showStatusBanner(
    mode === "affirm"
      ? "Affirmation ready! (-1 Coin)"
      : "Fresh Top 3 inspiration ready! (-2 Coins)"
  );
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

  // Location & Weather controls
  const locSelect = document.getElementById("location-select");
  if (locSelect) {
    locSelect.addEventListener("change", () => {
      appState.locationKey = locSelect.value;
      liveContextState.useLiveWeather = true;
      saveState();
      renderWeatherCard();
      renderAstrologyAndProfileForms();
      void fetchLiveOracleContext();
    });
  }

  const customLocInput = document.getElementById("custom-location-input");
  if (customLocInput) {
    customLocInput.addEventListener("input", () => {
      appState.customLocation = customLocInput.value;
      saveState();
      renderAstrologyAndProfileForms();
    });
  }

  const refreshWeatherBtn = document.getElementById("refresh-weather-btn");
  if (refreshWeatherBtn) {
    refreshWeatherBtn.addEventListener("click", () => {
      liveContextState.useLiveWeather = true;
      void fetchLiveOracleContext().then(() => {
        showStatusBanner("Synced live Singapore 24-hour weather, horoscope, and star chart.");
      });
    });
  }

  const cycleWeatherBtn = document.getElementById("cycle-weather-btn");
  if (cycleWeatherBtn) {
    cycleWeatherBtn.addEventListener("click", () => {
      liveContextState.useLiveWeather = false;
      appState.weatherIndex = (appState.weatherIndex + 1) % WEATHER_PRESETS.length;
      saveState();
      renderWeatherCard();
      showStatusBanner(`Weather preview updated to ${WEATHER_PRESETS[appState.weatherIndex].condition}.`);
    });
  }

  // Daily Check-In buttons
  ["daily-checkin-btn", "profile-checkin-btn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", handleDailyCheckIn);
  });

  // Feeling character counter & Quick Prompt buttons
  const feelingInput = document.getElementById("feeling-input");
  const charCount = document.getElementById("feeling-char-count");
  if (feelingInput && charCount) {
    feelingInput.addEventListener("input", () => {
      charCount.textContent = `${feelingInput.value.length}/240`;
    });
  }

  document.querySelectorAll(".prompt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const promptText = btn.getAttribute("data-prompt") || "";
      if (feelingInput) {
        feelingInput.value = promptText;
        if (charCount) charCount.textContent = `${promptText.length}/240`;
        feelingInput.focus();
      }
    });
  });

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
 * Starts the application once the browser finishes reading the HTML file.
 */
function initApp() {
  wireAllEventListeners();
  switchView(appState.activeView || "today");
  renderWeatherCard();
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
