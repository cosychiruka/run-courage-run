// src/scenes/CoirageExcited.js
import React from 'react';
import './CourageExcited.css';  // Import CSS for this scene

const CoirageExcited = () => {
  return (
    <div id="courageCharacter" className="courage">
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

export default CoirageExcited;
