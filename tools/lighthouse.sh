#!/bin/sh
# Lighthouse em celular com o Chromium próprio do Playwright (nunca o Chrome do usuário).
#   sh tools/lighthouse.sh [url] [saida.json]
URL="${1:-http://127.0.0.1:4245/}"
OUT="${2:-_shots/lighthouse.json}"
CHROME="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
LH="$HOME/.npm/_npx/8003d8991b0d346b/node_modules/lighthouse/cli/index.js"
CHROME_PATH="$CHROME" node "$LH" "$URL" --quiet --throttling-method=devtools \
  --only-categories=performance,accessibility,best-practices --output=json --output-path="$OUT" \
  --chrome-flags="--headless=new" >/dev/null 2>&1
python3 - "$OUT" <<'EOF'
import json, sys
r = json.load(open(sys.argv[1]))
print({k: round(v["score"] * 100) for k, v in r["categories"].items()})
a = r["audits"]
for k in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"):
    print(f"  {k}: {a[k]['displayValue']}")
for k, v in a.items():
    if v.get("score") is not None and v["score"] < 1 and v.get("scoreDisplayMode") in ("binary", "numeric"):
        print(f"  ! {k}: {v.get('displayValue', '')}")
EOF
