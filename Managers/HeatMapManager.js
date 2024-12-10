import '../dist/leaflet-heat.js';

/**
 * Beacon configuration object containing measured power values
 * @constant {Object}
 */
const BEACON_CONFIG = {
    referenceAntenna: {
        name: 'Standard Reference Antenna',
        measuredPower: -40
    },
    beacons: {
        GO_500: {
            name: 'blukii Go 500',
            measuredPower: -45
        },
        BOX: {
            name: 'blukii Box',
            measuredPower: -47
        },
        COIN_250: {
            name: 'blukii Coin250',
            measuredPower: -53
        },
        BEACON_4: {
            name: 'Beacon Type 4',
            measuredPower: -49
        },
        BEACON_5: {
            name: 'Beacon Type 5',
            measuredPower: -51
        },
        BEACON_6: {
            name: 'Beacon Type 6',
            measuredPower: -48
        }
    }
};

/**
 * Global configuration for heatmap calculations
 * @constant {Object}
 */
const HEATMAP_CONFIG = {
    RSSI_LIMIT: -90,    // Global RSSI limit for maximum radius
    N_FACTOR: 3         // Environmental factor
};

/**
 * Calculate distance using the BLE propagation formula
 * @param {number} rssi - RSSI value to calculate distance for
 * @param {number} measuredPower - Measured power of the beacon
 * @param {number} n - Environmental factor
 * @returns {number} Distance in meters
 */
const calculateDistance = (rssi, measuredPower, n) => {
    return Math.pow(10, (measuredPower - rssi) / (10 * n));
};

/**
 * Calculate the heatmap radius for a given RSSI value and beacon type
 * @param {number} rssi - Measured RSSI value from reference antenna
 * @param {string} beaconType - Key of the beacon type from BEACON_CONFIG.beacons
 * @returns {Object} Contains the calculated radius and intermediate values for debugging
 * @throws {Error} If beacon type is invalid or calculations fail
 */
const calculateHeatmapRadius = (rssi, beaconType) => {
  try {
      // Validate beacon type
      if (!BEACON_CONFIG.beacons[beaconType]) {
          throw new Error(`Invalid beacon type: ${beaconType}`);
      }

      // Get beacon configuration
      const beaconMP = BEACON_CONFIG.beacons[beaconType].measuredPower;
      const referenceMP = BEACON_CONFIG.referenceAntenna.measuredPower;

      // Calculate MP compensation
      const mpCompensation = referenceMP - beaconMP;
      
      // Apply compensation to RSSI
      const compensatedRSSI = rssi - mpCompensation;

      // Calculate distance for the compensated RSSI
      const measurementDistance = calculateDistance(
          compensatedRSSI,
          beaconMP,
          HEATMAP_CONFIG.N_FACTOR
      );

      // Calculate maximum distance (using RSSI limit)
      const maxDistance = calculateDistance(
          HEATMAP_CONFIG.RSSI_LIMIT,
          beaconMP,
          HEATMAP_CONFIG.N_FACTOR
      );

      // Calculate final radius
      const radius = maxDistance - measurementDistance;

      // If the radius is close to zero, make it zero (Invisible)
      if (radius < 0.1) {
          return { radius: 0, debug: { compensatedRSSI, measurementDistance, maxDistance, mpCompensation }};
      }

      return {
          radius: Number(radius.toFixed(2)),
          debug: {
              compensatedRSSI,
              measurementDistance: Number(measurementDistance.toFixed(2)),
              maxDistance: Number(maxDistance.toFixed(2)),
              mpCompensation
          }
      };
  } catch (error) {
      throw new Error(`Heatmap radius calculation failed: ${error.message}`);
  }
};



class RSSIHeatmapManager {
  constructor(map) {
    this.map = map;
    this.heatmapLayer = null;
    this.rssiPoints = [];
    this.markers = [];
    this.beaconType = 'GO_500';
    this.heatmapRadius = 1
    this.map.on('zoomend', () => {
      this.updateHeatmap();
    }); // Default beacon type
  }

  // Color mapping function for RSSI values
  getRSSIColor(rssiValue) {
    const clampedValue = Math.min(Math.max(rssiValue, -90), -10);
    const normalizedValue = (clampedValue - (-90)) / ((-10) - (-90));
    
    const r = Math.round(255 * (1 - normalizedValue));
    const g = Math.round(255 * normalizedValue);
    
    return `rgb(${r}, ${g}, 0)`;
  }

  // Calculate heatmap intensity based on RSSI value
  calculateHeatmapIntensity(rssiValue) {
    const clampedValue = Math.min(Math.max(rssiValue, -90), -10);
    const intensity = 1 - ((clampedValue - (-10)) / (-90 - (-10)));
    
    return Math.max(0.1, Math.min(intensity, 1));
  }

