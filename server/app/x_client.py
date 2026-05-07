"""
x_client.py — Rate-limited Tweepy client backed by Redis.

Every call checks Redis for remaining quota before hitting the API.
After every response, rate-limit headers are written back to Redis.
"""

import time
import tweepy
from app.redis_utils import get_sync_redis_client
from app.config import (
    X_CONSUMER_KEY, X_CONSUMER_SECRET,
    X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET,
    X_BEARER_TOKEN,
    X_CLIENT_ID, X_CLIENT_SECRET,
)

# ── Sync Redis connection (Tweepy is sync) ─────────────────────────────────────
_r = get_sync_redis_client()


class XRateLimitedClient:
    """
    Thin wrapper around tweepy.Client + tweepy.API (v1.1 for media).
    All calls are rate-limit aware via Redis.
    """

    def __init__(self):
        # Using both Bearer (for Search) and OAuth 1.0a (for Write/Media)
        self.client = tweepy.Client(
            bearer_token=X_BEARER_TOKEN,
            consumer_key=X_CONSUMER_KEY,
            consumer_secret=X_CONSUMER_SECRET,
            access_token=X_ACCESS_TOKEN,
            access_token_secret=X_ACCESS_TOKEN_SECRET,
            client_id=X_CLIENT_ID,
            client_secret=X_CLIENT_SECRET,
            wait_on_rate_limit=False,
        )
        # v1.1 API — needed for media upload (v2 doesn't support it yet)
        auth = tweepy.OAuth1UserHandler(
            X_CONSUMER_KEY, X_CONSUMER_SECRET,
            X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET,
        )
        self.api = tweepy.API(auth)

    # ── Rate limit helpers ─────────────────────────────────────────────────────

    def _update_limits(self, headers: dict, endpoint: str):
        remaining = headers.get("x-rate-limit-remaining")
        reset_ts  = headers.get("x-rate-limit-reset")
        limit     = headers.get("x-rate-limit-limit")
        if remaining is not None:
            _r.hset(f"rate:{endpoint}", mapping={
                "remaining": int(remaining),
                "reset":     int(reset_ts or time.time() + 900),
                "limit":     int(limit or 0),
                "updated_at": int(time.time()),
            })

    def _wait_if_needed(self, endpoint: str):
        data = _r.hgetall(f"rate:{endpoint}")
        if data and int(data.get("remaining", 10)) <= 2:
            sleep_sec = max(int(data.get("reset", time.time())) - time.time() + 5, 0)
            if sleep_sec > 0:
                print(f"[X] Rate limit low on {endpoint} — sleeping {sleep_sec:.0f}s")
                time.sleep(sleep_sec)

    def _call(self, method, endpoint_key: str, **kwargs):
        self._wait_if_needed(endpoint_key)
        try:
            resp = method(**kwargs)
            # Extract headers if available
            if hasattr(resp, "response") and resp.response is not None:
                self._update_limits(dict(resp.response.headers), endpoint_key)
            return resp
        except Exception as e:
            print(f"[X ERROR] {endpoint_key} call failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"[X ERROR] Response Headers: {e.response.headers}")
                print(f"[X ERROR] Response Body: {e.response.text}")
            raise e

    def get_rate_status(self) -> dict:
        keys = _r.keys("rate:*")
        return {k: _r.hgetall(k) for k in keys}

    # ── Search ─────────────────────────────────────────────────────────────────

    def search_recent(self, query: str, since_id: str | None = None, max_results: int = 10):
        return self._call(
            self.client.search_recent_tweets,
            "/tweets/search/recent",
            query=query,
            since_id=since_id,
            max_results=max(10, min(max_results, 100)),  # v2 requires 10-100
            tweet_fields=["created_at", "author_id", "text", "public_metrics"],
            expansions=["author_id"],
            user_fields=["username", "name"],
        )

    # ── Own account ────────────────────────────────────────────────────────────

    def get_my_recent_posts(self, max_results: int = 10):
        me = self.client.get_me()
        return self._call(
            self.client.get_users_tweets,
            "/users/tweets",
            id=me.data.id,
            max_results=max_results,
            tweet_fields=["created_at", "text"],
        )

    def get_mentions(self, max_results: int = 10):
        me = self.client.get_me()
        return self._call(
            self.client.get_users_mentions,
            "/users/mentions",
            id=me.data.id,
            max_results=max_results,
            tweet_fields=["created_at", "author_id", "conversation_id"],
        )

    # ── Trends (v1.1 — v2 trends are enterprise tier only) ────────────────────

    def get_trends(self, woeid: int = 1):
        """Get trending topics. woeid=1 = worldwide."""
        return self.api.get_place_trends(woeid)

    # ── Media upload ───────────────────────────────────────────────────────────

    def upload_media(self, media_bytes: bytes, media_type: str = "image/png") -> str:
        """Upload image bytes, return media_id_string."""
        media = self.api.media_upload(
            filename="news_card.png",
            file=__import__("io").BytesIO(media_bytes),
        )
        return media.media_id_string

    # ── Tweet / reply ──────────────────────────────────────────────────────────

    def create_tweet(
        self,
        text: str,
        media_ids: list[str] | None = None,
        reply_to: str | None = None,
    ):
        return self._call(
            self.client.create_tweet,
            "/tweets/create",
            text=text,
            media_ids=media_ids,
            in_reply_to_tweet_id=reply_to,
        )

    def reply_to_tweet(self, text: str, reply_to_id: str, media_ids: list[str] | None = None):
        return self.create_tweet(text, media_ids=media_ids, reply_to=reply_to_id)

    def get_my_profile(self):
        """Fetch @runcouragerun's own profile info."""
        return self.client.get_me(
            user_fields=["username", "name", "description", "public_metrics", "profile_image_url", "created_at"],
        )


# ── Module-level singleton ─────────────────────────────────────────────────────

def make_x_client() -> XRateLimitedClient | None:
    """Return configured client, or None if keys are missing."""
    print("[X_CLIENT DEBUG] Key Check:", {
        "consumer_key": bool(X_CONSUMER_KEY),
        "consumer_secret": bool(X_CONSUMER_SECRET),
        "access_token": bool(X_ACCESS_TOKEN),
        "access_token_secret": bool(X_ACCESS_TOKEN_SECRET),
        "bearer_token": bool(X_BEARER_TOKEN)
    })

    if not all([X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET]):
        print("[X] [FAIL] API keys missing in .env — X features disabled.")
        return None
    try:
        client = XRateLimitedClient()
        # Test login
        me = client.get_my_profile()
        if me and me.data:
            print(f"[X] [ OK ] Authenticated as @{me.data.username} (User Context)")
        return client
    except Exception as e:
        print(f"[X] [FAIL] Client init failed: {e}")
        return None
