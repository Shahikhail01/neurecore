# NeureCore — Disaster Recovery

**Audience:** Anyone who needs to restore a service after a bad deploy, disk event, or OOM.
**Sibling docs:** [operations.md](operations.md), [deployment.md](deployment.md), [system-state.md](system-state.md).

---

## 1. Snapshot locations

All snapshots live on Contabo at `/opt/neurecore/_archives/`.

```
/opt/neurecore/_archives/
├── 20260704-084322/                       # latest full DR snapshot
│   ├── backend-dist.tar.gz                # compiled NestJS output (~900 KB)
│   ├── frontend-tenant-.next.tar.gz       # compiled Next.js tenant (~36 MB)
│   ├── frontend-admin-.next.tar.gz        # compiled Next.js admin  (~33 MB)
│   ├── cors-proxy.js                      # CORS sidecar config
│   ├── ecosystem.config.js                # PM2 source of truth
│   └── rebuild.sh                         # on-server build script
├── ecosystem.config.js.bak.YYYYMMDD-HHMMSS    # config-only backups
├── cors-proxy.js.bak.YYYYMMDD-HHMMSS
├── backend-pre-deploy-YYYYMMDD-HHMMSS/       # older backend dist + src snapshots
└── legacy-YYYY-MM-DD.tar.gz                  # full-disk pre-cutover archives
```

Snapshots are **not** automatically pruned. Disk space is comfortable (~45 GB free on `/`), but if you want to prune:

```bash
ssh contabo '
  # Keep last 5 dated snapshot dirs
  ls -dt /opt/neurecore/_archives/2* | tail -n +6 | xargs -r rm -rf
'
```

---

## 2. Take a fresh snapshot (recommended before every deploy)

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)
  mkdir -p "$SNAP"

  cd /opt/neurecore/backend/backend   && tar -czf "$SNAP/backend-dist.tar.gz"          dist/
  cd /opt/neurecore/frontend-tenant  && tar -czf "$SNAP/frontend-tenant-.next.tar.gz"  .next/
  cd /opt/neurecore/frontend-admin   && tar -czf "$SNAP/frontend-admin-.next.tar.gz"   .next/

  cp /opt/neurecore/cors-proxy.js        "$SNAP/cors-proxy.js"
  cp /opt/neurecore/ecosystem.config.js  "$SNAP/ecosystem.config.js"
  cp /opt/neurecore/rebuild.sh           "$SNAP/rebuild.sh"

  echo "Snapshot: $SNAP"
  du -sh "$SNAP"
'
```

Expected size: ~70 MB.

---

## 3. Restore from a snapshot

### 3.1 Restore backend

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/backend/backend
  tar -xzf "$SNAP/backend-dist.tar.gz"
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
'
curl -sk https://brain.neurecore.com/api/v1/health   # expect 200
```

If the dist is also broken (prisma client mismatch), regenerate first:

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/nest build    # rebuilds dist/
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
'
```

### 3.2 Restore tenant

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/frontend-tenant
  tar -xzf "$SNAP/frontend-tenant-.next.tar.gz"
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant
'
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/   # expect 200
```

### 3.3 Restore admin

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/frontend-admin
  tar -xzf "$SNAP/frontend-admin-.next.tar.gz"
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-admin
'
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/   # expect 200
```

### 3.4 Restore CORS proxy config

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cp "$SNAP/cors-proxy.js" /opt/neurecore/cors-proxy.js
  pm2 restart neurecore-cors-proxy
'
curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
  -H "Origin: https://hq.neurecore.com" \
  -H "Access-Control-Request-Method: GET" \
  | grep -iE "^HTTP|access-control-allow"   # expect 204
```

### 3.5 Restore ecosystem config

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cp "$SNAP/ecosystem.config.js" /opt/neurecore/ecosystem.config.js
  node -c /opt/neurecore/ecosystem.config.js   # validate syntax
  pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
'
```

### 3.6 Full restore (all 4 services from one snapshot)

```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/20260704-084322
  cd /opt/neurecore/backend/backend   && tar -xzf "$SNAP/backend-dist.tar.gz"
  cd /opt/neurecore/frontend-tenant  && tar -xzf "$SNAP/frontend-tenant-.next.tar.gz"
  cd /opt/neurecore/frontend-admin   && tar -xzf "$SNAP/frontend-admin-.next.tar.gz"
  cp "$SNAP/cors-proxy.js"        /opt/neurecore/cors-proxy.js
  cp "$SNAP/ecosystem.config.js"  /opt/neurecore/ecosystem.config.js
  node -c /opt/neurecore/ecosystem.config.js
  pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

All three URLs should return 200.

---

## 4. Code rollback (revert a bad commit)

When the snapshot dist is fine but the source has a bad commit you just deployed:

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  git log --oneline -10
  git checkout <good-commit-sha>
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/nest build
  pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