  addRSSIPoint(latlng, rssiValue, beaconType = this.beaconType) {
    const { radius } = calculateHeatmapRadius(rssiValue, beaconType);

    // Skip adding point if radius is zero
    if (radius === 0) {
        console.log(`Point with RSSI value ${rssiValue} skipped due to zero radius`);
        return;
    }

    const point = [
        latlng.lat,
        latlng.lng,
        this.calculateHeatmapIntensity(rssiValue, radius),
    ];

    this.rssiPoints.push(point);
    console.log(this.rssiPoints);
    this.updateHeatmap(radius);

    return point;
}


  // Create a custom marker to show RSSI point details
  createRSSIMarker(latlng, rssiValue, beaconType = this.beaconType) {
    const color = this.getRSSIColor(rssiValue);
    
    // Calculate radius for display
    const { radius, debug } = calculateHeatmapRadius(rssiValue, beaconType);

    const customIcon = L.divIcon({
      className: 'rssi-marker',
      html: `
        <div style="
          width: 15px; 
          height: 15px; 
          border-radius: 50%; 
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 0 5px rgba(0,0,0,0.5);
        "></div>
      `,
      iconSize: [15, 15],
      iconAnchor: [7.5, 7.5]
    });
  
    const marker = L.marker(latlng, { 
      icon: customIcon,
      draggable: true 
    }).addTo(this.map);
  
    // Add marker to the tracking array
    this.markers.push(marker);
  
    // Add drag event to update heatmap
    marker.on('drag', (e) => {
        // Find the point in rssiPoints that corresponds to this marker
        const pointIndex = this.markers.indexOf(marker);
        if (pointIndex !== -1) {
          // Update the point's latitude and longitude
          this.rssiPoints[pointIndex][0] = e.target.getLatLng().lat;
          this.rssiPoints[pointIndex][1] = e.target.getLatLng().lng;
          
          // Refresh the heatmap
          this.updateHeatmap(radius);
        }
      });
  
    // Popup with RSSI details
    marker.bindPopup(`
      <div>
        <strong>RSSI Value:</strong> ${rssiValue} dBm<br>
        <strong>Beacon Type:</strong> ${BEACON_CONFIG.beacons[beaconType].name}<br>
        <strong>Radius:</strong> ${radius} meters<br>
        <div style="
          width: 100%; 
          height: 20px; 
          background-color: ${color};
          margin-top: 5px;
        "></div>
        <div style="font-size: 0.8em; margin-top: 5px;">
          <strong>Debug Info:</strong><br>
          Compensated RSSI: ${debug.compensatedRSSI} dBm<br>
          Measurement Distance: ${debug.measurementDistance} m<br>
          Max Distance: ${debug.maxDistance} m
        </div>
      </div>
    `);
  
    // Allow updating RSSI value and beacon type
    marker.on('popupopen', () => {
      const popupContent = marker.getPopup().getElement();
      const updateButton = document.createElement('button');
      updateButton.textContent = 'Update RSSI/Beacon';
      updateButton.onclick = () => this.showRSSIUpdateForm(marker, rssiValue, beaconType);
      if (!marker.updateButtonAdded) {
      popupContent.appendChild(updateButton);
      marker.updateButtonAdded = true;
    }
    });

  
    return marker;
  }


  getRadiusInPixels(meters) {
    const center = this.map.getCenter(); // Use map center as a reference point
    const centerPoint = this.map.latLngToLayerPoint(center);
    const edgePoint = this.map.latLngToLayerPoint(
      L.latLng(center.lat, center.lng + (meters / 111320)) // Convert meters to degrees
    );
    return Math.abs(centerPoint.x - edgePoint.x); // Return pixel distance
  }

  setHeatmapRadius(radius) {
    this.heatmapRadius = radius;
    this.updateHeatmap();
  }

  // Update heatmap method to use fixed configuration
  updateHeatmap() {
    // Remove the existing heatmap layer if it exists
    if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
    }

    // If there are no points, do not update the heatmap
    if (this.rssiPoints.length === 0) {
        console.log('No RSSI points available to generate the heatmap.');
        return;
    }

    // Calculate the radius from the first point (assuming it's the point of interest for radius)
    const rssiValue = parseFloat(this.markers[0].getPopup().getContent().match(/-?\d+/)[0]);
    const { radius } = calculateHeatmapRadius(rssiValue, this.beaconType);

    // Set the specific radius for -89 RSSI value
    const customRadius = (rssiValue >= -89) ?  this.heatmapRadius : radius; // For RSSI >= -89, set radius 

