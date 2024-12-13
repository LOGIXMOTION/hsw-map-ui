import CONFIG from "../config.js";
import APIManager from "./APIManager.js";
import NotificationManager from "./NotificationManager.js";

// Drawing Manager
class DrawingManager {
  constructor(map) {
    this.map = map;
    this.drawingHistory = [];
    this.currentColor = CONFIG.custom.Color;
    this.currentOpacity = CONFIG.custom.Opacity;
    this.hoverColor;
    this.setupDrawingControls();
    this.setupEventListeners();
    this.IDTP = new BroadcastChannel("IDTP_CHANNEL");
    this.IDTP.onmessage = (event) => {
      if (event.data.method == "assetsData") {
        this.assetsData = event.data.data;
      }
    };

    this.ICMP = new BroadcastChannel("ICMP");
    this.ICMP.onmessage = (e) => {
      if (e.data.method == "showAssetOnMap") {
        if (e.data.data.zone !== "Outside Range") {
          console.log(e.data);
          this.zon = e.data.data.zone;
          this.poly = CONFIG.zones.ZoneBeans[this.zon].polygon;
          this.polyColor = CONFIG.zones.ZoneBeans[this.zon].color;
          console.log("PARKER BARKER CSA", this.polyColor);
          this.popop();
        }
      }
    };
    this.apiManager = new APIManager();
    this.notificationManager = new NotificationManager();
    this.currentUIMode = "map";
    // Initialize zones array if it doesn't exist
    if (!CONFIG.zones) {
      CONFIG.zones = { zoneNames: [] };
    }
  }

  setupDrawingControls() {
    this.map.pm.addControls({
      position: "topright",
    });

    const drawingOptions = {
      pathOptions: {
        color: this.currentColor,
        fillColor: this.currentColor,
        fillOpacity: this.currentOpacity,
      },
      snappable: false,
      finishOn: "mouseout",
    };

    this.map.pm.enableDraw("Polygon", drawingOptions);
    this.map.pm.disableDraw("Polygon");

    this.map.pm.enableDraw("Marker", {
      snappable: false,
    });
    this.map.pm.disableDraw("Marker");
  }

  setupEventListeners() {
    this.map.on("pm:create", (e) => {
      const { layer } = e;

      if (layer.setStyle) {
        layer.setStyle({
          color: this.currentColor,
          fillColor: this.currentColor,
          fillOpacity: this.currentOpacity,
        });
      }

      // Add hover effect and popup handling
      let popup = null;

      // layer.on('mouseover', () => {
      //   if (layer.setStyle) {
      //     this.hoverColor = layer.options.color;
      //     const lighterColor = this.lightenColor(this.hoverColor, 0.3);
      //     layer.setStyle({
      //       fillColor: lighterColor,
      //     });
      //   }
      // });

      layer.on("click", (e) => {
        // Only show the form popup if the zone hasn't been named yet
        if (!layer.zoneName) {
          const center = layer.getBounds().getCenter();
          const popupContent = this.createZoneForm();

          popup = L.popup({
            maxWidth: 300,
            className: "zone-popup",
            keepInView: true,
          })
            .setLatLng(center)
            .setContent(popupContent);

          layer
            .bindPopup(popup)
            .off("popupopen")
            .on("popupopen", () => {
              // Add event listener specifically to the popup
              const popup = document.querySelector(".zone-popup");
            });
          layer.openPopup();

          // Setup form handling
          this.setupZoneFormHandling(layer);
        } else {
          // If zone is already named, show the zone name on hover
          const center = layer.getBounds().getCenter();
          popup = L.popup({
            maxWidth: 300,
            className: "zone-popup",
          }).setLatLng(center).setContent(`<div class="zoneNameDisplay">
                              <div class="zoneName">${layer.zoneName}</div>
                              <button type="button" class="delete-btn" onclick="deleteZoneButton('${layer.zoneName}')">Delete</button>
                            </div>
                            `);

          // const boundHandleDeleteClick = this.handleDeleteClick.bind(this);

          // popup.addEventListener('click', (event) => {
          //   if (event.target.closest('.zoneNameDisplay')) {
          //     boundHandleDeleteClick(event);
          //   }
          // });

          layer.bindPopup(popup);
          layer.openPopup();
        }
      });

      layer.on("mouseout", (e) => {
        if (layer.setStyle) {
          layer.setStyle({
            fillColor: this.hoverColor,
          });
        }

        // Add a small delay before closing the popup to allow for form interaction
        setTimeout(() => {
          // Only close the popup if the mouse isn't over the popup
          const popupElement = document.getElementById("zoneForm");
          if (popupElement && popupElement.matches(":hover")) {
            layer.closePopup();
          }
        }, 100);
      });

      this.drawingHistory.push(layer);

      layer.on("pm:edit", () => {
        const index = this.drawingHistory.indexOf(layer);
        if (index > -1) {
          this.drawingHistory[index] = layer;
        }
      });
    });
  }

