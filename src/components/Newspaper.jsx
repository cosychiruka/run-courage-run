import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import '../assets/css/Newspaper.css'; // Import the CSS styles for this component

const Newspaper = () => {
  return (
    <ErrorBoundary fallbackText="News section couldn't load. Please refresh the page.">
    <div className="newspaper-paper">
  <div className="newspaper-banner">
    <h2>Meme</h2>
    <h2>News</h2>
    <h2>Meme</h2>
    <h2>News</h2>
    <h2>Meme</h2>
    <h2>News</h2>
  </div>
  <div className="newspaper-heading">
    <h2 className="newspaper-title_right">Extra!<br/>Extra!</h2>
    <header className="newspaper-title_center">
      <h1>The Daily Trenches</h1>
      <h3>The World's Most Trenchy Newspaper</h3>
    </header>
    <h3 className="newspaper-title_right">Morning<br/>Final</h3>
  </div>
  <h2 className="newspaper-title">
    CTO Fired!
  </h2>
  <div className="newspaper-body">
    <div className="newspaper-col_1">
      <h3 className="newspaper-al_l newspaper-p_l">Accused of mooning</h3>
      <p className="newspaper-al_l newspaper-indent"> $MSRT mooned 135%, $PNUT mooned 256%, $ASS mooned 500%, $WMM mooned 210%, $MARS mooned 150%, $BRETT mooned 70%</p>
      <hr />
      <h3 className="newspaper-al_l">Daily jeet rate plummets</h3>
      <p className="newspaper-al_l newspaper-indent">$LESTER cooking, $MOODENG cooking, $SIGMA cooking, $FWOG cooking</p>
    </div>
    <div className="newspaper-col_2">
      <figure>
        <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg" />
        <figcaption className="newspaper-b_r newspaper-b_b newspaper-b_l">Latest Community Takeover</figcaption>
      </figure>
      <h3 className="newspaper-al_l newspaper-p_l">"CTO was a real loser!"</h3>
      <p className="newspaper-al_l newspaper-indent">$MEDUSA Dev accused of rugging.."bunk budd him up with diddy" @paul_got_rekt fumed</p>
    </div>
    <div className="newspaper-col_3 newspaper-b_t newspaper-b_r newspaper-b_l newspaper-p_t">
      <h3>Meme Spotlight Daily Trending News</h3>
      <div className="newspaper-cols_2">
        <div><p className="newspaper-al_l newspaper-p_l newspaper-indent">Blahblahbl blahbl blah blahb blahbl bla blahblahb blah blahb blahbl blahbla blahblahbl blahbl blah blahb blahbl bla blahblahb blah blahb blahbl blahbla</p></div>
        <div>
          <p className="newspaper-al_l newspaper-p_l newspaper-p_r newspaper-indent newspaper-p_b">Blahblahbl blahbl blah blahb blahbl bla blahblahb blah blahb blahbl blahbla blahblahbl</p>
          <div className="newspaper-p_t newspaper-b_t newspaper-b_l newspaper-p_l newspaper-p_r">
            <h3 className="newspaper-al_l newspaper-p_l">Daily fade regrets</h3>
            <p className="newspaper-al_l newspaper-indent">Since dumps: $ASS up +200%, $WORM up +350%, $CUPSEY up +640%, $PESTO up +500%</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    </ErrorBoundary>
  );
};

export default Newspaper;
