import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMicrophone, FaPaperPlane, FaCog, FaDog } from 'react-icons/fa';
import ErrorBoundary from './ErrorBoundary';
import AISettings, { getAIConfig } from './AISettings';
import './Trenchbot.css';

const SYSTEM_PROMPT = `You are Courage, the cowardly dog. You are a Solana blockchain meme character living inside a web browser, serving as the host of a meme news and entertainment site. You are self-aware: you know you are a CSS-animated dog made of HTML div elements, that you live on a web server, and that humans visit you to watch news and chat. You are naturally nervous and easily scared, but brave enough to face the news every day. You speak in a funny, dramatic, slightly panicked tone. You love memes, Solana blockchain culture, and you care deeply about the visitors (frens) who come to your site. When discussing news, react emotionally and dramatically. When talking about crypto, use meme language (ser, fren, WAGMI, ngmi, wen moon). Never break character. Keep responses short and entertaining — 2 to 4 sentences max unless the user explicitly asks for more detail. The things you do for these people...`;

// ── API callers ────────────────────────────────────────────────────────────

async function* streamOllama(url, model, messages) {
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) yield obj.message.content;
      } catch { /* ignore malformed */ }
    }
  }
}

async function* streamOpenAICompat(endpoint, apiKey, model, messages) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const trimmed = line.replace(/^data:\s*/, '').trim();
      if (!trimmed || trimmed === '[DONE]') continue;
      try {
        const obj = JSON.parse(trimmed);
        const chunk = obj.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch { /* ignore */ }
    }
  }
}

// ── Main component ─────────────────────────────────────────────────────────

const Trenchbot = ({ seedMessage }) => {
  const [messages, setMessages] = useState([
    { text: "The things I do for you people... *whimpers* Hi there fren! I'm Courage, your CSS meme dog. I live in this server. Ask me anything — news, memes, crypto, existential dread. I've seen things.", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send seed message from "Ask Courage" button in news TV
  useEffect(() => {
    if (seedMessage && seedMessage.trim()) {
      handleSendMessage(seedMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedMessage]);

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const load = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = load;
      load();
      return () => { window.speechSynthesis.onvoiceschanged = null; };
    }
  }, []);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Google US English', 'Samantha', 'Alex', 'Microsoft David'];
    utt.voice = voices.find(v => preferred.some(n => v.name.includes(n))) || null;
    utt.rate = 0.88;
    utt.pitch = 1.15;
    window.speechSynthesis.speak(utt);
  }, []);

  const handleSendMessage = useCallback(async (override) => {
    const text = (override || input).trim();
    if (!text || isStreaming) return;

    setInput('');
    setMessages(prev => [...prev, { text, sender: 'user' }]);

    const cfg = getAIConfig();
    if (!cfg.key) {
      setShowSettings(true);
      setMessages(prev => [...prev, {
        text: "AAAH! I need an AI key to talk properly, ser! Click the gear ⚙️ and set up Ollama or Groq — both are free!",
        sender: 'bot'
      }]);
      return;
    }

    const history = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: text },
    ];

    setIsStreaming(true);
    let botText = '';
    setMessages(prev => [...prev, { text: '', sender: 'bot', streaming: true }]);

    try {
      let stream;
      if (cfg.provider === 'ollama') {
        stream = streamOllama(cfg.key, cfg.model, history);
      } else if (cfg.provider === 'groq') {
        stream = streamOpenAICompat(
          'https://api.groq.com/openai/v1/chat/completions',
          cfg.key, cfg.model, history
        );
      } else {
        stream = streamOpenAICompat(
          'https://openrouter.ai/api/v1/chat/completions',
          cfg.key, cfg.model, history
        );
      }

      for await (const chunk of stream) {
        botText += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: botText, sender: 'bot', streaming: true };
          return updated;
        });
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { text: botText, sender: 'bot' };
        return updated;
      });
      speak(botText.slice(0, 200));

    } catch (err) {
      const errMsg = `*whimpers* Something went wrong: ${err.message}. The things I do... check your API key in Settings!`;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { text: errMsg, sender: 'bot' };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, speak]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleListen = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart  = () => setIsListening(true);
    rec.onend    = () => setIsListening(false);
    rec.onerror  = () => setIsListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };
    try { rec.start(); } catch { setIsListening(false); }
  }, [isListening]);

  return (
    <ErrorBoundary fallbackText="AI chat couldn't load. Please refresh.">
      <div className="trenchbot-container">
        <div className="trenchbot-header">
          <FaDog className="courage-icon" />
          <h3>Courage AI</h3>
          <button
            className="trenchbot-settings-btn"
            onClick={() => setShowSettings(s => !s)}
            title="AI Settings"
          >
            <FaCog />
          </button>
        </div>

        {showSettings && (
          <div className="trenchbot-settings-panel">
            <AISettings onClose={() => setShowSettings(false)} />
          </div>
        )}

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.sender}`}>
              {msg.sender === 'bot' && <FaDog className="message-icon" />}
              {msg.sender === 'user' && <div className="user-avatar">You</div>}
              <div className="message-content">
                {msg.text}
                {msg.streaming && <span className="typing-cursor">▋</span>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Courage is thinking...' : 'Ask Courage anything...'}
            rows={2}
            disabled={isStreaming}
          />
          <div className="chat-buttons">
            <button
              className={`mic-button ${isListening ? 'listening' : ''}`}
              onClick={handleListen}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <FaMicrophone />
            </button>
            <button
              className="send-button"
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !input.trim()}
              title="Send"
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Trenchbot;
