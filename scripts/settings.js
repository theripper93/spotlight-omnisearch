import { MODULE_ID } from "./main.js";

export function registerSettings() {
    const settings = {
        darkMode: {
            name: `${MODULE_ID}.settings.darkMode.name`,
            hint: `${MODULE_ID}.settings.darkMode.hint`,
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
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
        },
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
