lucide.createIcons();

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
let toastTimer;

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    const destination = item.textContent.trim().replace(/\d+$/, '').trim();
    if (destination !== 'Overview' && !item.closest('.sidebar-bottom')) {
      showToast(`${destination} view is ready for your team.`);
    }
  });
});

document.querySelectorAll('.filter').forEach((filter) => {
  filter.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((button) => button.classList.remove('active'));
    filter.classList.add('active');
    showToast(`Showing ${filter.textContent.replace(/\d+/g, '').trim().toLowerCase()} donations.`);
  });
});

document.getElementById('add-donation').addEventListener('click', () => {
  showToast('Donation added to the queue. A coordinator will be notified.');
});

document.getElementById('view-alerts').addEventListener('click', () => {
  showToast('You are up to date on all 3 active alerts.');
});

document.querySelectorAll('.arrow-button').forEach((button) => {
  button.addEventListener('click', () => showToast('Alert details opened for the operations team.'));
});

document.querySelectorAll('.row-action').forEach((button) => {
  button.addEventListener('click', () => showToast('Donation details opened.'));
});

document.querySelectorAll('.map-control').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.map-control').forEach((control) => control.classList.remove('active'));
    button.classList.add('active');
  });
});

let selectedRole = '';
const welcomeScreen = document.getElementById('welcome-screen');
const managementScreen = document.getElementById('management-screen');
const volunteerScreen = document.getElementById('volunteer-screen');
const appShell = document.querySelector('.app-shell');
const welcomePin = document.getElementById('welcome-pin');
const welcomeError = document.getElementById('welcome-error');
const donationForm = document.getElementById('donation-form');

const nearbyButton = document.getElementById('find-nearby');
const nearbyResults = document.getElementById('nearby-results');
const realMap = document.getElementById('real-map');
const pinForm = document.getElementById('pin-form');
const pinCode = document.getElementById('pin-code');

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

function distanceBetween(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lon2 - lon1);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function organizationName(tags) {
  return tags.name || tags.operator || 'Unnamed support organization';
}

async function showRealMap(latitude, longitude) {
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.035}%2C${latitude - 0.025}%2C${longitude + 0.035}%2C${latitude + 0.025}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  realMap.innerHTML = `<iframe title="OpenStreetMap view of the searched locality" src="${mapUrl}" loading="lazy"></iframe><a class="map-open-link" href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Open larger map</a>`;
  lucide.createIcons();
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`);
    if (!response.ok) return;
    const location = await response.json();
    const locality = location.address?.suburb || location.address?.town || location.address?.city || location.address?.village;
    if (locality) {
      realMap.insertAdjacentHTML('afterbegin', `<span class="locality-label"><i data-lucide="map-pin"></i>${locality}</span>`);
      lucide.createIcons();
    }
  } catch (error) {
    // The map remains usable if locality lookup is unavailable.
  }
}

function renderNearbyResults(elements, latitude, longitude) {
  const organizations = elements.map((element) => {
    const tags = element.tags || {};
    const elementLatitude = element.lat || element.center?.lat;
    const elementLongitude = element.lon || element.center?.lon;
    return { tags, latitude: elementLatitude, longitude: elementLongitude, distance: distanceBetween(latitude, longitude, elementLatitude, elementLongitude) };
  }).filter((organization) => organization.latitude && organization.longitude).sort((a, b) => a.distance - b.distance).slice(0, 8);

  if (!organizations.length) {
    nearbyResults.innerHTML = '<div class="empty-results"><span class="empty-icon"><i data-lucide="search-x"></i></span><div><strong>No nearby listings found</strong><p>Try again from a wider area or check a local directory.</p></div></div>';
    lucide.createIcons();
    return;
  }

  nearbyResults.innerHTML = organizations.map(({ tags, latitude: organizationLatitude, longitude: organizationLongitude, distance }) => {
    const phone = tags.phone || tags['contact:phone'];
    const address = [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not published';
    const type = tags.amenity === 'shelter' ? 'Shelter' : tags.social_facility === 'food_bank' ? 'Food bank' : 'Community support';
    const mapUrl = `https://www.openstreetmap.org/?mlat=${organizationLatitude}&mlon=${organizationLongitude}#map=18/${organizationLatitude}/${organizationLongitude}`;
    return `<article class="nearby-result"><span class="result-icon"><i data-lucide="heart-handshake"></i></span><div class="result-info"><strong>${organizationName(tags)}</strong><span>${type} · ${formatDistance(distance)}</span><small>${address}</small></div><div class="result-contact">${phone ? `<a href="tel:${phone.replace(/[^+\d]/g, '')}"><i data-lucide="phone"></i>${phone}</a>` : '<span class="no-phone"><i data-lucide="phone-off"></i>Phone not listed</span>'}<a href="${mapUrl}" target="_blank" rel="noopener"><i data-lucide="map-pin"></i>Open map</a></div></article>`;
  }).join('');
  lucide.createIcons();
}

