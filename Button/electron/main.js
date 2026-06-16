const { app, BrowserWindow, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;
let serverModule = null;
let stoppingServer = null;

function getAppRoot() {
    return app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
}

function findBundledDatabase() {
    const appRoot = getAppRoot();
    const candidates = app.isPackaged
        ? [
            path.join(process.resourcesPath, "fenster.db"),
            path.join(process.resourcesPath, "Fenster.db"),
            path.join(appRoot, "fenster.db"),
            path.join(appRoot, "Fenster.db")
        ]
        : [
            path.join(appRoot, "fenster.db"),
            path.join(appRoot, "Fenster.db")
        ];

    return candidates.find(candidate => fs.existsSync(candidate));
}

function prepareDatabase() {
    const dataDir = app.getPath("userData");
    fs.mkdirSync(dataDir, { recursive: true });

    const writableDb = path.join(dataDir, "fenster.db");
    if (!fs.existsSync(writableDb)) {
        const bundledDb = findBundledDatabase();
        if (bundledDb) {
            fs.copyFileSync(bundledDb, writableDb);
        }
    }

    process.env.FENSTER_DB_PATH = writableDb;
    return writableDb;
}

async function startLocalServer() {
    prepareDatabase();
    serverModule = require(path.join(getAppRoot(), "server.js"));
    const { port } = await serverModule.startServer({ port: 0, host: "127.0.0.1" });
    return `http://127.0.0.1:${port}`;
}

async function stopLocalServer() {
    if (stoppingServer) return stoppingServer;
    if (!serverModule || typeof serverModule.stopServer !== "function") return Promise.resolve();

    stoppingServer = serverModule.stopServer()
        .catch(error => {
            console.error("Server konnte nicht sauber beendet werden:", error);
        });

    return stoppingServer;
}

async function createWindow() {
    const dashboardUrl = await startLocalServer();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 1024,
        minHeight: 720,
        show: false,
        backgroundColor: "#0f1726",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    await mainWindow.loadURL(dashboardUrl);
}

app.whenReady()
    .then(createWindow)
    .catch(error => {
        console.error("Electron-App konnte nicht gestartet werden:", error);
        dialog.showErrorBox("Fenster Dashboard", `Die Anwendung konnte nicht gestartet werden.\n\n${error.message}`);
        app.quit();
    });

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        stopLocalServer().finally(() => app.quit());
    }
});

app.on("before-quit", () => {
    stopLocalServer();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(error => {
            console.error("Fenster konnte nicht erneut geoeffnet werden:", error);
        });
    }
});
