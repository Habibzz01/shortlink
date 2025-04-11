document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const targetUrlInput = document.getElementById('target-url');
  const linkNameInput = document.getElementById('link-name');
  const generateBtn = document.getElementById('generate-btn');
  const generatedLinkSection = document.getElementById('generated-link-section');
  const trackingLinkInput = document.getElementById('tracking-link');
  const copyLinkBtn = document.getElementById('copy-link');
  const linkFilter = document.getElementById('link-filter');
  const resultsBody = document.getElementById('results-body');
  const noResults = document.getElementById('no-results');
  const resultsTable = document.getElementById('results-table');
  const modal = document.getElementById('modal');
  const closeModal = document.querySelector('.close-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const toast = document.getElementById('toast');

  // Firebase references
  const linksRef = database.ref('trackingLinks');
  const clicksRef = database.ref('trackingClicks');

  // Initialize
  let currentUserId = generateUserId();
  loadTrackingLinks();

  // Generate tracking link
  generateBtn.addEventListener('click', function() {
    const targetUrl = targetUrlInput.value.trim();
    const linkName = linkNameInput.value.trim() || 'Unnamed Link';

    if (!isValidUrl(targetUrl)) {
      showToast('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    const linkId = generateLinkId();
    const trackingUrl = `${window.location.origin}/track.html?id=${linkId}`;

    // Save to Firebase
    linksRef.child(linkId).set({
      id: linkId,
      name: linkName,
      targetUrl: targetUrl,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: currentUserId,
      clickCount: 0
    }).then(() => {
      trackingLinkInput.value = trackingUrl;
      generatedLinkSection.style.display = 'block';
      showToast('Tracking link created successfully!');
      loadTrackingLinks();
    }).catch(error => {
      console.error('Error saving link:', error);
      showToast('Error creating tracking link. Please try again.');
    });
  });

  // Copy link to clipboard
  copyLinkBtn.addEventListener('click', function() {
    trackingLinkInput.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!');
  });

  // Load tracking links
  function loadTrackingLinks() {
    linksRef.orderByChild('createdAt').on('value', snapshot => {
      const links = [];
      const linkOptions = ['<option value="all">All Links</option>'];
      
      snapshot.forEach(childSnapshot => {
        const link = childSnapshot.val();
        links.push(link);
        linkOptions.push(`<option value="${link.id}">${link.name}</option>`);
      });

      linkFilter.innerHTML = linkOptions.join('');
      displayLinks(links);
    });
  }

  // Display links in table
  function displayLinks(links) {
    if (links.length === 0) {
      noResults.style.display = 'block';
      resultsTable.style.display = 'none';
      return;
    }

    noResults.style.display = 'none';
    resultsTable.style.display = 'table';
    resultsBody.innerHTML = '';

    // Get click counts for each link
    clicksRef.once('value').then(clicksSnapshot => {
      const clicksData = clicksSnapshot.val() || {};
      
      links.forEach(link => {
        const linkClicks = Object.values(clicksData).filter(click => click.linkId === link.id);
        const lastClick = linkClicks.length > 0 
          ? new Date(Math.max(...linkClicks.map(c => c.timestamp))) 
          : null;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${link.name}</td>
          <td><a href="${link.targetUrl}" target="_blank">${truncateUrl(link.targetUrl)}</a></td>
          <td>${linkClicks.length}</td>
          <td>${lastClick ? formatDate(lastClick) : 'Never'}</td>
          <td>
            <button class="btn btn-secondary view-clicks" data-id="${link.id}">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-danger delete-link" data-id="${link.id}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </td>
        `;
        resultsBody.appendChild(row);
      });

      // Add event listeners to buttons
      document.querySelectorAll('.view-clicks').forEach(btn => {
        btn.addEventListener('click', function() {
          viewLinkClicks(this.getAttribute('data-id'));
        });
      });

      document.querySelectorAll('.delete-link').forEach(btn => {
        btn.addEventListener('click', function() {
          deleteLink(this.getAttribute('data-id'));
        });
      });
    });
  }

  // View link clicks
  function viewLinkClicks(linkId) {
    linksRef.child(linkId).once('value').then(linkSnapshot => {
      const link = linkSnapshot.val();
      if (!link) return;

      clicksRef.orderByChild('linkId').equalTo(linkId).once('value').then(snapshot => {
        const clicks = [];
        snapshot.forEach(childSnapshot => {
          clicks.push(childSnapshot.val());
        });

        modalTitle.textContent = `Tracking Data: ${link.name}`;
        
        if (clicks.length === 0) {
          modalBody.innerHTML = '<p>No tracking data available for this link yet.</p>';
        } else {
          let html = `
            <p><strong>Destination:</strong> <a href="${link.targetUrl}" target="_blank">${link.targetUrl}</a></p>
            <p><strong>Total Clicks:</strong> ${clicks.length}</p>
            <div class="location-details">
              <h4><i class="fas fa-map-marker-alt"></i> Click Locations</h4>
          `;

          clicks.sort((a, b) => b.timestamp - a.timestamp).forEach(click => {
            const date = new Date(click.timestamp);
            html += `
              <div class="location-item">
                <div class="location-info">
                  <span><strong>${click.city || 'Unknown'}, ${click.country || 'Unknown'}</strong></span>
                  <span class="location-time">${formatDateTime(date)}</span>
                </div>
                <div>
                  <a href="https://maps.google.com/?q=${click.latitude},${click.longitude}" target="_blank" class="btn btn-secondary">
                    <i class="fas fa-map"></i> View Map
                  </a>
                </div>
              </div>
            `;
          });

          html += '</div>';
          modalBody.innerHTML = html;
        }

        modal.style.display = 'block';
      });
    });
  }

  // Delete link
  function deleteLink(linkId) {
    if (confirm('Are you sure you want to delete this tracking link? All associated data will be lost.')) {
      // Delete link and its clicks
      const updates = {};
      updates[`trackingLinks/${linkId}`] = null;
      
      // Find and delete all clicks for this link
      clicksRef.orderByChild('linkId').equalTo(linkId).once('value').then(snapshot => {
        snapshot.forEach(childSnapshot => {
          updates[`trackingClicks/${childSnapshot.key}`] = null;
        });
        
        database.ref().update(updates).then(() => {
          showToast('Tracking link and all associated data deleted.');
        }).catch(error => {
          console.error('Error deleting:', error);
          showToast('Error deleting tracking link.');
        });
      });
    }
  }

  // Filter links
  linkFilter.addEventListener('change', function() {
    const linkId = this.value;
    
    if (linkId === 'all') {
      linksRef.orderByChild('createdAt').once('value').then(snapshot => {
        const links = [];
        snapshot.forEach(childSnapshot => {
          links.push(childSnapshot.val());
        });
        displayLinks(links);
      });
    } else {
      linksRef.child(linkId).once('value').then(snapshot => {
        const link = snapshot.val();
        displayLinks(link ? [link] : []);
      });
    }
  });

  // Close modal
  closeModal.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Helper functions
  function generateLinkId() {
    return 'link_' + Math.random().toString(36).substr(2, 9);
  }

  function generateUserId() {
    // Try to get existing user ID from localStorage
    let userId = localStorage.getItem('trackingLinkUserId');
    if (!userId) {
      // Generate new ID if none exists
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('trackingLinkUserId', userId);
    }
    return userId;
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  function truncateUrl(url, maxLength = 30) {
    if (url.length <= maxLength) return url;
    return url.substr(0, maxLength) + '...';
  }

  function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  function formatDateTime(date) {
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString(undefined, options);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.style.visibility = 'visible';
    setTimeout(() => {
      toast.style.visibility = 'hidden';
    }, 3000);
  }
});