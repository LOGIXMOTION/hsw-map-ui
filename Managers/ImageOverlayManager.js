import CONFIG from '../config.js';
import '../src/Leaflet.ImageOverlay.Rotated.js';
import APIManager from './APIManager.js';

// Image Overlay Manager
class ImageOverlayManager {
  constructor(map, config) {
    this.map = map;
    this.config = config;
    this.imageOverlay = null;
    this.originalImage = null;
    this.uploadedImage = null;
    this.rotationAngle = 0;
    this.isCursorOverImage = false;
    this.isDraggingImage = false;
    this.isCtrlPressed = false;
    this.imageFile = null;
    // this.isMarkerDragging = false;
    this.dragStartLatLng = null;
    this.currentCenter = config.image.midpoint;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.setupEventHandlers();
    this.setupFileInput();
    this.apiManager = new APIManager();
    this.rotationState = {
      angle: 0,
      transform: new DOMMatrix(),
      lastUpdateTime: 0,
    };
    this.lastRotationAngle = 0;
  }

  async initializePlans(org, locale_info, floor) {
    const Plans = await this.apiManager.getPlans(org, locale_info, floor);
    console.log('Plans:', Plans);

    for (const plan of Plans.plans) {
      // Fetch the image from the server
      const response = await fetch(
        CONFIG.api.baseURL + plan.imagePath
      );
      const blob = await response.blob();

      // Create a File object from the blob
      const imageFile = new File([blob], `plan_${plan.id}.jpg`, {
        type: response.headers.get('content-type'),
      });

      // Override the current file upload process
      const reader = new FileReader();
      this.imageFile = imageFile;

      reader.onload = (e) => {
        if (this.imageOverlay) {
          this.map.removeLayer(this.imageOverlay);
        }

        this.originalImage = e.target.result;
        this.uploadedImage = this.originalImage;

        const img = new Image();
        img.onload = () => {
          this.uploadButtonStatus();
          this.disableSaveButton();
          this.imageWidth = img.width;
          this.imageHeight = img.height;
          CONFIG.image.dimensions = { width: img.width, height: img.height };

          // Create rotated image overlay with server-provided coordinates
          this.imageOverlay = L.imageOverlay
            .rotated(
              this.uploadedImage,
              L.latLng(plan.topLeft.lat, plan.topLeft.lng),
              L.latLng(plan.topRight.lat, plan.topRight.lng),
              L.latLng(plan.bottomLeft.lat, plan.bottomLeft.lng),
              {
                opacity: plan.opacity || CONFIG.image.currentOpacity,
              }
            )
            .addTo(this.map);

          this.imageOverlay.options.id = plan.id;
          console.log('this.imageOverlay', this.imageOverlay);
          console.log(
            'this.imageOverlay.options.id',
            this.imageOverlay.options.id
          );

          // Store initial points for rotation reference
          this.imagePoints = {
            topLeft: L.latLng(plan.topLeft.lat, plan.topLeft.lng),
            topRight: L.latLng(plan.topRight.lat, plan.topRight.lng),
            bottomLeft: L.latLng(plan.bottomLeft.lat, plan.bottomLeft.lng),
          };

          this.rotationAngle = plan.rotation || 0;
          this.lastRotationAngle = this.rotationAngle;
          const rotationSlider = document.getElementById('rotationSlider');
          if (rotationSlider) {
            rotationSlider.querySelector('input').value = this.rotationAngle;
          } else {
            console.log('ImageOverlayManager: rotationSlider is NOT defined');
          }

          this.imageOpacity = plan.opacity || CONFIG.image.currentOpacity;
          const imageOpacitySlider =
            document.getElementById('imageOpacitySlider');
          if (imageOpacitySlider) {
            imageOpacitySlider.querySelector('input').value = this.imageOpacity;
          } else {
            console.log(
              'ImageOverlayManager: imageOpacitySlider is NOT defined'
            );
          }

          this.imageScale = plan.scale || CONFIG.image.currentScale;
          const scaleSlider = document.getElementById('scaleSlider');
          if (scaleSlider) {
            scaleSlider.querySelector('input').value = this.imageScale;
          } else {
            console.log('ImageOverlayManager: scaleSlider is NOT defined');
          }
          // this.lastRotationAngle = 0;
          // this.updateImageRotation();
          this.currentCenter = plan.center;
          CONFIG.image.midpoint = [plan.center.lat, plan.center.lng];

          // this.attachDragHandlers();
        };
        img.src = this.uploadedImage;
      };
      reader.readAsDataURL(imageFile);
    }
  }

