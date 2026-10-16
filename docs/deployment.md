# Deploying TeamFlow

TeamFlow deploys as **one Node web service** that serves both the API (`/api/v1/*`) and the
built React app (every other path). Because the browser sees a single origin, the
`HttpOnly` refresh cookie works with `SameSite=Lax`, with no cross-site cookie or CORS
setup.

| Piece | Service | Cost |
| ----- | ------- | ---- |
| Web service (API + SPA) | [Render](https://render.com) via `render.yaml` | Free plan |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster | Free |
| CI (lint, typecheck, tests, build) | GitHub Actions (`.github/workflows/ci.yml`) | Free for public repos; included minutes for private |

Every push to the deployed branch runs CI, and Render deploys once the checks pass.

## 1. Create the database (MongoDB Atlas, about 5 minutes)

1. Sign in at <https://cloud.mongodb.com> and create a **free M0 cluster**.
2. **Database Access** → add a database user with a generated password and the
   *Read and write to any database* role.
3. **Network Access** → add `0.0.0.0/0`. Render's free plan has no fixed outbound IPs, so
   access is protected by the database user's credentials instead.
4. **Connect → Drivers** → copy the connection string, insert the password, and add the
   database name before the `?`:

   ```
   mongodb+srv://teamflow:<password>@cluster0.xxxxx.mongodb.net/teamflow?retryWrites=true&w=majority
   ```

Atlas clusters are replica sets, so TeamFlow's multi-document operations run inside real
transactions in production (see `architecture.md` §7).

## 2. Create the web service (Render, about 5 minutes)

1. Sign in at <https://dashboard.render.com> with GitHub and give Render access to the
   `TeamFlow` repository.
2. **New → Blueprint**, select the repository, and choose the branch to deploy.
3. Render reads `render.yaml` and asks for `MONGODB_URI`: paste the Atlas string.
   `JWT_ACCESS_SECRET` is generated automatically, and the other variables are preset.
4. **Apply.** The first build takes a few minutes. When the health check
   (`/api/v1/health/ready`) passes, the app is live at `https://teamflow-xxxx.onrender.com`.

### What `render.yaml` configures

| Setting | Value | Why |
| ------- | ----- | --- |
| Build | `npm ci --include=dev && npm run build` | TypeScript and Vite are dev dependencies |
| Start | `npm run start -w server` | Runs `server/dist/server.js` |
| `NODE_ENV` | `production` | JSON logs, `Secure` cookies, generic 500 messages |
| `CLIENT_DIST_DIR` | `../client/dist` | The API also serves the SPA |
| `TRUST_PROXY` | `1` | Correct client IPs for rate limiting behind Render's proxy |
| `MONGOMS_DISABLE_POSTINSTALL` | `1` | Skips downloading the test-only MongoDB binary |
| `autoDeployTrigger` | `checksPass` | Deploys only commits whose CI checks pass |

`CORS_ORIGINS` is not needed for single-origin hosting. Set it only if the SPA is hosted
separately, together with `COOKIE_SAMESITE=none`.

## 3. Verify

```bash
curl https://<your-app>.onrender.com/api/v1/health/ready
# {"status":"ready","checks":{"database":"up"}}
```

Then register, create a workspace, and open an invite link in a private window.

## Free-plan behaviour

- The free web service **sleeps after about 15 minutes without traffic**. The next visit
  takes roughly a minute to wake it, after which it responds normally.
- Each deploy builds from scratch. Data lives in Atlas, so redeploys never lose it.
- Rate limits are kept in memory, so they reset when the service restarts or redeploys.

## Rehearsing production locally

```bash
npm run build
NODE_ENV=production CLIENT_DIST_DIR=../client/dist \
  MONGODB_URI=mongodb://127.0.0.1:27017/teamflow \
  JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
  npm run start -w server
# open http://localhost:4000
```

Browsers treat `localhost` as a secure context, so the production `Secure` cookie works
over plain HTTP there.
