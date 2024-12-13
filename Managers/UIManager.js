import CONFIG from '../config.js';
import APIManager from './APIManager.js';

// UIManager.js
class UIManager {
  constructor() {
    this.elements = {};
    this.dm;
    this.apiManager = new APIManager();
  }

  createButton(config) {
    const container =
      document.getElementById('buttonContainer') ||
      document.createElement('div');
    container.id = 'buttonContainer';
    container.style =
      `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        gap: 10px;
        justify-content: center;
        align-items: center;
        z-index: 1002;
        width: 350px;
        position: absolute;
        right: 10px;
        bottom: 10px;
        background-color: rgba(255, 255, 255, 0.8);
        padding: 20px;
        border-radius: 25px;
      `;
    const button = document.createElement('button');
    button.id = config.id;
    Object.assign(button.style, {
      // position: 'relative',
      padding: '10px',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      zIndex: '1000',
      alignText: 'center',
      ...config.styles,
      backgroundColor: (config.id === 'saveButton') ? `${CONFIG.ui.colors.info}` : 'white',
      color: (config.id === 'saveButton') ? 'white' : 'black',
      boxShadow: '5px 5px 10px #bbbbbb, -5px -5px 10px white',
    });
    button.textContent = config.text;
    button.addEventListener('click', config.onClick);
    container.appendChild(button);
    document.body.appendChild(container);
    this.elements[config.id] = button;
    return button;
  }

  createSliderContainer(config) {
    const container = document.createElement('div');
    container.id = config.id;
    Object.assign(container.style, {
      position: 'absolute',
      [config.position || 'bottom']: config.pos || '10px',
      left: '10px',
      backgroundColor: 'rgba(255,255,255,0.8)',
      padding: '10px',
      zIndex: '1000',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      width: '320px',
      justifyContent: 'space-between',
    });
    if (config.hide) {
      container.style.display = 'none';
    }
    return container;
  }

  createSliderElement(config) {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = config.min.toString();
    slider.max = config.max.toString();
    slider.step = config.step.toString();
    slider.value = config.value.toString();
    slider.style.width = '180px';

    // Call the callback with initial value
    config.callback(config.value);

    slider.oninput = () => {
      const numValue = Number(slider.value);
      config.callback(numValue);
    };

    return slider;
  }

  createSliderControls(container, slider, config) {
    const label = document.createElement('label');
    label.textContent = config.labelText;
    label.style.fontWeight = 'bold';
    label.style.width = '60px';

    const minusSpan = document.createElement('span');
    minusSpan.textContent = '-';
    minusSpan.style.cursor = 'pointer';
    minusSpan.style.fontSize = '20px';
    minusSpan.style.userSelect = 'none';

    const plusSpan = document.createElement('span');
    plusSpan.textContent = '+';
    plusSpan.style.cursor = 'pointer';
    plusSpan.style.fontSize = '20px';
    plusSpan.style.userSelect = 'none';

    minusSpan.onclick = () => {
      const currentValue = Number(slider.value);
      const newValue = Math.max(
        Number(config.min),
        currentValue - Number(config.step)
      );
      slider.value = newValue;
      config.callback(newValue);
    };

    plusSpan.onclick = () => {
      const currentValue = Number(slider.value);
      const newValue = Math.min(
        Number(config.max),
        currentValue + Number(config.step)
      );
      slider.value = newValue;
      config.callback(newValue);
    };

    container.appendChild(label);
    container.appendChild(minusSpan);
    container.appendChild(slider);
    container.appendChild(plusSpan);
  }

  createSlider(config) {
    const container = this.createSliderContainer(config);
    const slider = this.createSliderElement(config);
    this.setupSliderControls(container, slider, config);
    document.body.appendChild(container);
    this.elements[config.id] = slider;
    return slider;
  }

