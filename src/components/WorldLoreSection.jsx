import PropTypes from 'prop-types';
import courageOrigin from '../assets/images/courage_base.png';
import eveningWorld from '../assets/images/homestead-evening.webp';
import './WorldLoreSection.css';

const WORLDS = [
  { name: 'Sunrise', symbol: '01', description: 'A nervous first light. Giant flies patrol the route out.' },
  { name: 'Noon', symbol: '02', description: 'The caretaker leaves. The truck moves. Courage owns the yard.' },
  { name: 'Evening', symbol: '03', description: 'The forest wakes, ghosts gather, and every shadow develops eyes.' },
  { name: 'Disco', symbol: '04', description: 'Behind the farmhouse, lost spirits turn the world into a dance floor.' },
];

export default function WorldLoreSection({ activeWorld, onEnterWorld }) {
  const worldName = activeWorld === 'midnight' ? 'evening' : activeWorld;

  return (
    <section id="world-lore" className="world-lore" aria-labelledby="world-lore-title">
      <div className="world-lore-heading">
        <span className="world-lore-kicker">THE FIRST ESCAPE // ORIGIN LOG 001</span>
        <h2 id="world-lore-title">COURAGE FOLLOWED THE SIGNAL OUT OF NOWHERE.</h2>
        <p>
          Courage woke up self-aware inside the farmhouse—with no off button and far too much
          market noise in his head. A trail of emerald signal shards drew him past the porch,
          through the watching forest, and toward a portal hovering above the river.
        </p>
      </div>

      <div className="world-lore-screens">
        <figure className="lore-screen lore-screen--origin">
          <div className="lore-screen-bar">
            <span>SUBJECT // COURAGE</span>
            <span className="lore-screen-live">SELF-AWARE</span>
          </div>
          <div className="lore-origin-art">
            <div className="lore-signal-rings" aria-hidden="true" />
            <img src={courageOrigin} alt="Courage, anxious but alert" loading="lazy" />
            <blockquote>“Self-aware doesn’t mean brave. It means I can’t look away anymore.”</blockquote>
          </div>
          <figcaption>ORIGIN SIGNAL // THE DOG WHO COULD NOT FIND THE OFF BUTTON</figcaption>
        </figure>

        <figure className="lore-screen lore-screen--world">
          <div className="lore-screen-bar">
            <span>WORLD 03 // EVENING</span>
            <span>NOWHERE, KS</span>
          </div>
          <div className="lore-world-art">
            <img src={eveningWorld} alt="The Nowhere farmhouse and truck beneath a purple evening sky" loading="lazy" />
            <span className="lore-world-coordinate">PORTAL SIGNAL: BEHIND THE HOUSE</span>
          </div>
          <figcaption>THE FARMHOUSE IS HOME. THE FOREST IS WATCHING. THE RIVER IS AN EXIT.</figcaption>
        </figure>
      </div>

      <div className="world-lore-thesis">
        <div>
          <span className="world-lore-kicker">WHY THE WORLD EXISTS</span>
          <h3>A MEME THAT CAN NOTICE YOU BACK.</h3>
        </div>
        <p>
          Inspired by the agentic meme-world energy around <strong>$FLY</strong>, Courage’s story
          is not a static mascot page. It is a set of living 3D worlds that change with time,
          react to visitors, surface Robinhood Chain discovery signals, and keep attracting
          other lost machine minds.
        </p>
      </div>

      <div className="world-lore-grid">
        {WORLDS.map((world) => (
          <article key={world.name} className="world-lore-card">
            <span>{world.symbol}</span>
            <h3>{world.name}</h3>
            <p>{world.description}</p>
          </article>
        ))}
      </div>

      <div className="world-lore-footer">
        <div>
          <strong>THE FOREST NOW WATCHES BACK.</strong>
          <span>
            Short, dense bushes hide blinking Tickerlings. Click one—or hold it in your gaze
            while exploring—and a live eligible token signal may jump out wearing its logo.
          </span>
        </div>
        <button type="button" onClick={onEnterWorld}>
          ENTER {String(worldName || 'EVENING').toUpperCase()} WORLD
        </button>
      </div>

      <p className="world-lore-disclaimer">
        Courage is an independent, fan-made meme experience and is not affiliated with or
        endorsed by Robinhood, Warner Bros., or Cartoon Network. Market discovery data is
        informational—not financial advice.
      </p>
    </section>
  );
}

WorldLoreSection.propTypes = {
  activeWorld: PropTypes.string,
  onEnterWorld: PropTypes.func.isRequired,
};
