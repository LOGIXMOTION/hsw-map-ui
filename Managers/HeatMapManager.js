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
        this.heatmapRadius = 1;
        this.map.on('zoomend', () => {
            this.updateHeatmap();
          });
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
    // Calculate the radius based on RSSI value and beacon type
    const { radius } = calculateHeatmapRadius(rssiValue, beaconType);

    // Construct the heatmap point
    const point = [
        latlng.lat,
        latlng.lng,
        radius === 0 ? 0 : this.calculateHeatmapIntensity(rssiValue, radius),
    ];

    // Add the point to the list (even if intensity is zero)
    this.rssiPoints.push(point);
    console.log("Updated RSSI Points:", this.rssiPoints);

    // Update the heatmap only for valid radius
    if (radius > 0) {
        this.updateHeatmap(radius);
    }

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
        const pointIndex = this.markers.indexOf(marker);
        if (pointIndex !== -1) {
            this.rssiPoints[pointIndex][0] = e.target.getLatLng().lat;
            this.rssiPoints[pointIndex][1] = e.target.getLatLng().lng;

            // Refresh the heatmap
            this.updateHeatmap();
        }
    });

    // Popup with RSSI details and delete option
    marker.bindPopup(() => {
        const markerId = marker._leaflet_id; // Use unique Leaflet marker ID
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
                    Measurement Distance: ${debug.measurementDistance} m<br>
                    Max Distance: ${debug.maxDistance} m
                </div>
                <button id="delete-point-${markerId}" 
                        style="
                            margin-top: 10px; 
                            background-color: red; 
                            color: white; 
                            border: none; 
                            padding: 5px 10px;
                            cursor: pointer;">
                    Delete Point
                </button>
            </div>
        `;
    });

    // Listen for the popupopen event to attach the delete functionality
    marker.on('popupopen', () => {
        const markerId = marker._leaflet_id; // Use unique Leaflet marker ID
        const deleteButton = document.getElementById(`delete-point-${markerId}`);
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                this.deleteRSSIPoint(marker);
            });
        }
    });

    return marker;
}


deleteRSSIPoint(marker) {
  // Find the index of the marker
  const index = this.markers.indexOf(marker);

  if (index !== -1) {
      // Remove the marker from the map
      this.map.removeLayer(marker);

      // Remove the marker and RSSI point from their respective arrays
      this.markers.splice(index, 1);
      this.rssiPoints.splice(index, 1);

      // Update the heatmap
      this.updateHeatmap();
  } else {
      console.error("Failed to find the marker for deletion.");
  }
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

    // Filter out points with radius or intensity of 0
    const validPoints = this.rssiPoints.filter(point => point[2] > 0);

    // If no valid points remain, skip heatmap creation
    if (validPoints.length === 0) {
        console.log('No valid RSSI points to display on the heatmap.');
        return;
    }

    // Create the heatmap layer with filtered points
    this.heatmapLayer = L.heatLayer(validPoints, {
        radius: this.getRadiusInPixels(this.heatmapRadius),
        blur: 20,
        maxZoom: 16,
        minOpacity: 0.0, // Fully transparent for intensity 0
        gradient: {
            0.1: 'red',
            0.4: 'orange',
            0.7: 'yellow',
            1.0: 'green',
        },
    }).addTo(this.map);
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
    points.forEach(point => {
      this.addRSSIPoint(
        { lat: point.lat, lng: point.lng }, 
        point.rssi
      );
    });
  }
}

export default RSSIHeatmapManager;