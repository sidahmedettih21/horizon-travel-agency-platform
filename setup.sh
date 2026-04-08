#!/bin/bash
echo "=== HORIZON BACKEND HEALTH CHECK ==="
curl -s http://localhost:3000/health | jq .

echo -e "\n=== TEST TENANT (demo agency) ==="
curl -s -c cookies.txt -b cookies.txt http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.horizon.dz","password":"ChangeMe123!"}' | jq .

echo -e "\n=== LIST LEADS ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/leads | jq .

echo -e "\n=== CREATE A LEAD ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Ahmed Benali","phone":"0555123456","service_interest":"omra"}' | jq .

echo -e "\n=== LIST CLIENTS ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/clients | jq .

echo -e "\n=== CREATE CLIENT ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Fatima Zahra","phone":"0777123456","passport_number":"ABC123456"}' | jq .

echo -e "\n=== CREATE BOOKING ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{"client_id":1,"type":"omra","total_amount":250000}' | jq .

echo -e "\n=== LIST BOOKINGS ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/bookings | jq .

echo -e "\n=== CREATE TRANSACTION ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"booking_id":1,"type":"income","amount":250000,"payment_method":"cash"}' | jq .

echo -e "\n=== TRANSACTION SUMMARY ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/transactions/summary | jq .

echo -e "\n=== GENERATE ATTENDANCE QR ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/attendance/qr -o qr.png && echo "QR saved as qr.png"

echo -e "\n=== LIST STAFF ==="
curl -s -b cookies.txt http://localhost:3000/api/v1/agency/staff | jq .

echo -e "\n=== CREATE STAFF ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/agency/staff \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@demo.horizon.dz","password":"Staff123!","first_name":"Karim","last_name":"Boudiaf","role":"staff"}' | jq .

echo -e "\n=== LOGOUT ==="
curl -s -b cookies.txt -X POST http://localhost:3000/api/v1/auth/logout | jq .

echo -e "\n=== TEST COMPLETE ==="
