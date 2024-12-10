// time-tracking-api.js
const API_BASE_URL = window.API_BASE_URL || window.CONFIG?.api?.baseURL;

const API_ENDPOINTS = {
    TIME_TRACKING: `${API_BASE_URL}/time-tracking-data`,
};

let currentData = {};
let selectedDate = null;

async function fetchTimeTrackingData() {
    try {
        const response = await axios.get(API_ENDPOINTS.TIME_TRACKING);
        console.log('Fetched data:', response.data); // Log fetched data
        const newData = response.data;
        const hasNewData = JSON.stringify(newData) !== JSON.stringify(currentData);

        if (hasNewData) {
            currentData = newData;
            return { success: true, data: currentData };
        }
        return { success: true, data: currentData };
    } catch (error) {
        console.error('Failed to fetch time tracking data:', error);
        return { success: false, error };
    }
}


function formatTotalTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Make functions and variables available globally
window.TimeTrackingAPI = {
    fetchTimeTrackingData,
    formatTotalTime,
    currentData,
    selectedDate
};
