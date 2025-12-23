# bench_debug.md

## Prerequisites

- Run `network_debug.md` first for system-level issues
- Ensure ports are listening: 8000, 9000, 13000, 11000, 3306
- System services running: Redis, MariaDB

## Common commands

- Check bench status: `bench status`
- View logs: `tail -f logs/web.log`
- Clear cache: `bench --site [site] clear-cache`
- Restart: `bench restart`
- Run migrations: `bench --site [site] migrate`

## Common issues

- Bench not starting: Check ports, restart Redis/MariaDB, clear cache
- 404 errors: Clear cache, rebuild website, check site exists
- Database errors: Restart MariaDB, check credentials in `site_config.json`
- Redis errors: Restart Redis, check config files
- Permission errors: Fix ownership with `chown -R frappe:frappe [bench_path]`
- Migration TypeError (module **file** is None): Check `modules.txt`, ensure all modules have `__init__.py` files

## Log files

- Web server: `logs/web.log`
- Socket.IO: `logs/socketio.log`
- Workers: `logs/worker.log`
- Schedule: `logs/schedule.log`
- Site logs: `sites/[site]/logs/web.log`

## Configuration files

- Bench config: `config/common_site_config.json`
- Site config: `sites/[site]/site_config.json`
- Process file: `Procfile`
- Redis config: `config/redis_cache.conf`, `config/redis_queue.conf`
