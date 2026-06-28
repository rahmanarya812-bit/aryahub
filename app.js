// Global State
let map;
let locations = [];
let markers = {}; // id -> L.marker
let tempMarker = null;

// Map Dragging & Measurement State
let isDraggingEnabled = true;
let isMeasureMode = false;
let measurePoints = [];
let measureLines = [];
let measureMarkers = [];
let measureTotalDistance = 0; // in meters

// Category Configurations
const CATEGORIES = {
  tourism: { icon: 'fa-monument', color: '#10b981', label: 'Wisata' },
  food: { icon: 'fa-utensils', color: '#f97316', label: 'Kuliner' },
  hotel: { icon: 'fa-hotel', color: '#0ea5e9', label: 'Hotel' },
  nature: { icon: 'fa-tree', color: '#0d9488', label: 'Alam' },
  custom: { icon: 'fa-location-dot', color: '#a855f7', label: 'Lainnya' }
};

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadLocations();
  initEventListeners();
});

// Initialize Leaflet Map
function initMap() {
  // Define layers
  const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  const cartoDbDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });

  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Create map
  map = L.map('map', {
    center: [-2.5489, 118.0149], // Center of Indonesia
    zoom: 5,
    layers: [osmStandard], // Default layer
    zoomControl: false // We'll add zoom control at a custom position
  });

  // Add zoom control to top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Group base layers
  const baseMaps = {
    "🗺️ Standard Map": osmStandard,
    "🌙 Dark Mode": cartoDbDark,
    "🛰️ Satellite Map": esriSatellite
  };

  // Add layer control
  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
}

// Setup Event Listeners
function initEventListeners() {
  // Map click
  map.on('click', (e) => {
    if (isMeasureMode) {
      addMeasurePoint(e.latlng);
    } else {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setTemporaryLocation(lat, lng);
    }
  });

  // Mousemove for coord indicator
  map.on('mousemove', (e) => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    document.getElementById('coords-indicator').innerHTML = 
      `<i class="fa-solid fa-compass fa-spin me-1 text-primary"></i> Lat: <strong>${lat}</strong>, Lng: <strong>${lng}</strong>`;
  });

  // Toggle map dragging
  document.getElementById('toggle-drag').addEventListener('click', function() {
    isDraggingEnabled = !isDraggingEnabled;
    if (isDraggingEnabled) {
      map.dragging.enable();
      this.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> Geser Peta: ON';
      this.className = 'btn btn-sm btn-success d-flex align-items-center gap-1';
      showToast('Geser peta diaktifkan', 'info');
    } else {
      map.dragging.disable();
      this.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> Geser Peta: OFF';
      this.className = 'btn btn-sm btn-secondary d-flex align-items-center gap-1';
      showToast('Geser peta dimatikan', 'info');
    }
  });

  // Toggle distance measurement tool
  document.getElementById('toggle-measure').addEventListener('click', function() {
    isMeasureMode = !isMeasureMode;
    const clearBtn = document.getElementById('clear-measure');
    if (isMeasureMode) {
      this.innerHTML = '<i class="fa-solid fa-ruler-combined"></i> Ukur Jarak: ON';
      this.className = 'btn btn-sm btn-success d-flex align-items-center gap-1';
      clearBtn.style.display = 'inline-block';
      showToast('Mode Pengukuran Jarak Aktif. Klik peta untuk membuat titik rute.', 'info');
      // If dragging is enabled, we can leave it, or let user drag. Let's change pointer cursor.
      document.getElementById('map').style.cursor = 'ruler';
      // Clean temporary markers
      clearTemporaryMarker();
    } else {
      this.innerHTML = '<i class="fa-solid fa-ruler-combined"></i> Ukur Jarak: OFF';
      this.className = 'btn btn-sm btn-secondary d-flex align-items-center gap-1';
      if (measurePoints.length === 0) {
        clearBtn.style.display = 'none';
      }
      document.getElementById('map').style.cursor = '';
      showToast('Mode Pengukuran Dinonaktifkan.', 'info');
    }
  });

  // Clear measurement lines
  document.getElementById('clear-measure').addEventListener('click', function() {
    resetMeasurement();
    this.style.display = 'none';
  });
}

