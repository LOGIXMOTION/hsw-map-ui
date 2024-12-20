class NotificationManager {
  constructor(options = {}) {
    const { containerId = "notification-container", styles = {} } = options;

    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(
        `Container with id '${containerId}' not found. Creating one.`
      );
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.styleElement = document.createElement("style");
    this.defaultStyles = {
      container: {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "1000",
        maxWidth: "350px",
        width: "100%",
      },
      notification: {
        position: "relative",
        marginBottom: "10px",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        opacity: "1",
        transition: "all 0.5s ease-in-out",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      },
      types: {
        success: {
          backgroundColor: "#4caf50",
          color: "white",
        },
        error: {
          backgroundColor: "#f44336",
          color: "white",
        },
        warning: {
          backgroundColor: "#ff9800",
          color: "white",
        },
        info: {
          backgroundColor: "#2196f3",
          color: "white",
        },
      },
      closeButton: {
        position: "absolute",
        top: "5px",
        right: "5px",
        background: "none",
        border: "none",
        color: "rgba(255, 255, 255, 0.7)",
        cursor: "pointer",
        fontSize: "18px",
      },
      progressBar: {
        position: "absolute",
        bottom: "0",
        left: "0",
        height: "4px",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        width: "100%",
        transformOrigin: "left",
      },
      animations: {
        fadeOut: {
          opacity: "0",
          transform: "translateX(100%)",
        },
        progress: {
          from: {
            transform: "scaleX(1)",
          },
          to: {
            transform: "scaleX(0)",
          },
        },
      },
    };

    this.currentStyles = this.mergeStyles(this.defaultStyles, customStyles);
    this.applyStyles();
  }

  mergeStyles(defaultStyles, customStyles) {
    const merged = { ...defaultStyles };

    Object.keys(customStyles).forEach((key) => {
      if (
        typeof customStyles[key] === "object" &&
        !Array.isArray(customStyles[key])
      ) {
        merged[key] = this.mergeStyles(
          defaultStyles[key] || {},
          customStyles[key]
        );
      } else {
        merged[key] = customStyles[key];
      }
    });

    return merged;
  }

  generateCSS() {
    const { currentStyles } = this;
    return `
            #${this.container.id} {
                ${this.objectToCSS(currentStyles.container)}
            }

            .notification {
                ${this.objectToCSS(currentStyles.notification)}
            }

            ${Object.entries(currentStyles.types)
              .map(
                ([type, styles]) => `
                .notification-${type} {
                    ${this.objectToCSS(styles)}
                }
            `
              )
              .join("")}

            .notification-close {
                ${this.objectToCSS(currentStyles.closeButton)}
            }

            .notification-fade-out {
                ${this.objectToCSS(currentStyles.animations.fadeOut)}
            }

            .notification-progress {
                ${this.objectToCSS(currentStyles.progressBar)}
            }

            @keyframes progress-animation {
                from {
                    ${this.objectToCSS(currentStyles.animations.progress.from)}
                }
                to {
                    ${this.objectToCSS(currentStyles.animations.progress.to)}
                }
            }
        `;
  }

  objectToCSS(styleObject) {
    return Object.entries(styleObject)
      .map(([property, value]) => {
        const cssProperty = property.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `${cssProperty}: ${value};`;
      })
      .join("\n");
  }

  applyStyles() {
    this.styleElement.textContent = this.generateCSS();
    document.head.appendChild(this.styleElement);
  }

  updateStyles(newStyles) {
    this.currentStyles = this.mergeStyles(this.currentStyles, newStyles);
    this.applyStyles();
  }

  show(options = {}) {
    const {
      message = "Notification",
      type = "info",
      duration = 2000,
      title = "",
    } = options;

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;

    if (title) {
      const titleElement = document.createElement("strong");
      titleElement.textContent = title + " ";
      notification.appendChild(titleElement);
    }

    const messageElement = document.createElement("span");
    messageElement.textContent = message;
    notification.appendChild(messageElement);

    const closeButton = document.createElement("button");
    closeButton.className = "notification-close";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = () => this.remove(notification);
    notification.appendChild(closeButton);

    const progressBar = document.createElement("div");
    progressBar.className = "notification-progress";
    progressBar.style.animationDuration = `${duration}ms`;
    progressBar.style.animationName = "progress-animation";
    progressBar.style.animationTimingFunction = "linear";
    progressBar.style.animationFillMode = "forwards";
    notification.appendChild(progressBar);

    this.container.appendChild(notification);

    const removeTimeout = setTimeout(() => {
      this.remove(notification);
    }, duration);

    closeButton.addEventListener("click", () => {
      clearTimeout(removeTimeout);
    });

    return notification;
  }

  remove(notification) {
    notification.classList.add("notification-fade-out");
    notification.addEventListener("transitionend", () => {
      notification.remove();
    });
  }
}

export default NotificationManager;
