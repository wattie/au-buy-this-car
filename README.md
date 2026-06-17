# Should I Buy This Car?

MVP demo app with:

- `frontend/`: React + TypeScript single-page UI
- `backend/`: .NET minimal API with mocked car-analysis logic

Both sides are intentionally simple and structured so a real AI integration can replace the mock backend analysis later.

## Run locally

### Backend

Requirements:

- .NET 8 SDK

Commands:

```bash
cd backend
dotnet restore
dotnet run
```

The API runs on `http://localhost:5052`.

Provider configuration:

- Default mock mode: leave `CarAnalysis:Provider` as `Mock`
- OpenAI mode: set `CarAnalysis:Provider` to `OpenAI` and provide `OpenAI:ApiKey`
- Environment variable equivalents:
  - `CarAnalysis__Provider=OpenAI`
  - `OpenAI__ApiKey=your_api_key`
  - `OpenAI__Model=gpt-4.1-mini`

### Frontend

Requirements:

- Node.js
- npm

Commands:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Notes

- The MVP uses a mock backend rules engine rather than a live AI model.
- `POST /api/analyse-car` is the main backend endpoint.
- TODO markers are included where a real OpenAI integration can be added later.
