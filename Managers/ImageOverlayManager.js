import CONFIG from "../config.js";
import "../src/Leaflet.ImageOverlay.Rotated.js";
import APIManager from "./APIManager.js";
import NotificationManager from "./NotificationManager.js";

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
    this.isEditMode = false;
    this.centerMarkers = new Map();
    this.imageFiles = [];
    this.dragStartLatLng = null;
    this.currentCenter = config.image.midpoint;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.setupEventHandlers();
    this.setupFileInput();
    // this.setupScaleSliderListener();
    this.apiManager = new APIManager();
    this.notificationManager = new NotificationManager();
    this.centerMarkers = new Map();
    this.rotationState = {
      angle: 0,
      transform: new DOMMatrix(),
      lastUpdateTime: 0,
    };
    // this.imagePoints = {
    //   topLeft: L.latLng(0, 0),
    //   topRight: L.latLng(0, 0),
    //   bottomLeft: L.latLng(0, 0),
    // };
    this.lastRotationAngle = 0;
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  async initializePlans(org, locale_info, floor) {
    this.disableSaveButton();
    this.disableDeleteButton();
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

          this.imagePoints = {
            topLeft: topLeft,
            topRight: topRight,
            bottomLeft: bottomLeft,
          };

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
            id: plan.id,
            center: plan.center,
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

          this.rotationAngle = plan.rotation || 0;

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
    fileInput.multiple = true;
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", (event) => {
      const files = Array.from(event.target.files);
      files.forEach((file) => this.handleFileUpload(file));
    });
  }

  async deleteImage() {
    if (this.activeImageIndex === null) return;

    const imageToDelete = this.imageOverlays[this.activeImageIndex];

    // If image was saved on server, delete from server
    if (imageToDelete.id) {
      const response = await this.apiManager.deleteImageFromServer(
        imageToDelete.id
      );
      console.log(response);
      if (response.message === "Plan deleted successfully") {
        this.notificationManager.show({
          type: "error",
          message: "Image deleted successfully",
        });
      } else {
        this.notificationManager.show({
          type: "Error",
          message: "Failed to delete image from server",
        });
      }
      // return response;
    }

    this.map.removeLayer(imageToDelete.overlay);

    // Remove from array
    this.imageOverlays.splice(this.activeImageIndex, 1);

    // Reset active image index
    this.activeImageIndex = null;

    // Reset UI
    // this.resetUIControls();
    this.disableSaveButton();
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
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate initial positioning
          const center = this.map.getCenter();
          const scale = this.config.image.initialScale;
          const aspectRatio = img.width / img.height;

          CONFIG.image.currentScale = scale;
          CONFIG.image.dimensions = { width: img.width, height: img.height };

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
            center: center,
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

          this.rotationAngle = 0;

          // Select the newly added image
          this.selectImage(this.imageOverlays.length - 1);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      this.notificationManager.show({
        type: "success",
        message: `${file.name} uploaded successfully`,
      })
    } catch (error) {
      console.error(error);
      this.notificationManager.show({
        type: "error",
        message: "Failed to upload image. Please try again.",
      });
    }
  }

  selectImage(index) {
    // Remove center marker from previously selected image
    if (this.activeImageIndex !== null) {
      const prevImage = this.imageOverlays[this.activeImageIndex];
      const prevMarker = this.centerMarkers.get(prevImage.overlay._leaflet_id);
      if (prevMarker) {
        this.map.removeLayer(prevMarker);
      }
      prevImage.isSelected = false;
    }

    this.activeImageIndex = index;
    const selectedImage = this.imageOverlays[index];
    selectedImage.isSelected = true;

    // Show center marker for selected image
    const marker = this.centerMarkers.get(selectedImage.overlay._leaflet_id);
    if (marker) {
      marker.addTo(this.map);
    }

    // Update UI controls
    this.updateUIForSelectedImage(selectedImage);

    // Enable/disable drag handlers based on edit mode
    if (this.isEditMode) {
      this.attachDragHandlers();
    }
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
    // Update sliders with the selected image's values
    const rotationSlider = document.getElementById("rotationSlider");
    const opacitySlider = document.getElementById("imageOpacitySlider");
    const scaleSlider = document.getElementById("scaleSlider");

    if (rotationSlider) {
      rotationSlider.querySelector("input").value = imageOverlay.rotationAngle;
    }
    if (opacitySlider) {
      opacitySlider.querySelector("input").value = imageOverlay.opacity;
    }
    if (scaleSlider) {
      scaleSlider.querySelector("input").value = imageOverlay.scale;
    }

    // Enable/disable sliders based on edit mode
    if (this.isEditMode) {
      this.enableSliders();
    } else {
      this.disableSliders();
    }
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

  /**
   * Update the scale of the selected image overlay, and reposition it around its center.
   * This function is called when the user changes the scale slider.
   * @param {number} scale The new scale value between 0 and 1.
   * @description
   * This function is responsible for updating the scale of the selected image overlay. It calculates the new points for the image overlay by taking into account the aspect ratio of the image and the new scale value. The new points are then used to reposition the image overlay around its center. Additionally, the function updates the scale and new points of the active image overlay.
   */
  updateImageScale(scale) {
    if (this.activeImageIndex === null) return;

    const selectedImage = this.imageOverlays[this.activeImageIndex];
    const currentCenter = selectedImage.center;

    // Get current rotation angle (0 if no rotation)
    const currentRotation = this.rotationAngle || 0;
    console.log("Current rotation angle:", currentRotation);

    // Calculate new points based on the scale and aspect ratio
    const width = selectedImage.dimensions.width;
    const height = selectedImage.dimensions.height;
    const aspectRatio = width / height;

    // Calculate offsets based on scale and aspect ratio
    const latOffset = scale / 111.19275649904434; // Convert scale to approximate degrees
    const lngOffset =
      (scale * aspectRatio) /
      (111.19275649904434 * Math.cos((currentCenter.lat * Math.PI) / 180));

    // Define new points around the center (without rotation)
    const newTopLeft = L.latLng(
      currentCenter.lat + latOffset / 2,
      currentCenter.lng - lngOffset / 2
    );
    const newTopRight = L.latLng(
      currentCenter.lat + latOffset / 2,
      currentCenter.lng + lngOffset / 2
    );
    const newBottomLeft = L.latLng(
      currentCenter.lat - latOffset / 2,
      currentCenter.lng - lngOffset / 2
    );

    // If there's a rotation, rotate the new points around the center
    if (currentRotation !== 0) {
      const rotatedTopLeft = this.rotatePoint(
        newTopLeft,
        currentCenter,
        currentRotation
      );
      const rotatedTopRight = this.rotatePoint(
        newTopRight,
        currentCenter,
        currentRotation
      );
      const rotatedBottomLeft = this.rotatePoint(
        newBottomLeft,
        currentCenter,
        currentRotation
      );

      // Reposition the image with rotated points
      selectedImage.overlay.reposition(
        rotatedTopLeft,
        rotatedTopRight,
        rotatedBottomLeft
      );

      // Update stored points with rotated points
      selectedImage.points = {
        topLeft: rotatedTopLeft,
        topRight: rotatedTopRight,
        bottomLeft: rotatedBottomLeft,
      };
    } else {
      // If no rotation, use the new points directly
      selectedImage.overlay.reposition(newTopLeft, newTopRight, newBottomLeft);

      // Update stored points
      selectedImage.points = {
        topLeft: newTopLeft,
        topRight: newTopRight,
        bottomLeft: newBottomLeft,
      };
    }

    // Update scale-related properties
    selectedImage.scale = scale;
    CONFIG.image.currentScale = scale;

    // Update center marker
    this.updateCenterMarker(selectedImage);
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
    selectedImage.center = this.calculateImageCenter();
    this.map.dragging.disable();
  }

  handleMouseMove(e) {
    if (this.activeImageIndex === null || !this.isEditMode) return;

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
    console.log("selectedImage", selectedImage);
    selectedImage.center = this.calculateImageCenter(
      newPoints.topRight,
      newPoints.bottomLeft
    );
    this.updateCenterMarker(selectedImage);
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
        const NewImagePoints = {
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
          NewImagePoints.topLeft,
          NewImagePoints.topRight,
          NewImagePoints.bottomLeft
        );

        // Update stored image points
        selectedImage.points = NewImagePoints;

        // Update the midpoint in CONFIG
        const newCenter = this.calculateImageCenter(
          NewImagePoints.topRight,
          NewImagePoints.bottomLeft
        );
        CONFIG.image.midpoint = [newCenter.lat, newCenter.lng];
        selectedImage.center = newCenter;
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
    const topRight =
      tr || this.imageOverlays[this.activeImageIndex].points.topRight;
    const bottomLeft =
      bl || this.imageOverlays[this.activeImageIndex].points.bottomLeft;

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
    if (this.activeImageIndex === null) return;
    console.log("imageOverlays: ", this.imageOverlays);
    const selectedImage = this.imageOverlays[this.activeImageIndex];
    const center = selectedImage.center;
    if (this.rotationAngle !== this.lastRotationAngle) {
      const deltaAngle = this.rotationAngle - this.lastRotationAngle;

      // Rotate each corner point
      const rotatedTopLeft = this.rotatePoint(
        selectedImage.points.topLeft,
        selectedImage.center,
        deltaAngle
      );
      const rotatedTopRight = this.rotatePoint(
        selectedImage.points.topRight,
        selectedImage.center,
        deltaAngle
      );
      const rotatedBottomLeft = this.rotatePoint(
        selectedImage.points.bottomLeft,
        selectedImage.center,
        deltaAngle
      );

      console.log(
        "TopLeft, TopRight, BottomLeft",
        rotatedTopLeft,
        rotatedTopRight,
        rotatedBottomLeft
      );

      selectedImage.overlay.reposition(
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

      selectedImage.points = {
        topLeft: rotatedTopLeft,
        topRight: rotatedTopRight,
        bottomLeft: rotatedBottomLeft,
      };

      selectedImage.rotationAngle = this.rotationAngle;
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
  }

  async saveImageToServer() {
    console.log("Saving images to server...");
    const savePromises = [];
    for (let index = 0; index < this.imageOverlays.length; index++) {
      const imageOverlay = this.imageOverlays[index];
      console.log(`Saving image ${index}...`);
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          org: "HSW",
          locale_info: "HSW",
          floor: 1,
          center: imageOverlay.center,
          topLeft: imageOverlay.points.topLeft,
          topRight: imageOverlay.points.topRight,
          bottomLeft: imageOverlay.points.bottomLeft,
          rotation: imageOverlay.rotationAngle,
          opacity: imageOverlay.opacity,
          scale: imageOverlay.scale,
          dimensions: imageOverlay.dimensions,
        })
      );

      if (!imageOverlay.id) {
        console.log("Saving new image");
        formData.append("image", imageOverlay.file);
        const response = await this.apiManager.request("/plans", {
          method: "POST",
          body: formData,
          headers: {},
        });
        this.notificationManager.show({
          message: `Saved ${imageOverlay.file.name} successfully!`,
          type: "success",
        });
        savePromises.push(response);
        console.log(response);
        imageOverlay.id = response.id;
      } else {
        console.log(`Updating image ${imageOverlay.id}`);
        const response = await this.apiManager.request(
          `/plans/${imageOverlay.id}`,
          {
            method: "PUT",
            body: formData,
            headers: {},
          }
        );
        this.notificationManager.show({
          message: `Updated ${imageOverlay.file.name} successfully!`,
          type: "success",
        });

        savePromises.push(response);
        console.log(response);
      }
      // await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      console.log("Waiting for all images to be saved...");
      await Promise.all(savePromises);
      console.log("All images saved successfully!");
      // After successful save, disable edit mode and sliders
      this.isEditMode = false;
      this.disableSliders();
      this.removeDragHandlers();

      // Update edit button state
      const editButton = document.getElementById("editImageButton");
      if (editButton) {
        editButton.style.backgroundColor = CONFIG.ui.colors.white;
        editButton.disabled = false;
        editButton.style.cursor = "pointer";
        editButton.style.opacity = "1";
      }
    } catch (error) {
      console.error("Error saving images:", error);
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

  enableSliders() {
    const sliders = ["scaleSlider", "rotationSlider", "imageOpacitySlider"];
    sliders.forEach((id) => {
      const slider = document.getElementById(id);
      if (slider) {
        const input = slider.querySelector("input");
        if (input) {
          input.disabled = false;
          slider.style.opacity = "1";
          slider.style.cursor = "pointer";
        }
      }
    });
  }

  disableSliders() {
    const sliders = ["scaleSlider", "rotationSlider", "imageOpacitySlider"];
    sliders.forEach((id) => {
      const slider = document.getElementById(id);
      if (slider) {
        const input = slider.querySelector("input");
        if (input) {
          input.disabled = true;
          slider.style.opacity = "0.5";
          slider.style.cursor = "not-allowed";
        }
      }
    });
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;

    if (this.isEditMode) {
      this.enableSliders();
      this.enableDeleteButton();
      // Enable dragging for selected image
      if (this.activeImageIndex !== null) {
        this.attachDragHandlers();
      }
    } else {
      this.disableDeleteButton();
      this.disableSliders();
      this.removeDragHandlers();
    }

    // Update button appearance
    const editButton = document.getElementById("editImageButton");
    if (editButton) {
      editButton.style.backgroundColor = this.isEditMode
        ? CONFIG.ui.colors.info
        : "white";
      editButton.style.color = this.isEditMode ? "white" : "black";
      editButton.style.boxShadow = this.isEditMode
        ? "5px 5px 10px inset #bbbbbb60, -5px -5px 10px inset #ffffff60, 5px 5px 10px #bbbbbb, -5px -5px 10px white"
        : "5px 5px 10px #bbbbbb, -5px -5px 10px white";
    }
  }

  // Create center marker for an image
  createCenterMarker(imageOverlay) {
    const center = this.calculateImageCenter(
      imageOverlay.points.topRight,
      imageOverlay.points.bottomLeft
    );

    const markerIcon = L.divIcon({
      className: "image-center-marker",
      html: `<img src="image_marker.svg" style="width: 24px; height: 24px;"/>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker(center, { icon: markerIcon, interactive: false });
    this.centerMarkers.set(imageOverlay.overlay._leaflet_id, marker);

    if (imageOverlay.isSelected) {
      marker.addTo(this.map);
    }
  }

  updateCenterMarker(imageOverlay) {
    const marker = this.centerMarkers.get(imageOverlay.overlay._leaflet_id);
    if (marker) {
      const center = this.calculateImageCenter(
        imageOverlay.points.topRight,
        imageOverlay.points.bottomLeft
      );
      marker.setLatLng(center);
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
