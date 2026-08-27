# Remote access & mobile pairing

Cubicle is self-hosted — by default it's only reachable on whatever machine
runs `docker compose up` (localhost, or your LAN). To pair a phone (or use
the web dashboard from anywhere but your desk), the server needs to be
reachable from outside that machine. Two supported paths:

## Option A — Tailscale (recommended)

Tailscale puts your server and your phone on the same private, encrypted
network (a "tailnet") — no public exposure, no port-forwarding, and traffic
is already end-to-end WireGuard-encrypted, so you don't strictly need Caddy
in front for TLS.

1. Install Tailscale on the machine running Cubicle: <https://tailscale.com/download>
2. Install the Tailscale app on your phone and log into the same account.
3. On the server, find its tailnet hostname/IP: `tailscale ip -4` or
   `tailscale status`. It looks like `100.x.y.z` or `your-machine.your-tailnet.ts.net`.
4. In Cubicle's web dashboard → **Settings → Devices**, set "Remote server
   address" to `http://<that-hostname>:8000` (or, if you're running Caddy —
   see below — `http://<that-hostname>`).
5. Pair your phone: tap "Pair a device", scan the QR code with the Cubicle
   mobile app (or type the address + code shown).

## Option B — Cloudflare Tunnel

For a real public HTTPS URL without installing anything on your phone
beyond the Cubicle app itself (no Tailscale account needed there), but your
server is now reachable from the public internet — the pairing-token flow
(short-lived, single-use) and the instance password are what keep that
safe, so make sure you've actually set a strong password.

1. Install `cloudflared`: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>
2. `cloudflared tunnel login`, then `cloudflared tunnel create cubicle`
3. Point the tunnel at Caddy (see below) or directly at `cubicle-web`/`cubicle-api`'s exposed ports.
4. `cloudflared tunnel route dns cubicle cubicle.yourdomain.com`
5. Set that URL as the "Remote server address" in Settings → Devices, same as Option A.

## Fronting both with Caddy (recommended once you have a real domain)

The included `Caddyfile` + `caddy` service in `docker-compose.yml` puts
both `cubicle-web` and `cubicle-api` behind one address and, if you set
`CADDY_DOMAIN` to a real hostname, automatically gets you a valid TLS cert:

```bash
CADDY_DOMAIN=cubicle.yourdomain.com docker compose up -d
```

Leave `CADDY_DOMAIN` unset to run Caddy on plain HTTP (`:80`) — the right
choice if you're only exposing this over a Tailscale tailnet, since that
traffic is already encrypted at the network layer.

## First run

The first time you open the dashboard (or pair a device) on a fresh
install, you'll be asked to set an **instance password** — this is what
protects the whole thing once it's reachable from outside your own
machine. There's no separate per-user account system; every browser tab
and every paired phone is just a bearer token issued after that one
password check (see Settings → Devices to see and revoke them).
