import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests to its own dev-only
  // assets by default (DNS-rebinding protection) — without this, loading
  // the app from a LAN IP or a Tailscale hostname gets every JS chunk
  // 403'd, even after the backend's CORS and the frontend's runtime API
  // URL resolution (see src/lib/constants.ts) are both already correct.
  // Matching is per-label (`*` = exactly one dot-separated segment, an IP
  // is just a 4-label "domain" to this matcher), not CIDR-aware — the
  // 172.*/100.* patterns are a little broader than the true private/
  // Tailscale ranges as a result. Harmless here: this only gates dev-mode
  // asset loading, not the app's actual auth boundary (see app/api/deps.py).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "100.*.*.*", "*.ts.net"],
};

export default nextConfig;
