/* eslint-disable */

import APIManager from "./Managers/APIManager.js";
import DrawingManager from "./Managers/DrawingManager.js";
import ImageOverlayManager from "./Managers/ImageOverlayManager.js";
import UIManager from "./Managers/UIManager.js";
import SidePane from "./Managers/SidePane.js";
import RSSIHeatmapManager from "./Managers/HeatMapManager.js";
import RssiMonitor from "./Managers/rssi-monitor.js";
import NotificationManager from "./Managers/NotificationManager.js";
import CONFIG from "./config.js";

// Main Application
class AssetTrackingApp {
  constructor() {
    // Create UI toggle buttons
    this.createUIToggleButtons();

    // Initialize side panel
    // this.sidePanel = new SidePanel();

    // Your existing initialization code
    this.currentUIMode = "map";
    this.uiManager = new UIManager();
    this.map = this.initializeMap();
    CONFIG.map.mapObj = this.map;
    this.imageManager = new ImageOverlayManager(this.map, CONFIG);
    this.drawingManager = new DrawingManager(this.map);
    this.apiManager = new APIManager();
    this.rssiHeatmapManager = new RSSIHeatmapManager(this.map);
    const sidePane = new SidePane();
    this.rssiMonitor = new RssiMonitor();
    this.notificationManager = new NotificationManager();

    // Make the instance globally accessible for event handling
    window.sidePaneInstance = sidePane;

    this.isCtrlPressed = false;
    this.isDraggingImage = false;
    this.formMarkerData = [];
    this.Marker = null;
    this.initializeGeoman();
    this.setupUI();
    this.setupEventListeners();
    // this.initializeZones();
    this.initializeDeleteMethods();
    this.initializeMarkers();
    // this.imageManager.initializePlans('HSW', 'HSW', 1);
    sidePane.init();
    this.setupRSSIHeatmapControls();
    this.initializeSearchBar();
    this.addSearchStyles();

    // customBtns.forEach((btn) => {
    //   const anchors = btn.querySelectorAll('.leaflet-buttons-control-button');
    //   anchors.forEach((anchor) => {
    //     anchor.classList.add('customButtonCss');
    //   });
    // });
  }
  // Add this to your AssetTrackingApp class

  // AssetTrackingApp.js search-related methods

