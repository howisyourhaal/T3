# Prompt Log — My Oracle (`FionBranch`)

Collated record of the product specification, master prompt, and session prompts for **My Oracle**.

---

## 1. Initial Master Prompt (`Master.md`)

**Role:** Senior front-end developer (vanilla JavaScript, responsive UI, serverless functions on Vercel, Material Design, WCAG 2.1 AA).

**Goal:** Build an app that tells the user the top 3 auspicious activities to do today based on today's weather, Western and Chinese astrology (Zi Wei Dou Shu), and what they are feeling today.

- **Main Page Features:**
  1. Seek Affirmation feature (text input describing what the user feels like doing today + `Affirm` button returning top 3 activities).
  2. Inspire Me feature (`Inspire Me` button generating top 3 auspicious activities; requires coins).
  3. Personalisation with Astrology (birthday, birth time, and birth location inputs to personalise results).
  4. Now weather report based on user location.
  5. Login / Sign Up feature.
- **User Profile Subpage:** Birth details, personal info, and Coin Wallet (daily check-in, activity acceptance rewards, coin top-up).
- **Coin Top Up Subpage:** Recharge coins via Credit Card, Apple Pay, or PayNow.
- **Look & Feel:** Gen Z playful oracle vibe, primarily white background with bold pops of colour.
- **Deliverables & Guardrails:** `index.html`, `styles.css`, `app.js`, `api/insight.js`; semantic HTML5, CSS Grid + Flexbox, mobile-first (`768px` / `1024px`), no React/Vue/Angular in UI, no inline styles/handlers, server-side API key via `process.env`, PII redaction, and AI-generated output disclosure.

---

## 2. Session Prompt 1 — Serverless Live Data & Health Endpoints

> 1. Add a serverless connection that pulls live data from a few different data sources using the following endpoints:
>    - 24-hour weather forecast data API: `https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast`
>    - Horoscope API: `https://freehoroscopeapi.com/api/v1/get-horoscope/daily?sign=aquarius`
>    - Purple Star API: `https://www.14mainstars.com/api/public/chart?date=1993-11-04&hour=21&minute=15&gender=female&cityId=kl&lang=en`
> 2. Store this in `/api` folder at the project root level (not `src` file).
> 3. Include `/health.ts` within the same subfolder.

**Implemented in:**
- `/api/live-data.ts`
- `/api/health.ts`
- `/api/insight.js`
- `/server.ts`
- Front-end wiring in `index.html`, `styles.css`, `app.js`

---

## 3. Session Prompt 2 — Push to GitHub

> `git push https://<REDACTED_TOKEN>@github.com/howisyourhaal/T3.git` (target branch: `FionBranch`)

*(Personal access token redacted for security.)*

---

## 4. Session Prompt 3 — Collate Prompts

> `collate all the prompts info promptfion.md file`

**Implemented in:**
- `/promptfion.md`
