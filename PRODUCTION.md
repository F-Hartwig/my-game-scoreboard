# Production deployment

Production uses Compose project `scoreboard`, container `game-scoreboard-db`, port `8085`, and `/volume2/docker/scoreboard-live`. Application code is built into the image; only `./data:/data` is writable and persistent.

## Required safety sequence

1. Confirm the selected commit passed CI on `staging`.
2. Create a consistent SQLite online backup of the current live database.
3. Restore that backup into a temporary database and verify `PRAGMA integrity_check` plus all four state keys.
4. Preserve the previous container and `/volume2/docker/scoreboard-server` for rollback.
5. Copy the verified database into `/volume2/docker/scoreboard-live/data/scoreboard.db` and deploy `docker-compose.production.yml` from `/volume2/docker/scoreboard-live/docker-compose.yml`.
6. Verify `/api/health`, all four API payloads, SQLite integrity, private-file blocking and persistence across a controlled restart.

## Rollback

Stop and remove only the new `game-scoreboard-db`, rename the preserved previous container back to `game-scoreboard-db`, start it, and verify port `8085` plus the four API payloads. Do not modify or delete either verified backup during rollback.
