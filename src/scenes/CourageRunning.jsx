import './CourageRunning.css';

const CourageRunning = ({ voiceState = null }) => {
  const isTalking  = voiceState !== null;
  const isSpeaking = voiceState === 'speaking';

  return (
    <div className={`runnercourage${isTalking ? ' is-talking' : ''}${isSpeaking ? ' is-speaking' : ''}`}>
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

export default CourageRunning;
