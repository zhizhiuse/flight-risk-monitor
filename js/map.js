// Map Component for Risk Visualization

class RiskMap {
  constructor(containerId) {
    this.map = L.map(containerId, {
      center: [30, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      worldCopyJump: true
    });

    // 主底图：CartoDB暗色（全球覆盖，效果最好）
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // 备用底图：ESRI暗灰（国内加载更稳定）
    // 如需切换，将上面替换为：
    // https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}

    this.markers = [];
    this.priorityColors = {
      'P0': '#ef4444',
      'P1': '#f59e0b',
      'P2': '#eab308'
    };
  }

  clearMarkers() {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];
  }

  addAirportMarker(code, lat, lng, priority, eventInfo) {
    const color = this.priorityColors[priority] || '#6b7280';
    const icon = this.createCustomIcon(color, priority);
    
    const marker = L.marker([lat, lng], { icon }).addTo(this.map);
    
    const popupContent = `
      <div class="popup-title">${code}</div>
      <span class="popup-priority ${priority.toLowerCase()}">${priority} ${eventInfo.category}</span>
      <div class="popup-summary">${eventInfo.title}</div>
    `;
    
    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'dark-popup'
    });
    
    this.markers.push(marker);
    return marker;
  }

  createCustomIcon(color, priority) {
    if (priority === 'P0') {
      // P0：脉冲动画标记
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="p0-marker">
            <div class="p0-pulse" style="background-color: ${color};"></div>
            <div class="p0-core" style="background-color: ${color};"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    }
    // P1/P2：静态圆点
    const size = priority === 'P1' ? 16 : 12;
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 2px solid rgba(255,255,255,0.8);
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }

  fitBounds() {
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.2));
    }
  }
}

// Global map instance
let riskMap = null;

function initMap() {
  riskMap = new RiskMap('riskMap');
}

function updateMapMarkers(events) {
  if (!riskMap) return;
  
  riskMap.clearMarkers();
  
  const markerMap = new Map();
  
  events.forEach(event => {
    if (event.coordinates && Array.isArray(event.coordinates)) {
      event.coordinates.forEach(coord => {
        const key = coord.code;
        
        if (!markerMap.has(key) || getPriorityWeight(event.priority) > getPriorityWeight(markerMap.get(key).priority)) {
          markerMap.set(key, {
            lat: coord.lat,
            lng: coord.lng,
            priority: event.priority,
            event: event
          });
        }
      });
    }
  });
  
  markerMap.forEach((data, code) => {
    riskMap.addAirportMarker(code, data.lat, data.lng, data.priority, data.event);
  });
  
  riskMap.fitBounds();
}

function getPriorityWeight(priority) {
  const weights = { 'P0': 3, 'P1': 2, 'P2': 1 };
  return weights[priority] || 0;
}
