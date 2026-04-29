import React from 'react';

const teasers = [
  {
    title: "MURIEL'S KITCHEN",
    icon: "🍳",
    desc: "AI Chef assistant. Mix ingredients, banish spirits, and learn to make the perfect vinegar-based pie.",
    status: "COMING SOON"
  },
  {
    title: "EUSTACE'S CHAIR",
    icon: "📺",
    desc: "Sit back and roast the news. An interactive AI commentary engine that hates everything as much as Eustace does.",
    status: "DEVELOPING"
  },
  {
    title: "THE COMPUTER",
    icon: "💻",
    desc: "A fully functional AI terminal. Ask it anything about the 'Middle of Nowhere' or the dark web.",
    status: "LOCKED"
  }
];

const TeaserGrid = () => {
  return (
    <div style={{ padding: '6rem 0', background: 'var(--nowhere-yellow)' }}>
      <div className="container">
        <div className="comic-banner" style={{ background: 'white' }}>
          <h2 style={{ fontSize: '2.5rem' }}>FUTURE MODULES</h2>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '3rem',
          marginTop: '4rem'
        }}>
          {teasers.map((t, i) => (
            <div key={i} className="brutal-card teaser-card" style={{ 
              background: 'white',
              cursor: 'pointer',
              transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <span style={{ fontSize: '4rem' }}>{t.icon}</span>
              <h3 style={{ margin: '1.5rem 0 1rem' }}>{t.title}</h3>
              <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>{t.desc}</p>
              <div style={{ 
                background: 'black', 
                color: 'white', 
                display: 'inline-block', 
                padding: '4px 12px',
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}>
                {t.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeaserGrid;