  getAssetsByZones(zoneName) {
    const assets = this.assetsData[zoneName];
    var p = ``;
    if (assets) {
      assets.forEach((asset) => {
        if (asset.humanFlag) {
          p += `<div class="mac-address"> ${asset.macAddress} <span class="asset-nam">${asset.assetName}</span> </div>`;
        } else {
          p += `<div class="mac-address"> ${asset.macAddress}</div>`;
        }
      });
      p += `</ul>`;
    } else {
      p += `<p>No assets in this zone</p>`;
    }

    return p;
  }

  popop = () => {
    const zone = this.zon;
    const polygon = this.poly;

    var popupContent = `<div class="zoneNameDisplay">
    <div class="zoneName">${zone}</div>
    <button type="button" class="delete-btn delete-zone" onclick="deleteZoneButton('${zone}')">Delete</button>
    </div>`;
    var poopi = ``;
    if (this.assetsData[zone]) {
      poopi = `<div class="zone-box" id="Embedded" style="background-color:${
        this.polyColor
      }">
                <div class="zone-header">
                    <div class="zone-name">${zone} (${
        this.assetsData[zone].length
      })</div>
                    
                </div>
                <div class="mac-list">
                  ${this.getAssetsByZones(zone)}
                </div>
            </div>`;
    } else {
      poopi = `<div class="zone-box" id="Embedded" style="background-color:${this.polyColor}">
      
                      <div class="zone-header">
                    <div class="zone-name">${zone} (0)</div>
                    
                </div>
                <div class="mac-list">
                  <p>No assets in this zone</p>
                </div>
            </div>`;
    }
    if (this.currentUIMode == "map") {
      polygon.unbindPopup(); // Unbind any existing popup
      polygon
        .bindPopup(popupContent, {
          maxWidth: 300,
          className: "zone-popup",
          keepInView: true,
        })
        .openPopup();
    } else if (this.currentUIMode == "asset") {
      polygon.unbindPopup(); // Unbind any existing popup
      polygon
        .bindPopup(poopi, {
          maxWidth: 300,
          className: "zone-popup",
          keepInView: true,
        })
        .openPopup();
    }
  };

  processZoneData(zones) {
    zones.forEach((zone) => {
      console.log(zone);
      CONFIG.zones.ZoneBeans[zone.name] = {};
      let polygon;
      let center;
      if (zone && zone.name !== "Outside Range") {
        if (zone.zoneData.vertices.lng === 0) {
          CONFIG.zones.ZoneBeans[zone.name].center = zone.zoneData.vertices[1];
          center = CONFIG.zones.ZoneBeans[zone.name].center;

          const radius = zone.zoneData.vertices[0].lat;
          polygon = L.circle(center, {
            color: zone.zoneData.color || "#ff0000",
            fillColor: zone.zoneData.color || "#ff0000",
            fillOpacity: zone.zoneData.opacity || 0.5,
            radius: radius,
          }).addTo(this.map);
        } else {
          // Create polygon from vertices
          const vertices = zone.zoneData.vertices.map((vertex) => [
            vertex.lat,
            vertex.lng,
          ]);
          polygon = L.polygon(vertices, {
            color: zone.zoneData.color || "#ff0000",
            fillColor: zone.zoneData.color || "#ff0000",
            fillOpacity: zone.zoneData.opacity || 0.5,
          }).addTo(this.map);

          center = polygon.getBounds().getCenter();
        }

        if (!CONFIG.zones.ZoneBeans[zone.name]) {
          CONFIG.zones.ZoneBeans[zone.name] = {};
        }
        CONFIG.zones.ZoneBeans[zone.name].polygon = polygon;
        CONFIG.zones.ZoneBeans[zone.name].color = zone.zoneData.color;
        polygon.zoneName = zone.name;
        CONFIG.zones.ZoneBeans[zone.name].center = center;
        polygon.count = zone.count;
        CONFIG.zones.ZoneBeans[zone.name].clicked = false;
        // Add click effect and popup handling like manual zones
        polygon.on("click", () => {
          this.zon = zone.name;
          this.poly = polygon;
          this.polyColor = zone.zoneData.color;
          this.popop();
        });

        // Add to drawing history
        this.drawingHistory.push(polygon);

        // Add to CONFIG zones
        if (!CONFIG.zones.zoneNames.includes(zone.name)) {
          CONFIG.zones.zoneNames.push(zone.name);
        }

        // Store polygon reference in CONFIG for easy access
        CONFIG.zones.ZoneBeans[zone.name].polygon = polygon;

        if (!this.drawingHistory.some((layer) => layer === polygon)) {
          this.drawingHistory.push(polygon);
        }
      }
    });
  }

