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

With no API key, Lezgo runs in **demo mode**. Page readings are labeled sample data, and the Harbor Tug sample (Try sample) is a full build with an unsure part and a page that asks for a retake. Demo mode is enough to click through the whole app.

## Vision model

Live readings use the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) through the AI SDK. Copy `.env.example` to `.env.local` and set:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | No | Gateway key for local runs and hosts other than Vercel. When this and `VERCEL_OIDC_TOKEN` are unset, the app stays in demo mode. |
| `AI_GATEWAY_MODEL` | No | Model id with image input and structured output. Default: `google/gemini-3.5-flash-lite`. |
| `VERCEL_OIDC_TOKEN` | No | Set by Vercel on deployments. Do not put a secret in git. |

The model is told to prefer **uncertain** over guessing. Each part carries a certainty flag and the fields that could not be read (color, shape, size, quantity). Each step carries a placement certainty. If a photo is too blurry, dark, cropped, angled, or low-resolution, the page comes back with a retake flag and a short reason, and the page offers a one-tap retake.

## Scripts

```bash
npm test          # unit tests for extraction parsing and the step player
npm run lint
npm run build
npm run test:e2e  # Playwright, demo mode, phone and desktop projects
```

`npm run test:e2e` expects a production build (`npm run build`) because Playwright starts `npm run start`. The browser is Chromium. The phone project uses a 390×844 viewport.

## Build together

Players are names and a color on this device. No accounts and no passwords.

One person opens **Together** and creates a room code (also a link and a QR code). Someone else opens **Join a room with a code**, types the code, and picks a name. If they use a name that was already in the room, they pick up that builder’s steps and checks. Each person’s place is saved as they move, including after the tab closes.

Sections such as Hull and Cabin can be assigned to different people. If the reader cannot see where a section ends, or where the parts join, that boundary stays marked **Unsure**. The **Combine** step is where the sub-builds meet.

### Where room data lives

| Setup | What happens |
| --- | --- |
| No room env vars | Rooms stay in the server’s memory. Two browsers on `npm run dev` or `npm start` can share a code. On Vercel, each instance has its own memory, so two phones will not see each other. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | The room (steps, sections, and each player’s progress) is stored in Upstash Redis. Clients poll about every 1.5 seconds. |
| `BLOB_READ_WRITE_TOKEN` | Instruction photos are uploaded to Vercel Blob and the room stores the URLs. |

Upstash Redis and Vercel Blob both have free tiers. You are billed only if you pass those limits. This repo does not provision either one for you.

### Set this up on Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). Framework: Next.js. Do not add a paid add-on during import.
2. In the new project, open **Storage** → **Create** → **Upstash Redis** (Marketplace). Choose the free plan. Connect it to this project. Vercel writes `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. **Storage** → **Create** → **Blob**. Choose the free Blob store and connect it. Vercel writes `BLOB_READ_WRITE_TOKEN`.
4. Optional: **Settings → Environment Variables** → `AI_GATEWAY_API_KEY` if you want live booklet reading. Without it, demo mode still runs.
5. Redeploy so the new variables are available. Do not commit `.env.local`.

For local Redis or Blob, copy the same variable names into `.env.local` from the Vercel project (**Settings → Environment Variables**, or `vercel env pull`).

Rooms expire after 24 hours. A code that does not exist returns “does not match”. A full room (6 people still present) asks you to wait. Someone who closes the app drops out of the seat after about 45 seconds; their checks stay, and joining again with the same name restores them. If two saves touch the same player at once, the later save wins and the other players’ checks are kept.

## Tests in CI

`.github/workflows/ci.yml` runs on every pull request. It checks out the PR merged with the latest `main`, installs dependencies and Chromium, lints, runs the unit tests, builds, and runs Playwright. Screenshots from the end-to-end tests are uploaded as the `playwright-screenshots` artifact.
