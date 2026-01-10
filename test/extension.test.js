const assert = require('assert');
const vscode = require('vscode');

suite('Gitea Extension Tests', () => {
	suite('Core Commands Registration', () => {
		test('core search and refresh commands are registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			const required = [
				'gitea.configure',
				'gitea.searchRepositories',
				'gitea.searchIssues',
				'gitea.searchPullRequests',
				'gitea.refreshRepositories'
			];

			required.forEach(cmd => {
				assert.ok(
					commands.includes(cmd),
					`Required command "${cmd}" should be registered`
				);
			});
		});

		test('branch management commands are registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			const branchCommands = [
				'gitea.switchBranch',
				'gitea.createBranchFromIssue',
				'gitea.createBranchFromPR'
			];

			branchCommands.forEach(cmd => {
				assert.ok(
					commands.includes(cmd),
					`Branch command "${cmd}" should be registered`
				);
			});
		});

		test('issue and pull request commands are registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			const prCommands = [
				'gitea.createIssue',
				'gitea.createPullRequest',
				'gitea.viewIssueDetails',
				'gitea.viewPullRequestDetails'
			];

			prCommands.forEach(cmd => {
				assert.ok(
					commands.includes(cmd),
					`PR/Issue command "${cmd}" should be registered`
				);
			});
		});

		test('notification commands are registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			const notifCommands = [
				'gitea.toggleNotifications',
				'gitea.notificationStatus'
			];

			notifCommands.forEach(cmd => {
				assert.ok(
					commands.includes(cmd),
					`Notification command "${cmd}" should be registered`
				);
			});
		});
	});

	suite('Utility Functions', () => {
		test('branch name sanitization works correctly', () => {
			const sanitize = (str) => {
				return str
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^a-z0-9-]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-|-$/g, '')
					.substring(0, 50);
			};

			assert.strictEqual(sanitize('Fix Login Bug'), 'fix-login-bug');
			assert.strictEqual(sanitize('Add New Feature!!!'), 'add-new-feature');
			assert.strictEqual(sanitize('MixedCASE-Text_123'), 'mixedcase-text-123');
			assert.strictEqual(sanitize('  Spaces  Around  '), 'spaces-around');
			assert.strictEqual(sanitize('---Multiple---Dashes---'), 'multiple-dashes');
		});

		test('branch name sanitization enforces length limit', () => {
			const sanitize = (str) => {
				return str
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^a-z0-9-]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-|-$/g, '')
					.substring(0, 50);
			};

			const longInput = 'a'.repeat(100);
			const result = sanitize(longInput);
			assert.ok(result.length <= 50, 'Result should not exceed 50 characters');
		});

		test('branch name sanitization removes special characters', () => {
			const sanitize = (str) => {
				return str
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^a-z0-9-]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-|-$/g, '')
					.substring(0, 50);
			};

			assert.strictEqual(sanitize('feature/new-ui'), 'featurenew-ui');
			assert.strictEqual(sanitize('bugfix@home'), 'bugfixhome');
			assert.strictEqual(sanitize('test#123'), 'test123');
			assert.strictEqual(sanitize('fix-$pecial'), 'fix-pecial');
		});
	});
});