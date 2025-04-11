document.addEventListener('DOMContentLoaded', function() {
  // Get the link ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const linkId = urlParams.get('id');
  const manualRedirectBtn = document.getElementById('manual-redirect');
  const errorMessage = document.getElementById('error-message');

  if (!linkId) {
    errorMessage.textContent = 'Invalid tracking link. Missing tracking ID.';
    errorMessage.style.display = 'block';
    return;
  }

  // Initialize Firebase
  const database = firebase.database();
  const linksRef = database.ref('trackingLinks/' + linkId);
  const clicksRef = database.ref('trackingClicks');

  // Get the target URL
  linksRef.once('value').then(snapshot => {
    const link = snapshot.val();
    
    if (!link) {
      errorMessage.textContent = 'Invalid tracking link. Link not found in database.';
      errorMessage.style.display = 'block';
      manualRedirectBtn.style.display = 'inline-block';
      return;
    }

    const targetUrl = link.targetUrl;
    
    // Update click count
    linksRef.update({
      clickCount: (link.clickCount || 0) + 1
    });

    // Get user's location and save click data
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          // We have location data
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get city/country (using a free API)
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(response => response.json())
            .then(data => {
              const locationData = {
                linkId: linkId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                latitude: latitude,
                longitude: longitude,
                city: data.address?.city || data.address?.town || data.address?.village || null,
                country: data.address?.country || null,
                userAgent: navigator.userAgent,
                referrer: document.referrer || null
              };
              
              // Save to Firebase
              clicksRef.push(locationData);
              
              // Redirect to target URL
              setTimeout(() => {
                window.location.href = targetUrl;
              }, 1500);
            })
            .catch(error => {
              console.error('Geocoding error:', error);
              // Save without city/country if geocoding fails
              const locationData = {
                linkId: linkId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                latitude: latitude,
                longitude: longitude,
                userAgent: navigator.userAgent,
                referrer: document.referrer || null
              };
              
              clicksRef.push(locationData);
              
              setTimeout(() => {
                window.location.href = targetUrl;
              }, 1500);
            });
        },
        error => {
          // Geolocation failed, save without location data
          console.error('Geolocation error:', error);
          const locationData = {
            linkId: linkId,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userAgent: navigator.userAgent,
            referrer: document.referrer || null
          };
          
          clicksRef.push(locationData);
          
          setTimeout(() => {
            window.location.href = targetUrl;
          }, 1500);
        },
        { timeout: 5000 }
      );
    } else {
      // Geolocation not supported, save without location data
      const locationData = {
        linkId: linkId,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userAgent: navigator.userAgent,
        referrer: document.referrer || null
      };
      
      clicksRef.push(locationData);
      
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1500);
    }

    // Manual redirect button as fallback
    manualRedirectBtn.addEventListener('click', function() {
      window.location.href = targetUrl;
    });
  }).catch(error => {
    console.error('Database error:', error);
    errorMessage.textContent = 'Error loading tracking link. Please try again later.';
    errorMessage.style.display = 'block';
    manualRedirectBtn.style.display = 'inline-block';
  });
});