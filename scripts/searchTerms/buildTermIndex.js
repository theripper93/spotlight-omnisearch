import { BaseSearchTerm } from "./baseSearchTerm";
import { getSetting } from "../settings";

export const INDEX = [];

export let FILE_INDEX = [];

let indexBuilt = false;

export async function buildIndex(force = false) {
    if (force) {
        indexBuilt = false;
        INDEX.length = 0;
        FILE_INDEX.length = 0;
    }
    if (indexBuilt) return;
    indexBuilt = true;
    if (getSetting("searchFiles")) buildFiles();
    if (getSetting("searchSettings")) await buildSettings();
    if (getSetting("searchUtils")) await buildSettingsTab();
    if (getSetting("searchSidebar")) await buildCollections();
    await buildModuleIntegration();
    await buildStatusEffects();
    if (getSetting("searchCompendium")) await buildCompendiumIndex();
    const promises = [];
    Hooks.callAll("spotlightOmnisearch.indexBuilt", INDEX, promises);
    await Promise.all(promises);
    return INDEX;
}

async function buildCompendiumIndex() {
    const allowedCompendiums = getSetting("compendiumConfig");
    const packs = Array.from(game.packs).filter((p) => (game.user.isGM || !p.private) && allowedCompendiums[p.metadata.id] !== false);
    const index = [];
    await Promise.all(packs.map((p) => p.getIndex()));
    for (const pack of packs) {
        const packPackageName = pack.metadata.packageType === "system" ? game.system.title : game.modules.get(pack.metadata.packageName)?.title;
        const packIndex = Array.from(await pack.getIndex());
        packIndex.forEach((entry) => {
            index.push(
                new BaseSearchTerm({
                    name: entry.name,
                    description: pack.title + " - " + packPackageName,
                    keywords: [],
                    type: pack.documentName + " compendium",
                    data: { ...entry, documentName: pack.documentName },
                    img: entry.img,
                    icon: ["fas fa-atlas", CONFIG[pack.documentName].sidebarIcon],
                    onClick: async function () {
                        const entity = await fromUuid(entry.uuid);
                        entity.sheet.render(true);
                    },
                }),
            );
        });
    }
    //sort index by type
    index.sort((a, b) => a.type.localeCompare(b.type));
    INDEX.push(...index);
}

async function buildCollections() {
    const collections = Array.from(game.collections);

    const index = [];

    const exclude = ["Combat", "Setting", "FogExploration", "ChatMessage", "Folder"];

    for (const collection of collections) {
        if (exclude.includes(collection.documentName)) continue;
        const documents = Array.from(collection);
        documents.forEach((document) => {
            if (!document.isOwner) return;
            const keywords = [];
            let description = "";
            if (collection.documentName === "ChatMessage") {
                keywords.push(document.content.toLowerCase() + document.flavor?.toLowerCase() ?? "");
                description = document.content;
            }
            if (document.folder) description = getFoldersRecursive(document).reverse().join(" > ");
            index.push(
                new BaseSearchTerm({
                    name: document.name ?? document.speaker?.alias ?? document.content,
                    description: description,
                    keywords: keywords,
                    type: collection.documentName,
                    data: { ...document, documentName: collection.documentName, uuid: document.uuid },
                    img: document.img,
                    icon: ["fas fa-earth-europe", CONFIG[collection.documentName].sidebarIcon],
                    onClick: async function () {
                        const entity = await fromUuid(document.uuid);
                        entity.sheet.render(true);
                    },
                }),
            );
        });
    }

    //sort index by type
    index.sort((a, b) => a.type.localeCompare(b.type));
    INDEX.push(...index);
}

async function buildSettings() {
    const index = [];
    game.settings.settings.forEach((setting) => {
        if (!setting.name || !setting.config) return;
        if (!game.user.isGM && setting.scope === "world") return;
        let toggle = "";
        if (setting.type === Boolean) {
            const state = game.settings.get(setting.namespace, setting.key);
            toggle = `<i class="s-toggle-setting fad fa-toggle-${state ? "on" : "off"}" data-namespace="${setting.namespace}" data-key="${setting.key}"></i>`;
        }
        index.push(
            new BaseSearchTerm({
                name: game.i18n.localize(setting.name) + toggle,
                description: game.i18n.localize(setting.hint),
                query: setting.key,
                keywords: [`${setting.key}${setting.namespace}`],
                type: "setting",
                data: { ...setting },
                img: null,
                icon: ["fas fa-cogs"],
                onClick: async function () {
                    game.settings.sheet.render(true);
                    Hooks.once("renderSettingsConfig", (app, html) => {
                        html = html[0];
                        const settNamespace = setting.namespace === game.system.id ? "system" : setting.namespace;
                        const settingTab = html.querySelector(`.category-tab[data-tab="${settNamespace}"]`);
                        if (settingTab) settingTab.click();
                        const settingFG = html.querySelector(`[data-setting-id="${setting.namespace + "." + setting.key}"]`);
                        if (settingFG) {
                            setTimeout(() => {
                                settingFG.scrollIntoView({ behavior: "smooth" });
                            }, 100);
                            settingFG.style.backgroundColor = "#0000ff29";
                        }
                    });
                },
            }),
        );
    });
    game.keybindings.actions.forEach((binding, key) => {
        if (!game.user.isGM && binding.restricted) return;
        const name = game.i18n.localize(binding.name);
        let description = "";
        const bindings = game.keybindings.bindings.get(key);
        bindings.forEach((b) => {
            description += `<span class="key">${KeybindingsConfig._humanizeBinding(b)}</span>`;
        });
        if (binding.hint) description += game.i18n.localize(binding.hint);
        index.push(
            new BaseSearchTerm({
                name: name,
                description: description,
                keywords: [],
                type: "keybinding",
                data: { ...binding },
                img: null,
                icon: ["fas fa-keyboard"],
                onClick: async function () {
                    new KeybindingsConfig().render(true);
                    Hooks.once("renderKeybindingsConfig", (app, html) => {
                        html = html[0];
                        const tab = html.querySelector(`.tab[data-tab="${binding.namespace}"]`);
                        const bindingFG = tab.querySelector(`[data-action-id="${key}"]`);
                        if (bindingFG) {
                            setTimeout(() => {
                                bindingFG.scrollIntoView({ behavior: "smooth" });
                            }, 100);
                            bindingFG.style.backgroundColor = "#0000ff29";
                        }
                    });
                },
            }),
        );
    });
    INDEX.push(...index);
}

