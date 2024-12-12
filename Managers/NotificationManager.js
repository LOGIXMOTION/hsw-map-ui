class NotificationManager {
    constructor(container = 'notification-container') {
        this.container = document.getElementById(container);
    }

    // Create and display a notification
    show(options = {}) {
        const {
            message = 'Notification',
            type = 'info',
            duration = 2000,
            title = ''
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Add title if exists
        if (title) {
            const titleElement = document.createElement('strong');
            titleElement.textContent = title + ' ';
            notification.appendChild(titleElement);
        }

        // Add message
        const messageElement = document.createElement('span');
        messageElement.textContent = message;
        notification.appendChild(messageElement);

        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => this.remove(notification);
        notification.appendChild(closeButton);

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'notification-progress';
        progressBar.style.animationDuration = `${duration}ms`;
        notification.appendChild(progressBar);

        // Add to container
        this.container.appendChild(notification);

        // Auto-remove after duration
        const removeTimeout = setTimeout(() => {
            this.remove(notification);
        }, duration);

        // Allow manual removal
        closeButton.addEventListener('click', () => {
            clearTimeout(removeTimeout);
        });

        return notification;
    }

    // Remove a specific notification
    remove(notification) {
        notification.classList.add('notification-fade-out');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }
}

// Initialize Notification Manager
const notificationManager = new NotificationManager('notification-container');

// Example usage demonstration
function showExamples() {
    notificationManager.show({
        message: 'Operation completed successfully!',
        type: 'success'
    });

    setTimeout(() => {
        notificationManager.show({
            title: 'Warning',
            message: 'Something might need your attention.',
            type: 'warning'
        });
    }, 1000);

    setTimeout(() => {
        notificationManager.show({
            title: 'Error',
            message: 'An unexpected error occurred.',
            type: 'error'
        });
    }, 2000);
}

// // Demonstrate notifications on page load
// window.onload = showExamples;

export default NotificationManager;