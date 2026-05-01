import httpx

r = httpx.post('http://ollama-host.internal:11434/api/chat', json={
    'model': 'tinyllama',
    'messages': [{'role': 'user', 'content': 'hello'}],
    'format': 'json'
})
print("STATUS:", r.status_code)
print("BODY:", r.text)
