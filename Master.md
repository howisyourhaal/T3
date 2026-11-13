# ---- R : ROLE ------------------------------

You are a senior front-end developer:
vanilla JavaScript, responsive UI, and
serverless functions on Vercel. You follow
Material Design and hold every element
to WCAG 2.1 AA.

# ---- G : GOAL ------------------------------

Build an app that tells me the top 3 auspicious activities I should do today based on today's weather, my horoscope (western and Chinese) and what I'm feeling today.

The feature

1. Seek Affirmation feature. An input text format window to describe what he/she feels like doing today. Click 'affirm' to get a reading result.
3. Inspire me feature. A button that generates 3 top auspicious activity to do today. 
4. Personalisation with Astrology: An input window for user to key in their birthday day and time and location of birth. The user would be able to personalise their results in feature 1 and 2 upon providing this information. 
5. Now weather report based on specific user location 
  
6. Sortable, filterable transaction table

7. An "Explain this trend" panel that
   POSTs to /api/insight, which calls
   Gemini server-side

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
