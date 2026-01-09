const assert = require('assert');
const vscode = require('vscode');
const extension = require('../extension');

suite('Gitea Extension Smoke Tests', () => {
	test('activates without throwing', async () => {
		const context = { subscriptions: [] };
		await extension.activate(context);
		assert.ok(true, 'activate completed');
	});

	test('registers core commands', async () => {
		const commands = await vscode.commands.getCommands(true);
		const required = [
			'gitea.configure',
			'gitea.searchRepositories',
			'gitea.searchIssues',
			'gitea.searchPullRequests',
			'gitea.refreshRepositories'
		];

		required.forEach(cmd => {
			assert.ok(commands.includes(cmd), `Command ${cmd} is registered`);
		});
	});
});
