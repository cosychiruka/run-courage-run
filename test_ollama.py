import httpx

print("Testing Internal URL...")
try:
    print(httpx.get('http://ollama-host.internal:11434/api/tags', timeout=10.0).text)
except Exception as e:
    print("Internal Failed:", type(e).__name__, str(e))

print("\nTesting Public URL...")
try:
    print(httpx.get('https://ollama-host.sliplane.app/api/tags', verify=False, timeout=10.0).text)
except Exception as e:
    print("Public Failed:", type(e).__name__, str(e))
