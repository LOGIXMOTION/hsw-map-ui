import CONFIG from "../config.js";
import "../src/Leaflet.ImageOverlay.Rotated.js";
import APIManager from "./APIManager.js";

// Image Overlay Manager
class ImageOverlayManager {
  constructor(map, config) {
    this.map = map;
    this.config = config;
    this.imageOverlays = [];
    this.originalImages = [];
    this.uploadedImages = [];
    this.activeImageIndex = null;
    this.rotationAngle = 0;
    this.isCursorOverImage = false;
    this.isDraggingImage = false;
    this.isCtrlPressed = false;
    this.imageFiles = [];
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
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  async initializePlans(org, locale_info, floor) {
    const Plans = await this.apiManager.getPlans(org, locale_info, floor);
    console.log("Plans:", Plans);

    // Clear any existing image overlays
    if (this.imageOverlays.length > 0) {
      this.imageOverlays.forEach((imageOverlay) => {
        this.map.removeLayer(imageOverlay.overlay);
      });
      this.imageOverlays = [];
    }

    for (const plan of Plans.plans) {
      // Fetch the image from the server
      const response = await fetch(CONFIG.api.baseURL + plan.imagePath);
      const blob = await response.blob();

      // Create a File object from the blob
      const imageFile = new File([blob], `plan_${plan.id}.jpg`, {
        type: response.headers.get("content-type"),
      });

      // Create a new image element to get dimensions
      const img = new Image();
      img.src = URL.createObjectURL(blob);

      await new Promise((resolve) => {
        img.onload = () => {
          // Calculate initial positioning
          const topLeft = L.latLng(plan.topLeft.lat, plan.topLeft.lng);
          const topRight = L.latLng(plan.topRight.lat, plan.topRight.lng);
          const bottomLeft = L.latLng(plan.bottomLeft.lat, plan.bottomLeft.lng);

          // Create image overlay
          const imageOverlay = {
            overlay: L.imageOverlay
              .rotated(
                URL.createObjectURL(blob),
                topLeft,
                topRight,
                bottomLeft,
                {
                  opacity: plan.opacity || CONFIG.image.currentOpacity,
                }
              )
              .addTo(this.map),
            file: imageFile,
            points: {
              topLeft: topLeft,
              topRight: topRight,
              bottomLeft: bottomLeft,
            },
            rotationAngle: plan.rotation || 0,
            opacity: plan.opacity || CONFIG.image.currentOpacity,
            scale: plan.scale || CONFIG.image.currentScale,
            dimensions: { width: img.width, height: img.height },
            isSelected: false,
          };

          // Add unique identifier from server
          imageOverlay.overlay.options.id = plan.id;

          // Add to image overlays array
          this.imageOverlays.push(imageOverlay);

          // Attach click handler to select image
          this.attachOverlayHandlers(imageOverlay);

          resolve();
        };
      });
    }
    // If there are images, select the first one
    if (this.imageOverlays.length > 0) {
      this.selectImage(0);
    }
  }

  setupFileInput() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true; // Allow multiple file selection
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", (event) => {
      const files = Array.from(event.target.files);
      files.forEach((file) => this.handleFileUpload(file));
    });
  }

  deleteImage() {
    if (this.activeImageIndex === null) return;

    // Remove from map
    const imageToDelete = this.imageOverlays[this.activeImageIndex];
    this.map.removeLayer(imageToDelete.overlay);

    // If image was saved on server, delete from server
    if (imageToDelete.overlay.options.id) {
      this.apiManager.deleteImageFromServer(imageToDelete.overlay.options.id);
    }

    // Remove from array
    this.imageOverlays.splice(this.activeImageIndex, 1);

    // Reset active image index
    this.activeImageIndex = null;

    // Reset UI
    this.resetUIControls();
  }

  uploadButtonStatus(disable = true) {
    // Get the button element directly from the event
    const button = document.getElementById("uploadImageButton");
    if (disable) {
      // Disable the button
      button.disabled = true;
      button.style.cursor = "not-allowed";
      button.style.opacity = "0.5";
    } else {
      // Enable the button
      button.disabled = false;
      button.style.cursor = "pointer";
      button.style.opacity = "1";
    }
  }

  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate initial positioning
        const center = this.map.getCenter();
        const scale = this.config.image.initialScale;
        const aspectRatio = img.width / img.height;

        // Calculate offsets
        const latOffset = scale / 111.19275649904434;
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

        // Create image overlay
        const imageOverlay = {
          overlay: L.imageOverlay
            .rotated(e.target.result, topLeft, topRight, bottomLeft, {
              opacity: CONFIG.image.currentOpacity,
            })
            .addTo(this.map),
          file: file,
          points: {
            topLeft: topLeft,
            topRight: topRight,
            bottomLeft: bottomLeft,
          },
          rotationAngle: 0,
          opacity: CONFIG.image.currentOpacity,
          scale: CONFIG.image.initialScale,
          dimensions: { width: img.width, height: img.height },
          isSelected: false,
        };

        // Add unique identifier
        imageOverlay.overlay.options.id = `image_${this.imageOverlays.length}`;

        // Add to image overlays array
        this.imageOverlays.push(imageOverlay);

        // Attach event handlers for this specific overlay
        this.attachOverlayHandlers(imageOverlay);

        // Select the newly added image
        this.selectImage(this.imageOverlays.length - 1);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  selectImage(index) {
    // Deselect previously active image
    if (this.activeImageIndex !== null) {
      this.deselectImage(this.activeImageIndex);
    }

    // Select new image
    this.activeImageIndex = index;
    const selectedImage = this.imageOverlays[index];
    selectedImage.isSelected = true;

    // Update UI for selected image
    this.updateUIForSelectedImage(selectedImage);

    // Attach specific handlers for the selected image
    this.attachSpecificHandlers(selectedImage);
  }

  deselectImage(index) {
    if (index !== null && this.imageOverlays[index]) {
      this.imageOverlays[index].isSelected = false;

      // Remove specific event handlers
      this.removeSpecificHandlers(this.imageOverlays[index]);
    }

    // Reset UI elements
    this.resetUIControls();
  }

  updateUIForSelectedImage(imageOverlay) {
    // Update rotation slider
    const rotationSlider = document.getElementById("rotationSlider");
    if (rotationSlider) {
      rotationSlider.querySelector("input").value = imageOverlay.rotationAngle;
    }

    // Update opacity slider
    const opacitySlider = document.getElementById("imageOpacitySlider");
    if (opacitySlider) {
      opacitySlider.querySelector("input").value = imageOverlay.opacity * 100;
    }

    // Update scale slider
    const scaleSlider = document.getElementById("scaleSlider");
    if (scaleSlider) {
      scaleSlider.querySelector("input").value = imageOverlay.scale;
    }

    // Enable/disable buttons
    this.enableEditButton();
    this.enableSaveButton();
    this.enableDeleteButton();
  }

  resetUIControls() {
    // Disable buttons when no image is selected
    this.disableEditButton();
    this.disableSaveButton();
    this.disableDeleteButton();
  }

  attachOverlayHandlers(imageOverlay) {
    imageOverlay.overlay.on("click", () => {
      // Find the index of the clicked image
      const index = this.imageOverlays.findIndex(
        (img) => img.overlay === imageOverlay.overlay
      );
      this.selectImage(index);
    });
  }

  attachSpecificHandlers(imageOverlay) {
    // Implement specific drag and rotation handlers for the selected image
    imageOverlay.overlay.on("mousedown", this.handleMouseDown);
    this.map.on("mousemove", this.handleMouseMove);
    this.map.on("mouseup", this.handleMouseUp);
  }

  removeSpecificHandlers(imageOverlay) {
    // Remove specific event handlers
    imageOverlay.overlay.off("mousedown", this.handleMouseDown);
    this.map.off("mousemove", this.handleMouseMove);
    this.map.off("mouseup", this.handleMouseUp);
  }

  calculateBounds(scale, w, h) {
    const width = w || CONFIG.image.dimensions.width;
    const height = h || CONFIG.image.dimensions.height;

    // Get current center point
    let center = this.imageOverlays
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

    console.log("scale: ", scale);
    console.log("width, height: ", width, height);
    console.log("center: ", center);
    console.log("Aspect ratio: ", aspectRatio);
    console.log("latOffset, lngOffset: ", latOffset, lngOffset);
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

    this.imageOverlays.reposition(topLeft, topRight, bottomLeft);

    // Store new points for next rotation
    this.imagePoints = {
      topLeft: topLeft,
      topRight: topRight,
      bottomLeft: bottomLeft,
    };

    console.log("rotationAngle: ", this.rotationAngle);
    console.log("lastRotationAngle: ", this.lastRotationAngle);
    this.lastRotationAngle = 0;
    console.log("lastRotationAngle after: ", this.lastRotationAngle);
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
    // Implementation similar to previous version, but scoped to selected image
    const selectedImage = this.imageOverlays[this.activeImageIndex];
    selectedImage.dragStartLatLng = e.latlng;
    selectedImage.dragStartPoints = { ...selectedImage.points };
    this.map.dragging.disable();
  }

  handleMouseMove(e) {
    if (this.activeImageIndex === null) return;

    const selectedImage = this.imageOverlays[this.activeImageIndex];
    if (!selectedImage.dragStartLatLng) return;

    const currentLatLng = e.latlng;
    const latDiff = currentLatLng.lat - selectedImage.dragStartLatLng.lat;
    const lngDiff = currentLatLng.lng - selectedImage.dragStartLatLng.lng;

    // Create new image points
    const newPoints = {
      topLeft: L.latLng(
        selectedImage.dragStartPoints.topLeft.lat + latDiff,
        selectedImage.dragStartPoints.topLeft.lng + lngDiff
      ),
      topRight: L.latLng(
        selectedImage.dragStartPoints.topRight.lat + latDiff,
        selectedImage.dragStartPoints.topRight.lng + lngDiff
      ),
      bottomLeft: L.latLng(
        selectedImage.dragStartPoints.bottomLeft.lat + latDiff,
        selectedImage.dragStartPoints.bottomLeft.lng + lngDiff
      ),
    };

    // Reposition the image
    selectedImage.overlay.reposition(
      newPoints.topLeft,
      newPoints.topRight,
      newPoints.bottomLeft
    );

    // Update stored points
    selectedImage.points = newPoints;
  }

  handleMouseUp() {
    if (this.activeImageIndex === null) return;

    const selectedImage = this.imageOverlays[this.activeImageIndex];
    selectedImage.dragStartLatLng = null;
    this.map.dragging.enable();
  }

  removeDragHandlers() {
    // Remove handlers from all image overlays
    this.imageOverlays.forEach((imageOverlay) => {
      imageOverlay.overlay.off("mouseover", this.handleMouseOver);
      imageOverlay.overlay.off("mouseout", this.handleMouseOut);
    });

    // Remove map-level event listeners
    this.map.off("mousedown");
    this.map.off("mousemove");
    this.map.off("mouseup");
  }

  attachDragHandlers() {
    if (this.imageOverlays.length === 0) return;

    // Remove existing handlers first
    this.removeDragHandlers();

    // Attach handlers to each image overlay
    this.imageOverlays.forEach((imageOverlay) => {
      imageOverlay.overlay.on("mouseover", this.handleMouseOver);
      imageOverlay.overlay.on("mouseout", this.handleMouseOut);
    });

    this.map.on("mousedown", (e) => {
      // Check if cursor is over any image
      const isOverAnyImage = this.imageOverlays.some((imageOverlay) => {
        const imageBounds = imageOverlay.overlay.getBounds();
        return imageBounds.contains(e.latlng);
      });

      if (isOverAnyImage) {
        // Find the specific image the cursor is over
        const selectedImageOverlay = this.imageOverlays.find((imageOverlay) => {
          const imageBounds = imageOverlay.overlay.getBounds();
          return imageBounds.contains(e.latlng);
        });

        if (selectedImageOverlay) {
          // Select the image
          const index = this.imageOverlays.indexOf(selectedImageOverlay);
          this.selectImage(index);

          // Prepare for dragging
          this.isDraggingImage = true;
          this.dragStartLatLng = e.latlng;
          this.dragStartImagePoints = { ...selectedImageOverlay.points };
          this.map.dragging.disable();
          e.originalEvent.preventDefault();
        }
      } else {
        // If not over any image, enable map dragging
        this.isDraggingImage = false;
        this.map.dragging.enable();
      }
    });

    this.map.on("mousemove", (e) => {
      // Only drag if an image is selected and dragging started
      if (
        this.activeImageIndex !== null &&
        this.isDraggingImage &&
        this.dragStartImagePoints
      ) {
        const selectedImage = this.imageOverlays[this.activeImageIndex];
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

        // Reposition the selected image
        selectedImage.overlay.reposition(
          newImagePoints.topLeft,
          newImagePoints.topRight,
          newImagePoints.bottomLeft
        );

        // Update stored image points
        selectedImage.points = newImagePoints;

        // Update the midpoint in CONFIG
        const newCenter = this.calculateImageCenter(
          newImagePoints.topRight,
          newImagePoints.bottomLeft
        );
        CONFIG.image.midpoint = [newCenter.lat, newCenter.lng];
      }
    });

    this.map.on("mouseup", () => {
      // Reset dragging state
      this.isDraggingImage = false;
      this.dragStartLatLng = null;

      // Re-enable map dragging
      this.map.dragging.enable();
    });
  }

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
    if (!this.imageOverlays || !this.imagePoints) return;

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
      "TopLeft, TopRight, BottomLeft",
      rotatedTopLeft,
      rotatedTopRight,
      rotatedBottomLeft
    );

    // Add some markers to show the points
    // const markerTopLeft = L.marker(rotatedTopLeft).addTo(this.map);
    // const markerTopRight = L.marker(rotatedTopRight).addTo(this.map);
    // const markerBottomLeft = L.marker(rotatedBottomLeft).addTo(this.map);
    // Update the image overlay using the reposition method from L.ImageOverlay.Rotated
    this.imageOverlays.reposition(
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
      "Image Overlay Details:",
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
    if (this.activeImageIndex === null) return;

    const selectedImage = this.imageOverlays[this.activeImageIndex];
    const formData = new FormData();

    formData.append(
      "data",
      JSON.stringify({
        org: "HSW",
        locale_info: "HSW",
        floor: 1,
        topLeft: selectedImage.points.topLeft,
        topRight: selectedImage.points.topRight,
        bottomLeft: selectedImage.points.bottomLeft,
        rotation: selectedImage.rotationAngle,
        opacity: selectedImage.opacity,
        scale: selectedImage.scale,
        dimensions: selectedImage.dimensions,
      })
    );

    // If image doesn't have an ID, it's a new upload
    if (!selectedImage.overlay.options.id) {
      formData.append("image", selectedImage.file);
      this.apiManager
        .request("/plans", {
          method: "POST",
          body: formData,
          headers: {},
        })
        .then((res) => {
          // Update the image with new ID from server
          selectedImage.overlay.options.id = res.id;
        })
        .catch(console.error);
    } else {
      // Update existing image
      this.apiManager.request(`/plans/${selectedImage.overlay.options.id}`, {
        method: "PUT",
        body: formData,
        headers: {},
      });
    }
  }

  // Utility methods for enabling/disabling buttons
  enableEditButton() {
    const editButton = document.getElementById("editImageButton");
    if (editButton) {
      editButton.disabled = false;
      editButton.style.cursor = "pointer";
      editButton.style.opacity = "1";
    }
  }

  disableEditButton() {
    const editButton = document.getElementById("editImageButton");
    if (editButton) {
      editButton.disabled = true;
      editButton.style.cursor = "not-allowed";
      editButton.style.opacity = "0.5";
    }
  }

  enableSaveButton() {
    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.style.cursor = "pointer";
      saveButton.style.opacity = "1";
    }
  }

  disableSaveButton() {
    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.style.cursor = "not-allowed";
      saveButton.style.opacity = "0.5";
    }
  }

  enableDeleteButton() {
    const deleteButton = document.getElementById("deleteImageButton");
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.style.cursor = "pointer";
      deleteButton.style.opacity = "1";
    }
  }

  disableDeleteButton() {
    const deleteButton = document.getElementById("deleteImageButton");
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.style.cursor = "not-allowed";
      deleteButton.style.opacity = "0.5";
    }
  }

  // Add cleanup method for proper removal of event listeners
  cleanup() {
    // Remove all event listeners when cleaning up
    if (this.imageOverlays) {
      this.imageOverlays.off("mouseover", this.handleMouseOver);
      this.imageOverlays.off("mouseout", this.handleMouseOut);
      this.map.off("mousedown");
      this.map.off("mousemove", this.handleMouseMove);
      this.map.off("mouseup", this.handleMouseUp);

      this.map.removeLayer(this.imageOverlays);
      this.imageOverlays = null;
    }
  }
}

export default ImageOverlayManager;
