let datePicker;

// function initializeDatePicker() {
//     datePicker = flatpickr("#dateSelector", {
//         dateFormat: "d.m.Y",
//         onChange: function(selectedDates, dateStr) {
//             console.log('Selected date:', dateStr);
//             TimeTrackingAPI.selectedDate = dateStr;
//             updateTimeTrackingData(); // This will fetch new data based on selected date
//         },
//         inline: false,
//         static: true
//     });
// }

let availableDates = [];
let isFirstLoad = true; // Add flag to track first load

async function fetchDatesFromAPI() {
    try {
        const response = await axios.get(window.CONFIG.api.baseURL + '/time-tracking-data/dates');
        availableDates = response.data.dates;
        
        // Initialize or update flatpickr with new dates
        initializeDatePicker();
        
        // Only set the most recent date on first load
        if (isFirstLoad && availableDates.length > 0) {
            const mostRecentDate = availableDates[0];
            TimeTrackingAPI.selectedDate = mostRecentDate;
            datePicker.setDate(mostRecentDate, true);
            updateTimeTrackingData();
            isFirstLoad = false; // Reset the flag after first load
        }
    } catch (error) {
        console.error('Error fetching dates from API:', error);
    }
}

function initializeDatePicker() {
    const flatpickrConfig = {
        dateFormat: "d.m.Y",
        inline: false,
        enable: availableDates.map(dateStr => {
            const [day, month, year] = dateStr.split('.').map(Number);
            return new Date(year, month - 1, day);
        }),
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const currentDate = dayElem.dateObj;
            const dateString = `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`;
            
            if (availableDates.includes(dateString)) {
                dayElem.classList.add('available');
            }
        },
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0) {
                TimeTrackingAPI.selectedDate = dateStr;
                updateTimeTrackingData();
            }
        }
    };

    if (datePicker) {
        // Store the current selected date before destroying
        const currentSelectedDate = datePicker.selectedDates[0];
        datePicker.destroy();
        
        // Reinitialize with the same date
        datePicker = flatpickr("#dateSelector", flatpickrConfig);
        if (currentSelectedDate) {
            datePicker.setDate(currentSelectedDate, false); // false to prevent triggering onChange
        }
    } else {
        datePicker = flatpickr("#dateSelector", flatpickrConfig);
    }
}

function openTimeTrackingPopup() {
    document.getElementById('timeTrackingPopup').style.display = 'block';
    isFirstLoad = true; // Reset first load flag when opening popup
    fetchDatesFromAPI();
    timeTrackingInterval = setInterval(fetchDatesFromAPI, 30000);
}

function closeTimeTrackingPopup() {
    document.getElementById('timeTrackingPopup').style.display = 'none';
    clearInterval(timeTrackingInterval);
    isFirstLoad = true; // Reset first load flag when closing popup
}

function initializeDatePicker() {
    const flatpickrConfig = {
        dateFormat: "d.m.Y",
        inline: false,
        enable: availableDates.map(dateStr => {
            const [day, month, year] = dateStr.split('.').map(Number);
            return new Date(year, month - 1, day);
        }),
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const currentDate = dayElem.dateObj;
            const dateString = `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`;
            
            if (availableDates.includes(dateString)) {
                dayElem.classList.add('available');
            }
        },
        onChange: function(selectedDates, dateStr) {
            if (selectedDates.length > 0) {
                TimeTrackingAPI.selectedDate = dateStr;
                updateTimeTrackingData();
            }
        }
    };

    if (datePicker) {
        datePicker.destroy();
    }

    datePicker = flatpickr("#dateSelector", flatpickrConfig);
}

function showLoadingIndicator() {
    document.getElementById('loadingIndicator').style.display = 'inline';
}