async function buildSettingsTab() {
    const settingsSidebar = document.querySelector(".settings-sidebar#settings");
    const buttons = settingsSidebar.querySelectorAll("button");
    const index = [];
    buttons.forEach((button) => {
        //the button innerhtml is formatted as follows <i class="fas fa-cogs"></i>  Configure Settings
        //extract the text and the i class
        const buttonLabel = button.innerText.trim();
        const i = button.querySelector("i");
        if (!i) return;
        const icon = i.className;
        if (!buttonLabel) return;
        index.push(
            new BaseSearchTerm({
                name: buttonLabel,
                keywords: [],
                type: "settingTab",
                data: {},
                img: null,
                icon: [icon],
                onClick: async function () {
                    button.click();
                },
            }),
        );
    });
    INDEX.push(...index);
}

async function buildFiles() {
    if (!game.user.isGM) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const fileCache = canvas.deepSearchCache?._fileIndexCache;
    if (!fileCache) return;
    const IMAGE = Object.keys(CONST.IMAGE_FILE_EXTENSIONS);
    const AUDIO = Object.keys(CONST.AUDIO_FILE_EXTENSIONS);
    const VIDEO = Object.keys(CONST.VIDEO_FILE_EXTENSIONS);
    const index = [];
    for (const [fileName, files] of Object.entries(fileCache)) {
        const ext = fileName.split(".").pop().toLowerCase();
        let icon = "fas fa-file";
        let isImageOrVideo = false;
        if (IMAGE.includes(ext)) {
            icon = "fas fa-image";
            isImageOrVideo = true;
        }
        if (VIDEO.includes(ext)) {
            icon = "fas fa-film";
            isImageOrVideo = true;
        }
        if (AUDIO.includes(ext)) icon = "fas fa-volume-up";

        files.forEach((file) => {
            let dropData = null;
            if (isImageOrVideo) {
                dropData = {
                    type: "Tile",
                    texture: {
                        src: file,
                    },
                    fromFilePicker: true,
                    tileSize: canvas?.grid?.size ?? 100,
                };
            }
            index.push(
                new BaseSearchTerm({
                    name: decodeURIComponent(fileName),
                    keywords: [file],
                    type: "file",
                    dragData: dropData,
                    img: null,
                    icon: [icon],
                    onClick: async function () {
                        if (isImageOrVideo) {
                            new ImagePopout(file, {}).render(true);
                        }
                    },
                }),
            );
        });
    }
    FILE_INDEX = index;
}

function getFoldersRecursive(document, folders = []) {
    if (document.folder) folders.push(document.folder.name);
    else return folders;
    return getFoldersRecursive(document.folder, folders);
}

async function buildStatusEffects() {
    const effects = CONFIG.statusEffects;
    for (const effect of effects) {
        INDEX.push(
            new BaseSearchTerm({
                name: effect.name,
                keywords: [],
                type: "statusEffect",
                data: { ...effect },
                img: effect.icon,
                icon: ["fas fa-earth-europe", "fas fa-bolt"],
                onClick: async function () {
                    canvas.tokens.controlled.forEach((token) => {
                        token.toggleEffect(effect);
                    });
                },
            }),
        );
    }
}

async function buildModuleIntegration() {
    //dfreds
    if (game.dfreds) {
        const allEffects = game.dfreds.effects.all;
        for (const effect of allEffects) {
            INDEX.push(
                new BaseSearchTerm({
                    name: effect.name,
                    description: effect.description,
                    keywords: [],
                    type: "dfreds",
                    data: { ...effect },
                    img: effect.img,
                    icon: ["fas fa-hand-sparkles", "fas fa-bolt"],
                    onClick: async function () {
                        game.dfreds.effectInterface.toggleEffect(effect.name);
                    },
                }),
            );
        }
    }
}
