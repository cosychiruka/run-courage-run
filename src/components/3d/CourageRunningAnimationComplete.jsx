import './CourageRunningAnimationComplete.css';

const CourageRunningAnimationComplete = ({ voiceState = null, isSniffing = false }) => {
  const isTalking   = voiceState !== null;
  const isListening = voiceState === 'listening';
  const isThinking  = voiceState === 'thinking';
  const isSpeaking  = voiceState === 'speaking';

  return (
    <div className={`runnercourage${isTalking ? ' is-talking' : ''}${isListening ? ' is-listening' : ''}${isThinking ? ' is-thinking' : ''}${isSpeaking ? ' is-speaking' : ''}${isSniffing ? ' is-sniffing' : ''}`}>
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
      </div>
    </div>
  );
};

export default CourageRunningAnimationComplete;
