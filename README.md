# Kalvi Mitra (Kavli) — AI Teaching Bot UI

Front-end implementation of the Figma design for a bilingual (Tamil / English / both) AI tutor for Tamil Nadu State Board (Samacheer Kalvi) students, Classes 1–12.

Figma: https://www.figma.com/design/wGFWfAauKqkYhYMGLL00VU/Untitled

## Stack
Vite · React 18 · TypeScript · React Router. No UI library; design tokens live in `src/styles/tokens.css` and mirror the Figma variables.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

## Screens (routes)
| Area | Routes |
|---|---|
| Public | `/`, `/signup`, `/profile`, `/verify`, `/verify/:ref` |
| Student | `/app`, `/app/lesson`, `/app/tutor`, `/app/material` |
| Tests & certificates | `/app/tests`, `/app/tests/:id` (instructions), `/app/tests/:id/take`, `/app/tests/:id/result`, `/app/certificates`, `/app/certificates/:ref` (A4, printable) |
| Parent / Teacher / Admin | `/parent`, `/teacher/builder`, `/teacher/results`, `/admin/certificates` |

Layout is a sidebar on desktop and a bottom navigation on screens up to 900 px.

## Status: UI prototype
All data is **demo data** (`src/data/demo.ts`) and is labelled as such. Not yet implemented:
- Authentication, API, database, AI tutor, file processing.
- **Scoring, pass/fail and certificate issuance must be done server-side**; the client only displays results. Integration points are marked `TODO` in the code.
- Certificates are platform-issued achievement certificates: no official board or government branding or signatures.
