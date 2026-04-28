import React, { useState, useCallback } from 'react';
import './CourageScared.css';
import './CourageHappy.css';
import './CourageExplosion.css';

const CourageHappy = ({ explosionPhase, onFrightened, voiceState = null }) => {
  const isTalking  = voiceState !== null;
  const isSpeaking = voiceState === 'speaking';
  const [interaction, setInteraction] = useState(null);

  const applyInteraction = useCallback((cls, duration = 600) => {
    setInteraction(cls);
    setTimeout(() => setInteraction(null), duration);
  }, []);

  const handleCharacterClick = useCallback((e) => {
    if (explosionPhase) return;
    const target = e.target.closest('.head');
    if (target) {
      applyInteraction('petted', 1600);
      e.stopPropagation();
      return;
    }
    const body = e.target.closest('.body');
    if (body) {
      applyInteraction('poked', 400);
      e.stopPropagation();
    }
  }, [applyInteraction, explosionPhase]);

  const phase = explosionPhase || interaction || '';

  return (
    <div
      id="courageCharacter"
      className={`courage happy ${phase}${isTalking ? ' is-talking' : ''}${isSpeaking ? ' is-speaking' : ''}`}
      onClick={handleCharacterClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="head">
        <div className="ear left"></div>
        <div className="ear right"></div>
        <div className="eye-container">
          <div className="eye left">
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
          </div>
        </div>
        <div className="eye-container right">
          <div className="eye right">
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
            <div className="blood-vessel"></div>
          </div>
        </div>
        <div className="cheek left">
          <div className="dot"></div>
          <div className="mustache"></div>
          <div className="mustache"></div>
        </div>
        <div className="cheek right">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="mustache"></div>
        </div>
        <div className="nouse"></div>
        <div className="mouth">
          <div className="mouth-inner" />
          <div className="tooth top" />
          <div className="tooth top" />
          <div className="tooth top" />
          <div className="tooth bottom" />
          <div className="tooth bottom" />
        </div>
      </div>
      <div className="body">
        <div className="leg top left">
          <div className="paw">
            <div className="finger"></div>
            <div className="finger"></div>
            <div className="finger"></div>
          </div>
        </div>
        <div className="leg top right">
          <div className="paw">
            <div className="finger"></div>
            <div className="finger"></div>
            <div className="finger"></div>
          </div>
        </div>
        <div className="leg bottom left">
          <div className="paw">
            <div className="finger"></div>
            <div className="finger"></div>
            <div className="finger"></div>
          </div>
        </div>
        <div className="leg bottom right">
          <div className="paw">
            <div className="finger"></div>
            <div className="finger"></div>
            <div className="finger"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourageHappy;
