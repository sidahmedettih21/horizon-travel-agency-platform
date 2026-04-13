#!/bin/bash
set -e
echo "🔐 Applying NSA‑level security fixes to Horizon backend..."

# 1. Update .gitignore
cat >> .gitignore << 'EOF'
cookies.txt
qr.png
*.db
*.bak
.env
scripts/cookies.txt
scripts/create-admin.js
test-*.sh
client/public/api-test.html
client/public/super-admin/
EOF
echo "✓ .gitignore updated"

# 2. Clean .env.example (remove duplicate WhatsApp lines)
awk '!seen[$0]++' .env.example > .env.example.tmp && mv .env.example.tmp .env.example
echo "✓ .env.example deduplicated"

# 3. Apply CORS fix to server.js (ensure origin array includes GitHub Pages and localhost)
if ! grep -q "https://tdnikram-dotcom.github.io" server/server.js; then
  sed -i "/origin: \[/c\  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://anouarelsabah-relizane.com', 'https://tdnikram-dotcom.github.io']," server/server.js
  echo "✓ CORS origins updated in server.js"
else
  echo "✓ CORS origins already present"
fi

# 4. Remove any residual sensitive files from working directory
rm -f cookies.txt qr.png scripts/cookies.txt scripts/create-admin.js test-*.sh client/public/api-test.html 2>/dev/null || true
rm -rf client/public/super-admin/ 2>/dev/null || true
echo "✓ Sensitive files removed from working tree"

# 5. Commit and push (if git is available and user confirms)
if git rev-parse --git-dir > /dev/null 2>&1; then
  git add -A
  git commit -m "SECURITY: final NSA‑level purge – CORS fix, .gitignore hardening, sensitive file removal" || echo "No changes to commit"
  echo "✓ Changes committed locally"
  read -p "Force push to origin main? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main --force
    echo "✓ Pushed to remote"
  fi
fi

echo "✅ Backend security fixes applied."
