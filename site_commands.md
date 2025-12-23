# site_commands.md

## Site management

- Create site: `bench new-site [site_name]`
- Drop site: `bench drop-site [site_name]`
- List apps: `bench --site [site] list-apps`

## App management

- Get app: `bench get-app [app_name]`
- Install app: `bench --site [site] install-app [app_name]`
- Uninstall app: `bench --site [site] uninstall-app [app_name]`

## Database operations

- Backup: `bench --site [site] backup`
- Backup with files: `bench --site [site] backup --with-files`
- Migrate: `bench --site [site] migrate`
- Console: `bench --site [site] console`
- MariaDB: `bench --site [site] mariadb`

## Development commands

- Build: `bench build`
- Build app: `bench build --app [app_name]`
- Restart: `bench restart`
- Clear cache: `bench --site [site] clear-cache`
- Clear website cache: `bench --site [site] clear-website-cache`
- Watch: `bench watch` (auto-rebuild on changes)
- Reload DocType: `bench --site [site] reload-doctype "DocType Name"`

## Configuration

- Set config: `bench --site [site] set-config developer_mode 1`
- Get config: `bench --site [site] get-config developer_mode`
- Set admin password: `bench --site [site] set-admin-password [password]`
