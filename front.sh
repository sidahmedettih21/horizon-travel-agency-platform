#!/bin/bash

# Horizon Frontend Patcher
# Applies indigo theme + fixes API integration

set -e

INDEX="index.html"
BACKUP="index.html.backup"

if [ ! -f "$INDEX" ]; then
    echo "❌ Error: $INDEX not found in current directory"
    exit 1
fi

echo "📦 Creating backup at $BACKUP"
cp "$INDEX" "$BACKUP"

echo "🎨 Patching CSS with Indigo/Periwinkle theme..."

# Replace the entire :root { ... } block using awk
awk -v new_root='
:root{
  /* Indigo base palette */
  --white: #FFFFFFff;
  --soft-periwinkle: #9E7ADAff;
  --indigo-velvet: #5727A1ff;
  --indigo-bloom: #6C31BFff;
  --indigo-ink: #3E1582ff;

  /* Backgrounds – layered dark indigo */
  --bg-0: #0B0818;
  --bg-1: #120E24;
  --bg-2: #1A1533;
  --bg-3: #231D42;
  --bg-4: #2D2652;
  --bg-5: #3A3168;

  /* Borders */
  --border-0: rgba(158, 122, 218, 0.08);
  --border-1: rgba(158, 122, 218, 0.15);
  --border-2: rgba(158, 122, 218, 0.25);
  --border-3: rgba(158, 122, 218, 0.40);

  /* Text */
  --text-0: #F0EEFF;
  --text-1: #CAC4E6;
  --text-2: #8F86B5;
  --text-3: #4F4870;

  /* Action colours – using your palette */
  --gold: var(--soft-periwinkle);
  --gold-dim: #7A5AB8;
  --gold-glow: rgba(158, 122, 218, 0.20);
  --emerald: var(--indigo-bloom);
  --emerald-dim: #4B2691;
  --emerald-glow: rgba(108, 49, 191, 0.15);
  --crimson: #E06C9F;
  --crimson-dim: #7A2A4F;
  --crimson-glow: rgba(224, 108, 159, 0.12);
  --sapphire: #7C9CFF;
  --sapphire-dim: #2E4C9A;
  --sapphire-glow: rgba(124, 156, 255, 0.12);
  --amber: #FFC555;
  --violet: var(--soft-periwinkle);

  /* Layout */
  --sidebar-w: 240px;
  --sidebar-w-collapsed: 64px;
  --topbar-h: 56px;
  --font-ui: "DM Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-display: "Fraunces", serif;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;
  --r-xl: 20px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.5);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.6);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.7);
  --shadow-gold: 0 0 20px rgba(158, 122, 218, 0.3);
}
' '
BEGIN { in_root=0 }
/:root{/ { print new_root; in_root=1; next }
/}/ && in_root { in_root=0; next }
!in_root { print }
' "$INDEX" > "$INDEX.tmp" && mv "$INDEX.tmp" "$INDEX"

echo "✅ CSS theme updated"

echo "🔧 Fixing API integration..."

# 1. Remove the AGENCY constant and ?agency= from api()
sed -i '/const AGENCY = /d' "$INDEX"

# 2. Replace the API base definition with configurable version
sed -i 's|const API = .*;|const API = window.ENV?.API_URL || "http://localhost:3000";|' "$INDEX"

# 3. Rewrite the api() function to remove ?agency= and simplify URL building
#    We'll use a more precise multiline sed replacement
cat > /tmp/api_fix.sed << 'EOF'
/function api(path, opts = {}) {/,/^  }/ {
  s|const url = `${API}${path}${path.includes('\'?\') ? '\'&\'' : '\'?\''}agency=${AGENCY}`;|const url = `${API}${path}`;|
}
EOF
sed -i -f /tmp/api_fix.sed "$INDEX"
rm /tmp/api_fix.sed

echo "✅ API calls now use clean URLs (no ?agency=)"
echo "✅ API base now reads from window.ENV?.API_URL (default localhost:3000)"

# 4. (Optional) Add a small configuration block at the top of the script
#    This makes it easy to change API URL without editing the HTML again
if ! grep -q "window.ENV = window.ENV || {}" "$INDEX"; then
    sed -i '/<script type="text\/babel">/a\
// --- Horizon Runtime Config ---\
window.ENV = window.ENV || {};\
window.ENV.API_URL = window.ENV.API_URL || "http://localhost:3000";\
// -----------------------------' "$INDEX"
    echo "✅ Added runtime configuration block (edit API_URL here if needed)"
fi

echo ""
echo "🎉 All changes applied successfully!"
echo ""
echo "📋 What was done:"
echo "   • Indigo/Periwinkle color scheme activated"
echo "   • Removed hardcoded ?agency= from all API requests"
echo "   • API URL is now configurable via window.ENV.API_URL"
echo "   • Backup saved as index.html.backup"
echo ""
echo "🚀 Next steps:"
echo "   1. Make sure your backend is running (npm run dev)"
echo "   2. Open index.html in your browser (or serve with 'npx serve .')"
echo "   3. Log in with a valid user from your database"
echo ""
echo "🌐 For production deployment:"
echo "   • Set window.ENV.API_URL = 'https://your-backend.com' before deploying"
echo "   • Or set environment variable ENV_API_URL if using Vercel/Railway"
