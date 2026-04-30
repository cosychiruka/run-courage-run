import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../assets/css/SceneEffects.css';
import { playSquash, playGhostAngry, playCourageSneak } from '../utils/soundUtils';

/* ══════════════════════════════════════════════════════════════════════════
   FLIES — daytime (sunrise / noon)
   ══════════════════════════════════════════════════════════════════════════ */
const FLY_BASE = [
  { left: '18%', top: '38%', delay: '0s',   duration: '5.2s' },
  { left: '52%', top: '22%', delay: '1.3s', duration: '4.7s' },
  { left: '74%', top: '55%', delay: '0.6s', duration: '6.1s' },
  { left: '31%', top: '65%', delay: '2.1s', duration: '5.5s' },
  { left: '85%', top: '32%', delay: '0.9s', duration: '4.3s' },
  { left: '63%', top: '72%', delay: '1.8s', duration: '5.9s' },
  { left: '42%', top: '48%', delay: '0.4s', duration: '6.4s' },
  { left: '28%', top: '20%', delay: '2.6s', duration: '4.9s' },
];

const Flies = () => {
  const [flies, setFlies] = useState(() =>
    FLY_BASE.map((f, i) => ({ ...f, id: i, squashed: false, dead: false }))
  );
  const timersRef = useRef(new Set());

  const squash = useCallback((id) => {
    setFlies(prev => prev.map(f => f.id === id && !f.squashed ? { ...f, squashed: true } : f));
    playSquash();
    const timer = setTimeout(() => setFlies(prev => prev.map(f => f.id === id ? { ...f, dead: true } : f)), 700);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    return () => {
      // Clear all timers on unmount
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <div className="scene-effects-layer flies-layer">
      {flies.filter(f => !f.dead).map(f => (
        <div
          key={f.id}
          className={`scene-fly${f.squashed ? ' squashed' : ''}`}
          style={{ left: f.left, top: f.top, animationDelay: f.delay, '--fly-dur': f.duration }}
          onClick={() => squash(f.id)}
        >
          {f.squashed
            ? <div className="fly-splat" />
            : (<><div className="fly-wing left" /><div className="fly-wing right" /></>)
          }
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   FIREFLIES — evening
   ══════════════════════════════════════════════════════════════════════════ */
const FIREFLY_CONFIGS = [
  { left: '12%', top: '30%', delay: '0s',   dur: '6s',   glow: '2.1s' },
  { left: '28%', top: '55%', delay: '1.2s', dur: '7.5s', glow: '3s'   },
  { left: '45%', top: '25%', delay: '0.4s', dur: '5.8s', glow: '1.8s' },
  { left: '60%', top: '68%', delay: '2.3s', dur: '6.7s', glow: '2.6s' },
  { left: '72%', top: '40%', delay: '0.8s', dur: '8s',   glow: '2.4s' },
  { left: '83%', top: '20%', delay: '1.6s', dur: '6.2s', glow: '1.9s' },
  { left: '38%', top: '78%', delay: '3s',   dur: '5.5s', glow: '3.2s' },
  { left: '55%', top: '15%', delay: '0.2s', dur: '7.1s', glow: '2.8s' },
  { left: '20%', top: '82%', delay: '2.8s', dur: '6.4s', glow: '2.2s' },
  { left: '90%', top: '58%', delay: '1s',   dur: '5.9s', glow: '1.7s' },
  { left: '67%', top: '85%', delay: '1.7s', dur: '7.3s', glow: '2.9s' },
  { left: '48%', top: '48%', delay: '0.5s', dur: '6.8s', glow: '2.3s' },
];

const Fireflies = () => (
  <div className="scene-effects-layer" aria-hidden="true">
    {FIREFLY_CONFIGS.map((f, i) => (
      <div key={i} className="scene-firefly" style={{ left: f.left, top: f.top,
        animationDelay: f.delay, '--float-dur': f.dur, '--glow-dur': f.glow }} />
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   GHOSTS — midnight chase state machine
   Phases: approaching → escaping → chasing → (loop)
   Repulse interrupt: ghosts scatter, then restart approaching
   ══════════════════════════════════════════════════════════════════════════ */

// Ghost base Y positions (stay fixed, only X moves)
const GHOST_BASE = [
  { id: 0, y: 15 },
  { id: 1, y: 33 },
  { id: 2, y: 52 },
  { id: 3, y: 68 },
  { id: 4, y: 40 },
];

// X positions for each phase
const GHOST_X_START   = [88, 93, 82, 91, 86]; // start right
const GHOST_X_NEAR_L  = [14,  7, 20, 11, 17]; // approaching Courage at left (10%)
const GHOST_X_NEAR_R  = [76, 83, 72, 80, 88]; // chasing Courage at right (80%)
const GHOST_X_FLEE_R  = [92, 97, 88, 94, 95]; // repulsed from left → scatter right
const GHOST_X_FLEE_L  = [ 4,  1,  8,  3,  7]; // repulsed from right → scatter left

const COURAGE_LEFT  = 10;
const COURAGE_RIGHT = 80;

const APPROACH_MS = 10500;
const ESCAPE_MS   = 2200;

const Ghosts = ({ repulseSignal, onCourageMove }) => {
  const [ghostXs,        setGhostXs]        = useState(GHOST_X_START);
  const [ghostTrans,     setGhostTrans]      = useState('left 0s');
  const [angryId,        setAngryId]         = useState(null);
  const [scaredIds,      setScaredIds]       = useState(new Set());
  const courageXRef  = useRef(COURAGE_LEFT);
  const phaseRef     = useRef('idle');
  const timerRef     = useRef(null);
  const angryTimerRef = useRef(null);

  const moveCourage = useCallback((x, trans = 'left 2s ease-in-out') => {
    courageXRef.current = x;
    onCourageMove?.(x, trans);
  }, [onCourageMove]);

  const moveGhosts = useCallback((targets, trans) => {
    setGhostTrans(trans);
    setGhostXs(targets);
  }, []);

  // Phase runner
  const runPhase = useCallback((phase) => {
    clearTimeout(timerRef.current);
    phaseRef.current = phase;

    if (phase === 'approaching') {
      // Ghosts slide from wherever they are toward Courage at left
      moveGhosts(GHOST_X_NEAR_L, 'left 10s linear');
      timerRef.current = setTimeout(() => runPhase('escaping'), APPROACH_MS);

    } else if (phase === 'escaping') {
      // Courage sneaks to right
      playCourageSneak();
      moveCourage(COURAGE_RIGHT);
      // Ghosts briefly confused — don't move yet
      timerRef.current = setTimeout(() => runPhase('chasing'), ESCAPE_MS);

    } else if (phase === 'chasing') {
      // Ghosts now chase Courage on the right
      moveGhosts(GHOST_X_NEAR_R, 'left 10s linear');
      timerRef.current = setTimeout(() => {
        // Courage sneaks back to left
        playCourageSneak();
        moveCourage(COURAGE_LEFT);
        timerRef.current = setTimeout(() => runPhase('approaching'), ESCAPE_MS);
      }, APPROACH_MS);
    }
  }, [moveGhosts, moveCourage]);

  // Initial mount
  useEffect(() => {
    // Place ghosts instantly on right, then start chase
    setGhostTrans('left 0s');
    setGhostXs(GHOST_X_START);
    moveCourage(COURAGE_LEFT, 'left 0s');
    timerRef.current = setTimeout(() => runPhase('approaching'), 800);
    return () => {
      // Clear ALL timers on unmount
      if (timerRef.current) clearTimeout(timerRef.current);
      // Clear any angry ghost timer
      if (angryTimerRef.current) clearTimeout(angryTimerRef.current);
    };
  }, [runPhase, moveCourage]);

  // Repulse signal
  useEffect(() => {
    if (!repulseSignal) return;
    clearTimeout(timerRef.current);
    phaseRef.current = 'repulsed';

    // Show scared faces on all ghosts
    setScaredIds(new Set(GHOST_BASE.map(g => g.id)));

    const cx = courageXRef.current;
    if (cx < 50) {
      moveGhosts(GHOST_X_FLEE_R, 'left 0.45s cubic-bezier(0.25,0.46,0.45,0.94)');
    } else {
      moveGhosts(GHOST_X_FLEE_L, 'left 0.45s cubic-bezier(0.25,0.46,0.45,0.94)');
    }

    // Clear scared faces after 1.5s
    timerRef.current = setTimeout(() => {
      setScaredIds(new Set());
    }, 1500);

    // After 3s: reset Courage left, restart chase
    timerRef.current = setTimeout(() => {
      moveCourage(COURAGE_LEFT, 'left 0.5s ease-out');
      timerRef.current = setTimeout(() => runPhase('approaching'), 800);
    }, 3000);
  }, [repulseSignal, moveGhosts, moveCourage, runPhase]);

  const handleGhostClick = useCallback((id) => {
    if (angryId === id) return;
    setAngryId(id);
    playGhostAngry();
    if (angryTimerRef.current) clearTimeout(angryTimerRef.current);
    angryTimerRef.current = setTimeout(() => setAngryId(null), 1600);
  }, [angryId]);

  return (
    <div className="scene-effects-layer ghosts-layer">
      {GHOST_BASE.map((g, i) => {
        const isAngry  = angryId === g.id;
        const isScared = scaredIds.has(g.id);
        return (
          <div
            key={g.id}
            className={`scene-ghost${isAngry ? ' angry' : ''}${isScared ? ' scared-face' : ''}`}
            style={{
              left: `${ghostXs[i]}%`,
              top:  `${g.y}%`,
              transition: ghostTrans,
              animationDelay: `${i * 0.6}s`,
            }}
            onClick={() => handleGhostClick(g.id)}
          >
            <div className="ghost-eye left" />
            <div className="ghost-eye right" />
            <div className="ghost-mouth" />
          </div>
        );
      })}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   Main export
   ══════════════════════════════════════════════════════════════════════════ */
const SceneEffects = ({ scene, repulseSignal, onCourageMove }) => {
  if (scene === 'sunrise' || scene === 'noon') return <Flies />;
  if (scene === 'evening')  return <Fireflies />;
  if (scene === 'midnight') return <Ghosts repulseSignal={repulseSignal} onCourageMove={onCourageMove} />;
  return null;
};

export default SceneEffects;
