import CONFIG from '../config.js';
import APIManager from './APIManager.js';

class SidePane {
  constructor() {
    this.apiManager = new APIManager();
    this.previousZonesData = null;
    this.previousAssets = {};
    this.assetsData = {};
    this.isSearching = false;
    this.searchQuery = '';
    this.currentlySelectedZone = null; // New property for tracking selected zone
    this.IDTP = new BroadcastChannel('IDTP_CHANNEL');
    this.ICMP = new BroadcastChannel('ICMP');
    
    // Bind methods to ensure correct context
    this.initializePanelToggle = this.initializePanelToggle.bind(this);
    this.initializeSearchListener = this.initializeSearchListener.bind(this);
    this.showAssetsPanel = this.showAssetsPanel.bind(this);
    this.fetchZones = this.fetchZones.bind(this);
    this.fetchAndDisplayAllAssets = this.fetchAndDisplayAllAssets.bind(this);
    this.deleteAsset = this.deleteAsset.bind(this);
    this.saveAsset = this.saveAsset.bind(this);
    this.showAssetOnMap = this.showAssetOnMap.bind(this);
    this.toggleAddForm = this.toggleAddForm.bind(this);
    this.handleZoneClick = this.handleZoneClick.bind(this);
    this.updateZoneContent = this.updateZoneContent.bind(this);
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.initializePanelToggle();
      this.initializeSearchListener();
      this.showAssetsPanel();
      this.fetchZones();

      // Periodic updates
      setInterval(this.fetchZones, 1000);
      setInterval(() => {
        if (!this.isSearching) {
          this.fetchAndDisplayAllAssets();
        }
      }, 1000);

      // Ensure the form is hidden initially
      const form = document.getElementById('addFormContainer');
      if (form) {
        form.style.display = 'none';

        // Attach save event listener to form
        const saveButton = form.querySelector('button');
        if (saveButton) {
          saveButton.addEventListener('click', this.saveAsset);
        }
      }

      const addIcon = document.getElementById('addIcon');
      if (addIcon) {
        addIcon.addEventListener('click', this.toggleAddForm);
      }

      const manageAssetsBtn = document.getElementById('manageAssetsBtn');
      if (manageAssetsBtn) {
        manageAssetsBtn.addEventListener('click', this.showAssetsPanel);
      }

      const saveButton = document.getElementById('saveAssetBtn');
      if (saveButton) {
        saveButton.addEventListener('click', this.saveAsset);
      }
    });
  }

  showAssetOnMap(zone, asset) {
    const decodedAsset = JSON.parse(window.atob(asset));
    console.log('Showing asset on map:', zone, decodedAsset);
    this.ICMP.postMessage({
      method: 'showAssetOnMap',
      data: {
        zone: zone,
        asset: decodedAsset.assetName,
      },
    });
  }

  initializePanelToggle() {
    const toggleBtn = document.getElementById('panelToggle');
    const panel = document.getElementById('panelContainer');
    const notification = document.getElementById('notification');

    toggleBtn.addEventListener('click', () => {
      toggleBtn.classList.toggle('collapsed');
      panel.classList.toggle('collapsed');
      toggleBtn.textContent = toggleBtn.classList.contains('collapsed')
        ? '<'
        : '>';

      if (notification.style.display === 'block') {
        notification.style.right = panel.classList.contains('collapsed')
          ? '24px'
          : '504px';
      }
    });
  }

  initializeSearchListener() {
    const searchInput = document.getElementById('assetSearch');
    let debounceTimeout;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      this.searchQuery = e.target.value.trim();

      debounceTimeout = setTimeout(() => {
        if (this.searchQuery) {
          this.isSearching = true;
          this.fetchAndDisplayAllAssets(this.searchQuery);
        } else {
          this.isSearching = false;
          this.fetchAndDisplayAllAssets();
        }
      }, 1000);
    });
  }

  toggleAddForm() {
    const form = document.getElementById('addFormContainer');
    if (!form) return;

    const currentDisplay = window.getComputedStyle(form).display;
    form.style.display = currentDisplay === 'none' ? 'block' : 'none';
  }

  async showAssetsPanel() {
    this.currentlySelectedZone = null; // Clear selected zone when showing assets panel
    
    document.querySelectorAll('.menu-button').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector('.add-delete-button').classList.add('active');

    const assetsPanel = document.getElementById('assetsPanel');
    const zoneContent = document.getElementById('zoneContent');

    if (assetsPanel) assetsPanel.style.display = 'block';
    if (zoneContent) zoneContent.style.display = 'none';

    await this.fetchAndDisplayAllAssets();
  }

  async fetchAndDisplayAllAssets(currentQuery = '') {
    if (this.isSearching && !currentQuery) return;

    try {
      this.assetsData = await this.apiManager.request('/assets');
      const assetsList = document.getElementById('assetsList');
      assetsList.innerHTML = '';

      let assetFound = false;

      Object.entries(this.assetsData).forEach(([zone, assetsInZone]) => {
        assetsInZone.forEach((asset) => {
          const assetName = (asset.assetName || 'Unnamed Asset').toLowerCase();
          const macAddress = (asset.macAddress || 'No MAC').toLowerCase();
          const isHuman = asset.humanFlag === 1;
          const searchTerm = currentQuery.toLowerCase();

          if (
            currentQuery &&
            !assetName.includes(searchTerm) &&
            !macAddress.includes(searchTerm)
          ) {
            return;
          }

          const hasZoneChanged =
            this.previousAssets[asset.macAddress] &&
            this.previousAssets[asset.macAddress] !== zone;

          const assetCard = this.createAssetCard(
            {
              ...asset,
              isHuman,
            },
            zone,
            hasZoneChanged
          );
          assetsList.appendChild(assetCard);
          assetFound = true;
          this.previousAssets[asset.macAddress] = zone;
        });
      });

      if (!assetFound) {
        assetsList.innerHTML = currentQuery
          ? '<div class="no-assets">No matching assets found</div>'
          : '<div class="no-assets">No assets found</div>';
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      const assetsList = document.getElementById('assetsList');
      assetsList.innerHTML = `<div class="error-message">Failed to load assets. Error: ${error.message}</div>`;
    }
  }

  createAssetCard(asset, zone, hasZoneChanged) {
    const div = document.createElement('div');
    div.setAttribute('id', asset.macAddress);
    div.setAttribute(
      'onClick',
      `window.sidePaneInstance.showAssetOnMap('${zone}', '${window.btoa(JSON.stringify(asset))}')`
    );
    div.className = 'asset-card';
    div.innerHTML = `
      <div class="asset-name">${asset.assetName || 'Unnamed Asset'}</div>
      <div class="asset-mac">${asset.macAddress || 'No MAC'}</div>
      <div class="asset-type ${asset.isHuman ? 'human' : 'device'}">
          ${asset.isHuman ? 'Human' : 'Device'}
      </div>
      <div class="asset-zone">
          Zone: ${zone} ${hasZoneChanged ? '<span style="color: red;">(Changed)</span>' : ''}
      </div>
      <div class="delete-icon" onclick="event.stopPropagation(); window.sidePaneInstance.deleteAsset('${asset.macAddress}')">🗑️</div>
    `;
    return div;
  }

  async deleteAsset(macAddress) {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      const response = await fetch(CONFIG.api.baseURL + '/delete-assets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          macAddresses: [macAddress.trim()],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete asset: ${errorText}`);
      }

      const notification = document.getElementById('notification');
      notification.textContent = 'Asset Deleted Successfully!';
      notification.style.display = 'block';

      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);

      await Promise.all([this.fetchZones(), this.fetchAndDisplayAllAssets()]);
    } catch (error) {
      console.error('Error deleting asset:', error);
      const notification = document.getElementById('notification');
      notification.textContent = `Error: ${error.message}`;
      notification.style.display = 'block';
      notification.style.backgroundColor = '#ff4444';

      setTimeout(() => {
        notification.style.display = 'none';
        notification.style.backgroundColor = '#4CAF50';
      }, 3000);
    }
  }

  async fetchZones() {
    const zoneButtonsContainer = document.getElementById('zoneButtonsContainer');

    try {
      const [zonesResponse, assetsResponse] = await Promise.all([
        fetch(CONFIG.api.baseURL + '/zones'),
        fetch(CONFIG.api.baseURL + '/assets'),
      ]);

      if (!zonesResponse.ok || !assetsResponse.ok) {
        throw new Error('Network response was not ok');
      }

      const [zonesData, assetsData] = await Promise.all([
        zonesResponse.json(),
        assetsResponse.json(),
      ]);

      this.IDTP.postMessage({
        method: 'assetsData',
        data: assetsData,
      });

      // If currently viewing a zone, update its content
      if (this.currentlySelectedZone) {
        const zoneAssets = assetsData[this.currentlySelectedZone.name] || [];
        this.updateZoneContent(this.currentlySelectedZone, zoneAssets);
      }

      if (
        this.previousZonesData &&
        JSON.stringify(this.previousZonesData) === JSON.stringify(zonesData)
      ) {
        return;
      }

      this.previousZonesData = zonesData;
      zoneButtonsContainer.innerHTML = '';

      if (zonesData && zonesData.zones && Array.isArray(zonesData.zones)) {
        const zones = zonesData.zones;

        if (zones.length === 0) {
          zoneButtonsContainer.innerHTML =
            '<div class="error-message">No zones found.</div>';
          return;
        }

        zones.sort((a, b) => a.name.localeCompare(b.name));

        zones.forEach((zone) => {
          const zoneAssets = assetsData[zone.name] || [];
          const button = document.createElement('button');
          button.className = 'menu-button';
          const countText =
            zoneAssets.length > 0 ? ` (${zoneAssets.length})` : '';
          button.textContent = `${zone.name}${countText}`;
          button.onclick = () => this.handleZoneClick(zone, zoneAssets, button);
          zoneButtonsContainer.appendChild(button);
        });
      } else {
        throw new Error('Invalid data structure received from API');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      zoneButtonsContainer.innerHTML = `
        <div class="error-message">
            Failed to load zones. Please try refreshing the page.<br>
            Error: ${error.message}
        </div>
      `;
    }
  }

  updateZoneContent(zone, zoneAssets) {
    let zoneContent = document.getElementById('zoneContent');
    if (!zoneContent) {
      zoneContent = document.createElement('div');
      zoneContent.id = 'zoneContent';
      document.querySelector('.content-panel').appendChild(zoneContent);
    }
    zoneContent.className = 'form-container';
    zoneContent.style.display = 'block';

    let content = `
      <h3 class="form-title">${zone.name}</h3>
      <div class="asset-list">
    `;

    if (!zoneAssets || zoneAssets.length === 0) {
      content += `
        <div class="no-assets" style="text-align: center; padding: 20px; color: #666;">
            No assets currently in this zone
        </div>
      `;
    } else {
      zoneAssets.forEach((asset) => {
        const macAddress = asset.macAddress || 'No MAC';
        const assetName = asset.assetName || 'Unnamed Asset';
        const isHuman = asset.humanFlag === 1;
        content += `
          <div class="asset-card" onclick="window.sidePaneInstance.showAssetOnMap('${zone.name}', '${window.btoa(JSON.stringify(asset))}')">
              <div class="asset-name">${assetName}</div>
              <div class="asset-mac">${macAddress}</div>
              <div class="asset-type ${isHuman ? 'human' : 'device'}">
                  ${isHuman ? 'Human' : 'Device'}
              </div>
          </div>
        `;
      });
    }

    content += '</div>';
    zoneContent.innerHTML = content;
  }

  handleZoneClick(zone, zoneAssets, button) {
    this.currentlySelectedZone = zone; // Store the selected zone

    document.querySelectorAll('.menu-button').forEach((btn) => {
      btn.classList.remove('active');
    });
    button.classList.add('active');

    const assetsPanel = document.getElementById('assetsPanel');
    if (assetsPanel) {
      assetsPanel.style.display = 'none';
    }

    this.updateZoneContent(zone, zoneAssets);
  }

  async saveAsset() {
    const beaconMac = document.getElementById('beaconMac').value;
    const assetName = document.getElementById('assetName').value;
    const isHuman = document.getElementById('isHuman').checked;

    if (!beaconMac || !assetName) {
      alert('Please fill in all required fields');
      return;
    }

    const assetData = [
      {
        macAddress: beaconMac,
        assetName: assetName,
        humanFlag: isHuman,
      },
    ];

    try {
      const response = await fetch(CONFIG.api.baseURL + '/new-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save asset: ${errorText}`);
      }

      

      document.getElementById('beaconMac').value = '';
      document.getElementById('assetName').value = '';
      document.getElementById('isHuman').checked = false;

      document.getElementById('addFormContainer').style.display = 'none';

      // setTimeout(() => {
      //   notification.style.display = 'none';
      // }, 3000);

      await Promise.all([this.fetchZones(), this.fetchAndDisplayAllAssets()]);
    } catch (error) {
      console.error('Error saving asset:', error);
      alert(`Failed to save asset. Please try again. Error: ${error.message}`);
    }
  }
}

export default SidePane;
