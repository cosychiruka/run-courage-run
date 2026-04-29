import { useEffect } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { FaPaw } from "react-icons/fa";

const HomePage = ({ CryptoTv, onNewsClick }) => {
  useEffect(() => {
    if (typeof CryptoTv === "function") {
      CryptoTv();
    }
  }, [CryptoTv]);

  return (
    <section id="loan-and-bone-center">
      <ErrorBoundary fallbackText="TV couldn't load. Please refresh.">
        {/* helper-section starts hidden; toggled by hero Watch TV button */}
        <div id="helper-section">
          <div className="tab-content">
            <div className="tips-content">
              <main>
                <div className="tv-body">
                  <div id="introText" className="intro-text hide">
                    <h1>
                      <span className="TVtitle">Courage</span>
                      <span className="TVtitle">the Meme</span>
                      <span className="TVtitle">Doggo <FaPaw style={{ marginLeft: "5px" }} /></span>
                    </h1>
                  </div>

                  <div className="screen-container">
                    <canvas id="static" width="380" height="280"></canvas>
                    <img id="displayed" className="hide" src="" alt="Nothing" width="380" height="280" />
                    <video id="displayedVideo" className="hide"></video>
                    <iframe
                      id="displayedArchive"
                      className="hide"
                      src="about:blank"
                      width="380"
                      height="280"
                      style={{ border: 'none' }}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title="Courage Toons"
                    />
                    <div id="archivePlayOverlay" className="archive-play-overlay hide">
                      <div className="archive-play-icon">▶</div>
                      <div className="archive-play-label">PLAY EPISODE</div>
                    </div>
                    <div id="channelLabel" className="channel-label"></div>
                    <div className="screen">
                      <div className="screen-frame"></div>
                      <div className="screen-inset"></div>
                    </div>
                  </div>

                  <div className="logo-badge">
                    <div className="logo-text">Bush</div>
                  </div>

                  <div className="controls">
                    <div className="panel">
                      <div className="screw"></div>
                      <div className="dial">
                        <button id="channel" className="dial-label pristine">Channel</button>
                      </div>
                    </div>
                    <div className="vents">
                      <div className="vent"></div>
                      <div className="vent"></div>
                      <div className="vent"></div>
                      <div className="vent"></div>
                      <div className="vent"></div>
                      <div className="vent"></div>
                    </div>
                    <div className="panel">
                      <div className="screw"></div>
                      <div className="dial">
                        <button id="trenchnews" className="dial-label pristine" onClick={onNewsClick}>News</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="legs">
                  <div className="leg"></div>
                  <div className="leg"></div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </section>
  );
};

export default HomePage;