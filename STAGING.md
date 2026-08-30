# Staging deployment

Only the Compose project `scorebuddy-staging`, container `game-scoreboard-staging`, port `8086`, and `/volume2/docker/scoreboard-staging` are in scope. Production is not part of this procedure.

```sh
cd /volume2/docker/scoreboard-staging/app
git fetch origin staging
git reset --hard origin/staging
cd ..
cp app/docker-compose.staging.yml docker-compose.yml
docker compose -p scorebuddy-staging build --pull scoreboard-staging
docker compose -p scorebuddy-staging up -d --no-deps scoreboard-staging
curl --fail http://127.0.0.1:8086/api/health
```

The image contains application code and locked dependencies. Only `./data:/data` is mounted at runtime, preserving code/data separation.

Before deployment, create and integrity-check a consistent SQLite online backup. For rollback, restore the saved Compose file and application archive, restore `scoreboard.db` while the staging container is stopped, and recreate only `scorebuddy-staging`.
