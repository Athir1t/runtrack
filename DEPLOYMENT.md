# Deployment

This app can be deployed using Vercel and a hosted PostgreSQL provider such as
Neon. Visitors can see the roster and weekly summaries. Detailed team activity
is available after signing in with Strava, and an athlete can sync their own
Strava activities or add app-only manual activities. Only an authenticated
admin can edit the roster and training program.

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
- The app stores each athlete's Strava connection and access/refresh tokens in
  PostgreSQL. Every athlete must sign in and authorize the app individually;
  previously connected accounts must authorize again after this change.
- Strava may restrict an app to a small number of athletes until multi-athlete
  access is approved. Check the app's current Strava API access level before
  inviting the whole team. A roster entry alone does not grant access to that
  athlete's private activities.
- Manual activities are stored only in this app and are never uploaded to
  Strava. Signed-in athletes can view team activity details; anonymous visitors
  receive only weekly summary data.

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
| `CRON_SECRET` | Random secret used to authorize the scheduled Strava sync |

Generate a session secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Do not paste secrets into chat or commit them. Vercel provides `NODE_ENV` for
production; do not set `NEXT_PUBLIC_` on any server-side secret.

## Daily Strava sync

The Vercel cron job in `vercel.json` refreshes the current Thailand training
week once daily at **02:00 Thailand time**. It syncs every connected athlete
using that athlete's saved token; athletes only need to authorize Strava once
and do not need to press Sync every day. If authorization is revoked or expires,
that athlete must reconnect. Add `CRON_SECRET` to Vercel's Production
environment variables before deploying this version. Vercel invokes scheduled
jobs for Production deployments, not Preview deployments. Generate the secret
locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The scheduled job refreshes only the current training week. Manual activities
remain in the app and are not changed by Strava syncs. Scheduled jobs run on
Vercel after deployment; local development does not run the Vercel schedule.

## Strava callback

After you know the deployed hostname, set the Strava API application's
**Authorization Callback Domain** to that hostname only (for example,
`your-project.vercel.app`, without `https://` or a path). The app then uses
`https://your-project.vercel.app/api/strava/callback` as the callback URL.
After deployment, each athlete can use **นักกีฬาเข้าสู่ระบบ** to authorize
their own Strava account. The profile name must match exactly one active roster
entry; ambiguous name matches are rejected. Admins use **Admin login** to edit
the roster and training program.

## Use on a phone

Open the deployed HTTPS URL in the phone browser. Anyone can view the site.
Choose **นักกีฬาเข้าสู่ระบบ** to sync your own Strava activities or add manual
activities. Choose **Admin login** to edit the roster and training program.

Free hosting plans have usage and eligibility limits that can change. Check
the current provider terms. Vercel Hobby is intended for personal, non-
commercial projects; confirm its terms for a club site. Strava's own API
access and athlete limits also apply.
