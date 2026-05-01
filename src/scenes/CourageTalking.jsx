import React, { useState, useCallback } from 'react';
import './CourageScared.css';
import './CourageTalking.css';
import ThinkingOverlay from '../components/ThinkingOverlay';

/**
 * CourageTalking — AI voice chat mode character.
 * Standing calm, arms at sides, open mouth with animated teeth.
 *
 * Props:
 *   voiceState  — 'idle' | 'listening' | 'thinking' | 'speaking'
 *   onVoiceClick — called when the mic button is pressed
 */
const BUTTON_LABELS = {
  idle:      '🎙️ Talk to Courage',
  listening: '🔴 Listening...',
  thinking:  '⏳ Thinking...',
  speaking:  '🔇 Stop',
};

const CourageTalking = ({ voiceState = 'idle', onVoiceClick, toolLog = [], transcript = '' }) => {
  const [interaction, setInteraction] = useState(null);

  const applyInteraction = useCallback((cls, duration = 600) => {
    setInteraction(cls);
    setTimeout(() => setInteraction(null), duration);
  }, []);

  const handleCharacterClick = useCallback((e) => {
    const head = e.target.closest('.head');
    if (head) { applyInteraction('petted', 1600); e.stopPropagation(); return; }
    const body = e.target.closest('.body');
    if (body) { applyInteraction('poked',  400);  e.stopPropagation(); }
  }, [applyInteraction]);

  const isTalking   = voiceState === 'speaking';
  const isListening = voiceState === 'listening';
  const phase       = interaction || '';

  return (
    <>
      <ThinkingOverlay
        visible={voiceState === 'thinking'}
        transcript={transcript}
        toolLog={toolLog}
      />
      <div
        id="courageCharacter"
        className={`courage talking ${phase}`}
        onClick={handleCharacterClick}
        style={{ cursor: 'pointer' }}
      >
      {/* ── Floating voice chat button above the character ── */}
      <button
        className={`voice-chat-btn${voiceState !== 'idle' ? ` ${voiceState}` : ''}`}
        onClick={(e) => { e.stopPropagation(); onVoiceClick?.(); }}
        disabled={voiceState === 'thinking'}
        aria-label={BUTTON_LABELS[voiceState]}
      >
        {BUTTON_LABELS[voiceState]}
      </button>

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

        {/* ── Open mouth with teeth — unique to talking variant ── */}
        <div
          className={`mouth${isTalking ? ' is-talking' : ''}${isListening ? ' is-listening' : ''}`}
          aria-hidden="true"
        />
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
    </>
  );
};

export default CourageTalking;
