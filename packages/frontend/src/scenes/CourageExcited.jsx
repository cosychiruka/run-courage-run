import React, { useState, useCallback } from 'react';
import './CourageExcited.css';
import './CourageExplosion.css';

const CourageExcited = () => {
  const [interaction, setInteraction] = useState(null);

  const applyInteraction = useCallback((cls, duration = 600) => {
    setInteraction(cls);
    setTimeout(() => setInteraction(null), duration);
  }, []);

  const handleCharacterClick = useCallback((e) => {
    if (e.target.closest('.head')) {
      applyInteraction('petted', 1600);
      e.stopPropagation();
      return;
    }
    if (e.target.closest('.body')) {
      applyInteraction('poked', 400);
      e.stopPropagation();
    }
  }, [applyInteraction]);

  return (
    <div
      id="courageCharacter"
      className={`courage ${interaction || ''}`}
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

export default CourageExcited;
