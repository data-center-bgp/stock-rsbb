# Deploying Stock RSBB to the VPS

Node + PM2 runs the app on `127.0.0.1:3010`; Nginx serves it publicly at
**https://stock-rsbb.barokahperkasagroup.com** with a Let's Encrypt
certificate. HTTPS is required: phones only allow the camera scanner and
"Install app" on HTTPS.

```
phone / browser ──HTTPS──▶ Nginx (443) ──▶ 127.0.0.1:3010 (next start, via PM2) ──▶ Supabase
```

Commands below assume Ubuntu/Debian and a normal user with `sudo`. Lines
starting with `#` are comments.

## 0. DNS (once)

In the company's DNS manager, add an **A record**:
`stock-rsbb` → the VPS's public IP. Check it has taken effect (from your PC or
the VPS) before step 7, since Let's Encrypt needs it:

```bash
nslookup stock-rsbb.barokahperkasagroup.com
```

## 1. Check the VPS

```bash
node -v              # needs v20.9 or newer
pm2 -v               # already installed for other apps?
nginx -v
ss -ltnp | grep 3010 # must print nothing (port free)
free -h              # the build needs ~1.5 GB of free RAM (swap counts)
```

- **No Node, or older than 20.9:** install Node 22 LTS:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
  If other apps on the VPS rely on an older Node, don't upgrade it system-wide.
  Install [nvm](https://github.com/nvm-sh/nvm) instead, then `nvm install 22`,
  and run the steps below in a shell where `node -v` shows v22.
- **No PM2:** `sudo npm install -g pm2`
- **Port 3010 taken:** pick another free port and change it in both
  `ecosystem.config.cjs` and `deploy/nginx/stock-rsbb.conf`.

## 2. Get the code

The GitHub repo is public, so no key is needed:

```bash
sudo mkdir -p /var/www/stock-rsbb
sudo chown "$USER": /var/www/stock-rsbb
git clone https://github.com/data-center-bgp/stock-rsbb.git /var/www/stock-rsbb
cd /var/www/stock-rsbb
```

## 3. Environment

Create `/var/www/stock-rsbb/.env.local` with the **two** values from the
`.env.local` on your PC. Use `nano .env.local`, paste, and save:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

```bash
chmod 600 .env.local
```

Do **not** copy `SUPABASE_SERVICE_ROLE_KEY`. The app doesn't use it; only the
import scripts on your PC do, and it bypasses all access rules.

`NEXT_PUBLIC_*` values are built into the app. If you ever change them, rebuild
(step 4) rather than just restarting.

## 4. Build

```bash
npm ci
npm run build
```

If the build is killed with no clear error (out of memory), add swap and retry:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 5. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
curl -I http://127.0.0.1:3010/login   # expect: HTTP/1.1 200 OK
```

If PM2 isn't already set to start on boot (for the other apps), run
`pm2 startup` once and then run the `sudo ...` command it prints.

## 6. Nginx

```bash
sudo cp deploy/nginx/stock-rsbb.conf /etc/nginx/sites-available/stock-rsbb.conf
sudo ln -s /etc/nginx/sites-available/stock-rsbb.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

If this Nginx uses `/etc/nginx/conf.d/` instead of `sites-available`, as other
sites on it may, copy the file to `/etc/nginx/conf.d/stock-rsbb.conf` and skip
the `ln` line. `http://stock-rsbb.barokahperkasagroup.com` should now show the
login page.

## 7. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx   # if certbot isn't installed yet
sudo certbot --nginx -d stock-rsbb.barokahperkasagroup.com
```

When asked, choose to **redirect** HTTP to HTTPS. Certbot renews the certificate
automatically.

## 8. Check it

- Open https://stock-rsbb.barokahperkasagroup.com and log in. The dashboard,
  Data Stok and Riwayat should load.
- On a phone, check that scanning opens the camera, and that "Install app" /
  "Add to Home Screen" appears.
- **Reprint the QR labels** from the new address (Label QR). Labels encode the
  address they were printed from. Old test labels still work with the in-app
  scanner, but a phone's own camera app would open the old test address.

Supabase needs no changes: email/password login doesn't use redirect URLs.
Don't change the project's Site URL either, since other company apps share it.

## Updating

After new commits are pushed to `main`:

```bash
cd /var/www/stock-rsbb && ./deploy/update.sh
```

This pulls, rebuilds and restarts. The app may error for a minute or two while
it builds, so run it outside working hours.

## Troubleshooting

| Symptom | Look at |
| --- | --- |
| 502 Bad Gateway | The app isn't running: `pm2 status`, `pm2 logs stock-rsbb --lines 100` |
| 413 when importing in Data Master | `client_max_body_size` in the Nginx file |
| Import fails with "Invalid Server Actions request" | Nginx isn't passing `Host` / `X-Forwarded-Host` (see the Nginx file) |
| Login works but pages show "Gagal memuat data" | The `.env.local` values; rebuild after changing them |
| Anything else from Nginx | `sudo tail -n 50 /var/log/nginx/error.log` |