'
```

Then return to main:

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  git checkout main
  ./node_modules/.bin/nest build
  pm2 restart neurecore-backend
'
```

---

## 5. Disk full recovery

If `/` hits 100% and PM2 processes die:

```bash
ssh contabo '
  # 1. Identify big consumers
  du -sh /opt/neurecore/_archives/* 2>/dev/null | sort -hr | head -10
  du -sh /opt/neurecore/*/node_modules 2>/dev/null | sort -hr | head -10
  du -sh /opt/neurecore/*/.next 2>/dev/null | sort -hr | head -10
  du -sh /var/log/* 2>/dev/null | sort -hr | head -10

  # 2. Prune old archives
  ls -dt /opt/neurecore/_archives/2* | tail -n +4 | xargs -r rm -rf

  # 3. Clear Next.js build cache (forces rebuild)
  rm -rf /opt/neurecore/frontend-tenant/.next/cache
  rm -rf /opt/neurecore/frontend-admin/.next/cache

  # 4. Clear old logs
  find /root/.pm2/logs -name "*.log" -mtime +14 -delete

  # 5. Clear apt cache
  apt-get clean
'
```

After cleanup, restart any dead PM2 processes:

```bash
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'
```

---

## 6. PM2 dump restoration after a reboot

```bash
ssh contabo '
  pm2 resurrect     # restores from /root/.pm2/dump.pm2
  pm2 list | grep neurecore   # verify 4 processes online
'
```

If `pm2 resurrect` fails, manually start each:

```bash
ssh contabo '
  pm2 start /opt/neurecore/ecosystem.config.js
  pm2 save
'
```

---

## 7. Database recovery

The database is Contabo Local PostgreSQL 16. Recovery options:

1. **Point-in-time recovery** (if backup available):
   - Check `/opt/neurecore/_archives/` for recent DB snapshots
   - Restore via `pg_restore`

2. **Reset to last migration**:
   ```bash
   ssh contabo '
     cd /opt/neurecore/backend/backend
     ./node_modules/.bin/prisma migrate resolve --rolled-back <migration-name>
     ./node_modules/.bin/prisma migrate deploy
   '
   ```

3. **Restore from a manual SQL dump** (if you have one):
   ```bash
   ssh contabo '
     psql "$DATABASE_URL" < /opt/neurecore/_archives/db-dump-YYYYMMDD.sql
   '
   ```

**There is currently no automated DB snapshot policy.** Contabo local PostgreSQL — schedule periodic `pg_dump` to `/opt/neurecore/_archives/db-*.dump`.

**New backup procedure for Contabo PG:**
```bash
ssh contabo '
  SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)
  mkdir -p "$SNAP"
  PGPASSWORD=NeureCoreDB123 pg_dump -h 127.0.0.1 -p 5433 -U neurecore_app -d neurecore -Fc -b -f "$SNAP/neurecore_db.dump"
  # Also export SQL for readability
  PGPASSWORD=NeureCoreDB123 pg_dump -h 127.0.0.1 -p 5433 -U neurecore_app -d neurecore -Fc -b > "$SNAP/neurecore_db.sql"
'
```

---

## 8. TLS cert loss

If Let's Encrypt certs expire or get revoked:

```bash
ssh contabo '
  # Force renewal
  certbot renew --force-renewal
  # Restart OLS to pick up (usually OLS watches inotify, but just in case)
  systemctl restart lsws
  # Verify
  echo | openssl s_client -connect hq.neurecore.com:443 -servername hq.neurecore.com 2>/dev/null | openssl x509 -noout -dates
'
```

---

## 9. Full server rebuild (nuclear option)

If the Contabo box is lost entirely:

1. Provision a new VPS with the same OS.
2. Install CyberPanel + OpenLiteSpeed.
3. Restore certs from backup (or re-request via certbot).
4. Recreate vhosts (see deployment.md §5).
5. Restore `/opt/neurecore/backend/backend/` from a git clone (latest good commit).
6. Restore `/opt/neurecore/frontend-{tenant,admin}/` from the most recent snapshot tarballs.
7. Restore `/opt/neurecore/{cors-proxy.js,ecosystem.config.js,rebuild.sh}`.
8. `npm ci` in each app, `nest build` for backend, `next build` for frontends.
9. `pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save`.
10. Smoke test all three URLs.

The git repo (`Shahikhail01/neurecore` on GitHub) is the source of truth for backend code. Frontend code lives only in this monorepo — **if you lose `/opt/neurecore/_archives/` you lose the most recent frontend builds** (until they're rebuilt from source).

**Recommended**: add a cron to push snapshots off-host weekly:

```bash
# Add to /etc/cron.d/neurecore-snapshot-upload
0 3 * * 0 root rsync -avz /opt/neurecore/_archives/ backup@offhost:/backups/neurecore/
```