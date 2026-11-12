# UNH Schedule Studio
Run locally (Node 18+, no npm install needed):
1. `npm run fetch` (no term) lists term codes from https://webcat.unh.edu/StudentRegistrationSsb
2. `npm run fetch -- <termCode>` (repeat per term)
3. `npm start` → http://localhost:3000
Without data files the site falls back to its built-in sample catalog.
Deploy: any Node host (Render, Railway, Fly.io). Start command `npm start`; refresh data with a scheduled job running the fetch command.