// Side Panel toggle
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar-btn');
  const toggleIcon = document.getElementById('toggle-icon');
  
  sidebar.classList.toggle('collapsed');
  
  if (sidebar.classList.contains('collapsed')) {
    toggleIcon.className = 'fa-solid fa-chevron-right';
    toggleBtn.style.left = '0';
  } else {
    toggleIcon.className = 'fa-solid fa-chevron-left';
    toggleBtn.style.left = '380px';
  }
  
  // Force map to recalculate sizes after transitions
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

// Create custom markers styled beautifully with HTML & CSS
function createCustomIcon(category) {
  const config = CATEGORIES[category] || CATEGORIES.custom;
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="marker-pin-wrapper">
        <div class="marker-pin-glow" style="background-color: ${config.color}"></div>
        <div class="marker-pin" style="background-color: ${config.color}">
          <i class="fa-solid ${config.icon}"></i>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

// Set temporary location coordinates in form
function setTemporaryLocation(lat, lng) {
  document.getElementById('location-lat').value = lat.toFixed(6);
  document.getElementById('location-lng').value = lng.toFixed(6);

  if (tempMarker) {
    map.removeLayer(tempMarker);
  }

  tempMarker = L.marker([lat, lng], {
    draggable: true
  }).addTo(map);

  tempMarker.bindPopup(`
    <div style="font-family: 'Outfit', sans-serif;">
      <strong>Lokasi Dipilih</strong><br>
      <span style="font-size: 0.8rem; color: #94a3b8;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span><br>
      <button class="btn btn-primary btn-sm w-100 mt-2 py-1" onclick="focusAddForm()" style="font-size: 0.75rem;">Isi Form Tambah</button>
    </div>
  `).openPopup();

  // Listen to dragend on temporary marker to update input fields
  tempMarker.on('dragend', function (e) {
    const newLatLng = e.target.getLatLng();
    document.getElementById('location-lat').value = newLatLng.lat.toFixed(6);
    document.getElementById('location-lng').value = newLatLng.lng.toFixed(6);
    tempMarker.getPopup().setContent(`
      <div style="font-family: 'Outfit', sans-serif;">
        <strong>Lokasi Dipilih (Digeser)</strong><br>
        <span style="font-size: 0.8rem; color: #94a3b8;">${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}</span><br>
        <button class="btn btn-primary btn-sm w-100 mt-2 py-1" onclick="focusAddForm()" style="font-size: 0.75rem;">Isi Form Tambah</button>
      </div>
    `);
  });
}

function focusAddForm() {
  document.getElementById('location-name').focus();
  showToast('Isi detail nama dan simpan lokasi baru.', 'info');
}

function clearTemporaryMarker() {
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
}

// CRUD Operations: Load Locations
function loadLocations() {
  const localData = localStorage.getItem('leaflet_map_locations');
  if (localData) {
    try {
      locations = JSON.parse(localData);
      locations.forEach(loc => {
        addMarkerToMap(loc);
      });
    } catch (e) {
      console.error("Gagal parsing local storage:", e);
      locations = [];
    }
  }
  renderLocationsList();
}

// CRUD: Add Marker to Leaflet
function addMarkerToMap(loc) {
  const icon = createCustomIcon(loc.category);
  const m = L.marker([loc.lat, loc.lng], { icon: icon }).addTo(map);
  
  // Custom styled popup
  const catLabel = CATEGORIES[loc.category]?.label || 'Lainnya';
  const popupHtml = `
    <div style="min-width: 180px;">
      <div class="popup-title">${loc.name}</div>
      <div class="mb-1"><span class="badge popup-badge badge-${loc.category}">${catLabel}</span></div>
      <div class="popup-desc">${loc.description || 'Tidak ada deskripsi.'}</div>
      <div class="text-muted mb-2" style="font-size: 0.7rem;"><i class="fa-solid fa-compass"></i> ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>
      <div class="d-flex gap-1">
        <button class="btn btn-secondary btn-sm py-1 px-2" style="font-size: 0.75rem; flex:1;" onclick="editLocation('${loc.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button class="btn btn-outline-danger btn-sm py-1 px-2" style="font-size: 0.75rem; flex:1;" onclick="deleteLocation('${loc.id}')">
          <i class="fa-solid fa-trash-can"></i> Hapus
        </button>
      </div>
    </div>
  `;

  m.bindPopup(popupHtml);
  markers[loc.id] = m;
}

// CRUD: Save New Location from form
function saveNewLocation(event) {
  event.preventDefault();
  
  const name = document.getElementById('location-name').value.trim();
  const category = document.getElementById('location-category').value;
  const lat = parseFloat(document.getElementById('location-lat').value);
  const lng = parseFloat(document.getElementById('location-lng').value);
  const description = document.getElementById('location-desc').value.trim();

  if (!name || !category || isNaN(lat) || isNaN(lng)) {
    showToast('Harap lengkapi semua field formulir!', 'error');
    return;
  }

  const id = Date.now().toString();
  const newLoc = { id, name, category, lat, lng, description, dateAdded: new Date().toISOString() };
  
  locations.push(newLoc);
  saveToLocalStorage();
  
  addMarkerToMap(newLoc);
  renderLocationsList();
  
  // Success state resets
  document.getElementById('add-location-form').reset();
  clearTemporaryMarker();
  showToast('Lokasi berhasil disimpan!', 'success');
  
  // Fly to new location
  map.flyTo([lat, lng], 14);
}

// CRUD: Delete Location
function deleteLocation(id) {
  const locIndex = locations.findIndex(loc => loc.id === id);
  if (locIndex === -1) return;
  
  const locName = locations[locIndex].name;
  
  // Close popup if open
  if (markers[id]) {
    markers[id].closePopup();
    map.removeLayer(markers[id]);
    delete markers[id];
  }
  
  locations.splice(locIndex, 1);
  saveToLocalStorage();
  renderLocationsList();
  showToast(`Lokasi "${locName}" berhasil dihapus`, 'info');
}

// CRUD: Edit Location Modal popup
let currentEditModal = null;
function editLocation(id) {
  const loc = locations.find(l => l.id === id);
  if (!loc) return;
  
  // Fill inputs in modal
  document.getElementById('edit-location-id').value = loc.id;
  document.getElementById('edit-location-name').value = loc.name;
  document.getElementById('edit-location-category').value = loc.category;
  document.getElementById('edit-location-lat').value = loc.lat;
  document.getElementById('edit-location-lng').value = loc.lng;
  document.getElementById('edit-location-desc').value = loc.description || '';
  
  // Close popup
  if (markers[id]) {
    markers[id].closePopup();
  }
  
  // Open Bootstrap modal
  currentEditModal = new bootstrap.Modal(document.getElementById('editModal'));
  currentEditModal.show();
}

// CRUD: Save Edited Location
function saveEditedLocation(event) {
  event.preventDefault();
  
  const id = document.getElementById('edit-location-id').value;
  const name = document.getElementById('edit-location-name').value.trim();
  const category = document.getElementById('edit-location-category').value;
  const lat = parseFloat(document.getElementById('edit-location-lat').value);
  const lng = parseFloat(document.getElementById('edit-location-lng').value);
  const description = document.getElementById('edit-location-desc').value.trim();
  
  const locIndex = locations.findIndex(l => l.id === id);
  if (locIndex === -1) return;
  
  // Remove old marker
  if (markers[id]) {
    map.removeLayer(markers[id]);
  }
  
  // Update data
  locations[locIndex] = {
    ...locations[locIndex],
    name,
    category,
    lat,
    lng,
    description
  };
  
  saveToLocalStorage();
  
  // Add new marker
  addMarkerToMap(locations[locIndex]);
  renderLocationsList();
  
  // Close Modal
  if (currentEditModal) {
    currentEditModal.hide();
  }
  
  showToast('Perubahan lokasi berhasil disimpan!', 'success');
  map.flyTo([lat, lng], 14);
}

// Save to local storage utility
function saveToLocalStorage() {
  localStorage.setItem('leaflet_map_locations', JSON.stringify(locations));
}

// Render Locations sidebar cards
function renderLocationsList(filtered = null) {
  const listContainer = document.getElementById('locations-list');
  const countBadge = document.getElementById('locations-count');
  const data = filtered || locations;
  
  countBadge.textContent = data.length;
  
  if (data.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-map"></i>
        <p>${filtered ? 'Tidak ada lokasi cocok dengan filter.' : 'Belum ada lokasi disimpan. Klik pada peta untuk menambahkan!'}</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  data.forEach(loc => {
    const catConfig = CATEGORIES[loc.category] || CATEGORIES.custom;
    const catLabel = catConfig.label;
    
    html += `
      <div class="location-item" onclick="zoomToLocation(${loc.lat}, ${loc.lng}, '${loc.id}')">
        <div class="location-item-header">
          <div class="location-item-title" title="${loc.name}">${loc.name}</div>
          <span class="badge-category badge-${loc.category}">
            <i class="fa-solid ${catConfig.icon}"></i> ${catLabel}
          </span>
        </div>
        <div class="location-item-desc">${loc.description || 'Tidak ada deskripsi.'}</div>
        <div class="location-item-actions" onclick="event.stopPropagation();">
          <button class="action-btn" onclick="editLocation('${loc.id}')" title="Edit Info">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn delete" onclick="deleteLocation('${loc.id}')" title="Hapus Lokasi">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  listContainer.innerHTML = html;
}

// Jump map focus to card location
function zoomToLocation(lat, lng, id) {
  map.flyTo([lat, lng], 15, {
    animate: true,
    duration: 1.2
  });
  
  // Highlight marker popup
  setTimeout(() => {
    if (markers[id]) {
      markers[id].openPopup();
    }
  }, 1200);
}

// Filter and Search mechanism for Saved Locations
function filterLocations() {
  const searchQuery = document.getElementById('list-search').value.toLowerCase().trim();
  const categoryFilter = document.getElementById('list-filter-category').value;
  
  const filtered = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery) || 
                          (loc.description && loc.description.toLowerCase().includes(searchQuery));
    const matchesCategory = categoryFilter === 'all' || loc.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  renderLocationsList(filtered);
}

// Nominatim Geocoding Search (Address lookup)
function searchAddress() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    showToast('Masukkan alamat atau nama tempat!', 'error');
    return;
  }

  showToast('Sedang mencari...', 'info');

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        map.setView([lat, lon], 13);
        
        // Auto fill form inputs
        document.getElementById('location-lat').value = lat.toFixed(6);
        document.getElementById('location-lng').value = lon.toFixed(6);
        document.getElementById('location-name').value = result.display_name.split(',')[0];
        
        if (tempMarker) {
          map.removeLayer(tempMarker);
        }
        
        tempMarker = L.marker([lat, lon]).addTo(map);
        tempMarker.bindPopup(`
          <div style="font-family: 'Outfit', sans-serif;">
            <strong>${result.display_name.split(',')[0]}</strong><br>
            <span style="font-size:0.75rem; color:#94a3b8; display:block; margin: 4px 0;">${result.display_name}</span>
            <button class="btn btn-primary btn-sm w-100 mt-2 py-1" onclick="focusAddForm()" style="font-size: 0.75rem;">Simpan ke Daftar</button>
          </div>
        `).openPopup();
        
        showToast('Lokasi ditemukan!', 'success');
      } else {
        showToast('Lokasi tidak dapat ditemukan!', 'error');
      }
    })
    .catch(err => {
      console.error("Geocoding Error:", err);
      showToast('Gagal memuat pencarian lokasi.', 'error');
    });
}

// HTML5 Geolocation tracker
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Browser Anda tidak mendukung Geolocation!', 'error');
    return;
  }
  
  showToast('Mengambil lokasi GPS...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      map.setView([lat, lng], 15);
      
      setTemporaryLocation(lat, lng);
      document.getElementById('location-name').value = "Lokasi GPS Saya";
      
      showToast('Berhasil mendeteksi lokasi Anda!', 'success');
    },
    (error) => {
      console.warn("GPS tracking error:", error);
      showToast('Gagal mendeteksi lokasi GPS Anda.', 'error');
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}

// Distance Measurement mode operations
function addMeasurePoint(latlng) {
  measurePoints.push(latlng);
  
  // 1. Draw circle node marker
  const cMarker = L.circleMarker(latlng, {
    color: '#6366f1',
    fillColor: '#fff',
    fillOpacity: 1,
    weight: 3,
    radius: 6,
    pane: 'popupPane'
  }).addTo(map);
  
  measureMarkers.push(cMarker);
  
  // 2. Draw connecting lines
  if (measurePoints.length > 1) {
    const lastIdx = measurePoints.length - 1;
    const from = measurePoints[lastIdx - 1];
    const to = measurePoints[lastIdx];
    
    // Calculate incremental distance
    const dist = from.distanceTo(to); // in meters
    measureTotalDistance += dist;
    
    // Draw polyline
    const line = L.polyline([from, to], {
      color: '#6366f1',
      weight: 4,
      dashArray: '5, 8'
    }).addTo(map);
    
    measureLines.push(line);
  }
  
  // 3. Add Cumulative Tooltip to node
  let label = '';
  if (measurePoints.length === 1) {
    label = 'Awal';
  } else {
    const km = measureTotalDistance / 1000;
    label = km >= 1 ? `${km.toFixed(2)} km` : `${measureTotalDistance.toFixed(0)} m`;
  }
  
  cMarker.bindTooltip(label, {
    permanent: true,
    direction: 'top',
    className: 'measurement-tooltip',
    offset: [0, -8]
  }).openTooltip();
}

function resetMeasurement() {
  measureMarkers.forEach(m => map.removeLayer(m));
  measureLines.forEach(l => map.removeLayer(l));
  
  measurePoints = [];
  measureMarkers = [];
  measureLines = [];
  measureTotalDistance = 0;
  
  showToast('Hasil ukur jarak dibersihkan', 'info');
}

// Toast alerts helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'info') icon = 'fa-circle-info';
  
  toast.className = `toast-custom ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div>${message}</div>
  `;
  
  container.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto destroy after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// File Utilities: Export Data as JSON
function exportData() {
  if (locations.length === 0) {
    showToast('Tidak ada lokasi untuk diekspor!', 'error');
    return;
  }
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(locations, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `aryahub_data_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchorElem.click();
  showToast('Data berhasil diekspor ke file JSON', 'success');
}

// File Utilities: Trigger file input click
function triggerImport() {
  document.getElementById('import-file').click();
}

// File Utilities: Import Data from JSON
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        // Simple structure validation
        const isValid = imported.every(loc => loc.id && loc.name && loc.category && typeof loc.lat === 'number' && typeof loc.lng === 'number');
        if (isValid) {
          // Confirm replace or merge
          if (confirm("Ingin menimpa data yang ada saat ini? (Batal = Menggabungkan data)")) {
            // Delete old data
            locations.forEach(loc => {
              if (markers[loc.id]) {
                map.removeLayer(markers[loc.id]);
              }
            });
            markers = {};
            locations = imported;
          } else {
            // Merge: avoid duplicated IDs
            imported.forEach(newLoc => {
              if (!locations.some(l => l.id === newLoc.id)) {
                locations.push(newLoc);
              }
            });
          }
          
          // Rebuild map markers
          locations.forEach(loc => {
            if (!markers[loc.id]) {
              addMarkerToMap(loc);
            }
          });
          
          saveToLocalStorage();
          renderLocationsList();
          showToast('Data lokasi berhasil diimpor!', 'success');
          
          // Zoom to first imported location
          if (locations.length > 0) {
            map.setView([locations[0].lat, locations[0].lng], 8);
          }
        } else {
          showToast('Format JSON tidak valid!', 'error');
        }
      } else {
        showToast('JSON harus berupa array lokasi!', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal membaca file JSON!', 'error');
    }
    // reset file input
    document.getElementById('import-file').value = '';
  };
  reader.readAsText(file);
}

// Wipe out data
function clearAllLocations() {
  if (locations.length === 0) {
    showToast('Daftar sudah kosong!', 'info');
    return;
  }
  
  if (confirm("Apakah Anda yakin ingin menghapus seluruh data lokasi yang tersimpan? Tindakan ini tidak bisa dibatalkan.")) {
    locations.forEach(loc => {
      if (markers[loc.id]) {
        map.removeLayer(markers[loc.id]);
      }
    });
    markers = {};
    locations = [];
    saveToLocalStorage();
    renderLocationsList();
    clearTemporaryMarker();
    showToast('Semua data lokasi telah dihapus!', 'info');
  }
}
