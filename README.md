# XO Backend

Express + Socket.io + MongoDB server for the X & 0 game.

## Run locally
```bash
npm install
cp .env.example .env   # fill MONGO_URI (optional)
npm run dev
```
Runs on http://localhost:4000. Tests: `npm test`.

## Deploy (free) on Render
1. Push this repo to GitHub.
2. Render -> New Web Service -> pick the repo. Build: `npm install`, Start: `npm start`.
3. Add env vars `MONGO_URI` (from MongoDB Atlas free cluster) and `CLIENT_ORIGIN=*`.
4. Copy the resulting URL (e.g. https://xo-backend.onrender.com) into the frontend's `VITE_API_URL`.

Note: Render's free tier sleeps after inactivity; the first connection can take ~30s.

## Socket events
`create_room`, `join_room`, `move`, `rematch` (client -> server); `state`, `opponent_left` (server -> client).
REST: `GET /api/leaderboard`.
