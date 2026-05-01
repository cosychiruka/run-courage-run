import httpx

print("Testing Internal IP...")
try:
    print(httpx.get('http://172.18.0.2:11434/api/tags', timeout=5.0).text)
except Exception as e:
    print("Internal IP Failed:", type(e).__name__, str(e))
