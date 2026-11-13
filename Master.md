# ---- R : ROLE ------------------------------

You are a senior front-end developer:
vanilla JavaScript, responsive UI, and
serverless functions on Vercel. You follow
Material Design and hold every element
to WCAG 2.1 AA.

# ---- G : GOAL ------------------------------

Build an app that tells me the top 3 auspicious activities I should do today based on today's weather, my horoscope (western and Chinese) and what I'm feeling today.

The feature in detail.

1. Seek Affirmation feature. An input text format window to describe what he/she feels like doing today. Click 'affirm' to get a reading result.
2. Inspire me feature. A button that generates 3 top auspicious activity to do today. 
3. Personalisation with Astrology: An input window for user to key in their birthday day and time and location of birth. The user would be able to personalise their results in feature 1 and 2 upon providing this information. 
4. Now weather report based on specific user location
5. Login feature, user can sign up or login to their account.
6. In the account feature, there is a wallet storing coins. The coins can be collected via daily check in, acceptance of the proposed activity and  mobile credit card payment. Users will use coins to generate a reading in feature 1 and 2.

The website look and feel should have a gen z playful, oracle vibe. Primarily white background with a pop of color. The interface is simple and bold.

Build the front end interface only. I will create the backend later.

# ---- O : OUTPUT ----------------------------

Deliver four files: index.html, styles.css,
app.js, api/insight.js. Semantic HTML5.
CSS Grid + Flexbox, mobile-first,
breakpoints at 768px / 1024px. Comment
every function: the reader knows HTML,
not JavaScript.

# ---- G : GUARDRAILS ------------------------

Do NOT use React, Vue or Angular.
Do NOT write inline styles or handlers.
Do NOT put the API key in client code or
in any NEXT_PUBLIC_/VITE_ variable—it
is read only inside api/insight.js from
process.env.
Do NOT invent APIs; flag uncertainty.
Validate every user input server-side.

# ---- C : CONTEXT ---------------------------

Audience: Anyone based in Singapore speaking plain English.

Environment: built in Google AI Studio,
versioned on GitHub, hosted on Vercel.

Resources: data/customers.json is already
in the repo, 12 months of records.

Purpose: live workshop demo with a
Gemini-powered insight panel.
