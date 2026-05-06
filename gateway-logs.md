05/06/2026, 16:50:37:
build
Pulled 3/14 layers
05/06/2026, 16:50:37:
build
Pulled 6/14 layers
05/06/2026, 16:50:37:
build
Pulled 9/14 layers
05/06/2026, 16:50:37:
build
Pulled 12/14 layers
05/06/2026, 16:50:39:
build
Pulled 14/14 layers
05/06/2026, 16:50:39:
build
Digest: sha256:b993eaa19115974dee48a91d239e2bbb85ac90378c493625f42f2ed517d8d2c7
05/06/2026, 16:50:39:
build
Status: Downloaded newer image for registry-01.nbg1.ger.sliplane.io/org_gaw21uevgoh7/service_b52wx5qzmk0h:service_event_3n7iy8moa39r
05/06/2026, 16:50:39:
runtime
INFO:     Shutting down
05/06/2026, 16:50:39:
runtime
INFO:     Waiting for application shutdown.
05/06/2026, 16:50:39:
runtime
INFO:     Finished server process [1]
05/06/2026, 16:50:39:
runtime
INFO:     Application shutdown complete.
05/06/2026, 16:50:39:
runtime
[SHUTDOWN] Shutdown complete.
05/06/2026, 16:50:39:
runtime
[SHUTDOWN] Shutting down...
05/06/2026, 16:50:42:
runtime
INFO:     Application startup complete.
05/06/2026, 16:50:42:
runtime
INFO:     Waiting for application startup.
05/06/2026, 16:50:42:
runtime
INFO:     Started server process [1]
05/06/2026, 16:50:42:
runtime
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
05/06/2026, 16:50:43:
runtime
INFO:     172.18.0.1:32836 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:50:43:
runtime
[STARTUP] Courage is waking up... waiting 5s for healthchecks to settle.
05/06/2026, 16:50:45:
runtime
INFO:     127.0.0.1:40670 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:51:16:
runtime
INFO:     127.0.0.1:42982 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:51:16:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 16:51:16:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 16:51:16:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 16:51:16:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Round complete.
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 16:51:16:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 16:51:16:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 16:51:16:
runtime
[AUTO] Groq 429 streak=2. Circuit breaker armed: 60m backoff.
05/06/2026, 16:51:16:
runtime
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
05/06/2026, 16:51:16:
runtime
[AUTO] Execution failed: Client error '429 Too Many Requests' for url 'https://api.groq.com/openai/v1/chat/completions'
05/06/2026, 16:51:16:
runtime
[GROQ] Fallback also 429 (Retry-After: 8s). Both models exhausted.
05/06/2026, 16:51:16:
runtime
[GROQ] Attempting fallback to 8b (no tools)...
05/06/2026, 16:51:16:
runtime
[GROQ] 429 Error on llama-3.3-70b-versatile (Retry-After: 23s).
05/06/2026, 16:51:16:
runtime
[TWITTER] Tool: get_x_rate_status
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 16:51:16:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 16:51:16:
runtime
[STARTUP] Voice models ready.
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 16:51:16:
runtime
[VOICE] Memory usage optimized.
05/06/2026, 16:51:16:
runtime
[VOICE] All models ready.
05/06/2026, 16:51:16:
runtime
[VOICE] Kokoro TTS loaded successfully.
05/06/2026, 16:51:16:
runtime
[AUTO] Decision — action=RANDOM bucket=RANDOM confidence=0.70 | No strong news or crypto to tweet about, let's create something new.
05/06/2026, 16:51:16:
runtime
[VOICE] Loading Kokoro TTS...
05/06/2026, 16:51:16:
runtime
[VOICE] Whisper loaded successfully.
05/06/2026, 16:51:16:
runtime
[AUTO] State — sessions: 0, unreplied: 0, auto_tweets_today: 1
05/06/2026, 16:51:16:
runtime
[TRIAGE] Parsed 0 scores from LLM.
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 16:51:16:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 16:51:16:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 16:51:16:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 16:51:16:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 16:51:16:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 16:51:16:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 16:51:16:
runtime
[REDIS] Connected successfully to redis://:x580z9UAnAV6Fl46@redis-jhla.internal:6379
05/06/2026, 16:51:16:
runtime
[VOICE] Loading Whisper...
05/06/2026, 16:51:16:
runtime
[STARTUP] Loading voice models (background)...
05/06/2026, 16:51:16:
runtime
[AUTO] Autonomous tick starting at 2026-05-06T14:50:47.099255
05/06/2026, 16:51:16:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 16:51:16:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 16:51:16:
runtime
[STARTUP] Courage Brain is fully awake. 🐕✨
05/06/2026, 16:51:16:
runtime
[STARTUP] Scheduler online.
05/06/2026, 16:51:16:
runtime
[STARTUP] X client: ACTIVE
05/06/2026, 16:51:16:
runtime
[STARTUP] Redis connected.
05/06/2026, 16:51:16:
runtime
[GOALS] Goal tracker tables initialized.
05/06/2026, 16:51:16:
runtime
[GOALS] Migrating DB: Adding 'topic_keyword' column...
05/06/2026, 16:51:16:
runtime
[GOALS] Migrating DB: Adding 'confidence' column...
05/06/2026, 16:51:16:
runtime
[STARTUP] Initializing background services...
05/06/2026, 16:51:16:
runtime
[STARTUP] Databases initialized.
05/06/2026, 16:51:33:
runtime
INFO:     10.1.0.3:38070 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:51:46:
runtime
INFO:     127.0.0.1:48920 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:52:16:
runtime
INFO:     127.0.0.1:35452 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:52:30:
runtime
INFO:     10.1.0.3:59676 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:52:46:
runtime
INFO:     127.0.0.1:44668 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:53:16:
runtime
INFO:     127.0.0.1:38396 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:53:31:
runtime
INFO:     10.1.0.3:56100 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:53:46:
runtime
INFO:     127.0.0.1:55398 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:54:16:
runtime
INFO:     127.0.0.1:38694 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:54:30:
runtime
INFO:     10.1.0.3:56662 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:54:46:
runtime
INFO:     127.0.0.1:40232 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:55:16:
runtime
INFO:     127.0.0.1:50320 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:55:33:
runtime
INFO:     10.1.0.3:10792 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:55:47:
runtime
INFO:     127.0.0.1:49544 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:56:17:
runtime
INFO:     127.0.0.1:44474 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:56:33:
runtime
INFO:     10.1.0.3:14308 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:56:47:
runtime
INFO:     127.0.0.1:38672 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:57:17:
runtime
INFO:     127.0.0.1:58416 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:57:31:
runtime
INFO:     10.1.0.3:31474 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:57:47:
runtime
INFO:     127.0.0.1:49124 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:58:17:
runtime
INFO:     127.0.0.1:45266 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:58:31:
runtime
INFO:     10.1.0.3:48646 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:58:47:
runtime
INFO:     127.0.0.1:50228 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:59:17:
runtime
INFO:     127.0.0.1:36384 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 16:59:35:
runtime
INFO:     10.1.0.3:25794 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 16:59:47:
runtime
INFO:     127.0.0.1:53918 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:00:17:
runtime
INFO:     127.0.0.1:34840 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:00:33:
runtime
INFO:     10.1.0.3:40424 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:00:48:
runtime
INFO:     127.0.0.1:34494 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:01:18:
runtime
INFO:     127.0.0.1:45968 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:01:33:
runtime
INFO:     10.1.0.3:59258 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:01:48:
runtime
INFO:     127.0.0.1:60250 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:02:18:
runtime
INFO:     127.0.0.1:48156 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:02:33:
runtime
INFO:     10.1.0.3:60612 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:02:48:
runtime
INFO:     127.0.0.1:36698 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:03:18:
runtime
INFO:     127.0.0.1:47042 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:03:31:
runtime
INFO:     10.1.0.3:15546 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:03:48:
runtime
INFO:     127.0.0.1:57034 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:04:18:
runtime
INFO:     127.0.0.1:54894 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:04:31:
runtime
INFO:     10.1.0.3:2310 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:04:48:
runtime
INFO:     127.0.0.1:46386 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:05:18:
runtime
INFO:     127.0.0.1:47388 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:05:31:
runtime
INFO:     10.1.0.3:22716 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:05:48:
runtime
INFO:     127.0.0.1:44288 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:06:19:
runtime
INFO:     127.0.0.1:48972 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:06:30:
runtime
INFO:     10.1.0.3:44150 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:06:49:
runtime
INFO:     127.0.0.1:56644 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:07:19:
runtime
INFO:     127.0.0.1:41512 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:07:31:
runtime
INFO:     10.1.0.3:3222 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:07:49:
runtime
INFO:     127.0.0.1:55668 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:08:19:
runtime
INFO:     127.0.0.1:32790 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:08:31:
runtime
INFO:     10.1.0.3:14974 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:08:49:
runtime
INFO:     127.0.0.1:42068 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:09:19:
runtime
INFO:     127.0.0.1:52990 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:09:36:
runtime
INFO:     10.1.0.3:11334 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:09:49:
runtime
INFO:     127.0.0.1:54706 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:10:19:
runtime
INFO:     127.0.0.1:45656 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:10:30:
runtime
INFO:     10.1.0.3:47776 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:10:41:
runtime
INFO:     10.1.0.3:16716 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 17:10:49:
runtime
INFO:     127.0.0.1:48128 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:11:19:
runtime
INFO:     127.0.0.1:34274 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:11:31:
runtime
INFO:     10.1.0.3:45746 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:11:50:
runtime
INFO:     127.0.0.1:40230 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:11:53:
runtime
INFO:     10.1.0.3:60020 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 17:12:20:
runtime
INFO:     127.0.0.1:58812 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:12:31:
runtime
INFO:     10.1.0.3:52472 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:12:50:
runtime
INFO:     127.0.0.1:38676 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:13:20:
runtime
INFO:     127.0.0.1:34508 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:13:31:
runtime
INFO:     10.1.0.3:4512 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:13:50:
runtime
INFO:     127.0.0.1:48966 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:14:20:
runtime
INFO:     127.0.0.1:33072 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:14:33:
runtime
INFO:     10.1.0.3:40414 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:14:50:
runtime
INFO:     127.0.0.1:37150 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:15:20:
runtime
INFO:     127.0.0.1:51188 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:15:34:
runtime
INFO:     10.1.0.3:59206 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:15:50:
runtime
INFO:     127.0.0.1:34268 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:16:20:
runtime
INFO:     127.0.0.1:49058 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:16:33:
runtime
INFO:     10.1.0.3:61624 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:16:51:
runtime
INFO:     127.0.0.1:52032 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:17:21:
runtime
INFO:     127.0.0.1:44474 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:17:31:
runtime
INFO:     10.1.0.3:62530 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:17:51:
runtime
INFO:     127.0.0.1:49770 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:18:21:
runtime
INFO:     127.0.0.1:38940 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:18:33:
runtime
INFO:     10.1.0.3:4872 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:18:51:
runtime
INFO:     127.0.0.1:49366 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:19:21:
runtime
INFO:     127.0.0.1:49344 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:19:31:
runtime
INFO:     10.1.0.3:60906 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:19:51:
runtime
INFO:     127.0.0.1:51564 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:20:21:
runtime
INFO:     127.0.0.1:57022 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:20:30:
runtime
INFO:     10.1.0.3:46076 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:20:51:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 17:20:51:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 17:20:51:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:20:51:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 17:20:51:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 17:20:51:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 17:20:51:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 17:20:51:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:20:51:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 17:20:51:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 17:20:51:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 17:20:51:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 17:20:51:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:20:51:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 17:20:51:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 17:20:51:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 17:20:51:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 17:20:51:
runtime
INFO:     127.0.0.1:46686 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:20:51:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 17:20:51:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:20:51:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 17:20:51:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 17:20:51:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 17:20:51:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:20:51:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:21:21:
runtime
INFO:     127.0.0.1:56334 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:21:21:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 17:21:21:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 17:21:21:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 17:21:21:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 17:21:21:
runtime
[DISCOVERY] Round complete.
05/06/2026, 17:21:21:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 17:21:21:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:21:21:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:21:21:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 17:21:21:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:21:21:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:21:21:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 17:21:21:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:21:21:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 17:21:21:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:21:21:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:21:21:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 17:21:21:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:21:21:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:21:21:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 17:21:21:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 17:21:52:
runtime
INFO:     127.0.0.1:41314 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:22:22:
runtime
INFO:     127.0.0.1:48262 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:22:33:
runtime
INFO:     10.1.0.3:4276 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:22:52:
runtime
INFO:     127.0.0.1:56786 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:23:22:
runtime
INFO:     127.0.0.1:55488 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:23:30:
runtime
INFO:     10.1.0.3:23194 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:23:52:
runtime
INFO:     127.0.0.1:42690 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:24:22:
runtime
INFO:     127.0.0.1:50560 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:24:33:
runtime
INFO:     10.1.0.3:9020 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:24:52:
runtime
INFO:     127.0.0.1:44998 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:25:22:
runtime
INFO:     127.0.0.1:36530 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:25:52:
runtime
INFO:     127.0.0.1:37998 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:26:22:
runtime
INFO:     127.0.0.1:60156 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:26:31:
runtime
INFO:     10.1.0.3:63656 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:26:53:
runtime
INFO:     127.0.0.1:44116 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:27:23:
runtime
INFO:     127.0.0.1:48672 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:27:31:
runtime
INFO:     10.1.0.3:8390 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:27:53:
runtime
INFO:     127.0.0.1:53268 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:28:23:
runtime
INFO:     127.0.0.1:38126 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:28:30:
runtime
INFO:     10.1.0.3:16150 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:28:53:
runtime
INFO:     127.0.0.1:43490 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:29:23:
runtime
INFO:     127.0.0.1:48708 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:29:27:
runtime
INFO:     10.1.0.3:52966 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 17:29:30:
runtime
INFO:     10.1.0.3:52976 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:29:53:
runtime
INFO:     127.0.0.1:37478 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:30:23:
runtime
INFO:     127.0.0.1:50006 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:30:30:
runtime
INFO:     10.1.0.3:40372 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:30:53:
runtime
INFO:     127.0.0.1:56560 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:31:15:
runtime
INFO:     10.1.0.3:33178 - "GET /media/system/js/core.js HTTP/1.1" 200 OK
05/06/2026, 17:31:17:
runtime
INFO:     10.1.0.3:33192 - "GET /wp-includes/js/jquery/jquery.js HTTP/1.1" 404 Not Found
05/06/2026, 17:31:23:
runtime
INFO:     127.0.0.1:45640 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:31:30:
runtime
INFO:     10.1.0.3:11188 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:31:54:
runtime
INFO:     127.0.0.1:44518 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:32:24:
runtime
INFO:     127.0.0.1:34640 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:32:30:
runtime
INFO:     10.1.0.3:46940 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:32:54:
runtime
INFO:     127.0.0.1:40764 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:33:24:
runtime
INFO:     127.0.0.1:39438 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:33:33:
runtime
INFO:     10.1.0.3:4796 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:33:54:
runtime
INFO:     127.0.0.1:54898 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:34:24:
runtime
INFO:     127.0.0.1:57082 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:34:33:
runtime
INFO:     10.1.0.3:11344 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:34:54:
runtime
INFO:     127.0.0.1:54524 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:35:24:
runtime
INFO:     127.0.0.1:34182 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:35:31:
runtime
INFO:     10.1.0.3:36824 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:35:54:
runtime
INFO:     127.0.0.1:36602 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:36:24:
runtime
INFO:     127.0.0.1:36394 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:36:30:
runtime
INFO:     10.1.0.3:48322 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:36:55:
runtime
INFO:     127.0.0.1:38162 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:37:25:
runtime
INFO:     127.0.0.1:52582 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:37:30:
runtime
INFO:     10.1.0.3:57410 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:37:55:
runtime
INFO:     127.0.0.1:54688 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:38:25:
runtime
INFO:     127.0.0.1:34454 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:38:30:
runtime
INFO:     10.1.0.3:46012 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:38:55:
runtime
INFO:     127.0.0.1:37266 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:39:02:
runtime
INFO:     10.1.0.3:11682 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 17:39:25:
runtime
INFO:     127.0.0.1:46310 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:39:30:
runtime
INFO:     10.1.0.3:60432 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:39:55:
runtime
INFO:     127.0.0.1:50574 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:40:25:
runtime
INFO:     127.0.0.1:49576 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:40:31:
runtime
INFO:     10.1.0.3:42886 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:40:55:
runtime
INFO:     127.0.0.1:55610 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:41:25:
runtime
INFO:     127.0.0.1:55952 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:41:33:
runtime
INFO:     10.1.0.3:51014 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:41:56:
runtime
INFO:     127.0.0.1:59802 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:42:26:
runtime
INFO:     127.0.0.1:55062 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:42:30:
runtime
INFO:     10.1.0.3:13078 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:42:56:
runtime
INFO:     127.0.0.1:53164 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:43:26:
runtime
INFO:     127.0.0.1:51748 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:43:30:
runtime
INFO:     10.1.0.3:64102 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:43:56:
runtime
INFO:     127.0.0.1:36510 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:44:26:
runtime
INFO:     127.0.0.1:43812 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:44:33:
runtime
INFO:     10.1.0.3:8734 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:44:56:
runtime
INFO:     127.0.0.1:55728 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:45:26:
runtime
INFO:     127.0.0.1:55010 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:45:33:
runtime
INFO:     10.1.0.3:16970 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:45:56:
runtime
INFO:     127.0.0.1:51400 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:46:26:
runtime
INFO:     127.0.0.1:34758 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:46:31:
runtime
INFO:     10.1.0.3:49650 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:46:57:
runtime
INFO:     127.0.0.1:41884 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:47:27:
runtime
INFO:     127.0.0.1:40432 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:47:34:
runtime
INFO:     10.1.0.3:18242 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:47:57:
runtime
INFO:     127.0.0.1:54182 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:48:27:
runtime
INFO:     127.0.0.1:35636 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:48:31:
runtime
INFO:     10.1.0.3:48482 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:48:57:
runtime
INFO:     127.0.0.1:60786 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:49:27:
runtime
INFO:     127.0.0.1:43594 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:49:42:
runtime
INFO:     10.1.0.3:36726 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:49:57:
runtime
INFO:     127.0.0.1:57346 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:50:27:
runtime
INFO:     127.0.0.1:47080 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:50:31:
runtime
INFO:     10.1.0.3:41760 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 17:50:57:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 17:50:57:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 17:50:57:
runtime
INFO:     127.0.0.1:60838 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Round complete.
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 17:50:57:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 17:50:57:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 17:50:57:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 17:50:57:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 17:50:57:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 17:50:57:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 17:50:57:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 17:50:57:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 17:50:57:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 17:51:27:
runtime
[AUTO] Autonomous tick starting at 2026-05-06T15:51:10.861343
05/06/2026, 17:51:27:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 17:51:27:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 17:51:27:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 17:51:27:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 17:51:27:
runtime
INFO:     127.0.0.1:44106 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:51:27:
runtime
[AUTO] Groq 429 streak=3. Circuit breaker armed: 120m backoff.
05/06/2026, 17:51:27:
runtime
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
05/06/2026, 17:51:27:
runtime
[AUTO] Execution failed: Client error '429 Too Many Requests' for url 'https://api.groq.com/openai/v1/chat/completions'
05/06/2026, 17:51:27:
runtime
[GROQ] Fallback also 429 (Retry-After: 1s). Both models exhausted.
05/06/2026, 17:51:27:
runtime
[GROQ] Attempting fallback to 8b (no tools)...
05/06/2026, 17:51:27:
runtime
[GROQ] 429 Error on llama-3.3-70b-versatile (Retry-After: 22s).
05/06/2026, 17:51:27:
runtime
[TWITTER] Tool: get_x_rate_status
05/06/2026, 17:51:27:
runtime
[AUTO] Decision — action=TWEET_NEWS bucket=NEWS confidence=0.85 | Panic about COVID-19 story because users in mentions are worried...
05/06/2026, 17:51:27:
runtime
[AUTO] State — sessions: 0, unreplied: 0, auto_tweets_today: 1
05/06/2026, 17:51:27:
runtime
[TRIAGE] Parsed 0 scores from LLM.
05/06/2026, 17:51:33:
runtime
INFO:     10.1.0.3:56826 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:51:58:
runtime
INFO:     127.0.0.1:34910 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:52:28:
runtime
INFO:     127.0.0.1:60844 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:52:33:
runtime
INFO:     10.1.0.3:8106 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:52:58:
runtime
INFO:     127.0.0.1:42190 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:53:28:
runtime
INFO:     127.0.0.1:54186 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:53:32:
runtime
INFO:     10.1.0.3:11600 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:53:58:
runtime
INFO:     127.0.0.1:41738 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:54:28:
runtime
INFO:     127.0.0.1:46388 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:54:33:
runtime
INFO:     10.1.0.3:61212 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:54:58:
runtime
INFO:     127.0.0.1:43552 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:55:28:
runtime
INFO:     127.0.0.1:43112 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:55:33:
runtime
INFO:     10.1.0.3:35824 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:55:58:
runtime
INFO:     127.0.0.1:56156 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:56:28:
runtime
INFO:     127.0.0.1:52588 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:56:33:
runtime
INFO:     10.1.0.3:54012 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:56:58:
runtime
INFO:     127.0.0.1:58748 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:57:29:
runtime
INFO:     127.0.0.1:60110 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:57:30:
runtime
INFO:     10.1.0.3:59158 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:57:59:
runtime
INFO:     127.0.0.1:42108 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:58:29:
runtime
INFO:     127.0.0.1:52762 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:58:30:
runtime
INFO:     10.1.0.3:50470 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:58:59:
runtime
INFO:     127.0.0.1:47662 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:59:29:
runtime
INFO:     127.0.0.1:46692 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 17:59:34:
runtime
INFO:     10.1.0.3:61248 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 17:59:59:
runtime
INFO:     127.0.0.1:44274 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:00:29:
runtime
INFO:     127.0.0.1:49434 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:00:33:
runtime
INFO:     10.1.0.3:4148 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:00:59:
runtime
INFO:     127.0.0.1:47268 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:01:29:
runtime
INFO:     127.0.0.1:58006 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:01:33:
runtime
INFO:     10.1.0.3:60196 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:01:59:
runtime
INFO:     127.0.0.1:34404 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:02:12:
runtime
INFO:     10.1.0.3:15422 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 18:02:30:
runtime
INFO:     127.0.0.1:47246 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:02:33:
runtime
INFO:     10.1.0.3:13274 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:03:00:
runtime
INFO:     127.0.0.1:51108 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:03:30:
runtime
INFO:     127.0.0.1:32896 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:04:00:
runtime
INFO:     127.0.0.1:35858 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:04:30:
runtime
INFO:     127.0.0.1:50676 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:04:33:
runtime
INFO:     10.1.0.3:48620 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:04:51:
runtime
INFO:     10.1.0.3:8508 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 18:05:00:
runtime
INFO:     127.0.0.1:45316 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:05:30:
runtime
INFO:     127.0.0.1:45620 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:05:33:
runtime
INFO:     10.1.0.3:52556 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:06:00:
runtime
INFO:     127.0.0.1:47696 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:06:29:
runtime
INFO:     10.1.0.3:39586 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:06:30:
runtime
INFO:     127.0.0.1:60920 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:07:00:
runtime
INFO:     127.0.0.1:49938 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:07:30:
runtime
INFO:     10.1.0.3:11282 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:07:30:
runtime
INFO:     127.0.0.1:50488 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:08:01:
runtime
INFO:     127.0.0.1:51144 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:08:30:
runtime
INFO:     10.1.0.3:7470 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:08:31:
runtime
INFO:     127.0.0.1:43074 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:09:01:
runtime
INFO:     127.0.0.1:40252 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:09:31:
runtime
INFO:     10.1.0.3:14894 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:09:31:
runtime
INFO:     127.0.0.1:56642 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:10:01:
runtime
INFO:     127.0.0.1:53536 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:10:30:
runtime
INFO:     10.1.0.3:11456 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:10:31:
runtime
INFO:     127.0.0.1:44364 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:11:01:
runtime
INFO:     127.0.0.1:57090 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:11:31:
runtime
INFO:     127.0.0.1:53550 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:11:33:
runtime
INFO:     10.1.0.3:40972 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:12:01:
runtime
INFO:     127.0.0.1:58736 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:12:31:
runtime
INFO:     10.1.0.3:55552 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:12:31:
runtime
INFO:     127.0.0.1:50860 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:13:02:
runtime
INFO:     127.0.0.1:59212 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:13:21:
runtime
INFO:     10.1.0.3:24582 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 18:13:30:
runtime
INFO:     10.1.0.3:13132 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:13:32:
runtime
INFO:     127.0.0.1:52816 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:14:02:
runtime
INFO:     127.0.0.1:50444 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:14:31:
runtime
INFO:     10.1.0.3:11832 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:14:32:
runtime
INFO:     127.0.0.1:34186 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:15:02:
runtime
INFO:     127.0.0.1:44760 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:15:30:
runtime
INFO:     10.1.0.3:11786 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:15:32:
runtime
INFO:     127.0.0.1:54954 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:16:02:
runtime
INFO:     127.0.0.1:44322 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:16:32:
runtime
INFO:     127.0.0.1:53500 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:16:33:
runtime
INFO:     10.1.0.3:21848 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:17:02:
runtime
INFO:     127.0.0.1:58988 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:17:31:
runtime
INFO:     10.1.0.3:56078 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:17:32:
runtime
INFO:     127.0.0.1:50174 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:18:02:
runtime
INFO:     127.0.0.1:53276 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:18:33:
runtime
INFO:     127.0.0.1:52440 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:18:33:
runtime
INFO:     10.1.0.3:36574 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:19:03:
runtime
INFO:     127.0.0.1:50214 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:19:33:
runtime
INFO:     127.0.0.1:43102 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:19:37:
runtime
INFO:     10.1.0.3:35722 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:20:03:
runtime
INFO:     127.0.0.1:52754 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:20:17:
runtime
INFO:     10.1.0.3:31818 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 18:20:30:
runtime
INFO:     10.1.0.3:62144 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:20:33:
runtime
INFO:     127.0.0.1:46126 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:21:03:
runtime
INFO:     127.0.0.1:35648 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:21:03:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 18:21:03:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 18:21:03:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 18:21:03:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Round complete.
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 18:21:03:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 18:21:03:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 18:21:03:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 18:21:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 18:21:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:21:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:21:03:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 18:21:03:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 18:21:03:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 18:21:03:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 18:21:03:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 18:21:33:
runtime
INFO:     10.1.0.3:3392 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:21:33:
runtime
INFO:     127.0.0.1:52592 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:22:03:
runtime
INFO:     127.0.0.1:58054 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:22:30:
runtime
INFO:     10.1.0.3:59272 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:22:33:
runtime
INFO:     127.0.0.1:55150 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:23:03:
runtime
INFO:     127.0.0.1:56934 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:23:30:
runtime
INFO:     10.1.0.3:15606 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:23:34:
runtime
INFO:     127.0.0.1:51448 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:24:04:
runtime
INFO:     127.0.0.1:34466 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:24:30:
runtime
INFO:     10.1.0.3:57494 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:24:34:
runtime
INFO:     127.0.0.1:42562 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:25:04:
runtime
INFO:     127.0.0.1:50320 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:25:33:
runtime
INFO:     10.1.0.3:48718 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:25:34:
runtime
INFO:     127.0.0.1:39700 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:26:04:
runtime
INFO:     127.0.0.1:44068 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:26:33:
runtime
INFO:     10.1.0.3:20596 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:26:34:
runtime
INFO:     127.0.0.1:53628 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:27:04:
runtime
INFO:     127.0.0.1:50612 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:27:30:
runtime
INFO:     10.1.0.3:2038 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:27:34:
runtime
INFO:     127.0.0.1:38434 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:28:04:
runtime
INFO:     127.0.0.1:44508 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:28:30:
runtime
INFO:     10.1.0.3:18894 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:28:34:
runtime
INFO:     127.0.0.1:52408 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:29:05:
runtime
INFO:     127.0.0.1:43170 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:29:30:
runtime
INFO:     10.1.0.3:65148 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:29:35:
runtime
INFO:     127.0.0.1:55958 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:30:05:
runtime
INFO:     127.0.0.1:50292 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:30:30:
runtime
INFO:     10.1.0.3:46288 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:30:35:
runtime
INFO:     127.0.0.1:59470 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:31:05:
runtime
INFO:     127.0.0.1:38688 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:31:30:
runtime
INFO:     10.1.0.3:26124 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:31:35:
runtime
INFO:     127.0.0.1:54148 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:32:05:
runtime
INFO:     127.0.0.1:55846 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:32:33:
runtime
INFO:     10.1.0.3:42770 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:32:35:
runtime
INFO:     127.0.0.1:45476 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:33:05:
runtime
INFO:     127.0.0.1:60370 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:33:30:
runtime
INFO:     10.1.0.3:11488 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:33:35:
runtime
INFO:     127.0.0.1:55714 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:34:05:
runtime
INFO:     127.0.0.1:35478 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:34:30:
runtime
INFO:     10.1.0.3:47404 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:34:36:
runtime
INFO:     127.0.0.1:43178 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:34:45:
runtime
INFO:     10.1.0.3:22168 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 18:35:06:
runtime
INFO:     127.0.0.1:55750 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:35:30:
runtime
INFO:     10.1.0.3:5834 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:35:36:
runtime
INFO:     127.0.0.1:47742 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:36:36:
runtime
INFO:     127.0.0.1:46656 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:37:06:
runtime
INFO:     127.0.0.1:54874 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:37:33:
runtime
INFO:     10.1.0.3:49484 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:37:36:
runtime
INFO:     127.0.0.1:49654 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:38:06:
runtime
INFO:     127.0.0.1:48412 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:38:30:
runtime
INFO:     10.1.0.3:57126 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:38:36:
runtime
INFO:     127.0.0.1:39802 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:39:06:
runtime
INFO:     127.0.0.1:45554 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:39:30:
runtime
INFO:     10.1.0.3:59062 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:39:36:
runtime
INFO:     127.0.0.1:43008 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:40:07:
runtime
INFO:     127.0.0.1:54054 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:40:30:
runtime
INFO:     10.1.0.3:57642 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:40:37:
runtime
INFO:     127.0.0.1:44844 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:41:07:
runtime
INFO:     127.0.0.1:32844 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:41:30:
runtime
INFO:     10.1.0.3:41498 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:41:37:
runtime
INFO:     127.0.0.1:58438 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:42:07:
runtime
INFO:     127.0.0.1:38694 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:42:30:
runtime
INFO:     10.1.0.3:44270 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:42:37:
runtime
INFO:     127.0.0.1:39894 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:43:07:
runtime
INFO:     127.0.0.1:44718 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:43:33:
runtime
INFO:     10.1.0.3:58090 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:43:37:
runtime
INFO:     127.0.0.1:56868 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:44:07:
runtime
INFO:     127.0.0.1:37832 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:44:30:
runtime
INFO:     10.1.0.3:59616 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:44:37:
runtime
INFO:     127.0.0.1:53196 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:45:07:
runtime
INFO:     127.0.0.1:58792 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:45:33:
runtime
INFO:     10.1.0.3:4566 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:45:38:
runtime
INFO:     127.0.0.1:35106 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:46:08:
runtime
INFO:     127.0.0.1:42860 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:46:33:
runtime
INFO:     10.1.0.3:63850 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:46:38:
runtime
INFO:     127.0.0.1:33572 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:47:08:
runtime
INFO:     127.0.0.1:57026 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:47:30:
runtime
INFO:     10.1.0.3:54680 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:47:38:
runtime
INFO:     127.0.0.1:50698 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:48:08:
runtime
INFO:     127.0.0.1:41858 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:48:32:
runtime
INFO:     10.1.0.3:24280 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:48:38:
runtime
INFO:     127.0.0.1:34730 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:49:08:
runtime
INFO:     127.0.0.1:53216 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:49:32:
runtime
INFO:     10.1.0.3:6666 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:49:38:
runtime
INFO:     127.0.0.1:55578 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:50:08:
runtime
INFO:     127.0.0.1:49150 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:50:30:
runtime
INFO:     10.1.0.3:25608 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:50:38:
runtime
INFO:     127.0.0.1:47698 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:51:09:
runtime
INFO:     127.0.0.1:54332 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:51:09:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 18:51:09:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 18:51:09:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 18:51:09:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Round complete.
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 18:51:09:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 18:51:09:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 18:51:09:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 18:51:09:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 18:51:09:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 18:51:09:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 18:51:09:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 18:51:09:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 18:51:09:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 18:51:09:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 18:51:09:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 18:51:32:
runtime
INFO:     10.1.0.3:42310 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:51:39:
runtime
INFO:     127.0.0.1:38412 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:52:09:
runtime
INFO:     127.0.0.1:59286 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:52:09:
runtime
[AUTO] Groq 429 circuit breaker active (streak=3, 59m remaining). Skipping tick.
05/06/2026, 18:52:09:
runtime
[AUTO] State — sessions: 0, unreplied: 0, auto_tweets_today: 1
05/06/2026, 18:52:09:
runtime
[AUTO] Autonomous tick starting at 2026-05-06T16:51:50.802473
05/06/2026, 18:52:09:
runtime
[TRIAGE] Parsed 0 scores from LLM.
05/06/2026, 18:52:30:
runtime
INFO:     10.1.0.3:12114 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:52:39:
runtime
INFO:     127.0.0.1:52144 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:53:09:
runtime
INFO:     127.0.0.1:33788 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:53:32:
runtime
INFO:     10.1.0.3:36490 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:53:39:
runtime
INFO:     127.0.0.1:39326 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:54:09:
runtime
INFO:     127.0.0.1:44822 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:54:39:
runtime
INFO:     127.0.0.1:43280 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:55:09:
runtime
INFO:     127.0.0.1:34232 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:55:30:
runtime
INFO:     10.1.0.3:13180 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:55:39:
runtime
INFO:     127.0.0.1:40272 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:56:10:
runtime
INFO:     127.0.0.1:35458 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:56:30:
runtime
INFO:     10.1.0.3:65012 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:56:40:
runtime
INFO:     127.0.0.1:41350 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:56:50:
runtime
INFO:     10.1.0.3:52416 - "GET /robots.txt HTTP/1.1" 200 OK
05/06/2026, 18:56:50:
runtime
INFO:     10.1.0.3:52422 - "GET /sitemap.xml HTTP/1.1" 200 OK
05/06/2026, 18:57:10:
runtime
INFO:     127.0.0.1:36986 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:57:30:
runtime
INFO:     10.1.0.3:59786 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:57:40:
runtime
INFO:     127.0.0.1:46970 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:58:10:
runtime
INFO:     127.0.0.1:43766 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:58:29:
runtime
INFO:     10.1.0.3:17348 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:58:40:
runtime
INFO:     127.0.0.1:53494 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:59:10:
runtime
INFO:     127.0.0.1:60526 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 18:59:30:
runtime
INFO:     10.1.0.3:30118 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 18:59:40:
runtime
INFO:     127.0.0.1:33950 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:00:10:
runtime
INFO:     127.0.0.1:49208 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:00:30:
runtime
INFO:     10.1.0.3:64436 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:00:40:
runtime
INFO:     127.0.0.1:59246 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:01:11:
runtime
INFO:     127.0.0.1:60900 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:01:30:
runtime
INFO:     10.1.0.3:7374 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:01:41:
runtime
INFO:     127.0.0.1:33160 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:02:11:
runtime
INFO:     127.0.0.1:56246 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:02:30:
runtime
INFO:     10.1.0.3:5058 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:02:41:
runtime
INFO:     127.0.0.1:58528 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:02:43:
runtime
INFO:     10.1.0.3:48460 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:03:11:
runtime
INFO:     127.0.0.1:41808 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:03:33:
runtime
INFO:     10.1.0.3:5474 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:03:41:
runtime
INFO:     127.0.0.1:58116 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:04:11:
runtime
INFO:     127.0.0.1:42534 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:04:33:
runtime
INFO:     10.1.0.3:11666 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:04:41:
runtime
INFO:     127.0.0.1:40258 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:05:11:
runtime
INFO:     127.0.0.1:35228 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:05:30:
runtime
INFO:     10.1.0.3:35904 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:05:41:
runtime
INFO:     127.0.0.1:39028 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:06:11:
runtime
INFO:     127.0.0.1:43704 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:06:30:
runtime
INFO:     10.1.0.3:1116 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:06:42:
runtime
INFO:     127.0.0.1:38944 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:07:12:
runtime
INFO:     127.0.0.1:47948 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:07:33:
runtime
INFO:     10.1.0.3:36396 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:07:42:
runtime
INFO:     127.0.0.1:59080 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:08:12:
runtime
INFO:     127.0.0.1:58642 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:08:30:
runtime
INFO:     10.1.0.3:8082 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:08:42:
runtime
INFO:     127.0.0.1:58614 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:09:12:
runtime
INFO:     127.0.0.1:57214 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:09:29:
runtime
INFO:     10.1.0.3:63820 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:09:42:
runtime
INFO:     127.0.0.1:42198 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:10:12:
runtime
INFO:     127.0.0.1:56412 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:10:42:
runtime
INFO:     127.0.0.1:37616 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:11:12:
runtime
INFO:     127.0.0.1:35276 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:11:30:
runtime
INFO:     10.1.0.3:16658 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:11:43:
runtime
INFO:     127.0.0.1:38662 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:12:13:
runtime
INFO:     127.0.0.1:58484 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:12:33:
runtime
INFO:     10.1.0.3:57622 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:12:43:
runtime
INFO:     127.0.0.1:50108 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:13:00:
runtime
INFO:     10.1.0.3:42482 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:13:13:
runtime
INFO:     127.0.0.1:53852 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:13:33:
runtime
INFO:     10.1.0.3:20426 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:13:43:
runtime
INFO:     127.0.0.1:49078 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:14:13:
runtime
INFO:     127.0.0.1:39760 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:14:33:
runtime
INFO:     10.1.0.3:32030 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:14:43:
runtime
INFO:     127.0.0.1:37468 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:15:13:
runtime
INFO:     127.0.0.1:52122 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:15:30:
runtime
INFO:     10.1.0.3:42842 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:15:43:
runtime
INFO:     127.0.0.1:59288 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:16:13:
runtime
INFO:     127.0.0.1:47044 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:16:27:
runtime
INFO:     10.1.0.3:34470 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:16:31:
runtime
INFO:     10.1.0.3:34482 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:16:43:
runtime
INFO:     127.0.0.1:48696 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:17:14:
runtime
INFO:     127.0.0.1:41096 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:17:33:
runtime
INFO:     10.1.0.3:61560 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:17:44:
runtime
INFO:     127.0.0.1:60154 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:18:14:
runtime
INFO:     127.0.0.1:54238 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:18:44:
runtime
INFO:     127.0.0.1:39092 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:19:08:
runtime
INFO:     10.1.0.3:65258 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:19:14:
runtime
INFO:     127.0.0.1:59072 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:19:44:
runtime
INFO:     127.0.0.1:50536 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:20:07:
runtime
INFO:     10.1.0.3:6830 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:20:14:
runtime
INFO:     127.0.0.1:42338 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:20:44:
runtime
INFO:     127.0.0.1:34044 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 19:21:07:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 19:21:07:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 19:21:07:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 19:21:07:
runtime
INFO:     10.1.0.3:18456 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:21:07:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 19:21:07:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 19:21:07:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 19:21:07:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Round complete.
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 19:21:07:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 19:21:07:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 19:21:07:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 19:21:07:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 19:21:07:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:21:07:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 19:21:07:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:21:07:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:21:14:
runtime
INFO:     127.0.0.1:59312 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:21:44:
runtime
INFO:     127.0.0.1:45816 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:22:03:
runtime
INFO:     10.1.0.3:61152 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:22:15:
runtime
INFO:     127.0.0.1:41394 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:22:45:
runtime
INFO:     127.0.0.1:45488 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:23:08:
runtime
INFO:     10.1.0.3:18912 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:23:15:
runtime
INFO:     127.0.0.1:47888 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:23:40:
runtime
INFO:     10.1.0.3:33606 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:23:45:
runtime
INFO:     127.0.0.1:60840 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:24:04:
runtime
INFO:     10.1.0.3:42242 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:24:15:
runtime
INFO:     127.0.0.1:43414 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:24:45:
runtime
INFO:     127.0.0.1:46552 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:25:04:
runtime
INFO:     10.1.0.3:14876 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:25:15:
runtime
INFO:     127.0.0.1:45144 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:25:45:
runtime
INFO:     127.0.0.1:59028 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:26:06:
runtime
INFO:     10.1.0.3:37382 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:26:15:
runtime
INFO:     127.0.0.1:46344 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:26:45:
runtime
INFO:     127.0.0.1:59478 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:27:07:
runtime
INFO:     10.1.0.3:47884 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:27:15:
runtime
INFO:     127.0.0.1:42814 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:27:46:
runtime
INFO:     127.0.0.1:52944 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:28:15:
runtime
INFO:     10.1.0.3:39256 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:28:16:
runtime
INFO:     127.0.0.1:41564 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:28:46:
runtime
INFO:     127.0.0.1:57618 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:29:03:
runtime
INFO:     10.1.0.3:60134 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:29:16:
runtime
INFO:     127.0.0.1:42044 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:29:46:
runtime
INFO:     127.0.0.1:58916 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:30:04:
runtime
INFO:     10.1.0.3:9544 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:30:16:
runtime
INFO:     127.0.0.1:35592 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:30:46:
runtime
INFO:     127.0.0.1:55426 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:31:04:
runtime
INFO:     10.1.0.3:30068 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:31:16:
runtime
INFO:     127.0.0.1:46438 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:31:46:
runtime
INFO:     127.0.0.1:60784 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:32:04:
runtime
INFO:     10.1.0.3:3438 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:32:16:
runtime
INFO:     127.0.0.1:39586 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:32:47:
runtime
INFO:     127.0.0.1:44632 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:33:07:
runtime
INFO:     10.1.0.3:22832 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:33:17:
runtime
INFO:     127.0.0.1:44362 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:33:47:
runtime
INFO:     127.0.0.1:45878 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:34:04:
runtime
INFO:     10.1.0.3:30340 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:34:17:
runtime
INFO:     127.0.0.1:56920 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:34:47:
runtime
INFO:     127.0.0.1:33128 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:35:06:
runtime
INFO:     10.1.0.3:60306 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:35:17:
runtime
INFO:     127.0.0.1:37002 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:35:47:
runtime
INFO:     127.0.0.1:41644 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:36:05:
runtime
INFO:     10.1.0.3:59872 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:36:17:
runtime
INFO:     127.0.0.1:56194 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:36:47:
runtime
INFO:     127.0.0.1:47180 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:37:03:
runtime
INFO:     10.1.0.3:37460 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:37:17:
runtime
INFO:     127.0.0.1:38258 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:37:48:
runtime
INFO:     127.0.0.1:54642 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:38:07:
runtime
INFO:     10.1.0.3:11312 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:38:18:
runtime
INFO:     127.0.0.1:36298 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:38:48:
runtime
INFO:     127.0.0.1:48178 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:39:03:
runtime
INFO:     10.1.0.3:59536 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:39:18:
runtime
INFO:     127.0.0.1:45026 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:39:48:
runtime
INFO:     127.0.0.1:39614 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:40:04:
runtime
INFO:     10.1.0.3:4862 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:40:18:
runtime
INFO:     127.0.0.1:33662 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:40:48:
runtime
INFO:     127.0.0.1:44314 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:41:06:
runtime
INFO:     10.1.0.3:27344 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:41:18:
runtime
INFO:     127.0.0.1:44964 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:41:48:
runtime
INFO:     127.0.0.1:56860 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:42:07:
runtime
INFO:     10.1.0.3:59470 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:42:18:
runtime
INFO:     127.0.0.1:50362 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:42:49:
runtime
INFO:     127.0.0.1:38974 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:43:06:
runtime
INFO:     10.1.0.3:45174 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:43:19:
runtime
INFO:     127.0.0.1:59568 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:43:49:
runtime
INFO:     127.0.0.1:46090 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:44:03:
runtime
INFO:     10.1.0.3:38766 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:44:19:
runtime
INFO:     127.0.0.1:57110 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:44:49:
runtime
INFO:     127.0.0.1:58896 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:45:03:
runtime
INFO:     10.1.0.3:47108 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:45:19:
runtime
INFO:     127.0.0.1:35656 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:45:49:
runtime
INFO:     127.0.0.1:42676 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:46:06:
runtime
INFO:     10.1.0.3:45986 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:46:19:
runtime
INFO:     127.0.0.1:56384 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:46:41:
runtime
INFO:     10.1.0.3:46954 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:46:49:
runtime
INFO:     127.0.0.1:41296 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:47:03:
runtime
INFO:     10.1.0.3:44388 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:47:19:
runtime
INFO:     127.0.0.1:42380 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:47:50:
runtime
INFO:     127.0.0.1:45894 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:48:04:
runtime
INFO:     10.1.0.3:44174 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:48:20:
runtime
INFO:     127.0.0.1:56030 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:48:50:
runtime
INFO:     127.0.0.1:34782 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:49:06:
runtime
INFO:     10.1.0.3:10228 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:49:20:
runtime
INFO:     127.0.0.1:39818 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:49:50:
runtime
INFO:     127.0.0.1:40488 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:50:04:
runtime
INFO:     10.1.0.3:41856 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:50:20:
runtime
INFO:     127.0.0.1:53826 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:50:50:
runtime
[NEWS] Trying GNews for us/general...
05/06/2026, 19:50:50:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[NEWS] Trying NewsAPI for us/general...
05/06/2026, 19:50:50:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:50:50:
runtime
[NEWS] Trying Guardian for us/general...
05/06/2026, 19:50:50:
runtime
[DISCOVERY] Budget — GNews: 80/80 | NewsAPI: 80/80
05/06/2026, 19:50:50:
runtime
[CRYPTO DISCOVERY] Starting crypto discovery round...
05/06/2026, 19:50:50:
runtime
INFO:     127.0.0.1:40360 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:50:50:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/business
05/06/2026, 19:50:50:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[NEWS] Trying GNews for us/business...
05/06/2026, 19:50:50:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[NEWS] Trying NewsAPI for us/business...
05/06/2026, 19:50:50:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:50:50:
runtime
[NEWS] Trying Guardian for us/business...
05/06/2026, 19:50:50:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/technology
05/06/2026, 19:50:50:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[NEWS] Trying GNews for us/technology...
05/06/2026, 19:50:50:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[NEWS] Trying NewsAPI for us/technology...
05/06/2026, 19:50:50:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:50:50:
runtime
[NEWS] Trying Guardian for us/technology...
05/06/2026, 19:50:50:
runtime
[DISCOVERY] Stored 10 articles [guardian]: us/general
05/06/2026, 19:50:50:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:50:50:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:50:50:
runtime
[DISCOVERY] Starting news round...
05/06/2026, 19:51:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:51:03:
runtime
[NEWS] Trying GNews for us/sports...
05/06/2026, 19:51:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:51:03:
runtime
[NEWS] Trying NewsAPI for us/sports...
05/06/2026, 19:51:03:
runtime
[NEWS] Trying Guardian for us/sports...
05/06/2026, 19:51:03:
runtime
[NEWS] Trying NewsAPI for gb/general...
05/06/2026, 19:51:03:
runtime
[NEWS] Guardian OK: 10 articles
05/06/2026, 19:51:03:
runtime
[NEWS] Trying Guardian for gb/general...
05/06/2026, 19:51:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:51:03:
runtime
[NEWS] Trying GNews for us/entertainment...
05/06/2026, 19:51:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:51:03:
runtime
[NEWS] Trying NewsAPI for us/entertainment...
05/06/2026, 19:51:03:
runtime
[NEWS] Trying Guardian for us/entertainment...
05/06/2026, 19:51:03:
runtime
INFO:     10.1.0.3:12982 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:51:03:
runtime
[CRYPTO DISCOVERY] Complete — 0 articles cached.
05/06/2026, 19:51:03:
runtime
[CRYPTO] CoinGecko: 0 articles
05/06/2026, 19:51:03:
runtime
[CRYPTO] CoinDesk: 0 articles
05/06/2026, 19:51:03:
runtime
[CRYPTO] CoinDesk fetch failed: 
05/06/2026, 19:51:03:
runtime
[DISCOVERY] Round complete.
05/06/2026, 19:51:03:
runtime
[DISCOVERY] Stored 10 articles [guardian]: gb/general
05/06/2026, 19:51:03:
runtime
[NEWS] GNews FAILED: GNews daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] gnews daily limit reached (80/80), skipping API call
05/06/2026, 19:51:03:
runtime
[NEWS] Trying GNews for gb/general...
05/06/2026, 19:51:03:
runtime
[NEWS] NewsAPI FAILED: NewsAPI daily budget exhausted
05/06/2026, 19:51:03:
runtime
[BUDGET] newsapi daily limit reached (80/80), skipping API call
05/06/2026, 19:51:20:
runtime
INFO:     127.0.0.1:54892 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:51:50:
runtime
INFO:     127.0.0.1:41316 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:52:06:
runtime
INFO:     10.1.0.3:10662 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:52:20:
runtime
INFO:     127.0.0.1:48590 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:52:50:
runtime
INFO:     127.0.0.1:58502 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:52:50:
runtime
[AUTO] Low confidence (0.42). Skipping tick.
05/06/2026, 19:52:50:
runtime
[AUTO] Decision — action=TWEET_NEWS bucket=NEWS confidence=0.42 | No specific news story to post, but recent headlines suggest economic uncertainty
05/06/2026, 19:52:50:
runtime
[AUTO] State — sessions: 0, unreplied: 0, auto_tweets_today: 1
05/06/2026, 19:52:50:
runtime
[TRIAGE] Parsed 0 scores from LLM.
05/06/2026, 19:52:50:
runtime
[AUTO] Autonomous tick starting at 2026-05-06T17:52:42.901678
05/06/2026, 19:53:06:
runtime
INFO:     10.1.0.3:17360 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:53:21:
runtime
INFO:     127.0.0.1:37116 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:53:51:
runtime
INFO:     127.0.0.1:41744 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:54:21:
runtime
INFO:     127.0.0.1:50054 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:54:29:
runtime
INFO:     10.1.0.3:23244 - "GET /wp-admin/install.php?step=1 HTTP/1.1" 404 Not Found
05/06/2026, 19:54:51:
runtime
INFO:     127.0.0.1:35154 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:55:06:
runtime
INFO:     10.1.0.3:50642 - "GET /health HTTP/1.1" 200 OK
05/06/2026, 19:55:21:
runtime
INFO:     127.0.0.1:50212 - "HEAD /health HTTP/1.1" 200 OK
05/06/2026, 19:55:51:
runtime
INFO:     127.0.0.1:40644 - "HEAD /health HTTP/1.1" 200 OK