    // Convert the radius to pixels
    const radiusInPixels = this.getRadiusInPixels(customRadius);

    // Create the heatmap layer with the new radius and intensity drop-off
    this.heatmapLayer = L.heatLayer(this.rssiPoints, {
        radius: radiusInPixels,
        blur: 30,
        maxZoom: 1,
        minOpacity: 0.1, 
        gradient: {
            0.1: 'red',
            0.4: 'orange',
            0.7: 'yellow',
            1.0: 'green',
        },
    }).addTo(this.map);
}


  // Show form to update RSSI value and beacon type
  showRSSIUpdateForm(marker, currentRSSI, currentBeaconType) {
    const popup = marker.getPopup();
    const popupContent = popup.getElement();
    
    // Create beacon type options
    const beaconTypeOptions = Object.keys(BEACON_CONFIG.beacons)
      .map(key => `<option value="${key}" ${key === currentBeaconType ? 'selected' : ''}>${BEACON_CONFIG.beacons[key].name}</option>`)
      .join('');
    
    // Clear existing content
    popupContent.innerHTML = `
      <form id="rssiUpdateForm">
        <div>
          <label for="rssiInput">RSSI Value (dBm):</label>
          <input 
            type="number" 
            id="rssiInput" 
            min="-90" 
            max="-10" 
            value="${currentRSSI}"
          >
        </div>
        <div>
          <label for="beaconTypeSelect">Beacon Type:</label>
          <select id="beaconTypeSelect">
            ${beaconTypeOptions}
          </select>
        </div>
        <button type="submit">Save</button>
      </form>
    `;
  
    const form = popupContent.querySelector('#rssiUpdateForm');
    form.onsubmit = (e) => {
      e.preventDefault();
      const newRSSI = parseFloat(form.querySelector('#rssiInput').value);
      const newBeaconType = form.querySelector('#beaconTypeSelect').value;
      
      // Find the corresponding point
      const index = this.markers.indexOf(marker);
      
      if (index !== -1) {
        // Regenerate points with new RSSI and beacon type
        const { radius } = calculateHeatmapRadius(newRSSI, newBeaconType);
        const newPoints = this.generateFixedRadiusPoints(
          marker.getLatLng(), 
          radius, 
          newRSSI
        );
        
        // Replace old points
        this.rssiPoints.splice(index * 20, 20, ...newPoints);
        
        // Update marker icon and popup
        const newColor = this.getRSSIColor(newRSSI);
        const newIcon = L.divIcon({
          className: 'rssi-marker',
          html: `
            <div style="
              width: 20px; 
              height: 20px; 
              border-radius: 50%; 
              background-color: ${newColor};
              border: 2px solid white;
              box-shadow: 0 0 5px rgba(0,0,0,0.5);
            "></div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        marker.setIcon(newIcon);
        
        // Refresh heatmap
        this.updateHeatmap(radius);
        
        // Update popup content
        marker.getPopup().setContent(this.createPopupContent(newRSSI, newBeaconType));
      }
    };
  }

  // Helper method to create popup content
  createPopupContent(rssiValue, beaconType) {
    const { radius, debug } = calculateHeatmapRadius(rssiValue, beaconType);
    const color = this.getRSSIColor(rssiValue);

    return `
      <div>
        <strong>RSSI Value:</strong> ${rssiValue} dBm<br>
        <strong>Beacon Type:</strong> ${BEACON_CONFIG.beacons[beaconType].name}<br>
        <strong>Radius:</strong> ${radius} meters<br>
        <div style="
          width: 100%; 
          height: 20px; 
          background-color: ${color};
          margin-top: 5px;
        "></div>
        <div style="font-size: 0.8em; margin-top: 5px;">
          <strong>Debug Info:</strong><br>
          Compensated RSSI: ${debug.compensatedRSSI} dBm<br>
          Measurement Distance: ${debug.measurementDistance} m
        </div>
      </div>
    `;
  }

  // Set beacon type
  setBeaconType(beaconType) {
    if (BEACON_CONFIG.beacons[beaconType]) {
      this.beaconType = beaconType;
    } else {
      console.error('Invalid beacon type');
    }
  }

  // Export RSSI points for saving
  exportRSSIPoints() {
    return this.rssiPoints.map((point, index) => ({
      lat: point[0],
      lng: point[1],
      rssi: this.markers[index].getPopup().getContent().match(/-?\d+/)[0]
    }));
  }

  // Import RSSI points
  importRSSIPoints(points) {
    this.clearRSSIPoints();
    points.forEach(point => {
      this.addRSSIPoint(
        { lat: point.lat, lng: point.lng }, 
        point.rssi
      );
    });
  }
}

export default RSSIHeatmapManager;