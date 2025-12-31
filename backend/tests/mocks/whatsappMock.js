// Mock for whatsapp-web.js - Reference Example
// This file is not directly used in 'flow.test.js' (which uses Jest module mocking)
// but serves as an example of how to construct a manual mock for this library.

class Client {
    constructor(options) {
        this.options = options;
        this.callbacks = {};
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    async initialize() {
        if (this.callbacks['ready']) {
            this.callbacks['ready']();
        }
    }

    async sendMessage(to, content) {
        // Mock sending message
        return { to, content, timestamp: Date.now() };
    }

    async destroy() {
        return true;
    }
}

class LocalAuth {
    constructor(options) {
        this.clientId = options.clientId;
    }
}

class MessageMedia {
    static fromUrl(url) {
        return { mimetype: 'image/jpeg', data: 'base64data' };
    }
}

module.exports = {
    Client,
    LocalAuth,
    MessageMedia
};