async function searchNearby(latitude, longitude, cityName = '') {
  // Simplified Overpass query - less likely to timeout or error
  const query = `[out:json][timeout:10];(node[amenity=shelter](around:10000,${latitude},${longitude});node[social_facility=food_bank](around:10000,${latitude},${longitude}););out center tags;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  console.log('Searching nearby at coordinates:', latitude, longitude);
  
  for (const endpoint of endpoints) {
    try {
      console.log('Trying Overpass endpoint:', endpoint);
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { timeout: 10000 });
      console.log('Overpass response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Overpass data received, elements:', data.elements?.length);
        if (data.elements && data.elements.length > 0) {
          return data;
        }
      }
    } catch (error) {
      console.log('Overpass endpoint error:', endpoint, error.message);
      // Try the next server
    }
  }
  
  console.log('All Overpass endpoints failed');
  throw new Error('Nearby search failed - unable to connect to any Overpass server');
}

function resetFinderButton() {
  nearbyButton.disabled = false;
  nearbyButton.innerHTML = '<i data-lucide="locate-fixed"></i> Use my location';
  lucide.createIcons();
}

nearbyButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Location is not supported by this browser.');
    return;
  }
  nearbyButton.disabled = true;
  nearbyButton.innerHTML = '<i data-lucide="loader-circle"></i> Finding nearby support';
  lucide.createIcons();
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const data = await searchNearby(coords.latitude, coords.longitude);
      showRealMap(coords.latitude, coords.longitude);
      renderNearbyResults(data.elements, coords.latitude, coords.longitude);
      showToast(`${data.elements.length} nearby organizations found.`);
    } catch (error) {
      nearbyResults.innerHTML = '<div class="empty-results"><span class="empty-icon"><i data-lucide="wifi-off"></i></span><div><strong>Could not load nearby listings</strong><p>Check your connection and try the location search again.</p></div></div>';
      lucide.createIcons();
      showToast('Nearby search could not connect.');
    } finally {
      resetFinderButton();
    }
  }, () => {
    resetFinderButton();
    showToast('Please allow location access to find nearby support.');
  }, { enableHighAccuracy: true, timeout: 10000 });
});

pinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const enteredCity = pinCode.value.trim();
  if (!/^[a-zA-Z\s\-]{2,30}$/.test(enteredCity)) {
    showToast('Enter a valid city name.');
    pinCode.focus();
    return;
  }
  const submitButton = pinForm.querySelector('button');
  submitButton.disabled = true;
  submitButton.innerHTML = '<i data-lucide="loader-circle"></i> Searching';
  lucide.createIcons();
  try {
    console.log('Searching for city:', enteredCity);
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=${encodeURIComponent(`${enteredCity}, India`)}`;
    console.log('API URL:', searchUrl);
    const geocodeResponse = await fetch(searchUrl);
    console.log('Geocode response status:', geocodeResponse.status);
    if (!geocodeResponse.ok) throw new Error('City lookup failed');
    const locations = await geocodeResponse.json();
    console.log('Locations found:', locations);
    if (!locations.length) {
      nearbyResults.innerHTML = '<div class="empty-results"><span class="empty-icon"><i data-lucide="search-x"></i></span><div><strong>City not found in India</strong><p>Check the spelling and try again.</p></div></div>';
      lucide.createIcons();
      return;
    }
    const latitude = Number(locations[0].lat);
    const longitude = Number(locations[0].lon);
    console.log('City coordinates:', latitude, longitude);
    const data = await searchNearby(latitude, longitude, enteredCity);
    console.log('Nearby results:', data);
    showRealMap(latitude, longitude);
    renderNearbyResults(data.elements, latitude, longitude);
    showToast(`${data.elements.length} organizations found near ${enteredCity}.`);
  } catch (error) {
    nearbyResults.innerHTML = '<div class="empty-results"><span class="empty-icon"><i data-lucide="wifi-off"></i></span><div><strong>Nearby search is temporarily unavailable</strong><p>The public directory did not respond. Please try again in a moment.</p></div></div>';
    lucide.createIcons();
    showToast('City search could not connect.');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '<i data-lucide="search"></i> Search city';
    lucide.createIcons();
  }
});

