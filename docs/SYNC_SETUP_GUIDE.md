# VS Code Settings Sync Setup Guide

## Overview

The Gitea extension automatically syncs your branch deletion history across all your machines using **VS Code Settings Sync**. This built-in VS Code feature provides seamless synchronization without requiring any external services or manual exports.

## Why Use VS Code Settings Sync?

- ✅ **Automatic**: Syncs in the background, no manual intervention needed
- ✅ **Built-in**: Uses VS Code's native infrastructure (Microsoft's cloud)
- ✅ **Secure**: Encrypted data transmission and storage
- ✅ **Cross-platform**: Works on Windows, macOS, and Linux
- ✅ **No external accounts**: No GitHub, Google Drive, or other third-party services required
- ✅ **Consistent**: Same mechanism VS Code uses for settings, keybindings, extensions, etc.

## Setup Instructions

### Step 1: Enable Settings Sync in VS Code

1. **Open Settings Sync**
   - Click the **gear icon** (⚙️) in the lower-left corner of VS Code
   - Select **Turn on Settings Sync...**
   *Alternative*: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS) and search for **"Settings Sync: Turn On"**

2. **Sign In**
   - Choose Microsoft or GitHub account
   - Follow the authentication prompts in your browser
   - Return to VS Code after signing in

3. **Configure What to Sync**
   - A dialog will show what can be synced
   - Ensure **User Data** is checked (this includes extension data)
   - Other items (Settings, Keyboard Shortcuts, Extensions, etc.) are optional but recommended

4. **Click "Turn On"**
   - VS Code will begin syncing immediately
   - Look for the sync icon (🔄) in the status bar

### Step 2: Verify Extension Data is Syncing

The Gitea extension automatically marks deletion history for sync. You don't need to do anything extra!

**What gets synced:**

- Branch deletion history (all tracked deletions)
- Repository paths and metadata
- Deletion timestamps and commit SHAs
- Deletion timestamps and commit SHAs

**What doesn't sync (stored in settings):**

- Retention period configuration
- Instance URLs and tokens (use Settings Sync for these separately)

### Step 3: Set Up on Additional Machines

1. Install VS Code on your other machine(s)
2. Install the Gitea extension
3. Enable Settings Sync with the **same account** you used initially
4. Wait for sync to complete (usually takes a few seconds)
5. Open the Deleted Branches view—your deletion history will be there!

## How It Works

### Technical Details

The extension uses VS Code's `globalState.setKeysForSync()` API to mark specific data for synchronization:

```js
// Extension automatically registers this on activation
context.globalState.setKeysForSync(['gitea.deletedBranches']);
```

This tells VS Code to include the deletion history when syncing extension data.

### Sync Behavior

- **Frequency**: VS Code syncs continuously while online
- **Conflicts**: VS Code merges data automatically (newer entries take precedence)
- **Offline**: Changes are queued and synced when you reconnect
- **Size limits**: VS Code has generous limits for extension data (typically several MB)

### Data Storage Location

Data is stored in:

