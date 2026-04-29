import React from 'react';

const teasers = [
  {
    title: "MURIEL'S KITCHEN",
    icon: "🥧",
    desc: "Baking AI-powered recipes and banishing ghosts with a rolling pin.",
    cta: "PREHEATING...",
    color: "#F1A7C1"
  },
  {
    title: "EUSTACE'S COMPUTER",
    icon: "🖥️",
    desc: "Query the ancient web and get barked at by the most grumpy AI agent.",
    cta: "BOOTING...",
    color: "#8BC6EC"
  }
];

const TeaserGrid = () => {
  return (
    <div style={{ padding: '6rem 0' }}>
      <div className="container">
        <h2 className="section-title">THE FUTURE OF NOWHERE</h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '3rem',
          marginTop: '3rem'
        }}>
          {teasers.map((t, idx) => (
            <div key={idx} className="brutal-card" style={{
              background: t.color,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              transform: `rotate(${idx === 0 ? '-1.5' : '1.5'}deg)`
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02) rotate(0deg)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = `rotate(${idx === 0 ? '-1.5' : '1.5'}deg)`}
            >
              <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>{t.icon}</div>
              <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t.title}</h3>
              <p style={{ marginBottom: '2rem', fontSize: '1.1rem', fontWeight: '500' }}>{t.desc}</p>
              <div className="brutal-btn" style={{ background: 'white' }}>
                {t.cta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeaserGrid;