  findPolygonByZoneName(zoneName) {
    let foundPolygon = null;

    // First check CONFIG.zones.ZoneBeans
    if (
      CONFIG.zones.ZoneBeans[zoneName] &&
      CONFIG.zones.ZoneBeans[zoneName].polygon
    ) {
      foundPolygon = CONFIG.zones.ZoneBeans[zoneName].polygon;
    }

    // If not found in CONFIG, search through all map layers
    if (!foundPolygon) {
      this.map.eachLayer((layer) => {
        if (layer instanceof L.Polygon && layer.zoneName === zoneName) {
          foundPolygon = layer;
        }
      });
    }

    return foundPolygon;
  }

  findMarkerById(id) {
    let foundMarker = null;
    this.map.eachLayer((layer) => {
      console.log("Layer: ", layer);
      if (layer instanceof L.Marker && layer.id === id) {
        foundMarker = layer;
        console.log("Found marker: ", foundMarker);
      }
    });
    return foundMarker;
  }

  createZoneForm() {
    return `
        <form id="zoneForm" class="zone-form">
            <div class="form-group">
                <label for="zoneName">Zone Name:</label>
                <input type="text" id="zoneName" name="zoneName" required>
            </div>
            <button type="submit" class="submit-btn">Save Zone</button>
        </form>
      `;
  }

  updateZoneDropdowns() {
    // Find all zone dropdowns in marker popups
    const zoneDropdowns = document.querySelectorAll('select[name="zone"]');

    zoneDropdowns.forEach((dropdown) => {
      // Save current selection
      const currentSelection = dropdown.value;

      // Clear existing options
      dropdown.innerHTML = '<option value="">Select a zone</option>';

      // Add all zones
      CONFIG.zones.zoneNames.forEach((zoneName) => {
        const option = document.createElement("option");
        option.value = zoneName;
        option.textContent = zoneName;
        dropdown.appendChild(option);
      });

      // Restore previous selection if it still exists
      if (
        currentSelection &&
        CONFIG.zones.zoneNames.includes(currentSelection)
      ) {
        dropdown.value = currentSelection;
      }
    });
  }

  getPolygonVertices(polygon) {
    // Get all vertices of the polygon
    const latLngs = polygon.getLatLngs()[0];
    return latLngs.map((latLng) => ({
      lat: latLng.lat,
      lng: latLng.lng,
    }));
  }

  deleteZoneOnServer(zoneName) {
    return this.apiManager.request("/zones/" + zoneName, { method: "DELETE" });
  }

  deleteMarkerOnServer(markerId) {
    return this.apiManager.request("/hubs/" + markerId, { method: "DELETE" });
  }

