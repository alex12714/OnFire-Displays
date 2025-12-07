import React from 'react';
import './Slideshow.css';

const Slideshow = () => {
  // Get the slideshow URL - can be made dynamic later
  const slideshowUrl = 'https://api2.onfire.so/s/slideshow';

  return (
    <div className="slideshow-container">
      <iframe
        src={slideshowUrl}
        className="slideshow-iframe"
        title="OnFire Slideshow"
        allow="autoplay; fullscreen"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
};

export default Slideshow;
