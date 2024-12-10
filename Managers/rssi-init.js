
// rssi-init.js
// Only declare if not already defined
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

function initRssiPopup() {
    //Add necessary styles
    const styles = `
        .rssi-table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 10px;
        }
        .rssi-table th, .rssi-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: center;
        }
        .rssi-table th {
            background-color: #f4f4f4;
        }
        .asset-name {
            font-size: 0.8em;
            color: #666;
        }
        .popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Add event listeners
    const openButton = document.getElementById('rssiButton');
    const closeButton = document.getElementById('closeRssiButton');
    const popup = document.getElementById('rssiPopup');

    if (openButton) {
        openButton.addEventListener('click', function() {
            popup.style.display = 'block';
            window.RssiMonitor.initialize();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', function() {
            popup.style.display = 'none';
            window.RssiMonitor.cleanup();
        });
    }
}

//Initialize event listeners
document.addEventListener('DOMContentLoaded', initRssiPopup);