document.querySelectorAll('.role-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.role-card').forEach((roleCard) => roleCard.classList.remove('selected'));
    card.classList.add('selected');
    selectedRole = card.dataset.role;
    welcomeError.textContent = '';
  });
});

function openDonorView(searchType) {
  welcomeScreen.hidden = true;
  managementScreen.hidden = true;
  volunteerScreen.hidden = true;
  appShell.classList.add('visible');
  renderRoleNetwork();
  document.getElementById('nearby-support').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (searchType === 'pin' && welcomePin.value.trim()) {
    pinCode.value = welcomePin.value.trim();
    pinForm.requestSubmit();
  } else if (searchType === 'location') {
    nearbyButton.click();
  }
}

function renderRoleNetwork() {
  const title = document.getElementById('network-title');
  const subtitle = document.getElementById('network-subtitle');
  const list = document.getElementById('network-list');
  const donorView = selectedRole === 'donor';
  title.textContent = donorView ? 'Recipients and volunteers' : 'Donors and volunteers';
  subtitle.textContent = donorView ? 'Nearby organizations ready to receive food, plus pickup support.' : 'Available food sources and pickup support near your community.';
  const cards = donorView ? [
    { icon: 'heart-handshake', color: 'green-icon', name: 'St. Mary\'s Shelter', detail: 'Recipient · 2.1 km away', action: 'View recipient' },
    { icon: 'building-2', color: 'green-icon', name: 'Hope Home', detail: 'Recipient · 4.6 km away', action: 'View recipient' },
    { icon: 'bike', color: 'blue-icon', name: 'Volunteers near you', detail: '3 available for pickup', action: 'Request help' }
  ] : [
    { icon: 'store', color: 'orange-icon', name: 'Bloom & Oven', detail: '18 kg bread · 1.8 km away', action: 'View donor' },
    { icon: 'shopping-basket', color: 'orange-icon', name: 'Green Basket Market', detail: '42 kg produce · 3.2 km away', action: 'View donor' },
    { icon: 'bike', color: 'blue-icon', name: 'Volunteers near you', detail: '3 available for pickup', action: 'Request help' }
  ];
  list.innerHTML = cards.map((card) => `<article class="connection-card"><span class="connection-avatar ${card.color}"><i data-lucide="${card.icon}"></i></span><div><strong>${card.name}</strong><small>${card.detail}</small></div><button class="connection-action"><i data-lucide="arrow-up-right"></i>${card.action}</button></article>`).join('');
  lucide.createIcons();
}

function openManagementView() {
  welcomeScreen.hidden = true;
  appShell.classList.remove('visible');
  volunteerScreen.hidden = true;
  managementScreen.hidden = false;
  document.getElementById('management-location').textContent = welcomePin.value.trim() || 'Current area';
  renderSharedDonations();
}

function openVolunteerView() {
  welcomeScreen.hidden = true;
  appShell.classList.remove('visible');
  managementScreen.hidden = true;
  volunteerScreen.hidden = false;
}

