// Constants and Configuration
console.log('config.js loading, API_BASE_URL:', window.API_BASE_URL);

const CONFIG = {
  api: {
    // baseURL: window.API_BASE_URL || 'https://api-tracking.hard-softwerk.com', // Fall back hard coded link is only used for local development
    baseURL: window.API_BASE_URL || 'https://api.aneeshprasobhan.xyz',
  },
  map: {
    mapObj: null,
    germanyCoords: [51.1725, 10.6322],
    customZoom: 5.5,
    center: [48.125149, 8.339695],
    zoom: 19,
    maxZoom: 25,
    maxNativeZoom: 19,
    tileLayer: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  image: {
    currentOpacity: 0.5,
    currentScale: 0.05,
    initialScale: 0.05,
    midpoint: [0, 0],
    dimensions: {
      width: 7680,
      height: 4320,
    },
    rotationAngle: 0,
  },
  ui: {
    colors: {
      primary: '#2196F3',
      secondary: '#5F33F5',
      success: '#4CAF50',
      danger: '#f44336',
      warning: '#FFC107',
      info: '#2196F3',
      light: '#f1f1f1',
      dark: '#333',
      transparent: 'rgba(0, 0, 0, 0.5)',
      orange: '#F5740A',
      darkblue: '#1B263B',
      darkyellow: '#FFC700',
    },
  },
  custom: {
    Color: '#70ffae',
    Opacity: 0.5,
    n: 0,
    offsetW: 25,
    offsetH: 14,
  },
  zones: {
    ZoneBeans: {},
    zoneNames: [],
  },
  blukiiTypes: {
    colorTypes: {
      RSSIhub: '#2196F3',
      Go1000: '#f44336',
      Box5200: '#9E9E9E',
      Box10800: '#4CAF50',
      OutdoorMini5400: '#FFC107',
      Box230: '#9C27B0',
      OutdoorExtreme4000: '#FF5722',
      GoMini: '#009688',
      Go500: '#E91E63',
    },
    
  },
};

window.CONFIG = CONFIG;
// window.CONFIG = CONFIG;
export default CONFIG;
