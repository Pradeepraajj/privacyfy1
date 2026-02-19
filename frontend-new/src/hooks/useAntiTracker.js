import { useEffect } from 'react';

const useAntiTracker = () => {
  useEffect(() => {
    // Save the browser's original canvas drawing function
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    // Override it with our Proxy shield
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      console.warn("🛡️ PrivacyFy Shield: Blocked a Canvas Fingerprinting Attempt!");
      
      // Instead of returning the real hardware pixel data, 
      // we return a fake, generic 1x1 blank pixel image.
      // This makes all PrivacyFy users look identical to trackers.
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    };

    // Cleanup function if the component unmounts
    return () => {
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    };
  }, []);
};

export default useAntiTracker;