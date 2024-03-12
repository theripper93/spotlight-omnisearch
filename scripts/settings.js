import { MODULE_ID } from "./main.js";
import {updateTimerInterval} from "./timer.js";

export function registerSettings() {
    const settings = {
        gmOnly: {
            name: `${MODULE_ID}.settings.gmOnly.name`,
            hint: `${MODULE_ID}.settings.gmOnly.hint`,
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        },
        darkMode: {
            name: `${MODULE_ID}.settings.darkMode.name`,
            hint: `${MODULE_ID}.settings.darkMode.hint`,
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
            onChange: (value) => ui.spotlightOmnisearch?._html.closest("#spotlight").classList.toggle("dark", value),
        },
        compactMode: {
            name: `${MODULE_ID}.settings.compactMode.name`,
            hint: `${MODULE_ID}.settings.compactMode.hint`,
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
            onChange: (value) => ui.spotlightOmnisearch?._html.closest("#spotlight").classList.toggle("compact", value),
        },
        clickToDismiss: {
            name: `${MODULE_ID}.settings.clickToDismiss.name`,
            hint: `${MODULE_ID}.settings.clickToDismiss.hint`,
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
        },
        saveLastSearch: {
            name: `${MODULE_ID}.settings.saveLastSearch.name`,
            hint: `${MODULE_ID}.settings.saveLastSearch.hint`,
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
        },
        useHistory: {
            name: `${MODULE_ID}.settings.useHistory.name`,
            hint: `${MODULE_ID}.settings.useHistory.hint`,
            scope: "client",
            config: true,
            default: true,
            type: Boolean,
        },
        position: {
            name: `${MODULE_ID}.settings.position.name`,
            hint: `${MODULE_ID}.settings.position.hint`,
            scope: "client",
            config: true,
            default: "save",
            type: String,
            choices: {
                default: `${MODULE_ID}.settings.position.choices.default`,
                save: `${MODULE_ID}.settings.position.choices.save`,
            },
        },
        alwaysOnTop: {
            name: `${MODULE_ID}.settings.alwaysOnTop.name`,
            hint: `${MODULE_ID}.settings.alwaysOnTop.hint`,
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
        },
        enableCtrlSpace: {
            name: `${MODULE_ID}.settings.enableCtrlSpace.name`,
            hint: `${MODULE_ID}.settings.enableCtrlSpace.hint`,
            scope: "client",
            config: true,
            default: true,
            type: Boolean,
        },
        spotlightWidth: {
            name: `${MODULE_ID}.settings.spotlightWidth.name`,
            hint: `${MODULE_ID}.settings.spotlightWidth.hint`,
            scope: "world",
            config: true,
            default: 700,
            type: Number,
            range: { min: 400, max: 1000, step: 50 },
        },
        showImages: {
            name: `${MODULE_ID}.settings.showImages.name`,
            hint: `${MODULE_ID}.settings.showImages.hint`,
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        },
        searchFiles: {
            name: `${MODULE_ID}.settings.searchFiles.name`,
            hint: `${MODULE_ID}.settings.searchFiles.hint`,
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        },
        searchSettings: {
            name: `${MODULE_ID}.settings.searchSettings.name`,
            hint: `${MODULE_ID}.settings.searchSettings.hint`,
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        },
        searchCompendium: {
            name: `${MODULE_ID}.settings.searchCompendium.name`,
            hint: `${MODULE_ID}.settings.searchCompendium.hint`,
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        },
        searchSidebar: {
            name: `${MODULE_ID}.settings.searchSidebar.name`,
            hint: `${MODULE_ID}.settings.searchSidebar.hint`,
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        },
        searchUtils: {
            name: `${MODULE_ID}.settings.searchUtils.name`,
            hint: `${MODULE_ID}.settings.searchUtils.hint`,
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        },
        useMetricForLights: {
            name: `${MODULE_ID}.settings.useMetricForLights.name`,
            hint: `${MODULE_ID}.settings.useMetricForLights.hint`,
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        },
        spotlightPosition: {
            scope: "client",
            config: false,
            default: null,
            type: Object,
        },
        firstTime: {
            scope: "client",
            config: false,
            default: true,
            type: Boolean,
        },
        appData: {
            scope: "world",
            config: false,
            default: {},
            type: Object,
            onChange: (value) => {
                if (ui.spotlightOmnisearch?.rendered) {

                    if(!("counter" in value) || !game.user.isGM) ui.spotlightOmnisearch._onSearch();
                }
                updateTimerInterval();
            },
        },
        recent: {
            scope: "client",
            config: false,
            default: [],
            type: Array,
        }
    };

    registerSettingsArray(settings);
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for (const [key, value] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, value);
    }
}
