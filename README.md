# Should I Buy This Car?

MVP demo app now packaged as a single `Next.js` project in `frontend/`.

What is inside:

- `frontend/`: Next.js app router UI plus API routes
- `backend/`: legacy .NET version kept for reference during the migration

The app still supports:

- mock analysis mode for demos
- optional OpenAI-backed analysis
- saved-car compare flows and three-year cost views

## Run locally

Requirements:

- Node.js 18+
- npm

Commands:

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

## Configuration

Default mock mode:

- leave `CAR_ANALYSIS_PROVIDER` unset, or set it to `Mock`

OpenAI mode:

- set `CAR_ANALYSIS_PROVIDER=OpenAI`
- set `OPENAI_API_KEY=your_api_key`
- optionally set `OPENAI_MODEL=gpt-4.1-mini`
- optionally set `OPENAI_BASE_URL=https://api.openai.com/v1/`

For convenience, the migrated app also accepts the old .NET-style environment variable names:

- `CarAnalysis__Provider`
- `OpenAI__ApiKey`
- `OpenAI__Model`
- `OpenAI__BaseUrl`

## API

- `GET /api/health`
- `POST /api/analyse-car`

## Notes

- The mock service remains the default path so the app is still easy to demo without external API setup.
- The Next.js API route falls back to the mock service if the OpenAI call fails or returns invalid JSON.
