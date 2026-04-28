import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppKit as App } from './App.jsx';
import Swal from 'sweetalert2';

const pawIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="50" height="50" fill="white">
  <path d="M256 384c-35.3 0-64 28.7-64 64 0 23.1 12.4 43.3 30.9 54.4C228.3 510.7 242.8 512 256 512s27.7-1.3 33.1-9.6C307.6 491.3 320 471.1 320 448c0-35.3-28.7-64-64-64zm164.7-63.3c-9.2-5.8-19.4-8.6-30-8.6-20.8 0-39.9 11.1-50.1 28.9-13.3 22.3-41.1 36.3-69.7 36.3s-56.4-14-69.7-36.3c-10.2-17.8-29.3-28.9-50.1-28.9-10.5 0-20.8 2.8-30 8.6C44.4 358.7 0 413.1 0 480c0 17.7 14.3 32 32 32h448c17.7 0 32-14.3 32-32 0-66.9-44.4-121.3-101.3-159.3zM98.8 225.4c-10.1 0-19.5 4.4-26.3 11.6-13.2 14-18.2 36.2-18.2 54.4 0 29.8 22.2 54.6 49.8 54.6 14.9 0 28.7-6.7 38.2-18.3 9.8-12 14.8-28.3 14.8-42.8 0-29.8-22.2-54.6-49.8-54.6zm314.4 0c-27.6 0-49.8 24.8-49.8 54.6 0 14.5 5 30.8 14.8 42.8 9.5 11.6 23.3 18.3 38.2 18.3 27.6 0 49.8-24.8 49.8-54.6 0-18.2-5-40.4-18.2-54.4-6.8-7.3-16.2-11.6-26.3-11.6zM256 0c-49.4 0-80 51.4-80 98.7 0 37.6 21.5 62.5 48 62.5s48-24.9 48-62.5C304 51.4 283.4 0 256 0zm-136 64c-33.2 0-56 38.5-56 76.9 0 29.3 16.8 49.5 37.5 49.5s37.5-20.2 37.5-49.5C139.5 102.5 123.8 64 120 64zm272 0c-3.8 0-19.5 38.5-19.5 76.9 0 29.3 16.8 49.5 37.5 49.5s37.5-20.2 37.5-49.5C392 102.5 368.2 64 344 64z"/>
</svg>
`;

document.addEventListener('DOMContentLoaded', () => {
  const progressBar = document.getElementById('progress-bar');
  const loadingScreen = document.getElementById('loading-screen');
  const rootElement = document.getElementById('root');

  let progress = 0;

  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 5) + 2;
    if (progress > 95) progress = 95;
    progressBar.style.width = `${progress}%`;
  }, 200);

  window.addEventListener('load', () => {
    clearInterval(interval);
    progressBar.style.width = '100%';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      rootElement.style.display = 'block';
      createRoot(rootElement).render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    }, 500);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./assets/js/service-worker.js').then((registration) => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              Swal.fire({
                iconHtml: pawIconSvg,
                title: 'Paw Alert!',
                html: '<p style="color: white;">A new version of Courage is available. Reload to update!</p>',
                background: '#000',
                color: '#fff',
                showCancelButton: true,
                confirmButtonText: 'Reload',
                cancelButtonText: 'Later',
                customClass: {
                  popup: 'swal-custom-popup',
                  confirmButton: 'swal-confirm-button',
                  cancelButton: 'swal-cancel-button',
                },
              }).then((result) => {
                if (result.isConfirmed) {
                  window.location.reload();
                }
              });
            }
          };
        };
      });
    }
  });
});
