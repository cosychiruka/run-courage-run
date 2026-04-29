import React from 'react';

const milestones = [
  {
    id: 1,
    title: "RUN COURAGE RUN",
    status: "LIVE",
    description: "The original 3D escape sequence. 60 FPS of pure terror.",
    color: "#F1A7C1"
  },
  {
    id: 2,
    title: "THE FOG OF NOWHERE",
    status: "UPCOMING",
    description: "Dynamic weather systems and new ghost varieties.",
    color: "#E5D352"
  },
  {
    id: 3,
    title: "MURIEL'S KITCHEN",
    status: "TEASER",
    description: "AI Voice agent helping you mix recipes and banish monsters.",
    color: "#B8E064"
  },
  {
    id: 4,
    title: "EUSTACE'S COMPUTER",
    status: "TEASER",
    description: "A retro terminal interface to query the ancient web.",
    color: "#8BC6EC"
  }
];

const Roadmap = () => {
  return (
    <div style={{ padding: '4rem 0', background: 'white' }}>
      <div className="container">
        <div className="comic-banner">
          <h2 style={{ fontSize: '2.5rem' }}>THE TIMELINE</h2>
        </div>
        
        <div style={{ 
          position: 'relative', 
          marginTop: '4rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* The Winding Path (Dotted Line) */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '8px',
            borderLeft: '4px dashed #2D1B4B',
            zIndex: 0,
            opacity: 0.3
          }} />

          {milestones.map((m, idx) => (
            <div key={m.id} style={{
              width: '100%',
              maxWidth: '600px',
              marginBottom: '3rem',
              position: 'relative',
              zIndex: 1,
              alignSelf: idx % 2 === 0 ? 'flex-end' : 'flex-start',
              textAlign: idx % 2 === 0 ? 'left' : 'right'
            }}>
              <div className="brutal-card" style={{ 
                background: m.color,
                transform: `rotate(${idx % 2 === 0 ? '1' : '-1'}deg)`
              }}>
                <div style={{ 
                  display: 'inline-block',
                  background: 'white',
                  border: '2px solid black',
                  padding: '2px 8px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  marginBottom: '0.5rem'
                }}>
                  {m.status}
                </div>
                <h3>{m.title}</h3>
                <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>{m.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Roadmap;