function hideLoadingIndicator() {
    document.getElementById('loadingIndicator').style.display = 'none';
}
function createTimeTrackingTable(data) {
    const table = document.getElementById('timeTrackingTable');
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    let excessiveHoursWarning = [];

    Object.entries(data).forEach(([macAddress, assetData], personIndex) => {
        let totalTime = 0;
        const filteredSections = assetData.timeSections.filter(section => 
            section.date === TimeTrackingAPI.selectedDate);

        if (filteredSections.length === 0) return;

        filteredSections.forEach((section, index) => {
            const row = tbody.insertRow();
            row.className = 'data-row';

            if (index === 0) {
                const nameCell = row.insertCell();
                nameCell.textContent = assetData.assetName || macAddress;
                nameCell.className = 'person-name';
                nameCell.rowSpan = filteredSections.length + 1;
            }

            // Add time cells with formatted times
            const startCell = row.insertCell();
            startCell.textContent = new Date(section.startTime).toLocaleTimeString('de-DE');
            
            const stopCell = row.insertCell();
            stopCell.textContent = section.stopTime ? 
                new Date(section.stopTime).toLocaleTimeString('de-DE') : '-';
            
            const durationCell = row.insertCell();
            durationCell.textContent = section.duration;

            // Calculate total time
            const [hours, minutes, seconds] = section.duration.split(':').map(Number);
            totalTime += hours * 3600 + minutes * 60 + seconds;
        });

        // Add total row
        const totalRow = tbody.insertRow();
        totalRow.className = 'total-row';
        const totalLabelCell = totalRow.insertCell();
        totalLabelCell.textContent = 'Total Time';
        totalLabelCell.colSpan = 3;
        const totalTimeCell = totalRow.insertCell();
        totalTimeCell.textContent = formatTotalTime(totalTime);

        // Check for excessive hours
        if (totalTime > 15 * 3600) {
            excessiveHoursWarning.push(assetData.assetName || macAddress);
        }

        // Add spacer row if not last entry
        if (personIndex < Object.entries(data).length - 1) {
            const spacerRow = tbody.insertRow();
            spacerRow.className = 'spacer-row';
            const spacerCell = spacerRow.insertCell();
            spacerCell.colSpan = 4;
        }
    });

    // Add warning if necessary
    if (excessiveHoursWarning.length > 0) {
        const warningRow = tbody.insertRow();
        warningRow.className = 'warning-row';
        const warningCell = warningRow.insertCell();
        warningCell.colSpan = 4;
        const warningText = excessiveHoursWarning.length === 1 
            ? `${excessiveHoursWarning[0]} probably left their blukii.` 
            : `${excessiveHoursWarning.slice(0, -1).join(', ')} and ${excessiveHoursWarning.slice(-1)} probably left their blukiis.`;
        warningCell.textContent = `${warningText} (>15 hours detected)`;
    }
}


function addTotalRow(tbody, totalTime) {
    const totalRow = tbody.insertRow();
    totalRow.classList.add('person-row', 'total-row');
    totalRow.insertCell();
    const totalLabelCell = totalRow.insertCell();
    totalLabelCell.textContent = 'Total Time';
    totalLabelCell.colSpan = 2;
    const totalTimeCell = totalRow.insertCell();
    totalTimeCell.textContent = TimeTrackingAPI.formatTotalTime(totalTime);
}

function addSpacerRow(tbody) {
    const spacerRow = tbody.insertRow();
    spacerRow.classList.add('spacer-row');
    const spacerCell = spacerRow.insertCell();
    spacerCell.colSpan = 4;
}

function addWarningRow(tbody, warningList) {
    const warningRow = tbody.insertRow();
    const warningCell = warningRow.insertCell();
    warningCell.colSpan = 4;
    warningCell.style.color = 'red';
    warningCell.style.fontWeight = 'bold';
    const warningText = warningList.length === 1 
        ? `${warningList[0]} probably left their blukii.` 
        : `${warningList.slice(0, -1).join(', ')} and ${warningList.slice(-1)} probably left their blukiis.`;
    warningCell.textContent = `${warningText} The trigger for this text is >15 hours.`;
}

function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'inline';
    }
}

function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

async function updateTimeTrackingData() {
    if (!TimeTrackingAPI.selectedDate) return;

    showLoadingIndicator();

    try {
        const apiURL = `${window.CONFIG.api.baseURL}/time-tracking-data/dates/${TimeTrackingAPI.selectedDate}`;
        console.log('Fetching data from:', apiURL);
        const response = await axios.get(apiURL);

        console.log(`Data for ${TimeTrackingAPI.selectedDate}:`, response.data);
        createTimeTrackingTable(response.data);
    } catch (error) {
        console.error(`Error fetching data for ${TimeTrackingAPI.selectedDate}:`, error);
    } finally {
        hideLoadingIndicator();
    }
}


function closeTimeTrackingPopup() {
    document.getElementById('timeTrackingPopup').style.display = 'none';
    clearInterval(timeTrackingInterval);
}

// Update the interval in openTimeTrackingPopup
function openTimeTrackingPopup() {
    document.getElementById('timeTrackingPopup').style.display = 'block';
    fetchDatesFromAPI();
    // Fetch dates every 30 seconds instead of 1 second to reduce server load
    timeTrackingInterval = setInterval(fetchDatesFromAPI, 30000);
}