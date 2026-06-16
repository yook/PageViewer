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
3. Deploy staging only after an explicit request to roll out on dev:
   - `https://dev.pageviewer.ru`
4. Verify the site against:
   - `https://dev-api.pageviewer.ru`
5. Open PR from `develop` into `master`
6. Merge into `master`
7. Publish production from `master` only after an explicit request to roll out on prod:
   - `https://pageviewer.ru`

## Default deployment rule

The default rule for site changes is:

- push fixes to `develop` first
- deploy them to `dev` only after explicit confirmation
- verify them on `https://dev.pageviewer.ru`
- update `master` only after explicit confirmation that staging is OK

Production publication is not the default next step after a change. `master` should receive only changes that have already been checked on the staging contour.

## Local branch archive

To keep the local repository tidy, only active working branches should stay under `refs/heads`:

- `develop`
- `master`

Old temporary and rollout branches are archived locally under `refs/archive/...` instead of staying in the normal local branch list.

This means:

- `git branch` stays short and readable
- archived branch tips are still available if we need to recover something
- the archive is local-only and is not published to `origin`

To inspect archived refs:

```bash
git for-each-ref refs/archive
```

To restore one archived branch as a normal local branch:

```bash
git branch <new-branch-name> refs/archive/<archived-name>
```

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

## Notes

- staging site is expected to work with `dev-api.pageviewer.ru`
- production site is expected to work with `api.pageviewer.ru`
- production is currently served by GitHub Pages from the `master` branch root
- no build step is required right now; staging workflow publishes the static files directly
