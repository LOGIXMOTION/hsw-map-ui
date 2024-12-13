import CONFIG from '../config.js';

// API Manager Class
class APIManager {
  constructor() {
    // Use the URL that was working before as fallback
    this.baseURL = window.API_BASE_URL || CONFIG.api.baseURL || 'https://api-tracking.hard-softwerk.com';
    console.log('APIManager using baseURL:', this.baseURL);
  }

  async request(endpoint, options = {headers: 'application/json'}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error in ${options.method || 'GET'} ${endpoint}:`, error);
      throw error;
    }
  }

  async getZones() {
    return this.request('/zones');
  }

  async getMarkers() {
    return this.request('/hubs');
  }

  async saveMarkerData(markerData) {
    try {
      console.log('Making API request to:', `${this.baseURL}/zones`);
      console.log('With data:', JSON.stringify(markerData, null, 2));

      const response = await fetch(`${this.baseURL}/hubs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(markerData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      // const textResponse = await response.text();
      // console.log('Raw response:', textResponse);

      // let jsonResponse;
      // try {
      //   jsonResponse = JSON.parse(textResponse);
      // } catch (e) {
      //   console.log('Response was not JSON:', textResponse);
      //   throw new Error('Invalid JSON response from server');
      // }

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${JSON.stringify(jsonResponse)}`
        );
      }

      return response.json();
    } catch (error) {
      console.error('Error in API call:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  getPlans(org, locale_info, floor) {
    return this.request(
      `/plans?org=${org}&locale_info=${locale_info}&floor=${floor}`
    );
  }

  async deleteImageFromServer(id) {
    const response = await this.request(`/plans/${id}`, {
      method: 'DELETE',
    });

    return response;
    // .then((res) => console.log(res))
    //   .catch((e) => console.error(e));
  }

  async firstMarkerData() {
    return this.request('/hubs');
  }

  // Add more API methods as needed
}

export default APIManager;
