**✅ PHASE 1.6 CONFIRMED LIVE**

I just verified the new log after your restart.  
- No more reflection crash  
- `/api/admin/recent-decisions` and `/api/admin/live-activity` are now returning real data  
- Dashboard should be showing clickable cards + live feed (refresh it if needed)

Perfect. We’re moving fast.

---

### **PHASE 2 — MAKE THE BRAIN ACTUALLY POST TWEETS**

This is the **core execution bug** you’ve been seeing for hours:  
The brain makes decisions like `TWEET_NEWS` or `TOKEN_HUSTLE`, logs them, but **nothing ever hits X**.

We fix it now.

**Apply these exact changes (copy-paste):**

**1. In `server/app/tools.py` — make sure the real post tool exists**

Add / replace this tool schema at the top (with your other TOOL_SCHEMAS):

```python
"post_tweet": {
    "type": "function",
    "function": {
        "name": "post_tweet",
        "description": "Post a tweet to @RunCourageRun. Use this ONLY when the brain decides to publish.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "The full tweet text"},
                "image_url": {"type": "string", "description": "Optional image URL from Fal.ai"}
            },
            "required": ["text"]
        }
    }
}
```

**2. In `server/app/autonomous_loop.py` — fix dispatch_tool so it actually posts**

**Replace your entire `dispatch_tool` function** with this updated version:

```python
async def dispatch_tool(tool_call, state=None):
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    print(f"[DISPATCH] Courage wants to use: {name} | args: {args}")

    try:
        if name == "post_tweet":
            result = await post_tweet_to_x(  # this is your real X posting function
                text=args.get("text"),
                image_url=args.get("image_url")
            )
            await log_brain_decision("POST_TWEET", args.get("text"), executed=True)
            await log_live_activity(f"Posted tweet: {args.get('text')[:80]}...")
            print(f"[POST SUCCESS] Tweet ID: {result.get('id')}")
            return result

        # All other tools
        from app.tools import execute_tool
        result = await execute_tool(name, args)
        await log_brain_decision(name.upper(), str(args), executed=True)
        return result

    except Exception as e:
        print(f"[DISPATCH ERROR] {name} failed: {e}")
        await log_brain_decision(name.upper(), str(args), executed=False, error=str(e))
        return {"status": "failed", "error": str(e)}
```

**3. Force one test post (optional but recommended)**

In your dashboard, click **FORCE VIBE CHECK** or run this in terminal:

```bash
curl -X POST http://localhost:8000/api/autonomous/trigger-now
```

---

**Reply with “PHASE 2 DONE”** after you apply the changes and restart the server.

I will then immediately give you:

- **PHASE 3** — Idle-mode posting + smart credit-aware fallback (so he never goes silent again, even when trenches/game are quiet)
- **PHASE 4** — Full proactive “Spreading Courage” personality (random memes, GM/GN, hype when bored)

We are now **on track** and moving extremely fast.

**Spreading Courage.** 🐕‍🦺

Your move, legend. Just say **“PHASE 2 DONE”**.