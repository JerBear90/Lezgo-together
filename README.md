# Lezgo

Lezgo turns a poorly printed brick-set booklet into a step-by-step builder. Photograph each page, or upload photos you already took. A vision model reads the page into parts, placement, and a crop of that step. You swipe through the build one step at a time, check pieces off, and fix anything the model was not sure about.

Everything stays in this browser. Sets are stored in IndexedDB. There are no accounts.

## Run it

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With no API key, Lezgo runs in **demo mode**. Page readings are labeled sample data, and the Harbor Tug sample (Try sample) is a full build with an unsure part and a page that asks for a retake. Demo mode is enough to click through the whole app. The sample also draws a reconstructed diagram, with stud arrows, without a key.

Each step is rebuilt from the parts found on the page. Known bricks get a standard part number (the same numbers LDraw and BrickLink use) and a stud position. The step view draws those bricks with studs, highlights the new ones, and points an arrow at them. Anything uncertain is a ghost with an Unsure badge, not a guessed brick. Photo is one tap away. Drag an arrow or use the stud +/− buttons to correct a placement; the change is saved on this device. No extra service is required for the diagram.

## Vision model

Live readings use the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) through the AI SDK. Copy `.env.example` to `.env.local` and set:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | No | Gateway key for local runs and hosts other than Vercel. When this and `VERCEL_OIDC_TOKEN` are unset, the app stays in demo mode. |
| `AI_GATEWAY_MODEL` | No | Model id with image input and structured output. Default: `google/gemini-3.5-flash-lite`. |
| `VERCEL_OIDC_TOKEN` | No | Set by Vercel on deployments. Do not put a secret in git. |

The model is told to prefer **uncertain** over guessing. Each part carries a certainty flag and the fields that could not be read (color, shape, size, quantity), plus a stud offset and a pose on the build. If a stud count or a spot is not clear, that number stays empty. If a photo is too blurry, dark, cropped, angled, or low-resolution, the page comes back with a retake flag and a short reason, and the page offers a one-tap retake.

## Scripts

```bash
npm test          # unit tests for extraction parsing and the step player
npm run lint
npm run build
npm run test:e2e  # Playwright, demo mode, phone and desktop projects
```

`npm run test:e2e` expects a production build (`npm run build`) because Playwright starts `npm run start`. The browser is Chromium. The phone project uses a 390×844 viewport.

## Tests in CI

`.github/workflows/ci.yml` runs on every pull request. It checks out the PR merged with the latest `main`, installs dependencies and Chromium, lints, runs the unit tests, builds, and runs Playwright. Screenshots from the end-to-end tests are uploaded as the `playwright-screenshots` artifact.
