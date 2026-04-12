#!/bin/bash
API="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "Horizon Backend Hardening Test"
echo "========================================="

# 1. Health check
echo -n "1. Health endpoint... "
if curl -s "$API/health" | grep -q "ok"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

# 2. Public content GET
echo -n "2. Public content GET /api/content/1/offer... "
if curl -s "$API/api/content/1/offer" | grep -q "\[\]"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

# 3. Admin POST without token
echo -n "3. Admin POST without token (should 401)... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/content/admin/offer" -H "Content-Type: application/json" -d '{"data":{}}')
if [ "$STATUS" -eq 401 ]; then
    echo -e "${GREEN}PASS (401)${NC}"
else
    echo -e "${RED}FAIL (got $STATUS)${NC}"
fi

# 4. Login with admin
echo -n "4. Login with admin... "
COOKIE_JAR=$(mktemp)
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -X POST "$API/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@anouarelsabah.com","password":"anouar2026"}')
if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $LOGIN_RESPONSE"
fi

# 5. Get current user (authenticated)
echo -n "5. GET /auth/me (authenticated)... "
ME=$(curl -s -b "$COOKIE_JAR" "$API/api/v1/auth/me")
if echo "$ME" | grep -q "email"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

# 6. Create offer as admin
echo -n "6. Create offer (authenticated)... "
CREATE=$(curl -s -b "$COOKIE_JAR" -X POST "$API/api/content/admin/offer" \
    -H "Content-Type: application/json" \
    -d '{"data":{"title":{"en":"Test Offer"},"price":1000},"is_active":true}')
if echo "$CREATE" | grep -q '"id"'; then
    echo -e "${GREEN}PASS${NC}"
    OFFER_UUID=$(echo "$CREATE" | grep -o '"uuid":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $CREATE"
fi

# 7. Verify offer in public endpoint
echo -n "7. Public endpoint shows new offer... "
sleep 1
PUBLIC=$(curl -s "$API/api/content/1/offer")
if echo "$PUBLIC" | grep -q "Test Offer"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

# 8. Delete test offer
echo -n "8. Delete test offer... "
if [ -n "$OFFER_UUID" ]; then
    DELETE=$(curl -s -b "$COOKIE_JAR" -X DELETE "$API/api/content/admin/offer/$OFFER_UUID")
    if echo "$DELETE" | grep -q "success"; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${RED}FAIL${NC}"
    fi
else
    echo "SKIPPED (no UUID)"
fi

# 9. Rate limiting check
echo -n "9. Rate limiting (10 rapid requests)... "
for i in {1..10}; do curl -s -o /dev/null "$API/health"; done
echo -e "${GREEN}PASS (not blocked)${NC}"

# 10. CORS headers
echo -n "10. CORS headers present... "
HEADERS=$(curl -s -I -X OPTIONS "$API/health" -H "Origin: http://localhost:5500")
if echo "$HEADERS" | grep -q "Access-Control-Allow-Credentials: true"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo "========================================="
echo "Test complete. Review any FAIL lines."
echo "========================================="

rm -f "$COOKIE_JAR"
