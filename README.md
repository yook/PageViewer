# PageViewer Site

Static site for PageViewer auth, checkout, account, and download flows.

## Release flow

Recommended branch strategy:

- `feature/*` - active development
- `develop` - staging
- `master` - production

Recommended promotion path:

1. Open PR from `feature/*` into `develop`
2. Merge into `develop`
3. GitHub Actions deploys staging to:
   - `https://dev.pageviewer.ru`
4. Verify the site against:
   - `https://dev-api.pageviewer.ru`
5. Open PR from `develop` into `master`
6. Merge into `master`
7. GitHub Actions deploys production to:
   - `https://pageviewer.ru`

## API routing

`auth.js` resolves API base URL like this:

- `localhost` -> `http://localhost:3001`
- `dev.pageviewer.ru` -> `https://dev-api.pageviewer.ru`
- all other public hosts -> `https://api.pageviewer.ru`

## Deploy model

The site is deployed as static files over SSH.

Recommended server paths:

- staging: `/opt/pageviewer/site-dev`
- production: `/opt/pageviewer/site`

Required GitHub Actions secrets:

### Staging

- `SSH_HOST_DEV`
- `SSH_USER_DEV`
- `SSH_PRIVATE_KEY_DEV` or fallback `SSH_PRIVATE_KEY`
- `DEPLOY_PATH_DEV`

### Production

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `DEPLOY_PATH`

## Notes

- staging site is expected to work with `dev-api.pageviewer.ru`
- production site is expected to work with `api.pageviewer.ru`
- no build step is required right now; workflows publish the static files directly
