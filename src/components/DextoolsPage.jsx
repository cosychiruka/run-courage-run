import React from 'react';
import ErrorBoundary from './ErrorBoundary';

const DextoolsPage = () => {
  return (
    <ErrorBoundary fallbackText="Dextools links couldn't load. Please refresh the page.">
      <section className="link-section">
        <h2>Check Us Out on Dextools</h2>
        <a href="https://www.dextools.io/app" target="_blank" rel="noopener noreferrer">
          View on Dextools
        </a>
      </section>
    </ErrorBoundary>
  );
};

export default DextoolsPage;
