import React, { useState, useEffect, useCallback, useRef, startTransition } from "react";
import "./App.css";
import { FaTv, FaNewspaper } from "react-icons/fa";
import HomePage from "./components/HomePage";
import NewsTV from "./components/NewsTV";
import CourageRunning from "./scenes/CourageRunning";
import CourageScared from "./scenes/CourageScared";
import CourageHappy from "./scenes/CourageHappy";
import CourageTalking from "./scenes/CourageTalking";
import SceneEffects from "./components/SceneEffects";
import HeroHints from "./components/HeroHints";
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import WelcomeTour from './components/WelcomeTour';
import { fetchTopNews } from './services/newsService';
import { analyzeSentiment } from './utils/sentimentUtils';
import { createVoiceService } from './services/voiceService';

const EveningWorld3D = React.lazy(() => import('./components/3d/EveningWorld3D'));

export default function App() {
  const [scene, setScene] = useState('');
  const [helperVisible, setHelperVisible] = useState(false);

  // ── News ───────────────────────────────────────────────────────────────────
  const [newsOpen, setNewsOpen] = useState(false);
  const [articles, setArticles] = useState([]);
  const [articleIndex, setArticleIndex] = useState(0);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsEmotion, setNewsEmotion] = useState('neutral');
  const [newsCountry, setNewsCountry] = useState(
    () => localStorage.getItem('courage_country') || 'us'
  );
  const [newsCategory, setNewsCategory] = useState(
    () => localStorage.getItem('courage_category') || 'general'
  );

  // ── Explosion ──────────────────────────────────────────────────────────────
  const [explosionPhase, setExplosionPhase] = useState(null);
  const [explosionReady, setExplosionReady] = useState(false);
  const scaredTimerRef = useRef(null);

  // ── Hero text visibility ──────────────────────────────────────────────────
  const isFirstVisit = !localStorage.getItem('courage_toured');
  const [tourDismissed, setTourDismissed] = useState(!isFirstVisit);
  const [heroTextVisible, setHeroTextVisible] = useState(true);
  const [showSceneTip, setShowSceneTip] = useState(false);
  const [aliveTextVisible, setAliveTextVisible] = useState(false);
  const heroHideTimerRef = useRef(null);
  const heroIntervalRef = useRef(null);
  const aliveShownRef = useRef(false);

  useEffect(() => {
    if (!tourDismissed) return;

    heroHideTimerRef.current = setTimeout(() => {
      setHeroTextVisible(false);
      setShowSceneTip(true);
      setTimeout(() => setShowSceneTip(false), 4500);

      if (!aliveShownRef.current) {
        aliveShownRef.current = true;
        setTimeout(() => {
          setAliveTextVisible(true);
          setTimeout(() => setAliveTextVisible(false), 5000);
        }, 500);
      }

      heroIntervalRef.current = setInterval(() => {
        setHeroTextVisible(true);
        setTimeout(() => setHeroTextVisible(false), 5000);
      }, 60000);
    }, 60000);

    return () => {
      clearTimeout(heroHideTimerRef.current);
      clearInterval(heroIntervalRef.current);
    };
  }, [tourDismissed]);

  // ── Voice chat state ──────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState(null);
  const voiceSvcRef = useRef(null);
  const [midnightMsg, setMidnightMsg] = useState(false);
  const midnightTimerRef = useRef(null);
  const [world3DMounted, setWorld3DMounted] = useState(false);
  const [world3DVisible, setWorld3DVisible] = useState(false);

  const handleVoiceClick = useCallback(async () => {
    if (voiceState === null) {
      setVoiceState('idle');
      return;
    }
    if (voiceState === 'idle') {
      if (!voiceSvcRef.current) {
        voiceSvcRef.current = createVoiceService({
          onState: (s) => setVoiceState(s),
          onTranscript: (t) => console.log('[Voice] transcript:', t),
          onReply: (r) => console.log('[Voice] reply:', r),
          onAudio: () => { },
          onError: (e) => { console.warn('[Voice]', e); setVoiceState('idle'); },
        });
      }
      try { await voiceSvcRef.current.start(); }
      catch (e) { setVoiceState('idle'); }
      return;
    }
    if (voiceState === 'listening') { await voiceSvcRef.current?.stop(); return; }
    if (voiceState === 'speaking') { setVoiceState('idle'); }
  }, [voiceState]);

  const handleVoiceClose = useCallback(() => {
    voiceSvcRef.current?.destroy();
    voiceSvcRef.current = null;
    setVoiceState(null);
  }, []);

  const [repulseSignal, setRepulseSignal] = useState(0);
  const [courageX, setCourageX] = useState(10);
  const [courageTrans, setCourageTrans] = useState('left 0s');

  const handleCourageMove = useCallback((x, trans = 'left 2s ease-in-out') => {
    setCourageX(x);
    setCourageTrans(trans);
  }, []);

  const SCENE_CYCLE = ['sunrise', 'noon', 'evening', 'midnight', null];
  const SCENE_LABELS = { sunrise: '☀️', noon: '🌤', evening: '🌆', midnight: '🌙', null: '🕐' };
  const [sceneOverride, setSceneOverride] = useState(null);

  const handleVoiceEntry = useCallback(() => {
    const activeScene = sceneOverride || scene;
    if (activeScene === 'midnight') {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
      setMidnightMsg(true);
      midnightTimerRef.current = setTimeout(() => {
        midnightTimerRef.current = null;
        startTransition(() => {
          setMidnightMsg(false);
          setSceneOverride('sunrise');
        });
      }, 2200);
      return;
    }
    setVoiceState('idle');
  }, [sceneOverride, scene]);

  const cycleScene = useCallback(() => {
    setSceneOverride(prev => {
      const idx = SCENE_CYCLE.indexOf(prev);
      return SCENE_CYCLE[(idx + 1) % SCENE_CYCLE.length];
    });
  }, []);

  const updateScene = useCallback(() => {
    const h = new Date().getHours();
    const h1 = document.querySelector('h1.couragesign');
    let s = '';
    if (h >= 12 && h < 18) { s = 'noon'; document.body.className = 'noon'; }
    else if (h >= 18 && h < 24) { s = 'evening'; document.body.className = 'evening'; }
    else if (h >= 0 && h < 6) { s = 'midnight'; document.body.className = 'midnight'; }
    else { s = 'sunrise'; document.body.className = 'sunrise'; }
    setScene(s);
    if (h1) h1.classList.toggle('typo', !(h >= 6 && h < 18));
  }, []);

  useEffect(() => {
    updateScene();
    const id = setInterval(updateScene, 3600000);
    return () => clearInterval(id);
  }, [updateScene]);

  const [scrolled, setScrolled] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  useEffect(() => {
    const handleScroll = () => { setScrolled(window.scrollY > 50); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (sceneOverride) { document.body.className = sceneOverride; }
    else { updateScene(); }
    const active = sceneOverride || scene;
    if (active !== 'midnight') { setCourageX(10); setCourageTrans('left 0s'); }
  }, [sceneOverride, updateScene, scene]);

  useEffect(() => {
    const isCurrentlyScared = newsEmotion === 'scared' && newsOpen;
    clearTimeout(scaredTimerRef.current);
    if (!isCurrentlyScared) { setExplosionReady(false); return; }
    scaredTimerRef.current = setTimeout(() => setExplosionReady(true), 4000);
    return () => clearTimeout(scaredTimerRef.current);
  }, [newsEmotion, newsOpen]);

  const triggerExplosion = useCallback(() => {
    if (explosionPhase) return;
    setExplosionReady(false);
    setNewsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setExplosionPhase('exploding');
    setTimeout(() => setExplosionPhase('heaping'), 950);
    setTimeout(() => setExplosionPhase('reassembling'), 1600);
    setTimeout(() => setExplosionPhase('assembled'), 3400);
    setTimeout(() => setExplosionPhase(null), 4200);
  }, [explosionPhase]);

  const handleRepulse = useCallback(() => { setRepulseSignal(s => s + 1); }, []);

  const renderCourageScene = useCallback(() => {
    const activeScene = sceneOverride || scene;
    const isNight = activeScene === 'evening' || activeScene === 'midnight';
    const isNoon = activeScene === 'noon';
    const isTalking = voiceState !== null;

    if (explosionPhase) { return <CourageScared explosionPhase={explosionPhase} onFrightened={handleRepulse} />; }
    if (newsOpen && newsEmotion === 'scared') { return <CourageScared explosionPhase={null} onFrightened={handleRepulse} voiceState={isTalking ? voiceState : null} />; }
    if (newsOpen && newsEmotion === 'happy') { return <CourageHappy explosionPhase={null} onFrightened={() => { }} voiceState={isTalking ? voiceState : null} />; }

    const chaseStyle = { left: `${courageX}%`, transition: courageTrans };
    if (!newsOpen && isNight) return <CourageScared explosionPhase={null} onFrightened={handleRepulse} style={chaseStyle} voiceState={isTalking ? voiceState : null} />;
    if (!newsOpen && isNoon) return <CourageHappy explosionPhase={null} onFrightened={() => { }} voiceState={isTalking ? voiceState : null} />;
    return <CourageRunning voiceState={isTalking ? voiceState : null} />;
  }, [scene, sceneOverride, newsEmotion, newsOpen, explosionPhase, handleRepulse, courageX, courageTrans, voiceState]);

  const loadNews = useCallback(async (country = newsCountry, category = newsCategory) => {
    setNewsLoading(true);
    try {
      const data = await fetchTopNews({ country, category, max: 10 });
      setArticles(data);
      setArticleIndex(0);
      if (data.length > 0) setNewsEmotion(analyzeSentiment(data[0].title));
    } catch (e) { }
    finally { setNewsLoading(false); }
  }, [newsCountry, newsCategory]);

  const handleOpenNews = useCallback(() => {
    setNewsOpen(true);
    if (articles.length === 0) loadNews(newsCountry, newsCategory);
  }, [articles.length, loadNews, newsCountry, newsCategory]);

  const handleCloseNews = useCallback(() => {
    setNewsOpen(false);
    setTimeout(() => setNewsEmotion('neutral'), 2000);
  }, []);

  const goToArticle = useCallback((idx) => {
    setArticleIndex(idx);
    if (articles[idx]) setNewsEmotion(analyzeSentiment(articles[idx].title));
  }, [articles]);

  const handleFetchNews = useCallback((country, category) => {
    const c = country || newsCountry;
    const cat = category || newsCategory;
    setNewsCountry(c);
    setNewsCategory(cat);
    loadNews(c, cat);
  }, [newsCountry, newsCategory, loadNews]);

  const animation = useCallback(() => {
    const h1 = document.querySelector('.intro-text h1');
    if (!h1) return;
    h1.querySelectorAll('span').forEach(span => {
      const letters = span.textContent.split('');
      span.innerHTML = '';
      letters.forEach(ch => {
        const ls = document.createElement('span');
        ls.textContent = ch;
        Object.assign(ls.style, { opacity: 0, position: 'relative', bottom: '-80px' });
        span.appendChild(ls);
      });
    });
    h1.querySelectorAll('span span').forEach((l, i) => {
      setTimeout(() => {
        l.style.opacity = 1; l.style.bottom = '0';
        l.style.transition = `all 0.5s cubic-bezier(0.175,0.885,0.32,1.275) ${i * 0.05}s`;
      }, i * 50);
    });
  }, []);

  const CryptoTv = useCallback(() => {
    const cnv = document.getElementById('static');
    const c = cnv?.getContext('2d');
    if (!cnv || !c) return;
    const cw = cnv.offsetWidth || 500, ch = cnv.offsetHeight || 300;
    const staticScrn = c.createImageData(cw, ch);
    let isStatic = false, staticTO;

    const ARCHIVE = 'https://archive.org/embed/courage-the-cowardly-dog-1080p-ai-upscale';
    const ep = (name) => `${ARCHIVE}/${encodeURIComponent(name)}?autoplay=1`;
    const gifData = [
      { file: 'https://imgur.com/G9JSL7t.mp4', type: 'video', desc: 'Meet Courage' },
      { file: 'https://assets.codepen.io/416221/willie.gif', type: 'image', desc: 'Steamboat Willie' },
      { file: 'https://imgur.com/AogvbkL.mp4', type: 'video', desc: 'Raining' },
      { file: 'https://assets.codepen.io/416221/skeletons.gif', type: 'image', desc: 'Spooky skeletons' },
      { file: 'https://imgur.com/lpZ7sD7.mp4', type: 'video', desc: 'Imperfect Courage' },
      { file: 'https://assets.codepen.io/416221/kingkong.gif', type: 'image', desc: 'King Kong' },
      { file: 'https://imgur.com/FQFIVTo.gif', type: 'image', desc: 'Cake day!' },
      { file: 'https://imgur.com/szKw3OX.mp4', type: 'video', desc: 'Courage Cleaning' },
      { file: 'https://assets.codepen.io/416221/tracks.gif', type: 'image', desc: 'Train tracks' },
      { file: 'https://imgur.com/SiUhyoq.mp4', type: 'video', desc: 'Frog Gang' },
      { file: 'https://assets.codepen.io/416221/nuke.gif', type: 'image', desc: 'Nuclear explosion' },
      { file: 'https://imgur.com/kyvQVzu.png', type: 'image', desc: 'Courage The Memish Dog' },
      { file: 'https://imgur.com/XhCBo5v.mp4', type: 'video', desc: 'Pie Eustas' },
      { file: 'https://imgur.com/M6UJsWs.jpeg', type: 'image', desc: 'Courage The Memish Dog' },
      { file: 'https://imgur.com/pfadmDi.gif', type: 'image', desc: 'CTO Courage' },
      { file: ep('Courage the Cowardly Dog S01E01 A Night at the Katz Motel.mkv'), type: 'archive', desc: '📺 S1E01 – Katz Motel' },
      { file: ep('Courage the Cowardly Dog S01E02 Cajun Granny Stew.mkv'), type: 'archive', desc: '📺 S1E02 – Cajun Granny Stew' },
      { file: ep('Courage the Cowardly Dog S01E05 King Ramses\' Curse.mkv'), type: 'archive', desc: '📺 S1E05 – King Ramses\' Curse' },
      { file: ep('Courage the Cowardly Dog S01E08 Freaky Fred.mkv'), type: 'archive', desc: '📺 S1E08 – Freaky Fred' },
      { file: ep('Courage the Cowardly Dog S01E13 The Great Fusilli.mkv'), type: 'archive', desc: '📺 S1E13 – The Great Fusilli' },
      { file: ep('Courage the Cowardly Dog S02E01 The House of Discontent.mkv'), type: 'archive', desc: '📺 S2E01 – House of Discontent' },
      { file: ep('Courage the Cowardly Dog S03E01 The Demon in the Mattress.mkv'), type: 'archive', desc: '📺 S3E01 – Demon in the Mattress' },
      { file: ep('Courage the Cowardly Dog S04E01 Remembrance of Fred.mkv'), type: 'archive', desc: '📺 S4E01 – Remembrance of Fred' },
      { file: `${ARCHIVE}?autoplay=1`, type: 'archive', desc: '📺 Browse All Episodes' },
    ];
    let channel = 0;

    const runStatic = () => {
      isStatic = true;
      c.clearRect(0, 0, cw, ch);
      for (let i = 0; i < staticScrn.data.length; i += 4) {
        const shade = 127 + Math.round(Math.random() * 128);
        staticScrn.data[i] = staticScrn.data[i + 1] = staticScrn.data[i + 2] = shade;
        staticScrn.data[i + 3] = 255;
      }
      c.putImageData(staticScrn, 0, 0);
      staticTO = setTimeout(runStatic, 40);
    };
    runStatic();

    const changeChannel = () => {
      const img = document.getElementById('displayed');
      const vid = document.getElementById('displayedVideo');
      const fra = document.getElementById('displayedArchive');
      const txt = document.getElementById('introText');
      const overlay = document.getElementById('archivePlayOverlay');
      if (!img || !vid || !txt) return;
      vid.pause(); vid.src = '';
      if (fra) { fra.src = 'about:blank'; fra.classList.add('hide'); }
      if (overlay) overlay.classList.add('hide');
      channel = channel >= gifData.length ? 1 : channel + 1;
      const item = gifData[channel - 1];
      cnv.classList.remove('hide');
      img.classList.add('hide'); vid.classList.add('hide'); txt.classList.add('hide');
      if (!isStatic) runStatic();
      const lbl = document.getElementById('channelLabel');
      if (lbl) { lbl.textContent = item.desc; lbl.classList.add('show'); setTimeout(() => lbl.classList.remove('show'), 2500); }
      setTimeout(() => {
        cnv.classList.add('hide');
        if (item.type === 'image') { img.src = item.file; img.alt = item.desc; img.classList.remove('hide'); }
        else if (item.type === 'archive') {
          if (overlay) {
            overlay.dataset.src = item.file; overlay.dataset.desc = item.desc;
            const label = overlay.querySelector('.archive-play-label');
            if (label) label.textContent = item.desc.replace('📺 ', '');
            overlay.classList.remove('hide');
          }
        } else {
          vid.src = item.file; vid.alt = item.desc;
          vid.classList.remove('hide'); vid.controls = false; vid.play();
          vid.onended = () => { txt.classList.remove('hide'); animation(); };
        }
        isStatic = false; clearTimeout(staticTO);
      }, 400);
    };
    const btn = document.getElementById('channel');
    if (btn) btn.addEventListener('click', changeChannel);

    const overlay = document.getElementById('archivePlayOverlay');
    if (overlay && !overlay._playListenerSet) {
      overlay._playListenerSet = true;
      overlay.addEventListener('click', () => {
        const fra = document.getElementById('displayedArchive');
        const url = overlay.dataset.src;
        if (fra && url) { fra.src = url; fra.classList.remove('hide'); }
        overlay.classList.add('hide');
      });
    }
  }, [animation]);

  const [tourOpen, setTourOpen] = useState(false);
  const toggleHelperSection = useCallback(() => { setHelperVisible(p => !p); }, []);

  const handleBackgroundClick = useCallback((e) => {
    if (e.target.id === 'app-background' && !explosionPhase) {
      const el = document.getElementById('courageCharacter');
      if (el) { el.classList.add('frightened'); setTimeout(() => el.classList.remove('frightened'), 500); }
    }
  }, [explosionPhase]);

  const _active = sceneOverride || scene;
  const _isNight = _active === 'evening' || _active === 'midnight';
  const _isNoon = _active === 'noon';
  const _scared = (newsOpen && newsEmotion === 'scared') || (!newsOpen && _isNight);
  const _happy = (newsOpen && newsEmotion === 'happy') || (!newsOpen && _isNoon);
  const explodeDisabled = !!explosionPhase || (!_scared && !_happy);

  return (
    <div className="app-container" id="app-background" onClick={handleBackgroundClick}>
      <SceneEffects scene={_active} repulseSignal={repulseSignal} onCourageMove={handleCourageMove} />
      <HeroHints scene={_active} scrolled={scrolled} />

      <div className="news-ticker-bar">
        <div className="news-ticker-track">
          RUN COURAGE RUN &nbsp;|&nbsp; $RCR — LIVING IN YOUR BROWSER, SER &nbsp;|&nbsp;
          NOT FINANCIAL ADVICE &nbsp;|&nbsp; WATERED DOWN NEWS FOR THE DEGENS &nbsp;|&nbsp;
          THE THINGS I DO FOR YOU PEOPLE &nbsp;|&nbsp; WAGMI &nbsp;|&nbsp;
        </div>
      </div>

      <nav className="bone-nav">
        <div className="circle left top" /><div className="circle left bottom" />
        <div className="halloctober__banner p-flex">
          <h1 className="couragesign shiny-glass">Run Courage Run</h1>
          <div className="fog p-circle" />
        </div>
        <button className={`scene-toggle-btn${showSceneTip ? ' scene-tip-flash' : ''}`} onClick={cycleScene}>
          {SCENE_LABELS[String(sceneOverride)] ?? '🕐'}
        </button>
        <div className="circle right top" /><div className="circle right bottom" />
      </nav>

      <section className={`hero-section${scrolled ? ' hero-section--hidden' : ''}`}>
        <div className="hero-center">
          <div className="hero-badge">
            <span className="hero-badge-dot" /> Live on Solana
          </div>
          <div className={`hero-text-block${heroTextVisible ? '' : ' hero-text-block--hidden'}`}>
            <p className="hero-tagline">Self-Aware Living Meme on Solana</p>
            <p className="hero-quote">"He knows his a meme. He breaks the 4th wall. He's a runner!"</p>
          </div>
          {aliveTextVisible && <div className="hero-alive-text">Animated Self Aware Meme &mdash; He&rsquo;s alive, Interact</div>}
        </div>

        <div className="character-stage">
          {renderCourageScene()}
          {newsOpen && voiceState === null && (
            <div className={`emotion-chip emotion-chip--${newsEmotion}`}>
              {newsEmotion === 'happy' && '🚀 WAGMI'}
              {newsEmotion === 'scared' && '😱 NGMI'}
              {newsEmotion === 'neutral' && "🐕 chillin'"}
            </div>
          )}
        </div>

        {voiceState === null && <button className="voice-entry-btn" onClick={handleVoiceEntry}>🎙️</button>}

        <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
          {_active === 'evening' && voiceState === null && !world3DVisible && (
            <button
              className={`brutal-btn brutal-btn--pink${world3DMounted ? ' enter-3d-btn--loading' : ''}`}
              onClick={() => { if (!world3DMounted) setWorld3DMounted(true); }}
            >
              {world3DMounted ? '⏳ Loading…' : '🌆 Enter 3D World'}
            </button>
          )}
        </div>

        {midnightMsg && <div className="midnight-refuse-bubble">I&apos;m TOO SCARED!! Get me OUT of here!!</div>}

        {voiceState !== null && (
          <div className={`mic-drop-wrap mic-drop-wrap--${voiceState}`} onClick={handleVoiceClick}>
            <div className="mic-drop-icon">
              {voiceState === 'idle' && '🎙️'} {voiceState === 'listening' && '🔴'}
              {voiceState === 'thinking' && '⏳'} {voiceState === 'speaking' && '🔊'}
            </div>
            <div className="mic-drop-label">
              {voiceState === 'idle' && 'Tap to speak'} {voiceState === 'listening' && 'Listening…'}
              {voiceState === 'thinking' && 'Thinking…'} {voiceState === 'speaking' && 'Tap to stop'}
            </div>
            <div className="mic-drop-cord" />
            <button className="voice-exit-btn" onClick={(e) => { e.stopPropagation(); handleVoiceClose(); }}>✕</button>
          </div>
        )}

        {explosionReady && !explosionPhase && <button className="explosion-trigger-btn" onClick={triggerExplosion}>💥 HE'S GONNA BLOW</button>}
      </section>

      {helperVisible && (
        <div className="tv-overlay" onClick={toggleHelperSection}>
          <div className="tv-overlay-inner" onClick={e => e.stopPropagation()}>
            <button className="tv-overlay-close" onClick={toggleHelperSection}>✕</button>
            <ErrorBoundary fallbackText="TV crashed. Please refresh.">
              <HomePage CryptoTv={CryptoTv} onNewsClick={() => { toggleHelperSection(); handleOpenNews(); }} />
            </ErrorBoundary>
          </div>
        </div>
      )}

      <div className="landing-wrapper">
        <section className="landing-section about-section container">
          <div className="landing-card brutal-panel">
            <div className="comic-banner"><h2 className="landing-heading">🐕 Who is $RCR?</h2></div>
            <p>Tribute to Courage the Cowardly Dog — Cartoon Network 1999–2002. He faced every monster for Muriel. We re-animated him to life.</p>
          </div>
          <div className="landing-card brutal-panel">
            <div className="comic-banner comic-banner--yellow"><h2 className="landing-heading">📺 What does he do?</h2></div>
            <p>Treat this as his mini browser world. Tap him to trigger reactions. Courage fetches real news every hour.</p>
          </div>
        </section>

        <section className="landing-section container brutal-panel">
          <div className="comic-banner"><h2 className="landing-heading">📊 Tokenomics</h2></div>
          <div className="token-grid">
            <div className="token-card"><span className="token-icon">💊</span><span className="token-label">Total Supply</span><span className="token-value">1,000,000,000</span></div>
            <div className="token-card"><span className="token-icon">🔥</span><span className="token-label">Liquidity</span><span className="token-value">Locked</span></div>
            <div className="token-card"><span className="token-icon">📈</span><span className="token-label">Tax</span><span className="token-value">0%</span></div>
          </div>
        </section>

        <section className="landing-section container brutal-panel" style={{ textAlign: 'center' }}>
          <div className="comic-banner comic-banner--pink"><h2 className="landing-heading">🐾 Get $RCR</h2></div>
          <div className="buy-cta-row">
            <a href="#" className="brutal-btn brutal-btn--dark">🔭 DexScreener</a>
            <a href="#" className="brutal-btn brutal-btn--pink">🐾 Buy $RCR</a>
          </div>
        </section>

        <section className="landing-section container brutal-panel">
          <div className="comic-banner comic-banner--pink"><h2 className="landing-heading">🌐 Join the Pack</h2></div>
          <div className="community-links" style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
            <a href="https://x.com/runcouragerun" target="_blank" rel="noopener noreferrer" className="brutal-btn brutal-btn--blue">𝕏 Twitter</a>
            <a href="#" className="brutal-btn brutal-btn--pink">✈️ Telegram</a>
          </div>
        </section>
      </div>

      {newsOpen && (
        <NewsTV
          articles={articles} articleIndex={articleIndex}
          onPrev={() => goToArticle(Math.max(0, articleIndex - 1))}
          onNext={() => goToArticle(Math.min(articles.length - 1, articleIndex + 1))}
          onClose={handleCloseNews} onFetch={handleFetchNews}
          newsEmotion={newsEmotion} loading={newsLoading}
          country={newsCountry} setCountry={setNewsCountry}
          category={newsCategory} setCategory={setNewsCategory}
        />
      )}

      <div className={`sticky-actions${scrolled ? ' sticky-actions--hidden' : ''}${controlsExpanded ? ' sticky-actions--expanded' : ''}`}>
        <button className="hero-btn mobile-only-toggle" onClick={() => setControlsExpanded(!controlsExpanded)}>
          {controlsExpanded ? '✕' : '☰'}
        </button>
        <div className="sticky-actions-inner">
          <button className="hero-btn" onClick={toggleHelperSection}><FaTv /> {helperVisible ? 'Hide TV' : 'Watch TV'}</button>
          <button className="hero-btn hero-btn--news" onClick={handleOpenNews}><FaNewspaper /> Read News</button>
          <button className="hero-btn hero-btn--explode" onClick={triggerExplosion} disabled={explodeDisabled}>💥 Explode!</button>
          <button className="sticky-info-btn" onClick={() => setTourOpen(true)}>i</button>
        </div>
      </div>

      <Footer />
      {world3DMounted && (
        <React.Suspense fallback={null}>
          <EveningWorld3D
            visible={world3DVisible}
            onReady={() => setWorld3DVisible(true)}
            onClose={() => { setWorld3DMounted(false); setWorld3DVisible(false); }}
          />
        </React.Suspense>
      )}
      <WelcomeTour forceOpen={tourOpen} onClose={() => { setTourOpen(false); setTourDismissed(true); }} />
    </div>
  );
}
