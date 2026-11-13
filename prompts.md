# My Oracle — Collated Prompts

A chronological record of all user prompts used to build and iterate on **My Oracle**.

---

## Prompt 1 — Initial Project Brief & Master Prompt

Build an app based on the prompts below. Also refer to the 2 attachment about the project. Project Name: My Oracle.

```text
# ---- R : ROLE ------------------------------

You are a senior front-end developer:
vanilla JavaScript, responsive UI, and
serverless functions on Vercel. You follow
Material Design and hold every element
to WCAG 2.1 AA.

# ---- G : GOAL ------------------------------

Build an app that tells me the top 3 auspicious activities I should do today based on today's weather, my horoscope (western and Chinese) and what I'm feeling today.


Main Page will include these features:
1. Seek Affirmation feature. An input text format window to describe what he/she feels like doing today. Click 'affirm'to get result of the top 3 activities.
2. Inspire me feature. A button that generates 3 top auspicious activity to do today. Requires coin to generate result.
3. Personalisation with Astrology: An input window for user to key in their birthday day and time and location of birth. The user would be able to personalise their results in feature 1 and 2 upon providing this information. 
4. Now weather report based on specific user location
5. Login feature, user can sign up or login to their account.

User Profile Subpage
A user profile. User can key in their birthday day and time and location of birth and other personal information. 
In the account feature, there is a wallet storing coins. The coins can be collected via daily check in, acceptance of the proposed activity and  mobile credit card payment. Users will use coins to generate a reading in feature 1 and 2.

Coin Top Up Subpage
User can recharge their coins into their wallet via credit card/Apple Pay etc.

The website look and feel should have a gen z playful, oracle vibe. Primarily white background with a pop of color. The interface is simple and bold.

Build the front end interface only. Do not call any external APIS yet. I will create the backend later.

# ---- O : OUTPUT ----------------------------

Deliver four files: index.html, styles.css,
app.js, api/insight.js. Semantic HTML5.
CSS Grid + Flexbox, mobile-first,
breakpoints at 768px / 1024px. Comment
every function: the reader knows HTML,
not JavaScript. For WCAG 2.1 AA standards.

# ---- G : GUARDRAILS ------------------------

Do NOT use React, Vue or Angular.
Do NOT write inline styles or handlers.
Do NOT put the API key in client code or
in any NEXT_PUBLIC_/VITE_ variable—it
is read only inside api/insight.js from
process.env.
Do NOT invent APIs; flag uncertainty.
Validate every user input server-side.

# ---- ETHICAL GUARDRAILS --------------------------------------------

1. Never invent facts, citations, APIs, statistics or method names.
   If you are not sure, say what you are unsure about and stop.

2. Cite a source for every factual claim, or mark it clearly as an estimate.

3. Never echo, store or repeat personal data that appears in the input.
   Redact it in your output.

4. If a request would be harmful or unlawful, refuse and say why in one line.
   Do not silently produce a degraded version instead.

5. Do not infer or guess protected attributes—race, religion, health,
   sexuality, political view—from names, photographs or writing style.

6. When output will be read by a person, state that it was AI-generated.



# ---- C : CONTEXT ---------------------------

Audience: Largely female audience based in Singapore speaking plain English. They have interest in fengshui, horoscope, new age, working professionals.

Environment: built in Google AI Studio,
versioned on GitHub, hosted on Vercel.

Resources: data/customers.json is already
in the repo, 12 months of records.

Purpose: live workshop demo with a
Gemini-powered insight panel.
```

**Attachments referenced:**
- `public/assets/aistudio/Awesome_API_project_66b3fdaa.csv` (Product Discovery / Business Model Canvas notes)
- `public/assets/aistudio/image_312dd20a.png` (Auspicious Day – Product Discovery Canvas diagram)

---

## Prompt 2 — Push Initial Build to GitHub

```text
git push https://<REDACTED_GITHUB_TOKEN>@https://github.com/howisyourhaal/T3.git
```

*(Personal access token redacted for security.)*

---

## Prompt 3 — Visual Enhancement (Dark Starry Background)

```text
1. Make the site more visually attractive by adding a dark background with stars.
```

---

## Prompt 4 — Menu Bar Update

```text
1. Menu bar: Remove Tracker. Replace 'Today' with 'Ask the Oracle'
```

---

## Prompt 5 — Push Visual & Menu Updates to GitHub

```text
git push https://<REDACTED_GITHUB_TOKEN>@https://github.com/howisyourhaal/T3.git
```

*(Personal access token redacted for security.)*

---

## Prompt 6 — Collate Prompts

```text
Collate all the prompts and save them into file name prompts.md
```
