const env = require('#env');
const { log } = require('#utils');
const osu = require('#lib/osu.js');
const writers = require('#api/write.js');
const dayjs = require('dayjs');
const { io } = require('socket.io-client');
const utils = require('#utils');

const axios = require('axios');
let isOsuOnline = null;
const pokeOsuApi = async () => {
    const oldStatus = isOsuOnline;
    let errorText = 'unknown error';
    try {
        const token = await osu.getToken();
        await axios.get('https://osu.ppy.sh/api/v2/users/2', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 1000 * 15
        });
        isOsuOnline = true;
    } catch (error) {
        isOsuOnline = error.response?.status === 401;
        errorText = `${error.toString()}`;
    }
    if (oldStatus !== isOsuOnline) {
        if (isOsuOnline) {
            utils.log(`osu! API is online`);
            if (oldStatus === false) {
                utils.logError(`osu! API access has been restored!`);
            }
        } else {
            utils.logError(
                `osu! API is currently inaccessible, updates will be delayed until access is restored: ${errorText}`
            );
        }
    }
    setTimeout(pokeOsuApi, 1000 * 60 * 5);
    return isOsuOnline;
};

const scoreBuffer = [];
const saveFromScoreBuffer = async () => {
    if (isOsuOnline && scoreBuffer.length > 0) {
        const scoresToSave = scoreBuffer.splice(0, 1000);
        await writers.savePassesFromScores(scoresToSave);
    }
    setTimeout(saveFromScoreBuffer, 200);
};

const runUpdateGlobalRecents = async () => {
    if (isOsuOnline) await writers.savePassesFromGlobalRecents();
    setTimeout(runUpdateGlobalRecents, 1000 * 60 * 5);
};

const runBackupDatabase = async () => {
    await writers.backupDatabaseClean();
    setTimeout(runBackupDatabase, 1000 * 60);
};

const runSaveHistory = async () => {
    if (dayjs().hour() === 0) {
        log('Saving user history snapshot for the day...');
        writers.snapshotCategoryStats();
        setTimeout(runSaveHistory, 1000 * 60 * 60);
    } else {
        setTimeout(runSaveHistory, 1000 * 60);
    }
};

const runImportQueue = async () => {
    if (isOsuOnline) await writers.startQueuedImports();
    setTimeout(runImportQueue, 5000);
};

const runFetchNewMaps = async () => {
    if (isOsuOnline) await writers.fetchNewMapData();
    setTimeout(runFetchNewMaps, 1000 * 60 * 5);
};

let isFullStatusUpdateRunning = false;
const runUpdateAllMapStatuses = async () => {
    if (isOsuOnline) {
        isFullStatusUpdateRunning = true;
        try {
            await writers.updateMapStatuses();
        } catch (error) {
            utils.logError(error);
        }
        isFullStatusUpdateRunning = false;
    }
    setTimeout(runUpdateAllMapStatuses, 1000 * 60 * 60 * 24);
};

const runUpdateRecentMapStatuses = async () => {
    if (isOsuOnline && !isFullStatusUpdateRunning) {
        const after = Date.now() - 1000 * 60 * 60 * 24 * 7;
        await writers.updateMapStatuses(after);
    }
    setTimeout(runUpdateRecentMapStatuses, 1000 * 60 * 5);
};

const runAnalyticsSave = async () => {
    await writers.saveAnalytics();
    setTimeout(runAnalyticsSave, 1000 * 60 * 15);
};

const runGenerateSitemap = async () => {
    await writers.generateSitemap();
    setTimeout(runGenerateSitemap, 1000 * 60 * 60 * 24);
};

async function main() {
    // Get osu API token
    // We await this before starting other processes to avoid
    // getting a bunch of tokens at once
    log('Authenticating with osu API...');
    await pokeOsuApi();

    // Start update processes
    log(`Starting update processes...`);
    runBackupDatabase();
    runImportQueue();
    runFetchNewMaps();
    runSaveHistory();
    runAnalyticsSave();
    runGenerateSitemap();
    runUpdateGlobalRecents();
    saveFromScoreBuffer();
    runUpdateRecentMapStatuses();

    // Delay this one so it only runs after the updater has been going for an hour
    setTimeout(runUpdateAllMapStatuses, 1000 * 60 * 60);

    // Connect to oSC websocket
    const socket = io(env.OSU_SCORE_CACHE_BASE_URL, {
        path: '/ws',
        transports: ['websocket']
    });
    socket.on('connect', () => {
        socket.emit('subscribe', 'scores');
        utils.log(`Connected to and listening for new scores on osu! score cache websocket`);
    });

    // Listen for new scores
    socket.on('scores', scores => {
        scoreBuffer.push(...scores);
        //utils.log(`Received ${scores.length} new scores from oSC`);
    });
}
main();
