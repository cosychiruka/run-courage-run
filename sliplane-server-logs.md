**✅ SHIPPED FIX AUDITED — FULL LOG REVIEW COMPLETE**

I read the **entire new log** (from 06:05:53 restart through 15:20+) and cross-checked against your current `autonomous_loop.py`, `twitter_memory.py`, and `main.py`.

### 1. The reflection fix **worked perfectly**
- `AttributeError: module 'app.twitter_memory' has no attribute 'get_recent_reflections'` is **gone**.
- Every autonomous_tick now completes `_gather_state()` cleanly.
- Brain is no longer crashing on every cycle. Good job shipping that.

### 2. New warnings (harmless but noisy)
**Duplicate Operation ID warning** (repeated at 11:24:20):

```python
UserWarning: Duplicate Operation ID health_health_get for function health at /app/app/main.py
```

**Cause**: You have **two** `@app.get("/health")` routes (or FastAPI auto-generated the same operation_id twice). This is why the warning fires every time Swagger/OpenAPI is accessed.

**Fix (one-line change)** – In `server/app/main.py`:

Find the health endpoint and change it to:

```python
@app.get("/health", operation_id="health_check")  # ← add this
async def health():
    return {"status": "ok", "time": datetime.now().isoformat()}
```

(If you already have an operation_id, just make it unique like `health_check_v2`.)

**404 on /api/docs/api.json** – Completely harmless. FastAPI’s docs UI is just probing for an old path. Ignore it.

**Suspicious /wp-admin/install.php probes**  
These are **not** someone trying to log into your admin dashboard.  
They are automated internet scanners (very common on any public IP). They hit every server looking for old WordPress installs.  
Your FastAPI app correctly returns **404** → no security issue.  
You can silence them forever by adding this middleware in `main.py` (optional but clean):

```python
@app.middleware("http")
async def block_wp_scans(request: Request, call_next):
    if "wp-admin" in request.url.path.lower() or "wp-login" in request.url.path.lower():
        return JSONResponse(status_code=404, content={"detail": "not found"})
    return await call_next(request)
```

### 3. Credit-Aware Intelligence — World-Class Upgrade (your idea is excellent)

You are 100% right. The current design is **not intelligent enough** when credits run out.

**Current state (from logs)**:
- He keeps trying `/tweets/search/recent` every 25 min → instantly gets 403 SpendCapReached.
- No memory of “I’m broke right now”.
- No proactive fallback (random meme, GM, hype post, self-reflection).
- No “treasury suggestion” when credits return.

**This is the major design gap you called out.**

**Proposed World-Class Credit-Aware System (Phase 2.0)**

We make him **self-aware** of his own budget in real time.

**Step-by-step implementation (add these today):**

**A. In `server/app/tools.py` – add new tool**

```python
{
    "type": "function",
    "function": {
        "name": "report_credit_status",
        "description": "Check current X credit status and decide safe actions",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["check", "fallback_hype", "suggest_treasury"]}
            }
        }
    }
}
```

**B. In `autonomous_loop.py` – enhance _gather_state()**

Add this block inside `_gather_state()`:

```python
credit_status = await _redis.get("courage:x_credit_status") or "unknown"
if credit_status == "capped":
    state["credit_alert"] = "X API credits depleted. Cannot search or post. Switch to internal hype / meme generation mode."
```

**C. In dispatch_tool – handle credit errors intelligently**

```python
except Exception as e:
    if "403" in str(e) or "SpendCapReached" in str(e) or "CreditsDepleted" in str(e):
        await _redis.set("courage:x_credit_status", "capped", ex=3600)  # remember for 1 hour
        await log_brain_decision("CREDIT_ALERT", "X credits depleted - switching to safe mode", executed=True)
        # Force a fun non-X action
        return await execute_tool("idle_hype_post", {"reason": "credits depleted"})
```

**D. New safe tool `idle_hype_post`** (add to tools.py)

This triggers when credits are gone or trenches are quiet:
- Random “Spreading Courage” message
- GM/GN
- Meme generation without posting to X yet
- Self-reflection

This makes him feel truly alive even when broke.

**Reply with “PHASE 2.0 CREDIT AWARE DONE”** after you add the above and restart.

Then I will give you:
- The full `idle_hype_post` implementation
- Dashboard fix for “Live Brain Activity” + MEMORY VECTORS
- Clickable decision modals with real context

We are now fixing the **intelligence layer**, not just the UI.

**Spreading Courage.**  
You spotted the real flaw. Let’s make him world-class.  

Your move.