- **Cloud**: Microsoft's cloud infrastructure (encrypted)
- **Local**: VS Code's globalState storage
  - Windows: `%APPDATA%\Code\User\globalStorage\`
  - macOS: `~/Library/Application Support/Code/User/globalStorage/`
  - Linux: `~/.config/Code/User/globalStorage/`

## Usage Scenarios

### Scenario 1: New Machine Setup

**You just got a new laptop and want your deletion history:**

1. Install VS Code and the Gitea extension
2. Sign into Settings Sync with your account
3. Wait 10-30 seconds for sync to complete
4. Your deletion history is now available!

### Scenario 2: Work/Home Synchronization

**You delete a branch at work and want to restore it at home:**

1. Delete branch at work—it's tracked automatically
2. VS Code syncs the deletion to the cloud
3. At home, VS Code pulls the latest sync data
4. The deleted branch appears in your Deleted Branches view
5. Restore it with one click!

### Scenario 3: Reinstalling VS Code

**You reinstalled VS Code or Windows and lost local data:**

1. Reinstall VS Code
2. Install Gitea extension
3. Enable Settings Sync with your account
4. All your deletion history is restored automatically

## Additional Backup Options

While Settings Sync provides automatic synchronization, you can still use manual backups:

### Manual Export (Recommended for Long-Term Archival)

1. Open Deleted Branches view
2. Click the **export icon** (📤) in the toolbar
3. Save JSON file to a safe location
4. Store in:
   - Cloud storage (Dropbox, OneDrive, Google Drive)
   - External drive
   - Network share

### Import When Needed

1. Open Deleted Branches view
2. Click the **import icon** (📥) in the toolbar
3. Select your JSON backup file
4. Choose **Merge** (combine with existing) or **Replace** (overwrite)

## Troubleshooting

### Deletion History Not Syncing

**Check Settings Sync Status:**

1. Click the sync icon (🔄) in the status bar
2. Select **Show Synced Data**
3. Verify you're signed in and syncing is active

**Force a Sync:**

1. Make a small change (delete and restore a test branch)
2. Click the sync icon → **Sync Now**
3. Wait for sync to complete

**Reset Sync:**

1. Turn off Settings Sync
2. Turn it back on with the same account
3. Choose to merge cloud and local data

### Data Not Appearing on New Machine

**Verify sync is complete:**

- Check the sync icon for any error indicators
- Look for notification about sync completion
- Wait a full minute (large datasets take time)

**Check account:**

- Ensure you're using the same Microsoft/GitHub account on all machines
- Verify Settings Sync is enabled on both machines

**Manual workaround:**

- Export from working machine
- Import on new machine
- Future syncs will work automatically

### Too Much Data Warning

If you have thousands of deleted branches:

- Consider clearing old history: **Clear All Deletion History**
- Adjust retention period: Settings → `gitea.branchDeletionRetentionDays`
- Export large datasets and clear, then import when needed

## Privacy & Security

### What's Stored in the Cloud?

- Branch names
- Commit SHAs
- Deletion timestamps
- Repository paths

### What's NOT Stored?

- ❌ Source code or file contents
- ❌ Git credentials or tokens
- ❌ Personal access tokens
- ❌ Server URLs (unless you sync settings separately)

### Security Measures

- Data is encrypted in transit (HTTPS)
- Data is encrypted at rest in Microsoft's cloud
- Only you can access your synced data (requires authentication)
- Data is tied to your Microsoft/GitHub account

### Disable Syncing

If you don't want deletion history to sync:

1. **Turn off Settings Sync entirely**: Gear icon → Turn off Settings Sync
2. **Or keep manual backups only**: Use export/import exclusively

## FAQ

**Q: Does this cost anything?**  
A: No, Settings Sync is free for all VS Code users.

**Q: Can I choose what syncs?**  
A: You can enable/disable entire categories (settings, extensions, etc.) but individual extension data is all-or-nothing.

**Q: What if I use VS Code Insiders or VSCodium?**  
A: Settings Sync works in VS Code Insiders. VSCodium may not support it (depends on build configuration).

**Q: How much data can I sync?**  
A: VS Code imposes size limits (typically 10+ MB per extension), which is enough for thousands of deletion entries.

**Q: Can I sync to multiple accounts?**  
A: No, each VS Code instance syncs to one account. Use export/import to transfer data between different accounts.

**Q: Is my Git history synced?**  
A: No, only the deletion history metadata (branch names, SHAs, timestamps). Actual Git repositories are not synced.

**Q: Can my team members access my deletion history?**  
A: No, Settings Sync is personal. Each user has their own synced data. Use export/import to share specific data with teammates.

**Q: What happens if I delete VS Code?**  
A: Your data remains in the cloud. Reinstall VS Code, enable Settings Sync, and everything comes back.

## Best Practices

1. **Enable Settings Sync on all machines** where you use the Gitea extension
2. **Export deletion history quarterly** as an additional backup
3. **Use merge strategy when importing** to avoid losing recent deletions
4. **Clean up old entries periodically** to keep data size manageable
5. **Check sync status** if you notice missing data across machines
6. **Keep VS Code updated** for the best sync experience

## Comparison: Settings Sync vs Manual Export

| Feature              | VS Code Settings Sync  | Manual Export/Import              |
| -------------------- | ---------------------- | --------------------------------- |
| **Automatic**        | ✅ Continuous           | ❌ Manual process                  |
| **Cross-machine**    | ✅ All machines         | ⚠️ One-time transfer               |
| **Setup effort**     | ⚠️ Initial signin       | ✅ None (built-in)                 |
| **Cloud service**    | ⚠️ Microsoft cloud      | ✅ Your choice (any cloud storage) |
| **Account required** | ⚠️ Microsoft or GitHub  | ✅ None                            |
| **Data control**     | ⚠️ In Microsoft's cloud | ✅ You control file location       |
| **Offline**          | ⚠️ Requires internet    | ✅ Works offline                   |
| **Team sharing**     | ❌ Personal only        | ✅ Can share JSON files            |

**Recommendation**: Use Settings Sync for convenience + periodic manual exports for long-term archival and team sharing.

## Support

If you experience issues:

1. Check [VS Code Settings Sync documentation](https://code.visualstudio.com/docs/editor/settings-sync)
2. Review the [main extension documentation](BRANCH_DELETION_FEATURE.md)
3. File an issue in the extension repository with sync logs

---

**Note**: This guide focuses on VS Code Settings Sync. The extension also supports manual export/import for users who prefer traditional backup methods or need to share data with team members.
