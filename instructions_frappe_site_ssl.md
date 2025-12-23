# frappe_site_ssl.md

## Prerequisites

- For Proxmox containers: `apt install snapd squashfuse fuse lxcfs -y`
- For regular systems: `sudo apt install snapd -y` then `sudo snap install --classic certbot`

## Setup nginx

- Setup nginx: `sudo bench setup nginx`
- Test config: `sudo nginx -t`
- Restart nginx: `sudo systemctl restart nginx`

## Obtain SSL certificate

- All sites: `sudo certbot --nginx`
- Specific site: `sudo certbot --nginx -d example.com -d www.example.com`
- Verify certificates: `sudo certbot certificates`

## Restart services

- Restart bench: `bench restart`
- Restart nginx: `sudo systemctl restart nginx`
- Restart supervisor: `sudo supervisorctl restart all`

## Certificate management

- Revoke certificate: `sudo certbot revoke --cert-name domain.com`
- Delete certificate: `sudo certbot delete --cert-name domain.com`
- Test renewal: `sudo certbot renew --dry-run`
- Check renewal status: `sudo systemctl status certbot.timer`

## Troubleshooting

- Nginx config errors: `sudo nginx -t`
- Port 80/443 not accessible: Check firewall with `sudo ufw status`
- DNS not resolving: Verify DNS A record with `dig +short example.com A`
- Certificate renewal fails: Check logs with `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

## Notes

- DNS A record must point to server IP before requesting certificate
- Port 80 must be open for Let's Encrypt domain validation
- Certbot sets up automatic renewal via systemd timer
- Certificates stored in `/etc/letsencrypt/live/[domain]/`
