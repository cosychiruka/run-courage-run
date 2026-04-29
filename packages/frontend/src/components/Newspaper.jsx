import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaExternalLinkAlt, FaDownload } from 'react-icons/fa';

import ErrorBoundary from './ErrorBoundary';
import { timeAgo, NEWS_COUNTRIES, NEWS_CATEGORIES } from '../services/newsService';
import { downloadArticleCard } from '../utils/screenshotUtils';
import '../assets/css/Newspaper.css';

const Newspaper = ({
  article,
  articleIndex,
  totalArticles,
  onPrev,
  onNext,
  country,
  setCountry,
  category,
  setCategory,
  onFetch,
  loading,
  newsEmotion,
}) => {
  const [imgError, setImgError] = useState(false);

  const paperBanner = (
    <div className="newspaper-banner">
      <h2>Meme</h2><h2>News</h2><h2>Meme</h2><h2>News</h2><h2>Meme</h2><h2>News</h2>
    </div>
  );

  const paperHeading = (
    <div className="newspaper-heading">
      <h2 className="newspaper-title_right">Extra!<br />Extra!</h2>
      <header className="newspaper-title_center">
        <h1>The Daily Trenches</h1>
        <h3>The World's Most Trenchy Newspaper</h3>
      </header>
      <h3 className="newspaper-title_right">Morning<br />Final</h3>
    </div>
  );

  if (!article) {
    return (
      <ErrorBoundary fallbackText="News section couldn't load. Please refresh the page.">
        <div className="newspaper-paper">
          {paperBanner}
          {paperHeading}
          <h2 className="newspaper-title">Courage checks the trenches...</h2>
          <div className="newspaper-body">
            <div className="newspaper-col_1">
              <h3 className="newspaper-al_l newspaper-p_l">Loading</h3>
              <p className="newspaper-al_l newspaper-indent">Fetching the latest from the trenches...</p>
            </div>
            <div className="newspaper-col_2">
              <figure>
                <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg" alt="Courage" />
                <figcaption className="newspaper-b_r newspaper-b_b newspaper-b_l">Latest Dispatch</figcaption>
              </figure>
            </div>
            <div className="newspaper-col_3 newspaper-b_t newspaper-b_r newspaper-b_l newspaper-p_t">
              <h3>Meme Spotlight</h3>
              <div className="newspaper-cols_2">
                <div><p className="newspaper-al_l newspaper-p_l newspaper-indent">Set your GNews API key in AI Settings to load real news...</p></div>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const bodyText = article.description || article.content || '';
  const source = article.source?.name || 'Source';
  const publishedAt = article.publishedAt ? timeAgo(article.publishedAt) : '';

  return (
    <ErrorBoundary fallbackText="News section couldn't load. Please refresh the page.">
      {/* Controls: filters + prev/next */}
      <div className="newspaper-controls">
        <select
          value={country}
          onChange={e => { setCountry(e.target.value); localStorage.setItem('courage_country', e.target.value); onFetch(e.target.value, category); }}
        >
          {Object.entries(NEWS_COUNTRIES).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); localStorage.setItem('courage_category', e.target.value); onFetch(country, e.target.value); }}
        >
          {NEWS_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
        <div className="newspaper-nav">
          <button onClick={onPrev} disabled={loading || articleIndex === 0}>
            <FaChevronLeft />
          </button>
          <span>{articleIndex + 1} / {totalArticles}</span>
          <button onClick={onNext} disabled={loading || articleIndex >= totalArticles - 1}>
            <FaChevronRight />
          </button>
        </div>
      </div>

      <div className="newspaper-paper">
        {paperBanner}
        {paperHeading}

        <h2 className="newspaper-title">{article.title}</h2>

        <div className="newspaper-body">
          <div className="newspaper-col_1">
            <h3 className="newspaper-al_l newspaper-p_l">{source}</h3>
            <p className="newspaper-al_l newspaper-indent">{publishedAt}</p>
            <hr />
            {article.url && article.url !== '#' && (
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="newspaper-full-btn">
                Full Story <FaExternalLinkAlt />
              </a>
            )}
            <button
              className="newspaper-download-btn"
              onClick={() => downloadArticleCard(article, newsEmotion)}
              title="Download article card"
            >
              Save Card <FaDownload />
            </button>
          </div>

          <div className="newspaper-col_2">
            <figure>
              <img
                src={!imgError && article.image ? article.image : 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg'}
                alt={article.title}
                onError={() => setImgError(true)}
              />
              <figcaption className="newspaper-b_r newspaper-b_b newspaper-b_l">{source}</figcaption>
            </figure>
          </div>

          <div className="newspaper-col_3 newspaper-b_t newspaper-b_r newspaper-b_l newspaper-p_t">
            <h3>Story</h3>
            <p className="newspaper-al_l newspaper-p_l newspaper-p_r newspaper-indent newspaper-p_b" style={{ gridColumn: 'span 2' }}>
              {bodyText || 'Click Full Story to read the complete article...'}
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Newspaper;
