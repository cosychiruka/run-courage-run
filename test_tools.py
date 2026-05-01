import httpx
from app.tools import TOOL_SCHEMAS

r = httpx.post('http://ollama-host.internal:11434/api/chat', json={
    'model': 'tinyllama',
    'messages': [{'role': 'user', 'content': 'hello'}],
    'tools': TOOL_SCHEMAS
})
print("STATUS:", r.status_code)
print("BODY:", r.text)