  initializeSearchBar() {
    const searchContainer = document.querySelector(".searchs-container");
    const searchInput = searchContainer.querySelector("input");
    const spinner = searchContainer.querySelector(".spinner");
    const resultsContainer = searchContainer.querySelector(".searchs-results");
    let debounceTimer;

    // Handle input changes for suggestions
    searchInput.addEventListener("input", async (e) => {
      const query = e.target.value.trim();

      // Clear previous timer
      clearTimeout(debounceTimer);

      // Clear results if input is empty
      if (!query) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
        return;
      }

      // Debounce the search to avoid too many API calls
      debounceTimer = setTimeout(async () => {
        try {
          spinner.style.display = "block";

          // Fetch suggestions from Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              query
            )}&limit=5`
          );
          const data = await response.json();

          // Display suggestions
          resultsContainer.innerHTML = "";

          if (data.length > 0) {
            data.forEach((place) => {
              const div = document.createElement("div");
              div.className = "search-result-item";
              div.innerHTML = `
              <span class="place-name">${
                place.display_name.split(",")[0]
              }</span>
              <span class="place-description">${place.display_name}</span>
            `;

              // Handle click on suggestion
              div.addEventListener("click", () => {
                searchInput.value = place.display_name;
                resultsContainer.style.display = "none";
                this.goToLocation(place);
              });

              resultsContainer.appendChild(div);
            });
            resultsContainer.style.display = "block";
          } else {
            resultsContainer.style.display = "none";
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          spinner.style.display = "none";
        }
      }, 300); // Debounce delay of 300ms
    });

    // Handle Enter key press
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        e.preventDefault();
        resultsContainer.style.display = "none";

        try {
          spinner.style.display = "block";
          searchInput.disabled = true;

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              searchInput.value
            )}`
          );
          const data = await response.json();

          if (data && data.length > 0) {
            this.goToLocation(data[0]);
          } else {
            alert("Location not found. Please try a different search term.");
          }
        } catch (error) {
          console.error("Search error:", error);
          alert("An error occurred while searching. Please try again.");
        } finally {
          spinner.style.display = "none";
          searchInput.disabled = false;
        }
      }
    });

    // Close suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (!searchContainer.contains(e.target)) {
        resultsContainer.style.display = "none";
      }
    });
  }

  // Helper method to handle location selection
  goToLocation(location) {
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    // Remove existing marker if any
    if (this.searchMarker) {
      this.map.removeLayer(this.searchMarker);
    }

    // Add new marker
    this.searchMarker = L.marker([lat, lon]).addTo(this.map);
    setTimeout(() => this.map.removeLayer(this.searchMarker), 5000);
    this.searchMarker.bindPopup(location.display_name).openPopup();

    // Fly to location
    this.map.flyTo([lat, lon], 16, {
      duration: 1.5,
      easeLinearity: 0.25,
    });

    // Remove any existing highlight if it exists
    if (this.searchHighlight) {
      this.map.removeLayer(this.searchHighlight);
      this.searchHighlight = null;
    }
  }

  addSearchStyles() {
    const styles = `
    .searchs-container {
      position: absolute;
      top: 17px;
      left: 80px;
      z-index: 1000;
      width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .searchs-container input {
      width: 100%;
      padding: 12px 40px 12px 16px;
      border: 2px solid #e1e1e1;
      border-radius: 24px;
      font-size: 14px;
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
    }

    .searchs-container input:hover {
      border-color: #d1d1d1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .searchs-container input:focus {
      outline: none;
      border-color: #3388ff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .searchs-container input::placeholder {
      color: #999;
      transition: color 0.2s ease;
    }

    .searchs-container input:focus::placeholder {
      color: #bbb;
    }

    .spinner {
      display: none;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3388ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .searchs-results {
      display: none;
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background: white;
      border-radius: 16px;
      margin-top: 4px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
      max-height: 300px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #d1d1d1 #f5f5f5;
    }

    .searchs-results::-webkit-scrollbar {
      width: 8px;
    }

    .searchs-results::-webkit-scrollbar-track {
      background: #f5f5f5;
      border-radius: 0 16px 16px 0;
    }

    .searchs-results::-webkit-scrollbar-thumb {
      background-color: #d1d1d1;
      border-radius: 4px;
      border: 2px solid #f5f5f5;
    }

    .search-result-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background-color 0.2s ease;
    }

    .search-result-item:first-child {
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
    }

    .search-result-item:last-child {
      border-bottom: none;
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
    }

    .search-result-item:hover {
      background: #f8f9fa;
    }

    .search-result-item:active {
      background: #f0f0f0;
    }

    .place-name {
      font-weight: 500;
      color: #2c3e50;
      font-size: 14px;
    }

    .place-description {
      font-size: 12px;
      color: #7f8c8d;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }

    @keyframes spin {
      0% { transform: translateY(-50%) rotate(0deg); }
      100% { transform: translateY(-50%) rotate(360deg); }
    }

    @media (max-width: 768px) {
      .searchs-container {
        width: calc(100% - 80px);
        max-width: 300px;
      }
    }
  `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }
  addStyles(cssString) {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = cssString;
    document.head.appendChild(styleSheet);
  }

  createUIToggleButtons() {
    const buttonContainer = document.createElement("div");
    buttonContainer.id = "uiToggleButtons";

    const mapButton = document.createElement("button");
    mapButton.className = "ui-toggle-btn active";
    mapButton.textContent = "MAP UI";
    mapButton.onclick = () => this.toggleUI("map");

    const heatmapButton = document.createElement("button");
    heatmapButton.className = "ui-toggle-btn";
    heatmapButton.textContent = "HEAT UI";
    heatmapButton.onclick = () => this.toggleUI("heatmap");

    const assetButton = document.createElement("button");
    assetButton.className = "ui-toggle-btn";
    assetButton.textContent = "Asset Tracking UI";
    assetButton.onclick = () => this.toggleUI("asset");

    const RSSIButton = document.createElement("button");
    RSSIButton.className = "ui-toggle-btn rssiButton";
    RSSIButton.textContent = "RSSI Realtime Data";
    RSSIButton.onclick = () => this.toggleUI("RSSI");

    const TimeTrackingButton = document.createElement("button");
    TimeTrackingButton.className = "ui-toggle-btn";
    TimeTrackingButton.textContent = "Time Tracking";
    TimeTrackingButton.onclick = () => this.toggleUI("timetracking");

    buttonContainer.appendChild(mapButton);
    buttonContainer.appendChild(heatmapButton);
    buttonContainer.appendChild(assetButton);
    buttonContainer.appendChild(RSSIButton);
    buttonContainer.appendChild(TimeTrackingButton);
    document.body.appendChild(buttonContainer);
  }

  toggleUI(mode) {
    this.currentUIMode = mode;
    this.drawingManager.currentUIMode = mode.toLowerCase();
    const mapButton = document.querySelector(
      "#uiToggleButtons button:first-child"
    );
    const assetButton = document.querySelector(
      "#uiToggleButtons button:nth-child(3)"
    );
    const RSSIButton = document.querySelector(
      "#uiToggleButtons button:nth-child(4)"
    );
    const TimeTrackingButton = document.querySelector(
      "#uiToggleButtons button:last-child"
    );
    const heatmapButton = document.querySelector(
      "#uiToggleButtons button:nth-child(2)"
    );
    const geomanControls = document.querySelectorAll(".leaflet-pm-toolbar");

    if (mode === "map") {
      // Show map UI
      mapButton.classList.add("active");
      heatmapButton.classList.remove("active");
      assetButton.classList.remove("active");
      RSSIButton.classList.remove("active");
      TimeTrackingButton.classList.remove("active");

      this.drawingManager.drawingHistory.forEach((polygon) => {
        this.map.addLayer(polygon); // Re-add user-created polygons
      });

      // this.sidePanel.hide();
      if (geomanControls) {
        for (const control of geomanControls) {
          control.style.opacity = "1";
          control.style.pointerEvents = "auto";
        }
      }
      document.querySelector("#sidepanel-main").style.display = "none";
      document.querySelector("#scaleSlider").style.display = "flex";
      document.querySelector("#rotationSlider").style.display = "flex";
      document.querySelector("#imageOpacitySlider").style.display = "flex";
      document.querySelector("#colorPicker").style.display = "flex";
      document.querySelector("#uploadImageButton").style.display = "flex";
      document.querySelector("#resetMapButton").style.display = "flex";
      document.querySelector("#undoButton").style.display = "flex";
      document.querySelector("#saveButton").style.display = "flex";
      document.querySelector("#addRSSIPointBtn").style.display = "none";
      document.querySelector("#heatmapRadiusSlider").style.display = "none";
      document.querySelector("#rssiPopup-main").style.display = "none";
      document.querySelector("#timeTrackingPopup").style.display = "none";
      document.querySelector("#deleteImageButton").style.display = "flex";
      document.querySelector("#editImageButton").style.display = "flex";
      document.querySelector("#ZoneBtn").style.display = "none";
      const buttonContainer = document.querySelector(
        "#buttonContainer"
      );
      buttonContainer.style.display = "grid";
      buttonContainer.style.width = "350px";

      if (
        this.map &&
        this.rssiHeatmapManager &&
        this.rssiHeatmapManager.heatmapLayer
      ) {
        this.map.removeLayer(this.rssiHeatmapManager.heatmapLayer);
      }
      if (this.rssiHeatmapManager.markers) {
        this.rssiHeatmapManager.markers.forEach((marker) => {
          this.map.removeLayer(marker);
        });
      }
    } else if (mode === "heatmap") {
      mapButton.classList.remove("active");
      assetButton.classList.remove("active");
      heatmapButton.classList.add("active");
      RSSIButton.classList.remove("active");
      TimeTrackingButton.classList.remove("active");

      const ZoneBtn = document.getElementById("ZoneBtn");
      const isShowingZones = ZoneBtn.textContent;

      if (isShowingZones === "Show Zones") {
        this.drawingManager.drawingHistory.forEach((polygon) => {
          this.map.removeLayer(polygon); // Remove user-created polygons
        });
      }

      if (isShowingZones === "Hide Zones") {
        this.drawingManager.drawingHistory.forEach((polygon) => {
          this.map.addLayer(polygon); // Add user-created polygons
        });
      }

      document.querySelector("#sidepanel-main").style.display = "none";
      document.querySelector("#scaleSlider").style.display = "none";
      document.querySelector("#rotationSlider").style.display = "none";
      document.querySelector("#imageOpacitySlider").style.display = "none";
      document.querySelector("#colorPicker").style.display = "none";
      document.querySelector("#uploadImageButton").style.display = "none";
      document.querySelector("#resetMapButton").style.display = "none";
      document.querySelector("#undoButton").style.display = "none";
      document.querySelector("#saveButton").style.display = "none";
      document.querySelector("#addRSSIPointBtn").style.display = "flex";
      document.querySelector("#heatmapRadiusSlider").style.display = "flex";
      document.querySelector("#rssiPopup-main").style.display = "none";
      document.querySelector("#timeTrackingPopup").style.display = "none";
      document.querySelector("#deleteImageButton").style.display = "none";
      document.querySelector("#editImageButton").style.display = "none";
      document.querySelector("#ZoneBtn").style.display = "flex";
      const buttonContainer = document.querySelector(
        "#buttonContainer"
      )
      buttonContainer.style.display = "flex";
      buttonContainer.style.width = "175px";
    } else if (mode === "RSSI") {
      // this.rssiMonitor.initRssiPopup();
      // Show map UI
      RSSIButton.classList.add("active");
      assetButton.classList.remove("active");
      mapButton.classList.remove("active");
      heatmapButton.classList.remove("active");

      TimeTrackingButton.classList.remove("active");
      // this.sidePanel.hide();
      if (geomanControls) {
        for (const control of geomanControls) {
          control.style.opacity = "0";
          control.style.pointerEvents = "none";
        }
      }
      document.querySelector("#sidepanel-main").style.display = "none";
      document.querySelector("#scaleSlider").style.display = "none";
      document.querySelector("#rotationSlider").style.display = "none";
      document.querySelector("#imageOpacitySlider").style.display = "none";
      document.querySelector("#colorPicker").style.display = "none";
      document.querySelector("#uploadImageButton").style.display = "none";
      document.querySelector("#resetMapButton").style.display = "none";
      document.querySelector("#undoButton").style.display = "none";
      document.querySelector("#saveButton").style.display = "none";
      document.querySelector("#addRSSIPointBtn").style.display = "none";
      document.querySelector("#heatmapRadiusSlider").style.display = "none";
      document.querySelector("#timeTrackingPopup").style.display = "none";
      document.querySelector("#rssiPopup-main").style.display = "block";
      document.querySelector("#deleteImageButton").style.display = "none";
      document.querySelector("#editImageButton").style.display = "none";
      document.querySelector("#ZoneBtn").style.display = "none";
      const buttonContainer = document.querySelector(
        "#buttonContainer"
      );
      buttonContainer.style.display = "none";
      buttonContainer.style.width = "350px";
    } else if (mode === "timetracking") {
      openTimeTrackingPopup();
      // Show map UI
      TimeTrackingButton.classList.add("active");
      assetButton.classList.remove("active");
      mapButton.classList.remove("active");
      RSSIButton.classList.remove("active");
      heatmapButton.classList.remove("active");

      // this.sidePanel.hide();
      if (geomanControls) {
        for (const control of geomanControls) {
          control.style.opacity = "0";
          control.style.pointerEvents = "none";
        }
        document.querySelector("#sidepanel-main").style.display = "none";
        document.querySelector("#scaleSlider").style.display = "none";
        document.querySelector("#rotationSlider").style.display = "none";
        document.querySelector("#imageOpacitySlider").style.display = "none";
        document.querySelector("#colorPicker").style.display = "none";
        document.querySelector("#uploadImageButton").style.display = "none";
        document.querySelector("#resetMapButton").style.display = "none";
        document.querySelector("#undoButton").style.display = "none";
        document.querySelector("#saveButton").style.display = "none";
        document.querySelector("#addRSSIPointBtn").style.display = "none";
        document.querySelector("#heatmapRadiusSlider").style.display = "none";
        document.querySelector("#rssiPopup-main").style.display = "none";
        document.querySelector("#timeTrackingPopup").style.display = "block";
        document.querySelector("#deleteImageButton").style.display = "none";
        document.querySelector("#editImageButton").style.display = "none";
        document.querySelector("#ZoneBtn").style.display = "none";
        const buttonContainer = document.querySelector(
          "#buttonContainer"
        );
        buttonContainer.style.display = "none";
        buttonContainer.style.width = "350px";

        if (
          this.map &&
          this.rssiHeatmapManager &&
          this.rssiHeatmapManager.heatmapLayer
        ) {
          this.rssiHeatmapManager.heatmapLayer.addTo(this.map);
        }
        if (this.rssiHeatmapManager.markers) {
          this.rssiHeatmapManager.markers.forEach((marker) => {
            marker.addTo(this.map);
          });
        }
      }
    } else {
      // Show asset tracking UI
      mapButton.classList.remove("active");
      heatmapButton.classList.remove("active");
      assetButton.classList.add("active");
      RSSIButton.classList.remove("active");
      TimeTrackingButton.classList.remove("active");

      this.drawingManager.drawingHistory.forEach((polygon) => {
        this.map.addLayer(polygon); // Re-add user-created polygons
      });

      // this.sidePanel.show();
      if (geomanControls) {
        for (const control of geomanControls) {
          control.style.opacity = "0";
          control.style.pointerEvents = "none";
        }
      }
      document.querySelector("#sidepanel-main").style.display = "block";
      document.querySelector("#scaleSlider").style.display = "none";
      document.querySelector("#rotationSlider").style.display = "none";
      document.querySelector("#imageOpacitySlider").style.display = "none";
      document.querySelector("#colorPicker").style.display = "none";
      document.querySelector("#uploadImageButton").style.display = "none";
      document.querySelector("#resetMapButton").style.display = "none";
      document.querySelector("#undoButton").style.display = "none";
      document.querySelector("#saveButton").style.display = "none";
      document.querySelector("#addRSSIPointBtn").style.display = "none";
      document.querySelector("#heatmapRadiusSlider").style.display = "none";
      document.querySelector("#timeTrackingPopup").style.display = "none";
      document.querySelector("#rssiPopup-main").style.display = "none";
      document.querySelector("#deleteImageButton").style.display = "none";
      document.querySelector("#editImageButton").style.display = "none";
      document.querySelector("#ZoneBtn").style.display = "none";
      const buttonContainer = document.querySelector(
        "#buttonContainer"
      )
      buttonContainer.style.display = "none";
      buttonContainer.style.width = "350px";

      if (
        this.map &&
        this.rssiHeatmapManager &&
        this.rssiHeatmapManager.heatmapLayer
      ) {
        this.map.removeLayer(this.rssiHeatmapManager.heatmapLayer);
      }
      if (this.rssiHeatmapManager.markers) {
        this.rssiHeatmapManager.markers.forEach((marker) => {
          this.map.removeLayer(marker);
        });
      }
    }
  }

  initializeDeleteMethods() {
    // Bind the method to the instance and assign it to the global window object
    window.deleteZoneButton = this.drawingManager.deleteZoneButton.bind(
      this.drawingManager
    );
    window.deleteHubButton = this.drawingManager.deleteHubButton.bind(
      this.drawingManager
    );
  }

  async submitMarkerFormData(marker) {
    try {
      const response = await this.apiManager.saveMarkerData(marker);
      if (response && response.status === 200) {
        console.log("Marker data saved successfully!");
      } else {
        console.error("Error saving marker data:", response);
      }
    } catch (error) {
      console.error("Error saving marker data:", error);
    }
  }

  async initializeZones() {
    try {
      const response = await this.apiManager.getZones();
      if (response && response.zones) {
        this.drawingManager.processZoneData(response.zones);
      }
    } catch (error) {
      console.error("Error initializing zones:", error);
    }
  }

  async initializeMarkers() {
    try {
      await this.initializeZones();
    } catch (error) {
      console.error("Error initializing zones:", error);
      this.notificationManager.show({
        type: "error",
        message: "Error initializing zones. Please try again.",
        duration: 1000,
      });
    }

    try {
      const response = await this.apiManager.getMarkers();
      if (response && response.hubs) {
        this.processMarkerData(response.hubs);
      }
    } catch (error) {
      console.error("Error initializing markers:", error);
      this.notificationManager.show({
        type: "error",
        message: "Error initializing markers. Please try again.",
        duration: 1200,
      });
    }

    try {
      this.imageManager.initializePlans("HSW", "HSW", 1);
    } catch (error) {
      console.error("Error initializing image manager:", error);
      this.notificationManager.show({
        type: "error",
        message: "Error initializing image manager. Please try again.",
        duration: 1400,
      });
    }

    this.notificationManager.show({
      message: "Welcome!",
      type: "info",
      duration: 1600,
    });
  }

  initializeMap() {
    const map = L.map("demo", {
      center: CONFIG.map.center,
      zoom: CONFIG.map.zoom,
      maxZoom: CONFIG.map.maxZoom,
      dragging: true,
    });

    L.tileLayer(CONFIG.map.tileLayer, {
      maxZoom: CONFIG.map.maxZoom,
      maxNativeZoom: CONFIG.map.maxNativeZoom,
    }).addTo(map);

    //OLD TEST
    // // More explicit geocoder setup
    // const geocoder = L.Control.geocoder({
    //     defaultMarkGeocode: false, // Prevent default marker
    //     placeholder: "Search address...",
    //     geocoder: L.Control.Geocoder.nominatim({
    //         // Optional: add more specific geocoding parameters
    //         geocodingQueryParams: {
    //             // You can add country codes or other parameters
    //             // 'countrycodes': 'us', // Limit to specific country if needed
    //         }
    //     })
    // }).addTo(map);

    // // Add event listener for geocoding results
    // geocoder.on('markgeocode', function(e) {
    //     const result = e.geocode;

    //     // Center and zoom to the found location
    //     map.setView(result.center, 13);

    //     // Optional: Add a marker
    //     L.marker(result.center)
    //         .addTo(map)
    //         .bindPopup(result.name)
    //         .openPopup();
    // });

    // NEW TEST
    // Geocoder Setup with Enhanced Configuration
    //   const geocoder = L.Control.geocoder({
    //     defaultMarkGeocode: false, // Prevent default marker
    //     placeholder: "Search address...",
    //     geocoder: L.Control.Geocoder.nominatim({
    //       // Optional: Customize geocoding parameters
    //       geocodingQueryParams: {
    //         // Uncomment and modify as needed
    //         // 'countrycodes': 'us', // Limit to specific country
    //         // 'limit': 5, // Limit number of results
    //       },
    //     }),
    //   }).addTo(map);

    //   // Advanced Geocoding Event Listener
    //   geocoder.on("markgeocode", function (e) {
    //     const result = e.geocode;

    //     // Clear previous markers if you want only one marker
    //     map.eachLayer(function (layer) {
    //       if (layer instanceof L.Marker) {
    //         map.removeLayer(layer);
    //       }
    //     });

    //     // Center and zoom to the found location with smooth animation
    //     map.setView(result.center, 13, {
    //       animate: true,
    //       pan: {
    //         duration: 1, // pan duration in seconds
    //       },
    //     });

    //     // Create a more stylized marker
    //     const marker = L.marker(result.center, {
    //       icon: L.divIcon({
    //         className: "custom-marker",
    //         html: `
    //             <div class="marker-pin"></div>
    //             <div class="marker-label">${result.name}</div>
    //         `,
    //         iconSize: [30, 42],
    //         iconAnchor: [15, 42],
    //       }),
    //     }).addTo(map);

    //     // Optional: Add popup with more details
    //     marker
    //       .bindPopup(
    //         `
    //     <strong>Location:</strong> ${result.name}<br>
    //     <small>Lat: ${result.center.lat.toFixed(
    //       4
    //     )}, Lng: ${result.center.lng.toFixed(4)}</small>
    // `
    //       )
    //       .openPopup();
    //   });

    return map;
  }

  initializeGeoman() {
    // Initialize Leaflet-Geoman controls
    this.map.pm.addControls({
      position: "topright",
      drawControls: true,
      editControls: true,
      optionsControls: true,
      customControls: true,
      oneBlock: false,
      drawCircleMarker: false,
      drawPolyline: false,
    });
  }

  async processMarkerData(hubs) {
    hubs.forEach((hub) => {
      const color = CONFIG.blukiiTypes.colorTypes[hub.type];
      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<svg class="custom-marker-icon" width="30" height="50" viewBox="0 0 131 210" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M61.8731 185.144L68.2229 195.246L74.5727 185.144C93.7353 154.658 105.821 128.095 113.133 107.531C120.362 87.1972 123.095 72.2454 123.095 65.0761C123.095 33.3198 97.3511 7.57617 65.5947 7.57617C33.8384 7.57617 8.09473 33.3198 8.09473 65.0761C8.09469 69.5918 9.26051 75.6262 11.3063 82.6733C13.3942 89.8657 16.5463 98.6034 20.8527 108.703C29.469 128.909 42.8206 154.833 61.8731 185.144Z" fill="${color}" stroke="white" stroke-width="3"/>
          </svg>`,
        iconSize: [30, 50],
        iconAnchor: [15, 50],
        popupAnchor: [0, -60],
      });

      const marker = L.marker([hub.coordinates.lat, hub.coordinates.lng], {
        draggable: true,
        icon: customIcon,
      }).addTo(this.map);

      marker.type = hub.type;

      // In processZoneData method
      const formContent = this.drawingManager.createMarkerForm({
        latlng: {
          lat: hub.coordinates.lat,
          lng: hub.coordinates.lng,
        },
        type: hub.type,
        data: {
          ID: hub.hubId,
          height: hub.height,
          weight: hub.weight,
          orientationAngle: hub.orientationAngle,
          tiltAngle: hub.tiltAngle,
          zone: hub.zoneName,
        },
      });

      marker.id = hub.hubId;

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
                marker.closePopup();
                const response = await this.drawingManager.deleteHubButton(
                  marker.id,
                  event,
                  marker
                );
                // this.notificationManager.show({
                //   message: "Hub deleted from server.",
                //   type: "error",
                // });
                marker.off("popupopen");
                this.map.removeLayer(marker);
              }
            };

            // Add new click handler
            popup.addEventListener("click", popup._clickHandler);
          }
        });

      this.Marker = marker;

      this.drawingManager.setupMarkerFormHandling(marker, marker.type);
    });
  }

  setupButtons() {
    const buttonConfigs = [
      {
        id: "uploadImageButton",
        text: "Upload Image",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '10px',
          backgroundColor: CONFIG.ui.colors.primary,
          color: "#fff",
          cursor: "pointer",
          opacity: 1,
        },
        onClick: (event) => {
          // Add event parameter to get the button element directly
          console.log("Upload Image button clicked!");

          const center = this.map.getCenter();
          CONFIG.image.midpoint = [center.lat, center.lng];
          console.log(center);

          // Trigger file input
          document.querySelector('input[type="file"]').click();
        },
      },
      {
        id: "deleteImageButton",
        text: "Delete Image",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '10px',
          backgroundColor: CONFIG.ui.colors.danger,
          color: "#fff",
          cursor: "pointer",
          opacity: 1,
        },
        onClick: () => {
          console.log("Delete Image button clicked!");
          this.imageManager.deleteImage();
        },
      },
      {
        id: "editImageButton",
        text: "Edit Image",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '10px',
          backgroundColor: CONFIG.ui.colors.orange,
          color: "#fff",
          cursor: "pointer",
          opacity: 1,
        },
        onClick: () => {
          console.log("Edit Image button clicked!");
          this.imageManager.attachDragHandlers();
          // this.imageManager.disableEditButton();
          this.imageManager.toggleEditMode();
          this.imageManager.enableSaveButton();
        },
      },
      {
        id: "resetMapButton",
        text: "Reset Map",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '130px',
          backgroundColor: CONFIG.ui.colors.darkyellow,
          color: "#fff",
        },
        onClick: () => {
          console.log("Reset Map button clicked!");
          this.uiManager.resetMap();
        },
      },
      {
        id: "undoButton",
        text: "Undo",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '230px',
          backgroundColor: CONFIG.ui.colors.darkblue,
          color: "#fff",
        },
        onClick: () => {
          console.log("Undo button clicked!");
          this.drawingManager.undo();
        },
      },
      // ... (previous code remains the same until the save button config)
      {
        id: "addRSSIPointBtn",
        text: "Add RSSI Point",
        styles: {
          bottom: "25px",
          left: "10px",
          display: "none",
          backgroundColor: CONFIG.ui.colors.dark,
          color: "#fff",
        },
        onClick: () => {
          console.log("Add RSSI Point button clicked!");
          this.drawingManager.addRSSIPoint();
        },
      },
      {
        id: "ZoneBtn",
        text: "Hide Zones",
        styles: {
          bottom: "25px",
          left: "10px",
          display: "none",
          backgroundColor: CONFIG.ui.colors.dark,
          color: "#fff",
        },
        onClick: () => {
          console.log("Show/Hide Zones button clicked!");
          this.toggleZones();
        },
      },
      {
        id: "saveButton",
        text: "Save",
        styles: {
          maxWidth: "100%",
          // bottom: '210px',
          // left: '300px',
          backgroundColor: CONFIG.ui.colors.success,
          color: "#fff",
        },
        onClick: () => {
          console.log("Save button clicked!");

          if (this.imageManager.imageOverlays.length > 0) {
            this.uiManager.hideSliders();
            this.imageManager.saveImageToServer();
            this.imageManager.toggleEditMode();
            this.imageManager.disableSaveButton();
            this.imageManager.removeDragHandlers();
          }

          const hubs = [];
          const zones = [];

          this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
              const { lat, lng } = layer.getLatLng();
              hubs.push([lat, lng]);
            } else if (
              layer instanceof L.Polygon ||
              layer instanceof L.Rectangle ||
              layer instanceof L.CircleMarker
            ) {
              const latlngs = layer.getLatLngs().flat();
              const zone = latlngs.map((latlng) => [latlng.lat, latlng.lng]);
              zones.push(zone);
            }
          });

          if (hubs.length === 0) {
            console.log("No Hubs found.");
          } else {
            console.log("Hub Coordinates:", hubs);
          }

          if (zones.length === 0) {
            console.log("No Zones found.");
          } else {
            console.log("Zone Coordinates:", zones);
          }
        },
      },
      // Extra button for toggling zone draw mode

      // {
      //   id: 'toggleDrawMode',
      //   text: 'Toggle Draw',
      //   styles: {
      //     top: '90px',
      //     left: '10px',
      //     backgroundColor: CONFIG.ui.colors.success,
      //     color: '#fff',
      //   },
      //   onClick: () => {
      //     console.log('Toggle Draw Mode clicked!');
      //     if (this.map.pm.globalDrawMode) {
      //       this.map.pm.disableDraw('Polygon');
      //     } else {
      //       this.map.pm.enableDraw('Polygon');
      //     }
      //   },
      // },
    ];

    buttonConfigs.forEach((config) => {
      this.uiManager.createButton(config);
    });
  }

  setupSliders() {
    const sliderConfigs = [
      {
        id: "imageOpacitySlider",
        labelText: "Opacity",
        min: 0,
        max: 1,
        step: 0.1,
        value: 0.5,
        pos: "10px", // Distance from the position (e.g., bottom: 10px)
        position: "bottom", // bottom or top
        callback: (value) => {
          console.log("Opacity Slider value:", value);
          if (this.imageManager.activeImageIndex !== null) {
            CONFIG.image.currentOpacity = value;
            const selectedImage =
              this.imageManager.imageOverlays[
                this.imageManager.activeImageIndex
              ];
            selectedImage.overlay.setOpacity(value);
            selectedImage.opacity = value;
          }
        },
      },
      {
        id: "rotationSlider",
        labelText: "Rotation",
        min: 0,
        max: 360,
        step: 0.1,
        value: 180,
        pos: "60px",
        position: "bottom",
        callback: (value) => {
          console.log("Rotation Slider value:", value);
          this.imageManager.rotationAngle = value;
          // const selectedImage = this.imageManager.imageOverlays[this.imageManager.activeImageIndex];
          this.imageManager.updateImageRotation();
          // this.imageManager.applyCssRotation();
        },
      },
      {
        id: "heatmapRadiusSlider",
        labelText: "Radius",
        min: 1,
        max: 20,
        step: 0.1,
        value: 0.5,
        pos: "10px", // Distance from the position (e.g., bottom: 10px)
        position: "bottom", // bottom or top
        callback: (value) => {
          console.log("Heatmap Radius value:", value);
          this.rssiHeatmapManager.setHeatmapRadius(value);
        },
        hide: true,
      },
      {
        id: "scaleSlider",
        labelText: "Scale",
        min: 0.0001,
        max: 0.1,
        step: 0.0001,
        value: CONFIG.image.initialScale,
        pos: "110px",
        position: "bottom",
        callback: (value) => {
          console.log("Scale Slider value:", value);
          if (this.imageManager.activeImageIndex !== null) {
            const selectedImage =
              this.imageManager.imageOverlays[
                this.imageManager.activeImageIndex
              ];
            CONFIG.image.currentScale = value;
            this.imageManager.updateImageScale(value);

            // Restore the rotation angle after scaling
            // this.imageManager.rotationAngle = currentRotationAngle;
            // this.imageManager.updateImageRotation();

            selectedImage.scale = value;
          }
        },
      },
    ];

    sliderConfigs.forEach((config) => {
      const container = this.uiManager.createSliderContainer(config);
      const slider = this.uiManager.createSliderElement(config);
      this.uiManager.createSliderControls(container, slider, config);
      document.body.appendChild(container);
    });
  }

  setupColorPicker() {
    const picker = this.uiManager.createColorPicker({
      id: "colorPicker",
      onChange: (color, opacity) => {
        console.log("Color:", color);
        console.log("Opacity:", opacity);
      },
      bottom: "160px",
    });
  }

  dragHandling = function (marker) {
    // this.imageManager.setMarkerDraggingState(true);
    // Update coordinates in form if popup is open
    const popup = marker.getPopup();
    if (popup && popup.isOpen()) {
      const newLatLng = marker.getLatLng();
      const coordsInput = popup.getElement().querySelector("#mapCoordinates");
      if (coordsInput) {
        coordsInput.value = `${newLatLng.lat.toFixed(
          6
        )}, ${newLatLng.lng.toFixed(6)}`;
      }
    }
  };

  // Modified UIManager method for custom markers
  createCustomMarkerButtons() {
    const markerConfigs = [
      {
        name: "RSSIhub",
        block: "custom",
        className: "blue-marker",
        color: CONFIG.blukiiTypes.colorTypes.RSSIhub,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "RSSIhub",
            data: {
              ID: "hub",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "Go1000",
        block: "custom",
        className: "red-marker",
        color: CONFIG.blukiiTypes.colorTypes.Go1000,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "Go1000",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "Box5200",
        block: "custom",
        className: "grey-marker",
        color: CONFIG.blukiiTypes.colorTypes.Box5200,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "Box5200",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "Box10800",
        block: "custom",
        className: "green-marker",
        color: CONFIG.blukiiTypes.colorTypes.Box10800,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "Box10800",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "OutdoorMini5400",
        block: "custom",
        className: "yellow-marker",
        color: CONFIG.blukiiTypes.colorTypes.OutdoorMini5400,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "OutdoorMini5400",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "Box230",
        block: "custom",
        className: "purple-marker",
        color: CONFIG.blukiiTypes.colorTypes.Box230,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "Box230",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "OutdoorExtreme4000",
        block: "custom",
        className: "orange-marker",
        color: CONFIG.blukiiTypes.colorTypes.OutdoorExtreme4000,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "OutdoorExtreme4000",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "GoMini",
        block: "custom",
        className: "teal-marker",
        color: CONFIG.blukiiTypes.colorTypes.GoMini,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "GoMini",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
      {
        name: "Go500",
        block: "custom",
        className: "pink-marker",
        color: CONFIG.blukiiTypes.colorTypes.Go500,
        createPopupContent: (latlng) =>
          this.drawingManager.createMarkerForm({
            latlng,
            type: "Go500",
            data: {
              ID: "",
              weight: "",
              height: "",
              orientationAngle: "",
              tiltAngle: "",
              zone: "",
            },
          }),
      },
    ];

    let hoverMarker = null;
    let isMarkerMode = false;

    // Cleanup function
    const cleanupMarkerMode = () => {
      if (hoverMarker) {
        this.map.removeLayer(hoverMarker);
        hoverMarker = null;
      }
      this.map.off("mousemove");
      this.map.off("click");
      this.map.off("mouseout");
      isMarkerMode = false;
    };

    // Add escape key handler
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isMarkerMode) {
        cleanupMarkerMode();
      }
    });

    markerConfigs.forEach((config) => {
      this.map.pm.Toolbar.createCustomControl({
        name: config.name,
        block: config.block,
        className: `leaflet-pm-icon-${config.name} custom-icon ${config.className}`,
        title: `Add ${config.name}`,
        onClick: () => {
          if (isMarkerMode) {
            cleanupMarkerMode();
            return;
          }

          isMarkerMode = true;

          // Create the hover marker icon
          const customIcon = L.divIcon({
            className: "custom-div-icon",
            html: `<svg class="custom-marker-icon" width="30" height="50" viewBox="0 0 131 210" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M61.8731 185.144L68.2229 195.246L74.5727 185.144C93.7353 154.658 105.821 128.095 113.133 107.531C120.362 87.1972 123.095 72.2454 123.095 65.0761C123.095 33.3198 97.3511 7.57617 65.5947 7.57617C33.8384 7.57617 8.09473 33.3198 8.09473 65.0761C8.09469 69.5918 9.26051 75.6262 11.3063 82.6733C13.3942 89.8657 16.5463 98.6034 20.8527 108.703C29.469 128.909 42.8206 154.833 61.8731 185.144Z" fill="${config.color}" stroke="white" stroke-width="3"/>
                      </svg>`,
            iconSize: [30, 50],
            iconAnchor: [15, 50],
            popupAnchor: [0, -60], // Offset popup above the marker
          });

          // Add mousemove handler to show hover marker
          this.map.on("mousemove", (e) => {
            if (hoverMarker) {
              hoverMarker.setLatLng(e.latlng);
            } else {
              hoverMarker = L.marker(e.latlng, {
                icon: customIcon,
                zIndexOffset: 1000,
              }).addTo(this.map);
            }
          });

          // Add click handler to place permanent marker
          this.map.on("click", async (e) => {
            const marker = L.marker(e.latlng, {
              draggable: true,
              icon: customIcon,
            }).addTo(this.map);

            // Add drag event handler
            marker.on("dragstart", this.dragHandling(marker));

            // Create popup with form
            const popupContent = config.createPopupContent(e.latlng);
            marker
              .bindPopup(popupContent, {
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
                      const response =
                        await this.drawingManager.deleteHubButton(
                          marker.id,
                          event,
                          marker
                        );
                      marker.closePopup();
                      marker.off("popupopen");
                    }
                  };

                  // Add new click handler
                  popup.addEventListener("click", popup._clickHandler);
                }
              });

            // Add dragend event to update form when marker is dropped
            marker.on("dragend", () => {
              // this.imageManager.setMarkerDraggingState(false);
              const popup = marker.getPopup();
              if (popup && popup.isOpen()) {
                const newLatLng = marker.getLatLng();
                const coordsInput = popup
                  .getElement()
                  .querySelector("#mapCoordinates");
                if (coordsInput) {
                  coordsInput.value = `${newLatLng.lat.toFixed(
                    6
                  )}, ${newLatLng.lng.toFixed(6)}`;
                }
              }
            });

            // Open popup after a small delay to ensure proper positioning
            setTimeout(() => {
              marker.openPopup();
            }, 100);

            // Setup form handling
            this.drawingManager.setupMarkerFormHandling(marker, config.name);

            // Clean up after placing marker
            cleanupMarkerMode();
          });

          // Add handler to remove hover marker when leaving the map
          this.map.on("mouseout", () => {
            if (hoverMarker) {
              this.map.removeLayer(hoverMarker);
              hoverMarker = null;
            }
          });
        },
        toggle: false, // Changed to false to prevent button state issues
      });
    });
  }

  setupUI() {
    // Create all UI elements using UIManager
    this.setupButtons();
    this.setupSliders();
    this.setupColorPicker();
    this.createCustomMarkerButtons(this.map);
  }

  setupEventListeners() {
    // Global keyboard events
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));

    // document.addEventListener('DOMContentLoaded', () => {
    //   // Check if the map is already initialized
    //   let map;

    //   if (window.map) {
    //       // Reuse the existing map instance
    //       map = window.map;
    //   } else {
    //       // Initialize the map and store it globally to avoid reinitialization
    //       map = L.map('demo').setView([51.505, -0.09], 13);

    //       // Add OpenStreetMap tiles
    //       L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //           attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    //       }).addTo(map);

    //       window.map = map; // Save the map instance globally
    //   }

    // Reference the search bar in the searchs-container
  }

  handleKeyDown(event) {
    if (event.key === "Control") {
      this.isCtrlPressed = true;
      if (this.isDraggingImage) {
        // If we're currently dragging the image, stop it
        this.isDraggingImage = false;
        this.map.dragging.enable();
      }
    }
  }

  handleKeyUp(event) {
    if (event.key === "Control") {
      this.isCtrlPressed = false;
      // Disable map dragging when Ctrl is released (unless we're using drawing tools)
      if (!this.map.pm.globalDrawMode) {
        this.map.dragging.disable();
      }
    }
  }

  // Event handlers and other methods

  handleMapClick(e) {
    if (this.currentUIMode !== "heatmap") {
      return; // Exit the method if not in heatmap mode
    }

    console.log("Click event:", e);
    console.log("Latitude:", e.latlng.lat);
    console.log("Longitude:", e.latlng.lng);

    // Prompt for RSSI value or use a default
    const rssiValue = prompt("Enter RSSI value (between -90 and -5):", "-60");

    if (rssiValue !== null) {
      const parsedRSSI = parseFloat(rssiValue);

      if (!isNaN(parsedRSSI) && parsedRSSI >= -90 && parsedRSSI <= -5) {
        // Prompt to select Beacon Type
        const beaconTypes = [
          "blukii_Go_500",
          "blukii Box",
          "blukii Coin250",
          "Beacon Type 4",
          "Beacon Type 5",
          "Beacon Type 6",
        ];

        const beacons = [
          "GO_500",
          "BOX",
          "COIN_250",
          "BEACON_4",
          "BEACON_5",
          "BEACON_6",
        ];

        const beaconType = prompt(
          "Select Beacon Type:\n" +
            beaconTypes
              .map((type, index) => `${index + 1}. ${type}`)
              .join("\n"),
          "1" // Default to first beacon type
        );

        // Validate Beacon Type selection
        if (beaconType !== null) {
          const beaconIndex = parseInt(beaconType) - 1;
          if (beaconIndex >= 0 && beaconIndex < beaconTypes.length) {
            const selectedBeacon = beacons[beaconIndex];
            console.log("Selected Beacon Type:", selectedBeacon);

            // Create RSSI marker and add point
            this.rssiHeatmapManager.createRSSIMarker(
              e.latlng,
              parsedRSSI,
              selectedBeacon
            );
            this.rssiHeatmapManager.addRSSIPoint(
              e.latlng,
              parsedRSSI,
              selectedBeacon
            );
          } else {
            alert(
              "Invalid Beacon Type selected. Please choose a number between 1 and 6."
            );
          }
        }
      } else {
        alert("Invalid RSSI value. Please enter a number between -90 and -5.");
      }
    }
  }

  setupRSSIHeatmapControls() {
    // Existing setup code for RSSI heatmap controls
    const addRSSIPointBtn = document.getElementById("addRSSIPointBtn");

    // Ensure handleMapClick is a defined method and bound correctly
    this.boundHandleMapClick = this.handleMapClick.bind(this);

    if (addRSSIPointBtn) {
      addRSSIPointBtn.addEventListener("click", () => {
        if (this.isAddingRSSIPoints) {
          // Stop adding points
          this.map.off("click", this.boundHandleMapClick);
          this.isAddingRSSIPoints = false;
          addRSSIPointBtn.textContent = "Add RSSI Point";
          addRSSIPointBtn.classList.remove("active");
        } else {
          // Start adding points
          this.map.on("click", this.boundHandleMapClick);
          this.isAddingRSSIPoints = true;
          addRSSIPointBtn.textContent = "Stop Adding Points";
          addRSSIPointBtn.classList.add("active");
        }
      });
    }
  }

  toggleZones() {
    const ZoneBtn = document.getElementById("ZoneBtn");
    const isShowingZones = ZoneBtn.textContent;

    if (isShowingZones === "Show Zones") {
      // Show zones
      this.drawingManager.drawingHistory.forEach((polygon) => {
        this.map.addLayer(polygon);
      });
      ZoneBtn.textContent = "Hide Zones";
    }

    if (isShowingZones === "Hide Zones") {
      // Hide zones
      this.drawingManager.drawingHistory.forEach((polygon) => {
        this.map.removeLayer(polygon);
      });
      ZoneBtn.textContent = "Show Zones";
    }
  }

  // showNotification(options) {
  //   const defaultOptions = {
  //     type: "success",
  //     message: "",
  //     duration: 3000,
  //     styles: {
  //       position: "fixed",
  //       top: "24px",
  //       right: "504px",
  //       background: "#4caf50",
  //       color: "white",
  //       padding: "16px 24px",
  //       borderRadius: "8px",
  //       display: "none",
  //       fontSize: "14px",
  //       fontWeight: "500",
  //       boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  //       animation: "slideIn 0.3s ease",
  //     },
  //   };

  //   const { type, message, duration, styles } = Object.assign(
  //     defaultOptions,
  //     options
  //   );

  //   const container = document.getElementById("notification-container");

  //   if (!container) return;

  //   const notification = document.createElement("div");
  //   notification.className = `notification ${type}`;
  //   notification.textContent = message;

  //   Object.assign(notification.style, styles);

  //   container.appendChild(notification);

  //   setTimeout(() => {
  //     notification.classList.add("fade-out");
  //   }, duration);

  //   notification.addEventListener("animationend", (e) => {
  //     if (e.animationName === "fade-out") {
  //       notification.remove();
  //     }
  //   });
  // }
}

// Initialize the application
const app = new AssetTrackingApp();

app.uiManager.dm = app.drawingManager;
// app.imageManager.uploadButtonStatus();
