import './CourageRunning.css';
import { useState, useEffect } from 'react';

const CourageRunning = ({ voiceState = null, currentScene = 'sunrise' }) => {
  const isTalking   = voiceState !== null;
  const isListening = voiceState === 'listening';
  const isThinking  = voiceState === 'thinking';
  const isSpeaking  = voiceState === 'speaking';
  const isSunriseScene = currentScene === 'sunrise';

  const [showThought, setShowThought] = useState(false);
  const [thoughtText, setThoughtText] = useState('');
  const [runningDirection, setRunningDirection] = useState('right');
  const [isPaused, setIsPaused] = useState(false);
  const lastPosRef = useRef('');

  // Track running direction and pause state based on animation phase
  useEffect(() => {
    const checkDirection = () => {
      const runner = document.querySelector('.runnercourage');
      if (runner) {
        const transform = window.getComputedStyle(runner).transform;
        
        // Pause check
        if (transform === lastPosRef.current && transform !== 'none') {
          setIsPaused(true);
        } else {
          setIsPaused(false);
        }
        lastPosRef.current = transform;

        // Check if running to the right (positive translateX) or left (negative)
        // Usually returns a matrix like matrix(a, b, c, d, tx, ty)
        if (transform.includes('matrix(')) {
          const parts = transform.split(',');
          if (parts.length >= 6) {
            const a = parseFloat(parts[0].split('(')[1]);
            // If scaleX/rotateY is flipped, 'a' is negative
            setRunningDirection(a < 0 ? 'left' : 'right');
          }
        } else if (transform.includes('translateX(')) {
          const match = transform.match(/translateX\(([^)]+)\)/);
          if (match) {
            const value = parseFloat(match[1]);
            setRunningDirection(value > 0 ? 'right' : 'left');
          }
        }
      }
    };

    const interval = setInterval(checkDirection, 100);
    return () => clearInterval(interval);
  }, []);

  // Show thought bubble based on running direction changes (only in sunrise scene)
  useEffect(() => {
    if (!isSunriseScene) return; // Only show in sunrise scene

    let lastDirection = runningDirection;
    let showTimeout = null;
    let hideTimeout = null;

    const showThoughtBubble = (direction) => {
      // Clear any existing timeouts
      if (showTimeout) clearTimeout(showTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
      
      const text = direction === 'right' ? '...monsters outside!!!' : '...monsters inside';
      setThoughtText(text);
      setShowThought(true);
      
      // Hide after 4.5 seconds (matching the animation duration)
      hideTimeout = setTimeout(() => {
        setShowThought(false);
      }, 4500);
    };

    // Check for direction changes
    const checkDirection = () => {
      if (runningDirection !== lastDirection) {
        lastDirection = runningDirection;
        showThoughtBubble(runningDirection);
      }
    };

    // Initial check after 1 second
    showTimeout = setTimeout(() => {
      showThoughtBubble(runningDirection);
    }, 1000);

    // Check direction changes every 100ms
    const directionCheckInterval = setInterval(checkDirection, 100);

    return () => {
      if (showTimeout) clearTimeout(showTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
      clearInterval(directionCheckInterval);
    };
  }, [runningDirection, isSunriseScene]);

  return (
    <div 
      id="courageCharacter"
      className={`runnercourage${isTalking ? ' is-talking' : ''}${isListening ? ' is-listening' : ''}${isThinking ? ' is-thinking' : ''}${isSpeaking ? ' is-speaking' : ''}${isPaused && !isTalking ? ' is-paused' : ''}`}
    >
      <div className='runnercourage-head'>
        <div className='runnercourage-ear-left'></div>
        <div className='runnercourage-head-rear'></div>
        <div className='runnercourage-ear-right'></div>
        <div className='runnercourage-head-nose'></div>
        <div className='runnercourage-eye-front'></div>
        <div className='runnercourage-eye-rear'></div>
        <div className='runnercourage-nose'>
          <div className='runnercourage-nose-cheek-left'></div>
          <div className='runnercourage-nose-cheek-right'></div>
          <div className='runnercourage-nose-tip'>
            <div className='runnercourage-nose-shadow'></div>
          </div>
        </div>
      </div>
      <div className='runnercourage-mouth'>
        <div className='runnercourage-mouth-inner'></div>
        <div className='runnercourage-tooth-top'></div>
        <div className='runnercourage-tooth-top'></div>
        <div className='runnercourage-tooth-top'></div>
        <div className='runnercourage-tooth-top'></div>
        <div className='runnercourage-tooth-bottom'></div>
        <div className='runnercourage-tooth-bottom'></div>
      </div>
      <div className='runnercourage-body'>
        <div className='runnercourage-arm-front'></div>
        <div className='runnercourage-arm-back'></div>
        <div className='runnercourage-tail-black'></div>
        <div className='runnercourage-tail'></div>
        <div className='runnercourage-leg-back'></div>
        <div className='runnercourage-leg-front'></div>
        
        {/* Thought bubble - only show in sunrise scene on landing page */}
        {showThought && isSunriseScene && (
          <div className="runnercourage-thought-bubble">
            <div className="thought-trail">
              <div className="thought-dot"></div>
              <div className="thought-dot"></div>
              <div className="thought-dot"></div>
            </div>
            <div className="thought-text">{thoughtText}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourageRunning;
