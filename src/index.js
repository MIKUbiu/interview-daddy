if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { createWindow } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const { scanProject } = require('./utils/projectScanner');
const codeIndex = require('./utils/codeIndex');
const docIndex = require('./utils/docIndex');
const storage = require('./storage');

function getEmbedConfigFromStorage() {
    const creds = storage.getCredentials();
    const prefs = storage.getPreferences();
    if (!creds.customSttApiKey) return null;
    return {
        baseUrl: (prefs.embeddingBaseUrl || 'https://api.siliconflow.cn/v1').replace(/\/+$/, ''),
        apiKey: creds.customSttApiKey,
        model: prefs.embeddingModel || 'BAAI/bge-m3',
    };
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createMainWindow() {
    mainWindow = createWindow();

    // The window has no native frame, so the only way it gets a real OS
    // 'close' event is via Alt+F4 or similar. Treat that the same as clicking
    // the in-app close button: hide to tray instead of exiting, unless a
    // real quit is already in progress (tray menu, clear-all-data, etc).
    mainWindow.on('close', event => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    return mainWindow;
}

function toggleMainWindowVisibility() {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow.showInactive();
    }
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', process.platform === 'win32' ? 'logo.ico' : 'logo.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
        icon = icon.resize({ width: 16, height: 16 });
    }

    tray = new Tray(icon);
    tray.setToolTip('Cheating Daddy');

    const menu = Menu.buildFromTemplate([
        {
            label: 'Show/Hide',
            click: () => toggleMainWindowVisibility(),
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => toggleMainWindowVisibility());
}

app.whenReady().then(async () => {
    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // Trigger screen recording permission prompt on macOS if not already granted
    if (process.platform === 'darwin') {
        const { desktopCapturer } = require('electron');
        desktopCapturer.getSources({ types: ['screen'] }).catch(() => {});
    }

    createMainWindow();
    createTray();
    setupGeminiIpcHandlers();
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
});

app.on('window-all-closed', () => {
    // With a tray icon present the app should keep running even if every
    // window is hidden/closed — only the tray's "Quit" (or clear-all-data)
    // should actually terminate the process.
});

app.on('before-quit', () => {
    isQuitting = true;
    stopMacOSAudioCapture();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupStorageIpcHandlers() {
    // ============ CONFIG ============
    ipcMain.handle('storage:get-config', async () => {
        try {
            return { success: true, data: storage.getConfig() };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-config', async (event, config) => {
        try {
            storage.setConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-config', async (event, key, value) => {
        try {
            storage.updateConfig(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CREDENTIALS ============
    ipcMain.handle('storage:get-credentials', async () => {
        try {
            return { success: true, data: storage.getCredentials() };
        } catch (error) {
            console.error('Error getting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-credentials', async (event, credentials) => {
        try {
            storage.setCredentials(credentials);
            return { success: true };
        } catch (error) {
            console.error('Error setting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PREFERENCES ============
    ipcMain.handle('storage:get-preferences', async () => {
        try {
            return { success: true, data: storage.getPreferences() };
        } catch (error) {
            console.error('Error getting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-preferences', async (event, preferences) => {
        try {
            storage.setPreferences(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error setting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-preference', async (event, key, value) => {
        try {
            storage.updatePreference(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating preference:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ HISTORY ============
    ipcMain.handle('storage:get-all-sessions', async () => {
        try {
            return { success: true, data: storage.getAllSessions() };
        } catch (error) {
            console.error('Error getting sessions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-session', async (event, sessionId) => {
        try {
            return { success: true, data: storage.getSession(sessionId) };
        } catch (error) {
            console.error('Error getting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-session', async (event, sessionId, data) => {
        try {
            storage.saveSession(sessionId, data);
            return { success: true };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-session', async (event, sessionId) => {
        try {
            storage.deleteSession(sessionId);
            return { success: true };
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-all-sessions', async () => {
        try {
            storage.deleteAllSessions();
            return { success: true };
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CLEAR ALL ============
    ipcMain.handle('storage:clear-all', async () => {
        try {
            storage.clearAllData();
            return { success: true };
        } catch (error) {
            console.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    });
}

function setupGeneralIpcHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('quit-application', async event => {
        try {
            isQuitting = true;
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('hide-window', async () => {
        try {
            if (mainWindow) mainWindow.hide();
            return { success: true };
        } catch (error) {
            console.error('Error hiding window:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PROJECT CONTEXT ============
    ipcMain.handle('select-project-dir', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select your project folder',
                properties: ['openDirectory'],
            });
            if (result.canceled || !result.filePaths.length) {
                return { success: false, canceled: true };
            }
            return { success: true, path: result.filePaths[0] };
        } catch (error) {
            console.error('Error selecting project dir:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('scan-project', async (event, dirPath) => {
        try {
            const { context, stats } = scanProject(dirPath);
            storage.updatePreference('projectContext', context);
            storage.updatePreference('projectPath', stats.path);

            // Also build the code chunk index (keyword + optional vector) for
            // per-question retrieval of implementation details during a session.
            const embedConfig = getEmbedConfigFromStorage();

            const indexStats = await codeIndex.buildIndex(dirPath, embedConfig, (done, total) => {
                sendToRenderer('code-index-progress', { done, total });
            });

            return { success: true, stats: { ...stats, ...indexStats } };
        } catch (error) {
            console.error('Error scanning project:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('clear-project-context', async () => {
        try {
            storage.updatePreference('projectContext', '');
            storage.updatePreference('projectPath', '');
            codeIndex.clearIndex();
            return { success: true };
        } catch (error) {
            console.error('Error clearing project context:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PERSONAL DOCUMENTS ============
    ipcMain.handle('select-doc-files', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select documents (resume, notes, prep docs...)',
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf'] }],
            });
            if (result.canceled || !result.filePaths.length) {
                return { success: false, canceled: true };
            }
            return { success: true, paths: result.filePaths };
        } catch (error) {
            console.error('Error selecting document files:', error);
            return { success: false, error: error.message };
        }
    });

    async function rebuildDocIndex(filePaths, onProgress) {
        storage.updatePreference('docFilePaths', filePaths);
        if (!filePaths.length) {
            docIndex.clearIndex();
            return { chunkCount: 0, fileCount: 0, includedFiles: [], skippedFiles: [] };
        }
        const embedConfig = getEmbedConfigFromStorage();
        return docIndex.buildDocIndex(filePaths, embedConfig, onProgress);
    }

    ipcMain.handle('add-doc-files', async (event, newPaths) => {
        try {
            const prefs = storage.getPreferences();
            const merged = [...new Set([...(prefs.docFilePaths || []), ...newPaths])];
            const stats = await rebuildDocIndex(merged, (done, total) => {
                sendToRenderer('doc-index-progress', { done, total });
            });
            return { success: true, stats };
        } catch (error) {
            console.error('Error adding document files:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('remove-doc-file', async (event, filePath) => {
        try {
            const prefs = storage.getPreferences();
            const remaining = (prefs.docFilePaths || []).filter(p => p !== filePath);
            const stats = await rebuildDocIndex(remaining, (done, total) => {
                sendToRenderer('doc-index-progress', { done, total });
            });
            return { success: true, stats };
        } catch (error) {
            console.error('Error removing document file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('clear-doc-files', async () => {
        try {
            storage.updatePreference('docFilePaths', []);
            docIndex.clearIndex();
            return { success: true };
        } catch (error) {
            console.error('Error clearing document files:', error);
            return { success: false, error: error.message };
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });
}
