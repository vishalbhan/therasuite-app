// Polyfill for Object.hasOwn to support older Safari versions
if (!Object.hasOwn) {
  Object.hasOwn = function(obj: object, prop: string | number | symbol): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
