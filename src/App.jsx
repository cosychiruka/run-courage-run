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
  // • First visit: wait for WelcomeTour dismissal, then hide after 60s
  // • Returning visit: start 60s timer immediately
  // • After first hide: flash text back for 5s every 60s
  // • Thought bubble fires once, right after the first hide
  // • "Alive" message fires once, 500ms after first hide, for 5s
  const isFirstVisit = !localStorage.getItem('courage_toured');
  const [tourDismissed, setTourDismissed] = useState(!isFirstVisit);
  const [heroTextVisible, setHeroTextVisible] = useState(true);
  const [showSceneTip, setShowSceneTip] = useState(false);
  const [aliveTextVisible, setAliveTextVisible] = useState(false);
  const heroHideTimerRef = useRef(null);
  const heroIntervalRef = useRef(null);
  const aliveShownRef = useRef(false);

  useEffect(() => {
    if (!tourDismissed) return; // first-timers: wait until tour is dismissed

    heroHideTimerRef.current = setTimeout(() => {
      setHeroTextVisible(false);

      // Thought bubble appears once on first hide
      setShowSceneTip(true);
      setTimeout(() => setShowSceneTip(false), 4500);

      // "He's alive" message appears once, 500ms after hero text fades
      if (!aliveShownRef.current) {
        aliveShownRef.current = true;
        setTimeout(() => {
          setAliveTextVisible(true);
          setTimeout(() => setAliveTextVisible(false), 5000);
        }, 500);
      }

      // Recurring: flash text back for 5s every 60s
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
  // 'idle' | 'listening' | 'thinking' | 'speaking' | null (normal scene)
  const [voiceState, setVoiceState] = useState(null);
  const voiceSvcRef = useRef(null);

  // Midnight refusal speech bubble (shown briefly, then auto-switches scene)
  const [midnightMsg, setMidnightMsg] = useState(false);
  const midnightTimerRef = useRef(null);
  // world3DMounted = scene is rendering in background; world3DVisible = user can see it
  const [world3DMounted, setWorld3DMounted] = useState(false);
  const [world3DVisible, setWorld3DVisible] = useState(false);

  const handleVoiceClick = useCallback(async () => {
    // Enter voice mode if not already in it
    if (voiceState === null) {
      setVoiceState('idle');
      return;
    }

    if (voiceState === 'idle') {
      // Start recording
      if (!voiceSvcRef.current) {
        voiceSvcRef.current = createVoiceService({
          onState: (s) => setVoiceState(s),
          onTranscript: (t) => console.log('[Voice] transcript:', t),
          onReply: (r) => console.log('[Voice] reply:', r),
          onAudio: () => { },
          onError: (e) => { console.warn('[Voice]', e); setVoiceState('idle'); },
        });
      }
      try {
        await voiceSvcRef.current.start();
      } catch (e) {
        console.warn('[Voice] mic error:', e);
        setVoiceState('idle');
      }
      return;
    }

    if (voiceState === 'listening') {
      // Stop recording → send to backend
      await voiceSvcRef.current?.stop();
      return;
    }

    if (voiceState === 'speaking') {
      // User wants to interrupt — reset to idle
      setVoiceState('idle');
    }
  }, [voiceState]);

  const handleVoiceClose = useCallback(() => {
    voiceSvcRef.current?.destroy();
    voiceSvcRef.current = null;
    setVoiceState(null);
  }, []);

  // ── Ghost repulse signal (incremented on Courage click at midnight) ────────
  const [repulseSignal, setRepulseSignal] = useState(0);

  // ── Courage position — animated by ghost chase (midnight only) ───────────
  const [courageX, setCourageX] = useState(10);   // % viewport
  const [courageTrans, setCourageTrans] = useState('left 0s');

  const handleCourageMove = useCallback((x, trans = 'left 2s ease-in-out') => {
    setCourageX(x);
    setCourageTrans(trans);
  }, []);

  // ── Scene override (user-controlled cycle) ────────────────────────────────
  const SCENE_CYCLE = ['sunrise', 'noon', 'evening', 'midnight', null];
  const SCENE_LABELS = { sunrise: '☀️', noon: '🌤', evening: '🌆', midnight: '🌙', null: '🕐' };
  const [sceneOverride, setSceneOverride] = useState(null);

  // Entry point for mic button — blocks midnight with a speech bubble then auto-switches scene
  // Declared after sceneOverride to avoid TDZ in the dependency array
  const handleVoiceEntry = useCallback(() => {
    const activeScene = sceneOverride || scene;
    if (activeScene === 'midnight') {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
      setMidnightMsg(true);
      midnightTimerRef.current = setTimeout(() => {
        midnightTimerRef.current = null;
        // startTransition batches both updates together, reducing DOM reconciliation conflicts
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

  // ── Scene / time ───────────────────────────────────────────────────────────
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

  // ── Scroll visibility for Hero ───────────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Apply body class for scene override (so background reflects the cycled scene)
  useEffect(() => {
    if (sceneOverride) {
      document.body.className = sceneOverride;
    } else {
      // Revert to time-based
      updateScene();
    }
    // Reset Courage position when leaving midnight scene
    const active = sceneOverride || scene;
    if (active !== 'midnight') {
      setCourageX(10);
      setCourageTrans('left 0s');
    }
  }, [sceneOverride, updateScene, scene]);

  // ── Scared timer → explosion ready ────────────────────────────────────────
  useEffect(() => {
    const isCurrentlyScared = newsEmotion === 'scared' && newsOpen;
    clearTimeout(scaredTimerRef.current);
    if (!isCurrentlyScared) { setExplosionReady(false); return; }
    scaredTimerRef.current = setTimeout(() => setExplosionReady(true), 4000);
    return () => clearTimeout(scaredTimerRef.current);
  }, [newsEmotion, newsOpen]);

  // ── Explosion sequence ─────────────────────────────────────────────────────
  const triggerExplosion = useCallback(() => {
    if (explosionPhase) return;
    setExplosionReady(false);
    setNewsOpen(false);
    // Scroll to hero so the character is visible during animation
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setExplosionPhase('exploding');
    setTimeout(() => setExplosionPhase('heaping'), 950);
    setTimeout(() => setExplosionPhase('reassembling'), 1600);
    setTimeout(() => setExplosionPhase('assembled'), 3400);
    setTimeout(() => setExplosionPhase(null), 4200);
  }, [explosionPhase]);

  // ── Courage scene ──────────────────────────────────────────────────────────
  //    Day  (sunrise / noon)    → CourageRunning (happy animated dog)
  //    Night (evening/midnight) → CourageScared  (pieces dog, can explode)
  //    News override still applies on top
  const handleRepulse = useCallback(() => {
    setRepulseSignal(s => s + 1);
  }, []);

  const renderCourageScene = useCallback(() => {
    const activeScene = sceneOverride || scene;
    const isNight = activeScene === 'evening' || activeScene === 'midnight';
    const isNoon = activeScene === 'noon';
    const isTalking = voiceState !== null;

    // Always render the pieces character during an explosion (voice can't trigger this)
    if (explosionPhase) {
      return <CourageScared explosionPhase={explosionPhase} onFrightened={handleRepulse} />;
    }

    // News emotion overrides time-based scene; voice state is passed through
    if (newsOpen && newsEmotion === 'scared') {
      return <CourageScared explosionPhase={null} onFrightened={handleRepulse} voiceState={isTalking ? voiceState : null} />;
    }
    if (newsOpen && newsEmotion === 'happy') {
      return <CourageHappy explosionPhase={null} onFrightened={() => { }} voiceState={isTalking ? voiceState : null} />;
    }

    // Time-based scenes — each character receives voiceState so it can brake/talk in place
    const chaseStyle = { left: `${courageX}%`, transition: courageTrans };
    if (!newsOpen && isNight) return <CourageScared explosionPhase={null} onFrightened={handleRepulse} style={chaseStyle} voiceState={isTalking ? voiceState : null} />;
    if (!newsOpen && isNoon) return <CourageHappy explosionPhase={null} onFrightened={() => { }} voiceState={isTalking ? voiceState : null} />;
    return <CourageRunning voiceState={isTalking ? voiceState : null} />;
  }, [scene, sceneOverride, newsEmotion, newsOpen, explosionPhase, handleRepulse, courageX, courageTrans, voiceState]);

  // ── News logic ─────────────────────────────────────────────────────────────
  const loadNews = useCallback(async (country = newsCountry, category = newsCategory) => {
    setNewsLoading(true);
    try {
      const data = await fetchTopNews({ country, category, max: 10 });
      setArticles(data);
      setArticleIndex(0);
      if (data.length > 0) setNewsEmotion(analyzeSentiment(data[0].title));
    } catch (e) {
      console.warn('[App] news load failed:', e.message);
    } finally {
      setNewsLoading(false);
    }
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

  // ── TV animation ──────────────────────────────────────────────────────────
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

  // ── Meme TV (canvas static + channel cycling) ─────────────────────────────
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
      // ── Courage the Cowardly Dog — 1080p AI Upscale (archive.org) ──
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
      // Show channel label briefly
      const lbl = document.getElementById('channelLabel');
      if (lbl) { lbl.textContent = item.desc; lbl.classList.add('show'); setTimeout(() => lbl.classList.remove('show'), 2500); }
      setTimeout(() => {
        cnv.classList.add('hide');
        if (item.type === 'image') {
          img.src = item.file; img.alt = item.desc; img.classList.remove('hide');
        } else if (item.type === 'archive') {
          // Show play overlay — user must click to trigger iframe load (browser autoplay policy)
          if (overlay) {
            overlay.dataset.src = item.file;
            overlay.dataset.desc = item.desc;
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

    // Archive play overlay — loads iframe on user click (satisfies browser autoplay policy)
    const overlay = document.getElementById('archivePlayOverlay');
    if (overlay && !overlay._playListenerSet) {
      overlay._playListenerSet = true;
      overlay.addEventListener('click', () => {
        const fra = document.getElementById('displayedArchive');
        const url = overlay.dataset.src;
        if (fra && url) {
          fra.src = url;
          fra.classList.remove('hide');
        }
        overlay.classList.add('hide');
      });
    }
  }, [animation]);

  // ── Tour modal (info button) ───────────────────────────────────────────────
  const [tourOpen, setTourOpen] = useState(false);

  // ── TV toggle ──────────────────────────────────────────────────────────────
  const toggleHelperSection = useCallback(() => {
    setHelperVisible(p => !p);
  }, []);

  // ── Background click → Courage fright ────────────────────────────────────
  const handleBackgroundClick = useCallback((e) => {
    if (e.target.id === 'app-background' && !explosionPhase) {
      const el = document.getElementById('courageCharacter');
      if (el) {
        el.classList.add('frightened');
        setTimeout(() => el.classList.remove('frightened'), 500);
      }
    }
  }, [explosionPhase]);

  // ── Disable explode when CourageRunning is shown (no explosion div parts) ──
  const _active = sceneOverride || scene;
  const _isNight = _active === 'evening' || _active === 'midnight';
  const _isNoon = _active === 'noon';
  const _scared = (newsOpen && newsEmotion === 'scared') || (!newsOpen && _isNight);
  const _happy = (newsOpen && newsEmotion === 'happy') || (!newsOpen && _isNoon);
  const explodeDisabled = !!explosionPhase || (!_scared && !_happy);

  return (
    <div className="app-container" id="app-background" onClick={handleBackgroundClick}>

      {/* ── Scene ambient effects ── */}
      <SceneEffects scene={_active} repulseSignal={repulseSignal} onCourageMove={handleCourageMove} />

      {/* ── Typewriter scene hints ── */}
      <HeroHints scene={_active} />

      {/* ── News ticker ── */}
      <div className="news-ticker-bar">
        <div className="news-ticker-track">
          RUN COURAGE RUN &nbsp;|&nbsp; $RCR — LIVING IN YOUR BROWSER, SER &nbsp;|&nbsp;
          NOT FINANCIAL ADVICE &nbsp;|&nbsp; WATERED DOWN NEWS FOR THE DEGENS &nbsp;|&nbsp;
          THE THINGS I DO FOR YOU PEOPLE &nbsp;|&nbsp; WAGMI &nbsp;|&nbsp;
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="bone-nav">
        <div className="circle left top" /><div className="circle left bottom" />
        <div className="halloctober__banner p-flex">
          <h1 className="couragesign shiny-glass">Run Courage Run</h1>
          <div className="fog p-circle" />
        </div>
        <button
          className={`scene-toggle-btn${showSceneTip ? ' scene-tip-flash' : ''}`}
          onClick={cycleScene}
          title={sceneOverride ? `Scene: ${sceneOverride}` : 'Scene: auto (time-based)'}
        >
          {SCENE_LABELS[String(sceneOverride)] ?? '🕐'}
        </button>
        <div className="circle right top" /><div className="circle right bottom" />

        {/* Thought bubble inside nav — absolutely anchored to the scene button */}
        {showSceneTip && (
          <div className="scene-thought-bubble" aria-hidden="true">
            <div className="thought-trail">
              <span /><span /><span />
            </div>
            <div className="thought-balloon">
              Change scenes here..
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero section ── */}
      <section className={`hero-section${scrolled ? ' hero-section--hidden' : ''}`}>
        <div className="hero-center">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Live on Solana
          </div>
          <div className={`hero-text-block${heroTextVisible ? '' : ' hero-text-block--hidden'}`}>
            <p className="hero-tagline">Self-Aware Living Meme on Solana</p>
            <p className="hero-quote">"He knows his a meme. He breaks the 4th wall. He's a runner!"</p>
          </div>
          {aliveTextVisible && (
            <div className="hero-alive-text" aria-live="polite">
              Animated Self Aware Meme &mdash; He&rsquo;s alive, Interact
            </div>
          )}
        </div>

        {/* Courage character — fills hero */}
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

        {/* Voice controls — OUTSIDE character-stage so pointer-events:none doesn't block them */}
        {voiceState === null && (
          <button
            className="voice-entry-btn"
            onClick={handleVoiceEntry}
            title="Talk to Courage"
            aria-label="Start voice chat with Courage"
          >
            🎙️
          </button>
        )}

        {/* Enter 3D World — evening scene only; shows loading state while scene warms up */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
          {_active === 'evening' && voiceState === null && !world3DVisible && (
            <button
              className={`enter-3d-btn brutal-btn brutal-btn--pink${world3DMounted ? ' enter-3d-btn--loading' : ''}`}
              onClick={() => { if (!world3DMounted) setWorld3DMounted(true); }}
              aria-label="Enter 3D evening world"
            >
              {world3DMounted ? '⏳ Loading…' : '🌆 Enter 3D World'}
            </button>
          )}
        </div>

        {/* Midnight refusal bubble */}
        {midnightMsg && (
          <div className="midnight-refuse-bubble" aria-live="assertive">
            I&apos;m TOO SCARED!! Get me OUT of here!!
          </div>
        )}

        {/* Mic drop — OUTSIDE character-stage so pointer-events:none doesn't block it */}
        {voiceState !== null && (
          <div className={`mic-drop-wrap mic-drop-wrap--${voiceState}`} onClick={handleVoiceClick} role="button" aria-label="Voice chat control">
            <div className="mic-drop-icon">
              {voiceState === 'idle' && '🎙️'}
              {voiceState === 'listening' && '🔴'}
              {voiceState === 'thinking' && '⏳'}
              {voiceState === 'speaking' && '🔊'}
            </div>
            <div className="mic-drop-label">
              {voiceState === 'idle' && 'Tap to speak'}
              {voiceState === 'listening' && 'Listening…'}
              {voiceState === 'thinking' && 'Thinking…'}
              {voiceState === 'speaking' && 'Tap to stop'}
            </div>
            <div className="mic-drop-cord" />
            {/* Close button */}
            <button className="voice-exit-btn" onClick={(e) => { e.stopPropagation(); handleVoiceClose(); }} title="Exit voice chat" aria-label="Exit voice chat">✕</button>
          </div>
        )}

        {explosionReady && !explosionPhase && (
          <button className="explosion-trigger-btn" onClick={triggerExplosion}>
            💥 HE'S GONNA BLOW
          </button>
        )}
      </section>

      {/* ── TV overlay modal — same pattern as NewsTV ── */}
      {helperVisible && (
        <div className="tv-overlay" onClick={toggleHelperSection}>
          <div className="tv-overlay-inner" onClick={e => e.stopPropagation()}>
            <button className="tv-overlay-close" onClick={toggleHelperSection}>✕</button>
            <ErrorBoundary fallbackText="TV crashed. Please refresh.">
              <HomePage
                CryptoTv={CryptoTv}
                onNewsClick={() => { toggleHelperSection(); handleOpenNews(); }}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* ── Landing content ── */}
      <div className="landing-wrapper">

        {/* About */}
        <section className="landing-section container glass-panel">
          <div className="landing-card" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
            <div className="comic-banner">
              <h2 className="landing-heading">🐕 Who is $RCR?</h2>
            </div>
            <p>
              Tribute to Courage the Cowardly Dog — Cartoon Network 1999–2002. Always watching the TV and reading Newspapers. He faced
              every monster for Muriel, and he&rsquo;d face them all again. We re-animated Courage to life making him self-aware in a interactable 3D world. He lives entirely
              inside your browser.{' '}
              <code>border-radius</code>.{' '}
              <a href="https://courage.fandom.com/wiki/Courage_the_Cowardly_Dog" target="_blank" rel="noopener noreferrer">
                Read his lore &rarr;
              </a>
            </p>
          </div>
          <div className="landing-card">
            <div className="comic-banner comic-banner--yellow">
              <h2 className="landing-heading">📺 What does he do?</h2>
            </div>
            <p>
              Treat this as his mini browser world. Tap him to trigger reactions. Change scenes in menubar. Courage fetches real news every hour — good headlines make him wag, bad ones make him
              literally <strong>explode from fear</strong> then reassemble. He hosts meme TV
              channels and streams old Courage toons via the{' '}
              <a href="https://archive.org/details/courage-the-cowardly-dog-1080p-ai-upscale" target="_blank" rel="noopener noreferrer">
                Internet Archive
              </a>
              . Follow his dispatches on{' '}
              <a href="https://x.com/runcouragerun" target="_blank" rel="noopener noreferrer">
                @runcouragerun
              </a>
              . Just a scared dog doing his best.
            </p>
          </div>
        </section>

        {/* Tokenomics */}
        <section className="landing-section container glass-panel">
          <div className="comic-banner">
            <h2 className="landing-heading section-title">📊 Tokenomics</h2>
          </div>
          <div className="token-grid">
            <div className="token-card">
              <span className="token-icon">💊</span>
              <span className="token-label">Total Supply</span>
              <span className="token-value">1,000,000,000</span>
            </div>
            <div className="token-card">
              <span className="token-icon">🔥</span>
              <span className="token-label">Liquidity</span>
              <span className="token-value">Locked</span>
            </div>
            <div className="token-card">
              <span className="token-icon">📈</span>
              <span className="token-label">Tax</span>
              <span className="token-value">0.5%</span>
            </div>
            <div className="token-card">
              <span className="token-icon">🐕</span>
              <span className="token-label">Dev Wallet</span>
              <span className="token-value">0% (he's a dog)</span>
            </div>
          </div>
        </section>

        {/* Buy $RCR CTA */}
        <section className="landing-section container glass-panel" style={{ textAlign: 'center' }}>
          <div className="comic-banner comic-banner--pink">
            <h2 className="landing-heading">🐾 Get $RCR</h2>
          </div>
          <p className="buy-cta-sub">Trade on Solana — Ser.</p>
          <div className="buy-cta-row">
            <a href="#" className="brutal-btn brutal-btn--dark">🔭 DexScreener</a>
            <a href="#" className="brutal-btn brutal-btn--pink">🐾 Buy $RCR</a>
          </div>
        </section>

        {/* How to buy */}
        <section className="landing-section howtobuy-section container glass-panel">
          <div className="comic-banner wiggle">
            <h2 className="landing-heading section-title">🛒 How to Get $RCR</h2>
          </div>
          <div className="steps-list">
            <div className="step-item">
              <span className="step-num">1</span>
              <div>
                <strong>Get a Solana Wallet</strong>
                <p>Download Phantom or Backpack — free and takes 2 minutes</p>
              </div>
            </div>
            <div className="step-item">
              <span className="step-num">2</span>
              <div>
                <strong>Buy SOL</strong>
                <p>Get SOL from any exchange (Coinbase, Kraken, Binance)</p>
              </div>
            </div>
            <div className="step-item">
              <span className="step-num">3</span>
              <div>
                <strong>Swap for $RCR</strong>
                <p>Head to Jupiter.ag or Raydium and paste the $RCR contract address</p>
              </div>
            </div>
            <div className="step-item">
              <span className="step-num">4</span>
              <div>
                <strong>WAGMI, ser</strong>
                <p>You're now part of the pack. The things we do for you people...</p>
              </div>
            </div>
          </div>
        </section>

        {/* Community */}
        <section className="landing-section container glass-panel">
          <div className="comic-banner comic-banner--purple">
            <h2 className="landing-heading section-title">🌐 Join the Pack</h2>
          </div>
          <p className="community-sub">The most anxious community in crypto</p>
          <div className="community-links" style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
            <a href="https://x.com/runcouragerun" target="_blank" rel="noopener noreferrer" className="brutal-btn brutal-btn--blue">𝕏 Twitter</a>
            <a href="#" className="brutal-btn" style={{ background: '#24A1DE', color: 'white' }}>✈️ Telegram</a>
          </div>
        </section>
      </div>

      {/* ── NewsTV overlay ── */}
      {newsOpen && (
        <NewsTV
          articles={articles}
          articleIndex={articleIndex}
          onPrev={() => goToArticle(Math.max(0, articleIndex - 1))}
          onNext={() => goToArticle(Math.min(articles.length - 1, articleIndex + 1))}
          onClose={handleCloseNews}
          onFetch={handleFetchNews}
          newsEmotion={newsEmotion}
          loading={newsLoading}
          country={newsCountry}
          setCountry={setNewsCountry}
          category={newsCategory}
          setCategory={setNewsCategory}
        />
      )}

      {/* ── Sticky action bar (always visible at bottom of viewport) ── */}
      <div className="sticky-actions">
        <button className="hero-btn" onClick={toggleHelperSection}>
          <FaTv /> {helperVisible ? 'Hide TV' : 'Watch TV'}
        </button>
        <button className="hero-btn hero-btn--news" onClick={handleOpenNews}>
          <FaNewspaper /> Read News
        </button>
        <button
          className="hero-btn hero-btn--explode"
          onClick={triggerExplosion}
          disabled={explodeDisabled}
          title={explodeDisabled ? 'Switch to night scene or open news first' : 'Boom!'}
        >
          💥 Explode!
        </button>
        <button
          className="sticky-info-btn"
          onClick={() => setTourOpen(true)}
          title="How to play"
          aria-label="Open demo guide"
        >
          i
        </button>
      </div>

      <Footer />

      {/* ── 3D Evening World portal — mounts silently in background, fades in when ready ── */}
      {world3DMounted && (
        <React.Suspense fallback={null}>
          <EveningWorld3D
            visible={world3DVisible}
            onReady={() => setWorld3DVisible(true)}
            onClose={() => { setWorld3DMounted(false); setWorld3DVisible(false); }}
          />
        </React.Suspense>
      )}

      {/* ── First-time visitor welcome tour ── */}
      <WelcomeTour
        forceOpen={tourOpen}
        onClose={() => {
          setTourOpen(false);
          setTourDismissed(true); // starts the 60s hero timer for first-timers
        }}
      />
    </div>
  );
}

