const vscode = require('vscode');
const https = require('https');
const http = require('http');

class GiteaAuth {
    constructor() {
        this.instanceUrl = null;
        this.authToken = null;
    }

    /**
     * Initialize authentication from VS Code settings
     */
    async initialize() {
        const config = vscode.workspace.getConfiguration('gitea');
        this.instanceUrl = config.get('instanceUrl');
        this.authToken = config.get('authToken');

        if (!this.instanceUrl || !this.authToken) {
            return false;
        }

        return await this.validateCredentials();
    }

    /**
     * Validate credentials by making a test API call
     */
    async validateCredentials() {
        try {
            const user = await this.makeRequest('/api/v1/user');
            if (user && user.login) {
                vscode.window.showInformationMessage(`Authenticated as ${user.login} on ${this.instanceUrl}`);
                return true;
            }
            return false;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to authenticate with Gitea: ${error.message}`);
            return false;
        }
    }

    /**
     * Configure Gitea instance and authentication
     */
    async configure() {
        // Get instance URL
        const instanceUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Gitea instance URL',
            placeHolder: 'https://gitea.example.com',
            value: this.instanceUrl || '',
            validateInput: (value) => {
                if (!value) return 'Instance URL is required';
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (!instanceUrl) return;

        // Get auth token
        const authToken = await vscode.window.showInputBox({
            prompt: 'Enter your Personal Access Token',
            placeHolder: 'Your Gitea Personal Access Token',
            password: true,
            validateInput: (value) => {
                if (!value) return 'Token is required';
                return null;
            }
        });

        if (!authToken) return;

        // Save to settings
        const config = vscode.workspace.getConfiguration('gitea');
        await config.update('instanceUrl', instanceUrl, vscode.ConfigurationTarget.Global);
        await config.update('authToken', authToken, vscode.ConfigurationTarget.Global);

        this.instanceUrl = instanceUrl;
        this.authToken = authToken;

        // Validate
        await this.validateCredentials();
    }

    /**
     * Make an authenticated request to the Gitea API
     * @param {string} endpoint - API endpoint (e.g., '/api/v1/user')
     * @param {object} options - Request options
     */
    makeRequest(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.instanceUrl || !this.authToken) {
                reject(new Error('Gitea not configured. Please run "Gitea: Configure Instance"'));
                return;
            }

            const url = new URL(endpoint, this.instanceUrl);
            const protocol = url.protocol === 'https:' ? https : http;

            const requestOptions = {
                method: options.method || 'GET',
                headers: {
                    'Authorization': `token ${this.authToken}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = protocol.request(url, requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    /**
     * Check if authentication is configured
     */
    isConfigured() {
        return !!(this.instanceUrl && this.authToken);
    }
}

module.exports = GiteaAuth;