  setupFileInput() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });
  }

  deleteImage() {
    this.map.removeLayer(this.imageOverlay);

    if (this.imageOverlay.options.id) {
      this.apiManager.deleteImageFromServer(this.imageOverlay.options.id);
    }

    this.imageOverlay = null;
    this.originalImage = null;
    this.uploadedImage = null;
    this.rotationAngle = 0;
    this.isCursorOverImage = false;
    this.isDraggingImage = false;
    this.isCtrlPressed = false;
    // this.isMarkerDragging = false;
    this.dragStartLatLng = null;
    this.currentCenter = this.config.image.midpoint;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.uploadButtonStatus(false);
  }

  uploadButtonStatus(disable = true) {
    // Get the button element directly from the event
    const button = document.getElementById('uploadImageButton');
    if (disable) {
      // Disable the button
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      button.style.opacity = '0.5';
    } else {
      // Enable the button
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
    }
  }

  handleFileUpload(file) {
    const reader = new FileReader();
    this.imageFile = file;
    reader.onload = (e) => {
      if (this.imageOverlay) {
        this.map.removeLayer(this.imageOverlay);
      }

      this.originalImage = e.target.result;
      this.uploadedImage = this.originalImage;

      const img = new Image();
      img.onload = () => {
        this.uploadButtonStatus();
        this.enableSaveButton();
        this.disableEditButton();
        this.imageWidth = img.width;
        this.imageHeight = img.height;
        CONFIG.image.dimensions = { width: img.width, height: img.height };
        const aspectRatio = this.imageWidth / this.imageHeight;

        // Calculate three points for the image corners
        const center = this.map.getCenter();
        const scale = this.config.image.initialScale;

        // Calculate offsets based on scale and aspect ratio
        const latOffset = scale / 111.19275649904434; // Convert scale to approximate degrees
        const lngOffset =
          (scale * aspectRatio) /
          (111.19275649904434 * Math.cos((center.lat * Math.PI) / 180));

        // Define three points for the image
        const topLeft = L.latLng(
          center.lat + latOffset / 2,
          center.lng - lngOffset / 2
        );
        const topRight = L.latLng(
          center.lat + latOffset / 2,
          center.lng + lngOffset / 2
        );
        const bottomLeft = L.latLng(
          center.lat - latOffset / 2,
          center.lng - lngOffset / 2
        );

        // Create rotated image overlay
        this.imageOverlay = L.imageOverlay
          .rotated(this.uploadedImage, topLeft, topRight, bottomLeft, {
            opacity: CONFIG.image.currentOpacity,
          })
          .addTo(this.map);

        // Store initial points for rotation reference
        this.imagePoints = {
          topLeft: topLeft,
          topRight: topRight,
          bottomLeft: bottomLeft,
        };

        this.attachDragHandlers();

        this.rotationAngle = 0;
        this.lastRotationAngle = 0;
        const rotationSlider = document.getElementById('rotationSlider');
        if (rotationSlider) {
          rotationSlider.querySelector('input').value = 0;
        } else {
          console.log('ImageOverlayManager: rotationSlider is NOT defined');
        }

        this.imageOpacity = CONFIG.image.currentOpacity;
        const imageOpacitySlider =
          document.getElementById('imageOpacitySlider');
        if (imageOpacitySlider) {
          imageOpacitySlider.querySelector('input').value =
            CONFIG.image.currentOpacity;
        } else {
          console.log('ImageOverlayManager: imageOpacitySlider is NOT defined');
        }

        this.imageScale = CONFIG.image.initialScale;
        const scaleSlider = document.getElementById('scaleSlider');
        if (scaleSlider) {
          scaleSlider.querySelector('input').value = CONFIG.image.initialScale;
        } else {
          console.log('ImageOverlayManager: scaleSlider is NOT defined');
        }

        if (
          this.isCursorOverImage &&
          !this.isCtrlPressed &&
          !this.map.pm.globalDrawMode
        ) {
          this.map.dragging.disable();
        }
      };
      img.src = this.uploadedImage;
    };
    reader.readAsDataURL(file);
  }

  // calculateBounds(scale, aspectRatio) {
  //   // Get current center point
  //   let center;
  //   if (this.imageOverlay) {
  //     const currentBounds = this.imageOverlay.getBounds();
  //     center = currentBounds.getCenter();
  //   } else {
  //     center = L.latLng(
  //       this.config.image.midpoint[0],
  //       this.config.image.midpoint[1]
  //     );
  //   }

  //   // Calculate height in degrees latitude
  //   const latOffset = scale / 111.19275649904434; // Convert scale to approximate degrees

  //   // Calculate width based on aspect ratio
  //   // Adjust for latitude to maintain proper proportions
  //   const lngOffset =
  //     (scale * aspectRatio) /
  //     (111.19275649904434 * Math.cos((center.lat * Math.PI) / 180));

  //   // Create bounds maintaining aspect ratio
  //   return L.latLngBounds(
  //     [center.lat - latOffset / 2, center.lng - lngOffset / 2], // Southwest
  //     [center.lat + latOffset / 2, center.lng + lngOffset / 2] // Northeast
  //   );
  // }

  calculateBounds(scale, w, h) {
    const width = w || CONFIG.image.dimensions.width;
    const height = h || CONFIG.image.dimensions.height;

    // Get current center point
    let center = this.imageOverlay
      ? this.calculateImageCenter()
      : this.map.getCenter();

    // Calculate height in degrees latitude
    CONFIG.image.dimensions = { width: width, height: height };
    const aspectRatio = width / height;

    // Calculate offsets based on scale and aspect ratio
    const latOffset = scale / 111.19275649904434; // Convert scale to approximate degrees
    const lngOffset =
      (scale * aspectRatio) /
      (111.19275649904434 * Math.cos((center.lat * Math.PI) / 180));

    console.log('scale: ', scale);
    console.log('width, height: ', width, height);
    console.log('center: ', center);
    console.log('Aspect ratio: ', aspectRatio);
    console.log('latOffset, lngOffset: ', latOffset, lngOffset);
    console.log(center.lat + latOffset / 2, center.lng - lngOffset / 2);

    // Define three points for the image
    const topLeft = L.latLng(
      center.lat + latOffset / 2,
      center.lng - lngOffset / 2
    );
    const topRight = L.latLng(
      center.lat + latOffset / 2,
      center.lng + lngOffset / 2
    );
    const bottomLeft = L.latLng(
      center.lat - latOffset / 2,
      center.lng - lngOffset / 2
    );

    this.imageOverlay.reposition(topLeft, topRight, bottomLeft);

    // Store new points for next rotation
    this.imagePoints = {
      topLeft: topLeft,
      topRight: topRight,
      bottomLeft: bottomLeft,
    };

    console.log('rotationAngle: ', this.rotationAngle);
    console.log('lastRotationAngle: ', this.lastRotationAngle);
    this.lastRotationAngle = 0;
    console.log('lastRotationAngle after: ', this.lastRotationAngle);
    this.updateImageRotation();

    // Create bounds maintaining aspect ratio
    return L.latLngBounds(topLeft, topRight, bottomLeft);
  }

  setupEventHandlers() {
    // Bind methods to ensure correct context
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
  }

  // Drag handling function
  handleDrag(e) {}

  handleMouseOver() {
    this.isCursorOverImage = true;

    // Disable map dragging unless in control mode or draw mode
    if (!this.isCtrlPressed && !this.map.pm.globalDrawMode) {
      this.map.dragging.disable();
    }
    this.isDraggingImage = false;
  }

  handleMouseOut() {
    this.isCursorOverImage = false;
    this.isDraggingImage = false;
    this.map.dragging.enable();
  }

  handleMouseDown(e) {
    this.isDraggingImage = true;
    this.dragStartLatLng = e.latlng;
    this.dragStartImagePoints = { ...this.imagePoints }; // Store the initial image points
    // this.map.dragging.disable();
    // e.originalEvent.preventDefault();

    // Store the initial image points before dragging
    // this.dragStartImagePoints = {
    //   topLeft: this.imagePoints.topLeft.clone(),
    //   topRight: this.imagePoints.topRight.clone(),
    //   bottomLeft: this.imagePoints.bottomLeft.clone(),
    // };

    // Disable map dragging
    if (this.isCursorOverImage) this.map.dragging.disable();

    // Prevent default to stop map interactions
    e.originalEvent.preventDefault();
  }

  handleMouseMove(e) {
    // Check if we're actively dragging the image
    if (
      this.isDraggingImage &&
      this.uploadedImage &&
      this.dragStartImagePoints
    ) {
      try {
        const currentLatLng = e.latlng;

        // Calculate the total movement from the original drag start point
        const latDiff = currentLatLng.lat - this.dragStartLatLng.lat;
        const lngDiff = currentLatLng.lng - this.dragStartLatLng.lng;

        // Create new image points by translating the original points
        const newImagePoints = {
          topLeft: L.latLng(
            this.dragStartImagePoints.topLeft.lat + latDiff,
            this.dragStartImagePoints.topLeft.lng + lngDiff
          ),
          topRight: L.latLng(
            this.dragStartImagePoints.topRight.lat + latDiff,
            this.dragStartImagePoints.topRight.lng + lngDiff
          ),
          bottomLeft: L.latLng(
            this.dragStartImagePoints.bottomLeft.lat + latDiff,
            this.dragStartImagePoints.bottomLeft.lng + lngDiff
          ),
        };

        // Reposition the image using the new points
        this.imageOverlay.reposition(
          newImagePoints.topLeft,
          newImagePoints.topRight,
          newImagePoints.bottomLeft
        );

        // Update stored image points
        this.imagePoints = newImagePoints;

        // Update the midpoint in CONFIG
        const newCenter = this.calculateImageCenter();
        CONFIG.image.midpoint = [newCenter.lat, newCenter.lng];
      } catch (error) {
        console.error('Error during image drag:', error);
      }
    }
  }

  handleMouseUp() {
    // Reset dragging state
    this.isDraggingImage = false;
    this.dragStartLatLng = null;

    // Re-enable map dragging based on conditions
    if (!this.isCursorOverImage && this.map.pm.globalDrawMode) {
      this.map.dragging.enable();
    } else {
      this.map.dragging.disable();
    }
  }

  removeDragHandlers() {
    if (!this.imageOverlay) return;

    // Remove any existing handlers first to prevent multiple bindings
    this.imageOverlay.off('mouseover', this.handleMouseOver);
    this.imageOverlay.off('mouseout', this.handleMouseOut);
    this.map.off('mousedown');
    this.map.off('mousemove');
    this.map.off('mouseup');
  }

  attachDragHandlers() {
    if (!this.imageOverlay) return;

    this.removeDragHandlers();

    // Attach new handlers
    this.imageOverlay.on('mouseover', this.handleMouseOver);
    this.imageOverlay.on('mouseout', this.handleMouseOut);

    this.map.on('mousedown', (e) => {
      // Check if cursor is over the image
      const imageBounds = this.imageOverlay.getBounds();
      const isOverImage = imageBounds.contains(e.latlng);

      if (isOverImage) {
        // If over image, prepare for image dragging
        this.isDraggingImage = true;
        this.dragStartLatLng = e.latlng;
        this.dragStartImagePoints = { ...this.imagePoints };
        this.map.dragging.disable();
        e.originalEvent.preventDefault();
      } else {
        // If not over image, prevent image dragging
        this.isDraggingImage = false;
        this.map.dragging.enable();
      }
    });

    this.map.on('mousemove', (e) => {
      // console.log(this.isMarkerDragging);
      // Only drag image if we started dragging on the image
      if (
        this.isDraggingImage &&
        this.uploadedImage &&
        this.dragStartImagePoints
      ) {
        const currentLatLng = e.latlng;

        // Calculate the total movement from the original drag start point
        const latDiff = currentLatLng.lat - this.dragStartLatLng.lat;
        const lngDiff = currentLatLng.lng - this.dragStartLatLng.lng;

        // Create new image points by translating the original points
        const newImagePoints = {
          topLeft: L.latLng(
            this.dragStartImagePoints.topLeft.lat + latDiff,
            this.dragStartImagePoints.topLeft.lng + lngDiff
          ),
          topRight: L.latLng(
            this.dragStartImagePoints.topRight.lat + latDiff,
            this.dragStartImagePoints.topRight.lng + lngDiff
          ),
          bottomLeft: L.latLng(
            this.dragStartImagePoints.bottomLeft.lat + latDiff,
            this.dragStartImagePoints.bottomLeft.lng + lngDiff
          ),
        };

        // Reposition the image using the new points
        this.imageOverlay.reposition(
          newImagePoints.topLeft,
          newImagePoints.topRight,
          newImagePoints.bottomLeft
        );

        // Update stored image points
        this.imagePoints = newImagePoints;

        // Update the midpoint in CONFIG
        const newCenter = this.calculateImageCenter();
        CONFIG.image.midpoint = [newCenter.lat, newCenter.lng];
      }
    });

    this.map.on('mouseup', () => {
      // Reset dragging state
      this.isDraggingImage = false;
      this.dragStartLatLng = null;

      // Re-enable map dragging
      this.map.dragging.enable();
    });
  }

  // setMarkerDraggingState(isDragging) {
  //   this.isMarkerDragging = isDragging;
  // }

  // Add these new helper functions
  calculateImageCenter(tr, bl) {
    // TopRight & BottomLeft

    // const bounds = this.imageOverlay.getBounds();
    // We use the top-right and bottom-left points to find center
    const topRight = tr || this.imagePoints.topRight;
    const bottomLeft = bl || this.imagePoints.bottomLeft;

    // console.log('topRight', topRight, 'bottomLeft', bottomLeft);

    // Calculate the midpoint
    const centerLat = (topRight.lat + bottomLeft.lat) / 2;
    const centerLng = (topRight.lng + bottomLeft.lng) / 2;

    return L.latLng(centerLat, centerLng);
  }

  rotatePoint(point, center, angleInDegrees) {
    const angleRad = (angleInDegrees * Math.PI) / 180;
    const lngScalingFactor = Math.cos((center.lat * Math.PI) / 180);

    const dx = (point.lng - center.lng) * lngScalingFactor;
    const dy = point.lat - center.lat;

    const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    return L.latLng(
      center.lat + rotatedY,
      center.lng + rotatedX / lngScalingFactor
    );
  }

  updateImageRotation() {
    if (!this.imageOverlay || !this.imagePoints) return;

    const center = this.calculateImageCenter();
    const deltaAngle = this.rotationAngle - this.lastRotationAngle;

    // Rotate each corner point
    const rotatedTopLeft = this.rotatePoint(
      this.imagePoints.topLeft,
      center,
      deltaAngle
    );
    const rotatedTopRight = this.rotatePoint(
      this.imagePoints.topRight,
      center,
      deltaAngle
    );
    const rotatedBottomLeft = this.rotatePoint(
      this.imagePoints.bottomLeft,
      center,
      deltaAngle
    );

    console.log(
      'TopLeft, TopRight, BottomLeft',
      rotatedTopLeft,
      rotatedTopRight,
      rotatedBottomLeft
    );

    // Add some markers to show the points
    // const markerTopLeft = L.marker(rotatedTopLeft).addTo(this.map);
    // const markerTopRight = L.marker(rotatedTopRight).addTo(this.map);
    // const markerBottomLeft = L.marker(rotatedBottomLeft).addTo(this.map);
    // Update the image overlay using the reposition method from L.ImageOverlay.Rotated
    this.imageOverlay.reposition(
      rotatedTopLeft,
      rotatedTopRight,
      rotatedBottomLeft
    );

    // Store new points for next rotation
    this.imagePoints = {
      topLeft: rotatedTopLeft,
      topRight: rotatedTopRight,
      bottomLeft: rotatedBottomLeft,
    };

    this.lastRotationAngle = this.rotationAngle;
    CONFIG.image.rotationAngle = this.rotationAngle;

    console.log(
      'Image Overlay Details:',
      JSON.stringify(
        {
          topLeft: this.imagePoints.topLeft,
          topRight: this.imagePoints.topRight,
          bottomLeft: this.imagePoints.bottomLeft,
          rotation: this.rotationAngle,
          center: center,
          opacity: CONFIG.image.currentOpacity,
          scale: CONFIG.image.currentScale,
          dimensions: CONFIG.image.dimensions,
        },
        null,
        2
      )
    );
  }

  saveImageToServer() {
    const formData = new FormData();
    formData.append(
      'data',
      JSON.stringify({
        org: 'HSW',
        locale_info: 'HSW',
        floor: 1,
        openGround: false,
        topLeft: this.imagePoints.topLeft,
        topRight: this.imagePoints.topRight,
        bottomLeft: this.imagePoints.bottomLeft,
        rotation: this.rotationAngle,
        center: this.calculateImageCenter(),
        opacity: CONFIG.image.currentOpacity,
        scale: CONFIG.image.currentScale,
        dimensions: CONFIG.image.dimensions,
      })
    );
    if (!this.imageOverlay.options.id) {
      formData.append('image', this.imageFile);
      console.log('Uploaded image:', this.imageFile);
      this.apiManager
        .request('/plans', {
          method: 'POST',
          body: formData,
          headers: {},
        })
        .then((res) => console.log(res))
        .catch((e) => console.error(e));
      console.log('formData', formData);
    } else {
      this.apiManager.request(`/plans/${this.imageOverlay.options.id}`, {
        method: 'PUT',
        body: formData,
        headers: {},
      });
    }
  }

  enableSaveButton() {
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.style.cursor = 'pointer';
      saveButton.style.opacity = '1';
    }
  }

  enableEditButton() {
    const editButton = document.getElementById('editImageButton');
    if (editButton) {
      editButton.disabled = false;
      editButton.style.cursor = 'pointer';
      editButton.style.opacity = '1';
    }
  }

  disableSaveButton() {
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.style.cursor = 'not-allowed';
      saveButton.style.opacity = '0.5';
    }
  }

  disableEditButton() {
    const editButton = document.getElementById('editImageButton');
    if (editButton) {
      editButton.disabled = true;
      editButton.style.cursor = 'not-allowed';
      editButton.style.opacity = '0.5';
    }
  }

  // Add cleanup method for proper removal of event listeners
  cleanup() {
    // Remove all event listeners when cleaning up
    if (this.imageOverlay) {
      this.imageOverlay.off('mouseover', this.handleMouseOver);
      this.imageOverlay.off('mouseout', this.handleMouseOut);
      this.map.off('mousedown');
      this.map.off('mousemove', this.handleMouseMove);
      this.map.off('mouseup', this.handleMouseUp);

      this.map.removeLayer(this.imageOverlay);
      this.imageOverlay = null;
    }
  }
}

export default ImageOverlayManager;
