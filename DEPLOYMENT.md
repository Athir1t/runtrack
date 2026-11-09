# Deployment

This app can be deployed as a public, read-only site using Vercel and a hosted
PostgreSQL provider such as Neon. Only an authenticated admin can edit data,
connect Strava, or request a sync.

## Before deploying

- Keep the source repository private. Do not commit `.env.local`,
  `src/data/strava-token.json`, or any credential.
- Rotate the Strava client secret before deploying: it was present in the
  obsolete local server and must be treated as exposed. Update the new secret
  in your local `.env.local` and Vercel's environment settings.
- Create a PostgreSQL database and use its pooled connection URL as
  `DATABASE_URL`. The app creates its tables and seeds the roster/program on
  its first request. A new hosted database does not automatically copy local
  database edits or synced activity history; reconnect Strava and sync the
  weeks you need, or migrate those records separately.
- The app stores Strava access and refresh tokens in PostgreSQL. Connect Strava
  from the deployed site after deployment; the local token file is only read
  once as a migration fallback and is ignored by Git.
- This Strava integration reads the one athlete who authorizes it. It cannot
  sync other club members' private activities merely from the club roster.

## Vercel environment variables

Add these in the Vercel project's Settings → Environment Variables, then
redeploy:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL pooled connection URL |
| `STRAVA_CLIENT_ID` | Client ID from Strava API settings |
| `STRAVA_CLIENT_SECRET` | Client secret from Strava API settings |
| `STRAVA_CLUB_ID` | `2403606` |
| `ADMIN_USERNAME` | Your chosen admin login name |
| `ADMIN_PASSWORD` | A unique password (at least 11 characters) |
| `ADMIN_SESSION_SECRET` | Random secret of at least 32 characters |

Generate a session secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Do not paste secrets into chat or commit them. Vercel provides `NODE_ENV` for
production; do not set `NEXT_PUBLIC_` on any server-side secret.

## Strava callback

After you know the deployed hostname, set the Strava API application's
**Authorization Callback Domain** to that hostname only (for example,
`your-project.vercel.app`, without `https://` or a path). The app then uses
`https://your-project.vercel.app/api/strava/callback` as the callback URL.
Log in as admin and connect Strava from the deployed site.

## Use on a phone

Open the deployed HTTPS URL in the phone browser. Anyone can view the site.
Choose **Admin login** to sync Strava or edit the roster/program.

Free hosting plans have usage and eligibility limits that can change. Check
the current provider terms. Vercel Hobby is intended for personal, non-
commercial projects; confirm its terms for a club site. Strava's own API
access and athlete limits also apply. Only the athlete who authorizes Strava
can have private activities synced by this app.