  async deleteZoneButton(zoneName, e) {
    // If event exists, prevent propagation
    if (e) {
      e.stopPropagation();
    }

    if (zoneName) {
      // Find the polygon using the existing method
      const polygon = this.findPolygonByZoneName(zoneName);

      if (polygon) {
        // Confirm deletion
        const confirmDelete = window.confirm(
          `Are you sure you want to delete the zone "${zoneName}"?`
        );

        if (confirmDelete) {
          try {
            const response = await this.deleteZoneOnServer(zoneName);
            if (response && response.message === "Zone deleted") {
              console.log(`Zone "${zoneName}" deleted successfully`);
              window.alert(`Zone "${zoneName}" deleted successfully`);

              // Force close any open popups
              polygon.closePopup();

              // Remove the polygon from the map immediately
              this.map.removeLayer(polygon);

              // Clean up CONFIG references
              if (CONFIG.zones.ZoneBeans[zoneName]) {
                // Remove the polygon reference
                CONFIG.zones.ZoneBeans[zoneName].polygon = null;
                delete CONFIG.zones.ZoneBeans[zoneName];
              }

              // Remove from zoneNames array
              const index = CONFIG.zones.zoneNames.indexOf(zoneName);
              if (index > -1) {
                CONFIG.zones.zoneNames.splice(index, 1);
              }

              // Remove from drawing history
              const historyIndex = this.drawingHistory.findIndex(
                (layer) =>
                  layer instanceof L.Polygon && layer.zoneName === zoneName
              );
              if (historyIndex > -1) {
                this.drawingHistory.splice(historyIndex, 1);
              }

              // Update all zone dropdowns
              this.updateZoneDropdowns();

              // Return true to indicate successful deletion
              return { message: "Zone deleted" };
            }
          } catch (error) {
            console.error(`Error deleting zone "${zoneName}":`, error);
            window.alert(
              `Failed to delete zone "${zoneName}". Please try again.`
            );
            return error;
          }
        }
      } else {
        // If polygon wasn't found on the map but exists in CONFIG, clean up CONFIG
        if (CONFIG.zones.ZoneBeans[zoneName]) {
          delete CONFIG.zones.ZoneBeans[zoneName];
          const index = CONFIG.zones.zoneNames.indexOf(zoneName);
          if (index > -1) {
            CONFIG.zones.zoneNames.splice(index, 1);
          }
          this.updateZoneDropdowns();
        }
        return { message: "Zone deleted" };
      }
    }
  }

  async deleteHubButton(id, e) {
    if (id) {
      // Prevent event bubbling
      e.stopPropagation();

      // Confirm deletion only once
      const confirmDelete = window.confirm(
        `Are you sure you want to delete the hub "${id}"?`
      );

      if (confirmDelete) {
        const type = id.substring(0, 3) === "hub" ? "Hub" : "Beacon";
        try {
          const response = await this.deleteMarkerOnServer(id);
          console.log(`${type} "${id}" deleted successfully`);
          // Only show success message, no need for additional confirmation
          console.log("response", response);
          return response;
        } catch (error) {
          console.error(`Error deleting ${type} "${id}":`, error);
          window.alert(`Failed to delete ${type} "${id}". Please try again.`);
          return error;
        }
      }
    }
  }

  // async handleDeleteClick(e) {
  //   const deleteZoneBtn = e.target.closest('.delete-zone');
  //   const deleteMarkerBtn = e.target.closest('.delete-marker');

  //   if (deleteZoneBtn) {
  //     const zoneElement = deleteZoneBtn.closest('.zoneNameDisplay');
  //     if (zoneElement) {
  //       const zoneName = zoneElement.querySelector('.zoneName').textContent;

  //       // Confirm deletion
  //       const confirmDelete = window.confirm(
  //         `Are you sure you want to delete the zone "${zoneName}"?`
  //       );

  //       if (confirmDelete) {
  //         try {
  //           const response = await this.deleteZoneOnServer(zoneName);
  //           console.log(`Zone "${zoneName}" deleted successfully`);
  //           window.alert(`Zone "${zoneName}" deleted successfully`);
  //           console.log('response', response);
  //           if (response && response.message === 'Zone deleted') {
  //             // Remove the zone from the map
  //             const polygon = this.findPolygonByZoneName(zoneName);
  //             if (polygon) {
  //               polygon.remove();
  //             }
  //           }
  //         } catch (error) {
  //           console.error(`Error deleting zone "${zoneName}":`, error);
  //           window.alert(
  //             `Failed to delete zone "${zoneName}". Please try again.`
  //           );
  //         }
  //       }
  //     }
  //   } else if (deleteMarkerBtn) {
  //     const markerElement = deleteMarkerBtn.closest('.leaflet-marker-icon');
  //     const markerForm = deleteMarkerBtn.closest('.marker-form');

