const vscode = require('vscode');
const https = require('https');
const http = require('http');

class GiteaAuth {
    constructor() {
        this.instanceUrl = null;
        this.authToken = null;
        this.activeProfile = null;
        this.profiles = {};
    }

    /**
     * Initialize authentication from VS Code settings
     */
    async initialize() {
        try {
            const config = vscode.workspace.getConfiguration('gitea');

            // Load profiles
            const savedProfiles = config.get('profiles') || {};
            this.profiles = savedProfiles;

            // Get active profile name
            const profileName = config.get('activeProfile') || 'default';

            // Load active profile
            if (this.profiles[profileName]) {
                this.activeProfile = profileName;
                const profile = this.profiles[profileName];
                this.instanceUrl = profile.instanceUrl;
                this.authToken = profile.authToken;
            } else {
            // Try legacy configuration for backward compatibility
                this.instanceUrl = config.get('instanceUrl');
                this.authToken = config.get('authToken');

                if (this.instanceUrl && this.authToken) {
                    // Migrate to profile-based system
                    this.profiles['default'] = {
                        instanceUrl: this.instanceUrl,
                        authToken: this.authToken
                    };
                    this.activeProfile = 'default';
                    await this.saveProfiles();
                }
            }

            if (!this.instanceUrl || !this.authToken) {
                return false;
            }

            return await this.validateCredentials();
        } catch (error) {
            console.error('Failed to initialize authentication:', error);
            vscode.window.showErrorMessage(`Failed to initialize Gitea authentication: ${error.message}`);
            return false;
        }
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
        try {
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

            // Get profile name
            const profileName = await vscode.window.showInputBox({
                prompt: 'Enter a profile name',
                placeHolder: 'e.g., work, personal, default',
                value: this.activeProfile || 'default',
                validateInput: (value) => {
                    if (!value) return 'Profile name is required';
                    return null;
                }
            });

            if (!profileName) return;

            // Save profile
            this.profiles[profileName] = {
                instanceUrl: instanceUrl,
                authToken: authToken
            };
            this.activeProfile = profileName;
            this.instanceUrl = instanceUrl;
            this.authToken = authToken;

            await this.saveProfiles();

            // Validate
            await this.validateCredentials();
        } catch (error) {
            console.error('Failed to configure Gitea:', error);
            vscode.window.showErrorMessage(`Failed to configure Gitea: ${error.message}`);
        }
    }

    /**
     * Add a new profile
     */
    async addProfile() {
        try {
            // Get instance URL
            const instanceUrl = await vscode.window.showInputBox({
                prompt: 'Enter your Gitea instance URL',
                placeHolder: 'https://gitea.example.com',
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

            if (!instanceUrl) return false;

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

            if (!authToken) return false;

            // Get profile name
            const profileName = await vscode.window.showInputBox({
                prompt: 'Enter a profile name',
                placeHolder: 'e.g., work, personal, main',
                validateInput: (value) => {
                    if (!value) return 'Profile name is required';
                    if (this.profiles[value]) return `Profile "${value}" already exists`;
                    return null;
                }
            });

            if (!profileName) return false;

            // Save profile
            this.profiles[profileName] = {
                instanceUrl: instanceUrl,
                authToken: authToken
            };

            await this.saveProfiles();

            // Ask if user wants to switch to this profile
            const switchNow = await vscode.window.showInformationMessage(
                `Profile "${profileName}" created successfully. Switch to it now?`,
                'Switch', 'Keep Current'
            );

            if (switchNow === 'Switch') {
                this.activeProfile = profileName;
                this.instanceUrl = instanceUrl;
                this.authToken = authToken;
                await this.saveProfiles();
                await this.validateCredentials();
            }

            return true;
        } catch (error) {
            console.error('Failed to add profile:', error);
            vscode.window.showErrorMessage(`Failed to add profile: ${error.message}`);
            return false;
        }
    }

    /**
     * Save profiles to VS Code settings
     */
    async saveProfiles() {
        try {
            const config = vscode.workspace.getConfiguration('gitea');
            await config.update('profiles', this.profiles, vscode.ConfigurationTarget.Global);
            await config.update('activeProfile', this.activeProfile, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save profiles:', error);
            throw error;
        }
    }

    /**
     * Switch to a different profile (list and switch combined)
     */
    async switchProfile() {
        try {
            // Reload profiles from settings to ensure we have the latest
            const config = vscode.workspace.getConfiguration('gitea');
            const savedProfiles = config.get('profiles') || {};
            this.profiles = savedProfiles;

            const profileNames = Object.keys(this.profiles);

            if (profileNames.length === 0) {
                vscode.window.showInformationMessage('No profiles configured. Please configure one first.');
                return false;
            }

            const selected = await vscode.window.showQuickPick(
                profileNames.map(name => ({
                    label: this.activeProfile === name ? `$(check) ${name}` : name,
                    description: this.profiles[name].instanceUrl,
                    profileName: name
                })),
                { placeHolder: 'Select a profile' }
            );

            if (!selected) return false;

            // If same profile is selected, just return
            if (selected.profileName === this.activeProfile) {
                vscode.window.showInformationMessage(`Already on Profile: ${selected.profileName}`);
                return false;
            }

            this.activeProfile = selected.profileName;
            const profile = this.profiles[this.activeProfile];
            this.instanceUrl = profile.instanceUrl;
            this.authToken = profile.authToken;

            await this.saveProfiles();
            await this.validateCredentials();
            return true;
        } catch (error) {
            console.error('Failed to switch profile:', error);
            vscode.window.showErrorMessage(`Failed to switch profile: ${error.message}`);
            return false;
        }
    }

    /**
     * List all available profiles (returns array for programmatic access)
     */
    listProfiles() {
        // Reload profiles from settings to ensure we have the latest
        const config = vscode.workspace.getConfiguration('gitea');
        const savedProfiles = config.get('profiles') || {};
        this.profiles = savedProfiles;

        return Object.keys(this.profiles).map(name => ({
            name: name,
            url: this.profiles[name].instanceUrl,
            isActive: this.activeProfile === name
        }));
    }

    /**
     * Remove a profile
     */
    async removeProfile(profileName = null) {
        try {
            // Reload profiles from settings to ensure we have the latest
            const config = vscode.workspace.getConfiguration('gitea');
            const savedProfiles = config.get('profiles') || {};
            this.profiles = savedProfiles;

            if (!profileName) {
                const profileNames = Object.keys(this.profiles);

                if (profileNames.length === 0) {
                    vscode.window.showInformationMessage('No profiles to remove');
                    return false;
                }

                const selected = await vscode.window.showQuickPick(
                    profileNames.map(name => ({
                        label: name,
                        description: this.profiles[name].instanceUrl,
                        profileName: name
                    })),
                    { placeHolder: 'Select a profile to remove' }
                );

                if (!selected) return false;
                profileName = selected.profileName;
            }

            if (profileName === this.activeProfile) {
                vscode.window.showErrorMessage('Cannot remove the active profile. Switch to another profile first.');
                return false;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to remove the profile "${profileName}"?`,
                'Remove', 'Cancel'
            );

            if (confirm !== 'Remove') return false;

            delete this.profiles[profileName];
            await this.saveProfiles();
            vscode.window.showInformationMessage(`Profile "${profileName}" removed successfully`);
            return true;
        } catch (error) {
            console.error('Failed to remove profile:', error);
            vscode.window.showErrorMessage(`Failed to remove profile: ${error.message}`);
            return false;
        }
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