  createColorPicker(config) {
    const container = document.createElement('div');
    container.id = config.id;
    Object.assign(container.style, {
      position: 'absolute',
      bottom: config.bottom || '160px',
      left: '10px',
      backgroundColor: 'rgba(255,255,255,0.8)',
      padding: '10px',
      zIndex: '1000',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      width: '320px',
      justifyContent: 'space-between',
    });

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = CONFIG.ui.primary || '#FF6600';
    colorPicker.style.marginRight = '10px';

    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '0';
    opacityInput.max = '1';
    opacityInput.step = '0.1';
    opacityInput.value = CONFIG.image.initialOpacity || '0.4';

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color: ';
    colorLabel.style.fontWeight = 'bold';
    colorLabel.appendChild(colorPicker);

    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity: ';
    opacityLabel.style.fontWeight = 'bold';

    const opacityMinusSpan = document.createElement('span');
    opacityMinusSpan.textContent = '-';
    opacityMinusSpan.style.cursor = 'pointer';
    opacityMinusSpan.style.fontSize = '20px';
    opacityMinusSpan.style.userSelect = 'none';

    const opacityPlusSpan = document.createElement('span');
    opacityPlusSpan.textContent = '+';
    opacityPlusSpan.style.cursor = 'pointer';
    opacityPlusSpan.style.fontSize = '20px';
    opacityPlusSpan.style.userSelect = 'none';

    opacityMinusSpan.onclick = () => {
      const currentValue = parseFloat(opacityInput.value);
      opacityInput.value = Math.max(0, currentValue - 0.1).toFixed(1);
      CONFIG.custom.Color = colorPicker.value;
      CONFIG.custom.Opacity = opacityInput.value;
      config.onChange(colorPicker.value, opacityInput.value);
      this.dm.updateDrawingOptions();
    };

    opacityPlusSpan.onclick = () => {
      const currentValue = parseFloat(opacityInput.value);
      opacityInput.value = Math.min(1, currentValue + 0.1).toFixed(1);
      CONFIG.custom.Color = colorPicker.value;
      CONFIG.custom.Opacity = opacityInput.value;
      config.onChange(colorPicker.value, opacityInput.value);
      this.dm.updateDrawingOptions();
    };

    colorPicker.addEventListener('input', () => {
      CONFIG.custom.Color = colorPicker.value;
      CONFIG.custom.Opacity = opacityInput.value;
      config.onChange(colorPicker.value, opacityInput.value);

      // Update drawing options
      this.dm.updateDrawingOptions();
    });

    opacityInput.addEventListener('input', () => {
      CONFIG.custom.Color = colorPicker.value;
      CONFIG.custom.Opacity = opacityInput.value;
      config.onChange(colorPicker.value, opacityInput.value);

      // Update drawing options
      this.dm.updateDrawingOptions();
    });

    container.appendChild(colorLabel);
    container.appendChild(colorPicker);
    container.appendChild(opacityLabel);
    container.appendChild(opacityMinusSpan);
    container.appendChild(opacityInput);
    container.appendChild(opacityPlusSpan);

    document.body.appendChild(container);

    this.elements[config.id] = {
      colorPicker,
      opacityInput,
      container,
    };

    return { colorPicker, opacityInput };
  }

  hideSliders() {
    // Object.values(this.sliders).forEach((slider) => {
    //   if (element.container) {
    //     element.container.style.display = 'none';
    //   } else {
    //     element.style.display = 'none';
    //   }
    // });
  }

  removeElement(id) {
    const element = this.elements[id];
    if (element) {
      if (element.container) {
        element.container.remove();
      } else {
        element.remove();
      }
      delete this.elements[id];
    }
  }

  // Function to create custom marker buttons
  createCustomMarkerButtons(markerConfigs, map) {
    markerConfigs.forEach((config) => {
      if (config && config.pm) {
        map.pm.Toolbar.createCustomControl({
          name: config.name,
          block: config.block,
          className: config.className,
          title: config.title,
          onClick: () => {
            // Remove any existing click handlers
            map.off('click');

            // Add new click handler for this marker type
            map.on('click', (e) => {
              const marker = L.marker(e.latlng, {
                draggable: true,
                icon: L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: ${config.color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 2px 2px 4px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                }),
              }).addTo(map);

              // Add popup with custom text
              marker.bindPopup(config.popupText);

              // Optional: Remove the click handler after placing the marker
              map.off('click');
            });
          },
          toggle: false,
        });
      } else {
        console.warn("Undefined or missing 'pm' property:", config);
      }
    });
  }

  async resetMap() {
    try {
      const response = await this.apiManager.firstMarkerData();
      console.log('response', response);
      if (!response || !response.hubs || response.hubs.length === 0) {
        const coords = CONFIG.map.germanyCoords;
        CONFIG.map.mapObj.setView(coords, CONFIG.map.customZoom);
      } else {
        const coords = response.hubs[0].coordinates;
        CONFIG.map.mapObj.setView(coords, CONFIG.map.zoom);
      }
    } catch (error) {
      console.error('Error resetting map:', error);
    }
  }

  // ... other UI creation methods
}

export default UIManager;
