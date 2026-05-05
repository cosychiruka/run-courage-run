import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaExternalLinkAlt, FaDownload } from 'react-icons/fa';

import ErrorBoundary from './ErrorBoundary';
import { timeAgo, NEWS_COUNTRIES, NEWS_CATEGORIES } from '../services/newsService';
import { downloadArticleCard } from '../utils/screenshotUtils';
import '../assets/css/Newspaper.css';

function getEditionInfo() {
  const h = new Date().getHours();
  if (h >= 5  && h < 11) return { label: 'Morning Final',   icon: '🌅' };
  if (h >= 11 && h < 17) return { label: 'Afternoon Final', icon: '☀️' };
  if (h >= 17 && h < 21) return { label: 'Evening Final',   icon: '🌆' };
  return                         { label: 'Late Final',      icon: '🌙' };
}

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
  const edition = getEditionInfo();

  const paperBanner = (
    <div className="newspaper-banner">
      <h2>#News4Pluckies</h2><h2>#News4Pluckies</h2><h2>#News4Pluckies</h2>
      <h2>#News4Pluckies</h2><h2>#News4Pluckies</h2><h2>#News4Pluckies</h2>
    </div>
  );

  const paperHeading = (
    <div className="newspaper-heading">
      <h2 className="newspaper-title_right">Extra!<br />Extra!</h2>
      <header className="newspaper-title_center">
        <h1>The Courageous Chronicle</h1>
        <h3>The World's Bravest Newspaper</h3>
      </header>
      <h3 className="newspaper-title_right">
        {edition.icon}<br />{edition.label.split(' ')[0]}<br />{edition.label.split(' ')[1]}
      </h3>
    </div>
  );

  if (!article) {
    return (
      <ErrorBoundary fallbackText="News section couldn't load. Please refresh the page.">
        <div className="newspaper-paper">
          {paperBanner}
          {paperHeading}
          <h2 className="newspaper-title">Courage checks the trenches<span className="newspaper-exclaim">!!!</span></h2>
          <div className="newspaper-body">
            <div className="newspaper-col_1">
              <figure>
                <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg" alt="Courage" />
                <figcaption className="newspaper-b_r newspaper-b_b newspaper-b_l">Nowhere News</figcaption>
              </figure>
            </div>
            <div className="newspaper-col_2 newspaper-b_t newspaper-b_r newspaper-b_l newspaper-p_t">
              <h3>Dispatches from Nowhere</h3>
              <p className="newspaper-al_l newspaper-p_l newspaper-indent">
                Set your GNews API key in AI Settings to load real news...
              </p>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const bodyText    = article.description || article.content || '';
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

        <h2 className="newspaper-title">
          {article.title}<span className="newspaper-exclaim">!!!</span>
        </h2>

        <div className="newspaper-body">
          {/* Left column: image */}
          <div className="newspaper-col_1">
            <figure>
              <img
                src={!imgError && article.image ? article.image : 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1145795/paperboy.jpg'}
                alt={article.title}
                onError={() => setImgError(true)}
              />
              <figcaption className="newspaper-b_r newspaper-b_b newspaper-b_l">
                Nowhere News · {publishedAt}
              </figcaption>
            </figure>
          </div>

          {/* Right column: story + actions */}
          <div className="newspaper-col_2 newspaper-b_t newspaper-b_r newspaper-b_l newspaper-p_t">
            <h3>Story</h3>
            <p className="newspaper-al_l newspaper-p_l newspaper-p_r newspaper-indent newspaper-p_b">
              {bodyText || 'Click Full Story to read the complete article...'}
            </p>
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
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Newspaper;
