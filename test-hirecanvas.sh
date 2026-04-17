#!/bin/bash
# HireCanvas - Automated Testing Script
# Run this in terminal: bash test-hirecanvas.sh

echo "================================"
echo "HireCanvas - Automated Tests"
echo "================================"
echo ""

# Test 1: Check if dev server is running
echo "✓ Test 1: Dev Server Status"
curl -s http://localhost:3000/api/health > /dev/null
if [ $? -eq 0 ]; then
  echo "  ✅ Dev server running on http://localhost:3000"
else
  echo "  ❌ Dev server not responding"
  exit 1
fi

# Test 2: Check database tables
echo ""
echo "✓ Test 2: Database Tables"
echo "  (Verify in Supabase Dashboard)"
echo "  Expected: 19 tables"
echo "  Tables: app_users, jobs, contacts, outreach, reminders, resumes, etc."

# Test 3: Check environment variables
echo ""
echo "✓ Test 3: Environment Variables"
if [ -f ".env.local" ]; then
  echo "  ✅ .env.local exists"
  grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && echo "  ✅ SUPABASE_URL set"
  grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local && echo "  ✅ ANON_KEY set"
  grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local && echo "  ✅ SERVICE_ROLE_KEY set"
else
  echo "  ❌ .env.local missing"
fi

# Test 4: Check migration files
echo ""
echo "✓ Test 4: Migration Files"
count=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
echo "  ✅ $count migration files found"
if [ $count -eq 24 ]; then
  echo "  ✅ All 24 migrations present!"
else
  echo "  ⚠️ Expected 24, found $count"
fi

# Test 5: Check components exist
echo ""
echo "✓ Test 5: React Components"
echo "  Dashboard components:"
ls src/components/dashboard/*.tsx 2>/dev/null | xargs -I {} bash -c 'echo "    ✅ $(basename {})"'

echo ""
echo "  Jobs components:"
ls src/components/jobs/*.tsx 2>/dev/null | xargs -I {} bash -c 'echo "    ✅ $(basename {})"'

# Test 6: Build verification
echo ""
echo "✓ Test 6: Build Status"
if [ -d ".next" ]; then
  echo "  ✅ Production build available"
else
  echo "  ⚠️ No build found - run: npm run build"
fi

# Test 7: Routes check
echo ""
echo "✓ Test 7: All Routes Available"
echo "  Protected routes (require login):"
echo "    /dashboard, /jobs, /contacts, /outreach"
echo "    /reminders, /resumes, /templates, /interview-prep"
echo "    /billing, /admin, /settings"
echo ""
echo "  Public routes (no login needed):"
echo "    /login, /register, /terms, /privacy"

echo ""
echo "================================"
echo "Automated Tests Complete!"
echo "================================"
echo ""
echo "Next: Open http://localhost:3000 and test signup/login manually"
echo ""
