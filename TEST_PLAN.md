# 🐕🦺 Courage AI: Phase 4 Test Plan (Elite Tier 4.0)

This document outlines the safe, pay-per-use friendly testing procedures for the Courage AI autonomous pipeline.

## 1. Core Health & Vibe Checks
Run these to verify the server is alive and the autonomous logic is firing correctly.

### 📊 Check System Status
Returns the full Phase 4 metrics (Voice status, Queue size, Trench unread, RCR stats).
```bash
curl -X GET "http://localhost:8000/api/admin/system-status"
```

### ✨ Trigger Vibe Check (Manual Heartbeat)
Forces Courage to wake up and perform a full decision tick immediately. This is safe to run multiple times.
```bash
curl -X GET "http://localhost:8000/api/admin/vibe-check"
```

---

## 2. Voice Priority Override Test
Verify that Courage respects your live voice sessions and pauses background tasks.

### Step 1: Simulate an active voice session
```bash
# Set a flag in Redis to pretend you are talking
python -c "import redis; r = redis.Redis(); r.sadd('active_voice_sessions', 'test_session')"
```

### Step 2: Trigger a Vibe Check
```bash
curl -X GET "http://localhost:8000/api/admin/vibe-check"
```
**Expected Result:** Check server logs. You should see:
`[VOICE_PRIORITY] Live mic detected — pausing all background actions`
The tick will exit early without making any API calls.

### Step 3: Clear the simulation
```bash
python -c "import redis; r = redis.Redis(); r.srem('active_voice_sessions', 'test_session')"
```

---

## 3. Stress Test (Safe for Pay-per-use)
Simulate a period of high activity to see how the queue and sensors handle load.

```powershell
# Windows PowerShell version
1..5 | ForEach-Object { 
    Invoke-WebRequest -Uri "http://localhost:8000/api/admin/vibe-check"
    Write-Host "Vibe Check $i triggered. Sleeping 8s..."
    Start-Sleep -Seconds 8 
}
```

---

## 4. Monitoring X API Usage
Every call Courage makes is logged in the server console:
- `POST /2/tweets` (Posts/Replies)
- `GET /2/tweets/search/recent` (Trench/Mentions)

### Real-time Usage Check
Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard) to see your real-time usage metrics against your pay-per-use limits.

---

## 📈 Future Tools (Planned)
- `/api/admin/usage-report`: Estimated hourly/daily cost analysis.
- `test_all.sh`: One-line full integration test script.

**Courage is Courageous. Send it!** 🚀🐕🦺 $RCR
