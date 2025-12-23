# network_debug.md

## Prerequisites

- Run this FIRST before checking Frappe-specific issues (see bench_debug.md)

## Check running ports

- All listening ports: `sudo netstat -tulpn | grep LISTEN` or `sudo ss -tulpn | grep LISTEN`
- Web server (8000): `sudo netstat -tulpn | grep :8000`
- Socket.IO (9000): `sudo netstat -tulpn | grep :9000`
- Redis Cache (13000): `sudo netstat -tulpn | grep :13000`
- Redis Queue (11000): `sudo netstat -tulpn | grep :11000`
- MariaDB (3306): `sudo netstat -tulpn | grep :3306`

## Check service status

- Bench processes: `ps aux | grep bench`
- Redis: `sudo systemctl status redis`
- MariaDB: `sudo systemctl status mariadb` or `sudo systemctl status mysql`
- Nginx: `sudo systemctl status nginx`

## Check network connectivity

- Test localhost: `curl http://localhost:8000`
- Test specific IP: `curl http://[server_ip]/`
- Check port: `telnet localhost 8000` or `nc -zv localhost 8000`

## Check firewall

- Check status: `sudo ufw status` or `sudo firewall-cmd --list-all`
- Allow ports: `sudo ufw allow 8000/tcp` or `sudo firewall-cmd --add-port=8000/tcp --permanent`

## Common issues

- Port not listening: Check if service is running, check firewall
- Connection refused: Service not running or firewall blocking
- Timeout: Network issue or service not responding
