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

export default NotificationManager;