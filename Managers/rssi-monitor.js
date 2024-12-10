class RssiMonitor {
  constructor() {
    this.rssiInterval = null;
    this.REFRESH_INTERVAL = 1000;

    // Set up API base URL if not already defined
    if (typeof window.API_BASE_URL === 'undefined') {
      window.API_BASE_URL = window.API_BASE_URL || window.CONFIG?.api?.baseURL;
    }

    // Only create endpoints if not already defined
    if (typeof window.API_ENDPOINTS === 'undefined') {
      window.API_ENDPOINTS = {
        ZONES: `${window.API_BASE_URL}/zones`,
        RSSI_DATA: `${window.API_BASE_URL}/rssi-data`,
      };
    }

    // Bind methods to ensure correct context
    this.fetchZones = this.fetchZones.bind(this);
    this.createTableHeader = this.createTableHeader.bind(this);
    this.fetchRssiData = this.fetchRssiData.bind(this);
    this.initialize = this.initialize.bind(this);
    this.cleanup = this.cleanup.bind(this);

    // Add event listener for DOM content loaded
    document.addEventListener('DOMContentLoaded', this.initialize());
  }

  fetchZones() {
    return axios
      .get(window.API_ENDPOINTS.ZONES)
      .then((response) => response.data.zones.map((zone) => zone.name))
      .catch((error) => {
        console.error('Error fetching zones:', error);
        return [];
      });
  }

  createTableHeader(zones) {
    const thead = document
      .getElementById('rssiTable')
      .getElementsByTagName('thead')[0];
    thead.innerHTML = '';

    // Create main header row
    const mainHeaderRow = thead.insertRow();

    // MAC Address Header
    const macHeader = mainHeaderRow.insertCell();
    macHeader.innerHTML = 'MAC Address';
    macHeader.rowSpan = 2;

    // Zone headers
    zones.forEach((zone) => {
      const header = mainHeaderRow.insertCell();
      header.colSpan = 2;
      header.innerHTML = zone;
    });

    // Assigned Zone Header
    const assignedZoneHeader = mainHeaderRow.insertCell();
    assignedZoneHeader.innerHTML = 'Algorithm Assigned Zone';
    assignedZoneHeader.rowSpan = 2;

    // Subheader row
    const subHeaderRow = thead.insertRow();
    zones.forEach(() => {
      subHeaderRow.insertCell().innerHTML = 'Inst. RSSI';
      subHeaderRow.insertCell().innerHTML = 'Last Seen';
    });
  }

  fetchRssiData(zones) {
    const fiveSecondsAgo = Date.now() - 5000;

    axios
      .get(window.API_ENDPOINTS.RSSI_DATA)
      .then((response) => {
        const data = response.data;
        const tableBody = document
          .getElementById('rssiTable')
          .getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';

        Object.entries(data).forEach(([macAddress, assetData]) => {
          const row = tableBody.insertRow();

          // MAC Address cell
          const macCell = row.insertCell();
          macCell.innerHTML = `${macAddress}<br><span class="asset-name">${assetData.assetName || ''}</span>`;

          let assignedZone;

          // Create cells for each zone
          zones.forEach((zone, index) => {
            const rssiCell = row.insertCell();
            const lastSeenCell = row.insertCell();

            if (assetData[zone]) {
              const lastSeenTimestamp = new Date(
                assetData[zone].lastSeen
              ).getTime();
              const adjustedLastSeen = new Date(lastSeenTimestamp);

              rssiCell.textContent = assetData[zone].rssi;
              lastSeenCell.textContent = adjustedLastSeen
                .toTimeString()
                .split(' ')[0];

              const bgColor =
                lastSeenTimestamp > fiveSecondsAgo
                  ? 'lightgreen'
                  : 'lightcoral';
              rssiCell.style.backgroundColor = bgColor;
              lastSeenCell.style.backgroundColor = bgColor;

              if (!assignedZone) {
                assignedZone = assetData[zone].assignedZone;
              }
            } else {
              rssiCell.textContent = '--';
              lastSeenCell.textContent = '--:--:--';
              rssiCell.style.backgroundColor = 'lightcoral';
              lastSeenCell.style.backgroundColor = 'lightcoral';
            }

            if (index < zones.length - 1) {
              lastSeenCell.style.borderRight = '2px solid #000';
            }
          });

          // Assigned Zone cell
          const assignedZoneCell = row.insertCell();
          assignedZoneCell.textContent = assignedZone || 'Unknown';
        });
      })
      .catch((error) => console.error('Failed to fetch RSSI data:', error));
  }

  initialize() {
    this.fetchZones().then((zones) => {
      this.createTableHeader(zones);
      this.fetchRssiData(zones);
      this.rssiInterval = setInterval(
        () => this.fetchRssiData(zones),
        this.REFRESH_INTERVAL
      );
    });
  }

  cleanup() {
    if (this.rssiInterval) {
      clearInterval(this.rssiInterval);
    }
  }
}

export default RssiMonitor;