document.getElementById('welcome-search-button').addEventListener('click', () => {
  if (!selectedRole) {
    welcomeError.textContent = 'Choose your role first, then search nearby support.';
    return;
  }
  if (!welcomePin.value.trim()) {
    welcomeError.textContent = 'Enter a PIN code, or use the location button.';
    welcomePin.focus();
    return;
  }
  if (selectedRole === 'donor') openDonorView('pin');
  if (selectedRole === 'recipient') openManagementView();
  if (selectedRole === 'volunteer') openVolunteerView();
});

document.getElementById('welcome-location').addEventListener('click', () => {
  if (!selectedRole) {
    welcomeError.textContent = 'Choose your role first, then use your location.';
    return;
  }
  if (selectedRole === 'recipient') {
    openManagementView();
    document.getElementById('management-location').textContent = 'Current area';
  } else if (selectedRole === 'donor') {
    openDonorView('location');
  } else {
    openVolunteerView();
  }
});

document.getElementById('back-to-welcome').addEventListener('click', () => {
  managementScreen.hidden = true;
  welcomeScreen.hidden = false;
  selectedRole = '';
  document.querySelectorAll('.role-card').forEach((card) => card.classList.remove('selected'));
});

document.getElementById('back-from-volunteer').addEventListener('click', () => {
  volunteerScreen.hidden = true;
  welcomeScreen.hidden = false;
  selectedRole = '';
  document.querySelectorAll('.role-card').forEach((card) => card.classList.remove('selected'));
});

document.getElementById('donor-filter').addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll('.donor-match').forEach((donor) => {
    donor.hidden = !donor.textContent.toLowerCase().includes(query);
  });
});

document.querySelectorAll('.match-request').forEach((button) => {
  button.addEventListener('click', () => showToast('Pickup request sent to the donor.'));
});

document.addEventListener('click', (event) => {
  const action = event.target.closest('.connection-action');
  if (action) showToast('Request sent. A coordinator will confirm the connection.');
});

document.getElementById('accept-route').addEventListener('click', () => {
  showToast('Route accepted. Your handoff checklist is ready.');
});

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatDeadline(value) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderSharedDonations() {
  const donations = JSON.parse(localStorage.getItem('commonTableDonations') || '[]');
  const donorGrid = document.getElementById('donor-grid');
  const routeList = document.querySelector('.route-task-list');
  document.querySelectorAll('.shared-donation').forEach((item) => item.remove());
  donations.slice().reverse().forEach((donation, index) => {
    const donorCard = document.createElement('article');
    donorCard.className = 'donor-match shared-donation';
    donorCard.innerHTML = `<span class="match-mark cafe">${escapeHtml(donation.foodType.slice(0, 2).toUpperCase())}</span><div class="match-details"><strong>${escapeHtml(donation.foodType)}</strong><span>${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)} · ${escapeHtml(donation.packaging)}</span><small>Collect by ${escapeHtml(formatDeadline(donation.deadline))}${donation.notes ? ` · ${escapeHtml(donation.notes)}` : ''}</small></div><div class="match-actions"><span class="no-phone"><i data-lucide="phone-off"></i> Phone not verified</span><button class="match-request"><i data-lucide="send"></i> Request pickup</button></div>`;
    donorGrid.prepend(donorCard);
    const routeTask = document.createElement('article');
    routeTask.className = 'shared-donation';
    routeTask.innerHTML = `<span class="task-number">NEW</span><div><strong>${escapeHtml(donation.foodType)} · ${escapeHtml(donation.quantity)} ${escapeHtml(donation.unit)}</strong><small>Collect by ${escapeHtml(formatDeadline(donation.deadline))} · ${escapeHtml(donation.packaging)}</small></div><span class="task-distance">PIN area</span>`;
    routeList.prepend(routeTask);
  });
  lucide.createIcons();
}

donationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(donationForm);
  const donation = Object.fromEntries(formData.entries());
  donation.createdAt = new Date().toISOString();
  const donations = JSON.parse(localStorage.getItem('commonTableDonations') || '[]');
  donations.push(donation);
  localStorage.setItem('commonTableDonations', JSON.stringify(donations));
  donationForm.reset();
  showToast('Donation published for recipients and volunteers.');
});