  //     if (markerElement) {
  //       // Get marker details
  //       const markerId = markerElement._leaflet_id;
  //       const markerType = markerForm
  //         ? markerForm.querySelector('#ID').value
  //         : 'Unknown';

  //       // Confirm deletion
  //       const confirmDelete = window.confirm(
  //         `Are you sure you want to delete the ${markerType} marker?`
  //       );

  //       if (confirmDelete) {
  //         try {
  //           const markerName = markerForm
  //             ? markerForm.querySelector('#ID').value
  //             : 'Unknown';

  //           // Confirm deletion
  //           const confirmDelete = window.confirm(
  //             `Are you sure you want to delete the ${markerType} marker "${markerName}"?`
  //           );

  //           if (confirmDelete) {
  //             try {
  //               const response = await this.deleteMarkerOnServer(markerId);
  //               console.log(
  //                 `Marker ${markerId} (${markerType}) "${markerName}" deleted successfully`
  //               );
  //               window.alert(
  //                 `Marker ${markerId} (${markerType}) "${markerName}" deleted successfully`
  //               );
  //               console.log('response', response);
  //             } catch (error) {
  //               console.error(
  //                 `Error deleting marker ${markerId} (${markerType}) "${markerName}":`,
  //                 error
  //               );
  //               window.alert(
  //                 `Failed to delete marker ${markerId} (${markerType}) "${markerName}". Please try again.`
  //               );
  //             }
  //           }
  //         } catch (error) {
  //           console.error(`Error deleting marker ${markerId}:`, error);
  //           window.alert(`Failed to delete marker. Please try again.`);
  //         }
  //       }
  //     }
  //   }
  // }

  // Form creation function
  createMarkerForm(markerInfo) {
    const { latlng, type, data = {} } = markerInfo;

    // Provide default values for all properties
    const defaultData = {
      ID: type === "RSSIhub" ? "hub" : "",
      weight: "",
      height: "",
      orientationAngle: "",
      tiltAngle: "",
      zone: "",
    };

    // Merge provided data with default data
    // const data = { ...defaultData, ...data };

    // console.log('mergedData', mergedData);
    // console.log("zones: ", CONFIG.zones.zoneNames);

    return `
      <form id="markerForm" class="marker-form" onsubmit="return false;">
        <div class="form-group">
          <label for="ID">${type === "RSSIhub" ? "Hub ID:" : "MAC ID:"}</label>
          <input 
            type="text" 
            id="ID" 
            value="${data.ID}" 
            name="ID" 
            pattern="${
              type === "RSSIhub"
                ? "^hub[0-9A-Fa-f]{8}$"
                : "^([0-9A-Fa-f]{2}[:/-]){5}[0-9A-Fa-f]{2}$"
            }" 
            required>
        </div>
  
        <div class="form-group">
          <label for="mapCoordinates">Map Coordinates:</label>
          <input type="text" id="mapCoordinates" name="mapCoordinates" value="${latlng.lat.toFixed(
            15
          )}, ${latlng.lng.toFixed(15)}" required>
        </div>
        
        <div class="form-group">
          <label for="weight">Weight:</label>
          <input type="number" value="${
            data.weight
          }" id="weight" name="weight" min="0" max="5" step="0.1" required>
        </div>
        
        <div class="form-group">
          <label for="height">Height (meters):</label>
          <input type="number" value="${
            data.height
          }" id="height" name="height" min="0" step="0.1" required>
        </div>
        
        <div class="form-group">
          <label for="orientationAngleFromNorth">Orientation Angle from North (degrees):</label>
          <input type="number" value="${
            data.orientationAngle
          }" id="orientationAngleFromNorth" name="orientationAngleFromNorth" min="0" max="360" step="0.1" required>
        </div>
        
        <div class="form-group">
          <label for="tiltAngle">Tilt Angle (degrees):</label>
          <input type="number" value="${
            data.tiltAngle
          }" id="tiltAngle" name="tiltAngle" min="-90" max="90" step="0.1" required>
        </div>
        
        <div class="form-group">
          <label for="zone">Zone:</label>
          <select id="zone" name="zone" required>
            <option value="">Select a zone</option>
            ${CONFIG.zones.zoneNames
              .map(
                (zoneName) =>
                  `<option value="${zoneName}" ${
                    zoneName === data.zone ? "selected" : ""
                  }>${zoneName}</option>`
              )
              .join("")}
          </select>
        </div>
  
        <button type="submit" class="submit-btn">Save</button>
        <button type="button" class="delete-btn delete-marker">Delete</button>
      </form>
    `;
  }

