import React, { useState } from 'react';
import { saveApiKey, getApiKey, saveBackendUrl, getBackendUrl } from '../services/newsService';

const PROVIDERS = {
  ollama: {
    label: 'Ollama (Local)',
    placeholder: 'http://localhost:11434',
    isKey: false,
    models: ['llama3.2:3b', 'llama3.1:8b', 'mistral:7b', 'phi4-mini', 'gemma2:2b'],
    hint: 'Run Ollama locally. Free, private, no limits.',
    link: 'https://ollama.com',
  },
  groq: {
    label: 'Groq (Free Cloud)',
    placeholder: 'Paste your free Groq API key...',
    isKey: true,
    models: ['llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
    hint: 'Free API key from console.groq.com — super fast.',
    link: 'https://console.groq.com',
  },
  openrouter: {
    label: 'OpenRouter',
    placeholder: 'Paste your OpenRouter API key...',
    isKey: true,
    models: [
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openrouter/free',
      'qwen/qwen3-30b-a3b-instruct-2507',
    ],
    hint: 'Free models via openrouter.ai — choose :free models.',
    link: 'https://openrouter.ai/keys',
  },
};

const LS_PROVIDER = 'courage_ai_provider';
const LS_MODEL    = 'courage_ai_model';
const LS_URL      = 'courage_ollama_url';

export function getAIConfig() {
  const provider = localStorage.getItem(LS_PROVIDER) || 'groq';
  const model    = localStorage.getItem(LS_MODEL) || PROVIDERS[provider]?.models[0] || '';
  const key      = provider === 'ollama'
    ? (localStorage.getItem(LS_URL) || 'http://localhost:11434')
    : getApiKey(provider);
  return { provider, model, key };
}

const AISettings = ({ onClose }) => {
  const saved = getAIConfig();
  const [provider, setProvider] = useState(saved.provider);
  const [value, setValue] = useState(saved.key);
  const [model, setModel] = useState(saved.model);
  const [saved_, setSaved] = useState(false);
  const [backendUrl, setBackendUrl] = useState(getBackendUrl());

  const pInfo = PROVIDERS[provider];

  const handleProviderChange = (p) => {
    setProvider(p);
    const cfg = getAIConfig();
    if (p === 'ollama') {
      setValue(localStorage.getItem(LS_URL) || 'http://localhost:11434');
    } else {
      setValue(getApiKey(p) || '');
    }
    setModel(PROVIDERS[p].models[0]);
  };

  const handleSave = () => {
    localStorage.setItem(LS_PROVIDER, provider);
    localStorage.setItem(LS_MODEL, model);
    if (provider === 'ollama') {
      localStorage.setItem(LS_URL, value);
    } else {
      saveApiKey(provider, value);
    }
    saveBackendUrl(backendUrl);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose && onClose(); }, 800);
  };

  return (
    <div className="ai-settings">
      <h4 style={{ margin: '0 0 10px', color: '#eb57c1', fontFamily: 'Comic Sans MS' }}>
        Courage AI Settings
      </h4>

      {/* Provider */}
      <label style={labelStyle}>AI Provider</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {Object.entries(PROVIDERS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => handleProviderChange(key)}
            style={{
              ...provBtnStyle,
              background: provider === key ? '#eb57c1' : '#222',
              color: provider === key ? '#000' : '#eb57c1',
            }}
          >
            {p.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Hint + link */}
      <p style={{ margin: '0 0 8px', fontSize: '0.65rem', color: '#aaa' }}>
        {pInfo.hint}{' '}
        <a href={pInfo.link} target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>
          Get free access →
        </a>
      </p>

      {/* URL / Key */}
      <label style={labelStyle}>{pInfo.isKey ? 'API Key' : 'Ollama URL'}</label>
      <input
        type={pInfo.isKey ? 'password' : 'text'}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={pInfo.placeholder}
        style={inputStyle}
      />

      {/* Model */}
      <label style={labelStyle}>Model</label>
      <select value={model} onChange={e => setModel(e.target.value)} style={inputStyle}>
        {pInfo.models.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* ── Hosted backend ── */}
      <div style={{ borderTop: '1px solid #333', margin: '12px 0 10px', paddingTop: '10px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.65rem', color: '#888', fontFamily: 'Comic Sans MS' }}>
          HOSTED BACKEND
        </p>

        {/* Backend URL */}
        <label style={labelStyle}>
          Backend Server URL{' '}
          <span style={{ color: '#9945FF', fontSize: '0.6rem' }}>
            (crypto feed + agentic voice)
          </span>
        </label>
        <input
          type="text"
          value={backendUrl}
          onChange={e => setBackendUrl(e.target.value)}
          placeholder="http://localhost:8000"
          style={inputStyle}
        />
      </div>

      <button onClick={handleSave} style={saveBtnStyle}>
        {saved_ ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  fontSize: '0.65rem',
  color: '#888',
  marginBottom: '4px',
  fontFamily: 'Comic Sans MS',
};
const inputStyle = {
  width: '100%',
  background: '#111',
  color: '#fff',
  border: '1px solid #444',
  borderRadius: '5px',
  padding: '6px 8px',
  fontFamily: 'Comic Sans MS',
  fontSize: '0.72rem',
  boxSizing: 'border-box',
  marginBottom: '8px',
};
const provBtnStyle = {
  flex: 1,
  padding: '5px 4px',
  border: '1px solid #eb57c1',
  borderRadius: '5px',
  cursor: 'pointer',
  fontFamily: 'Comic Sans MS',
  fontSize: '0.62rem',
};
const saveBtnStyle = {
  width: '100%',
  padding: '8px',
  background: 'linear-gradient(135deg, #9945FF, #eb57c1)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'Comic Sans MS',
  fontSize: '0.75rem',
  marginTop: '4px',
};

export default AISettings;
