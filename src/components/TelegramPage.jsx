import React from 'react';
import ErrorBoundary from './ErrorBoundary';

const TelegramLinkPage = () => {
  return (
    <ErrorBoundary fallbackText="Telegram links couldn't load. Please refresh the page.">
      <section className="link-section">
        <h2>Join Our Telegram Group</h2>
        <a href="https://t.me/your-telegram-link" target="_blank" rel="noopener noreferrer">
          Join Us on Telegram
        </a>
      </section>
    </ErrorBoundary>
  );
};

export default TelegramLinkPage;