  setupMarkerFormHandling(marker, markerType) {
    // Get the popup content element
    const popup = marker.getPopup();

    popup.on("add", () => {
      const container = popup.getElement();
      const form = container.querySelector("#markerForm");

      if (!form) return;

      // Update coordinates when popup opens
      const currentLatLng = marker.getLatLng();
      const coordsInput = form.querySelector("#mapCoordinates");
      if (coordsInput) {
        coordsInput.value = `${currentLatLng.lat.toFixed(
          15
        )}, ${currentLatLng.lng.toFixed(15)}`;
      }

      // Update zone dropdowns when popup opens
      const dropdown = form.querySelector('select[name="zone"]');
      if (dropdown) {
        this.updateZoneDropdowns();
      }

      // Handle form submission
      form.onsubmit = async (e) => {
        e.preventDefault(); // Prevent form from submitting traditionally

        // Get form data
        const formData = new FormData(form);

        // Get coordinates array from the string
        const coords = formData
          .get("mapCoordinates")
          .split(",")
          .map((coord) => parseFloat(coord.trim()));

        // Find the associated polygon for the selected zone
        const selectedZoneName = formData.get("zone");
        const associatedPolygon = this.findPolygonByZoneName(selectedZoneName);

        if (!associatedPolygon) {
          console.error("No polygon found for zone:", selectedZoneName);
          return;
        }
        console.log("markerType:", marker.type);
        // Create the marker data object
        const markerData = {
          hubId: formData.get("ID"),
          zoneName: selectedZoneName,
          type: markerType || marker.type,
          coordinates: {
            lat: coords[0],
            lng: coords[1],
          },
          height: parseFloat(formData.get("height")),
          weight: parseFloat(formData.get("weight")),
          orientationAngle: parseFloat(
            formData.get("orientationAngleFromNorth")
          ),
          tiltAngle: parseFloat(formData.get("tiltAngle")),
        };

        const formContent = this.createMarkerForm({
          latlng: {
            lat: markerData.coordinates.lat,
            lng: markerData.coordinates.lng,
          },
          type: markerData.type,
          data: {
            ID: markerData.hubId,
            height: markerData.height,
            weight: markerData.weight,
            orientationAngle: markerData.orientationAngle,
            tiltAngle: markerData.tiltAngle,
            zone: markerData.zoneName,
          },
        });

        marker.id = markerData.hubId;

        marker.unbindPopup();

        marker
          .bindPopup(formContent, {
            maxWidth: 400,
            className: "marker-popup",
            keepInView: true,
          })
          .off("popupopen")
          .on("popupopen", () => {
            const popup = document.querySelector(".marker-popup");
            if (popup) {
              // Remove any existing click handlers first
              popup.removeEventListener("click", popup._clickHandler);

              // Create new click handler
              popup._clickHandler = async (event) => {
                if (event.target.classList.contains("delete-marker")) {
                  this.map.removeLayer(marker);
                  const response = await this.deleteHubButton(marker.id, event);
                  marker.off("popupopen");
                  this.notificationManager.show({
                    message: "Hub deleted from server.",
                    type: "error"
                });
                }
              };

              // Add new click handler
              popup.addEventListener("click", popup._clickHandler);
            }
          });

        console.log("Sending marker data:", markerData);

        try {
          const response = await this.apiManager.saveMarkerData(markerData);
          console.log("Save successful:", response);
          this.notificationManager.show({
            type: "success",
            message: "Marker data saved successfully",
          });
          marker.closePopup();
        } catch (error) {
          console.error("Error saving marker data:", error);
          // alert("Error saving data. Please try again.");
          this.notificationManager.show({
            type: "error",
            message: "Error saving data. Please try again.",
          });
        }

        return false; // Extra prevention of form submission
      };

      // Add drag handlers to update coordinates in real-time if popup is open
      marker.off("drag dragend").on("drag dragend", () => {
        const currentPopup = marker.getPopup();
        if (currentPopup && currentPopup.isOpen()) {
          const newLatLng = marker.getLatLng();
          const coordsInput = currentPopup
            .getElement()
            .querySelector("#mapCoordinates");
          if (coordsInput) {
            coordsInput.value = `${newLatLng.lat.toFixed(
              15
            )}, ${newLatLng.lng.toFixed(15)}`;
          }
        }
      });
    });
  }

  setupZoneFormHandling(layer) {
    setTimeout(() => {
      const form = document.querySelector("#zoneForm");
      if (!form) return;

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const zoneName = form.zoneName.value;

        // Store the zone name in the layer
        layer.zoneName = zoneName;

        // Store polygon reference in CONFIG
        CONFIG.zones.ZoneBeans[zoneName] =
          CONFIG.zones.ZoneBeans[zoneName] || {};
        CONFIG.zones.ZoneBeans[zoneName].polygon = layer;

        // Add to CONFIG.zones if not already present
        if (!CONFIG.zones.zoneNames.includes(zoneName)) {
          CONFIG.zones.zoneNames.push(zoneName);
        }

        // Update all zone dropdowns in any open marker popups
        this.updateZoneDropdowns();

        // Update the popup content
        const newContent = `<div class="zoneNameDisplay">
          <div class="zoneName">${zoneName}</div>
          <button type="button" class="delete-btn delete-zone" onclick="deleteZoneButton('${zoneName}')">Delete</button>
        </div>`;

        layer.setPopupContent(newContent);
        layer.closePopup();

        // Send POST request to /zones to update zone data
        fetch(CONFIG.api.baseURL + "/zones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            zoneName: zoneName,
            vertices: this.getPolygonVertices(layer),
            color: layer.options.color || "#70ffae",
            opacity: layer.options.fillOpacity || 0.4,
          }),
        });
      });
    }, 100);
  }

  lightenColor(color, factor) {
    if (color.startsWith("#")) {
      let r = parseInt(color.slice(1, 3), 16);
      let g = parseInt(color.slice(3, 5), 16);
      let b = parseInt(color.slice(5, 7), 16);

      r = Math.min(255, Math.round(r + (255 - r) * factor));
      g = Math.min(255, Math.round(g + (255 - g) * factor));
      b = Math.min(255, Math.round(b + (255 - b) * factor));

      return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }

    if (color.startsWith("rgb")) {
      const rgb = color.match(/\d+/g).map(Number);
      const r = Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * factor));
      const g = Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * factor));
      const b = Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * factor));
      return `rgb(${r}, ${g}, ${b})`;
    }

    return color;
  }

  updateDrawingOptions() {
    this.currentColor = CONFIG.custom.Color;
    this.currentOpacity = CONFIG.custom.Opacity;

    const newPathOptions = {
      pathOptions: {
        color: this.currentColor,
        fillColor: this.currentColor,
        fillOpacity: this.currentOpacity,
      },
    };

    this.map.pm.setGlobalOptions(newPathOptions);

    if (this.map.pm.getMode) {
      console.log("Draw mode:", this.map.pm.getMode());
    } else {
      console.error(
        "getMode is not a function. Check your Leaflet.pm version."
      );
    }

    const currentMode = this.map.pm.getDrawMode();
    if (currentMode) {
      this.map.pm.disableDraw();
      this.map.pm.enableDraw(currentMode, newPathOptions);
    }
  }

  undo() {
    if (this.drawingHistory.length > 0) {
      const lastLayer = this.drawingHistory.pop();

      if (this.map.hasLayer(lastLayer)) {
        this.map.removeLayer(lastLayer);

        try {
          const pmLayers = this.map.pm.getLayers();
          const layerIndex = pmLayers.indexOf(lastLayer);
          if (layerIndex > -1) {
            pmLayers.splice(layerIndex, 1);
          }
        } catch (error) {}
      }
    }
  }
}

export default DrawingManager;
