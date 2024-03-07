import { BaseSearchTerm } from "./baseSearchTerm";
import { getSetting } from "../settings";

export const INDEX = [];
export const FILTERS = [];

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
    if (getSetting("searchSettings")) await buildSettings();
    if (getSetting("searchUtils")) await buildSettingsTab();
    if (getSetting("searchSidebar")) await buildCollections();
    await buildModuleIntegration();
    await buildStatusEffects();
    if (getSetting("searchCompendium")) await buildCompendiumIndex();
    const promises = [];
    Hooks.callAll("spotlightOmnisearch.indexBuilt", INDEX, promises);
    await Promise.all(promises);

    const filters = new Set();

    INDEX.forEach((term) => {
        filters.add(term.type);
    });

    let filtersArray = [];
    Array.from(filters).forEach((filter) => {
        filtersArray.push(...filter.split(" ").map((f) => f.toLowerCase()));
    });
    filtersArray.sort((a, b) => a.localeCompare(b));
    //remove duplicates
    filtersArray = Array.from(new Set(filtersArray));
    FILTERS.push(...filtersArray);
    if (getSetting("searchFiles")) buildFiles();
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

        index.push(
            new BaseSearchTerm({
                name: pack.title,
                description: packPackageName,
                img: pack.banner,
                keywords: [],
                type: "compendium",
                data: { ...pack.metadata },
                icon: [CONFIG[pack.documentName].sidebarIcon, "fas fa-atlas"],
                onClick: async function () {
                    pack.render(true);
                },
            }),
        );

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
            if (document.folder) description = "<i style='display: inline; opacity: 0.3;' class='fas fa-folder'></i> " + getFoldersRecursive(document).join(" / ");
            const actions = [];
            if (collection.documentName === "JournalEntry") {
                document.pages.forEach((page) => {
                    actions.push({
                        name: page.name,
                        icon: `<i class="fa-solid fa-file-lines"></i>`,
                        callback: async function () {
                            const entity = await fromUuid(document.uuid);
                            entity.sheet.render(true, { pageId: page.id, anchor: null });
                        },
                    });

                    const pageActions = [];
                    const tocKeywords = [];
                    Object.values(page.toc).forEach((toc) => {
                        tocKeywords.push(toc.text.toLowerCase());
                        pageActions.push({
                            name: toc.text,
                            icon: `<i class="fa-solid fa-hashtag"></i>`,
                            callback: async function () {
                                const entity = await fromUuid(document.uuid);
                                entity.sheet.render(true, { pageId: page.id, anchor: toc.slug });
                            },
                        });
                    });

                    index.push(
                        new BaseSearchTerm({
                            name: page.name + ` (${document.name})`,
                            actions: pageActions,
                            keywords: tocKeywords,
                            description: description,
                            type: "JournalEntryPage",
                            data: { ...document, documentName: collection.documentName, uuid: document.uuid },
                            img: document.img,
                            icon: ["fas fa-earth-europe", "fas fa-file-lines"],
                            onClick: async function () {
                                const entity = await fromUuid(document.uuid);
                                entity.sheet.render(true, { pageId: page.id, anchor: null });
                            },
                        }),
                    );
                });
            }
            index.push(
                new BaseSearchTerm({
                    name: document.name ?? document.speaker?.alias ?? document.content,
                    description: description,
                    keywords: keywords,
                    actions: actions,
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
    const processSetting = (setting, isMenu) => {
        if (!setting.name || (!setting.config && !isMenu) || setting.config === false) return;
        if (!game.user.isGM && setting.scope === "world") return;
        let toggle = "";
        if (setting.type === Boolean) {
            const state = game.settings.get(setting.namespace, setting.key);
            toggle = `<i class="s-toggle-setting fad fa-toggle-${state ? "on" : "off"}" data-namespace="${setting.namespace}" data-key="${setting.key}"></i>`;
        }
        const icon = setting.icon ?? "fas fa-cogs";

        let settingNamespace = "";
        if (setting.namespace === game.system.id) settingNamespace = game.system.title;
        else if (setting.namespace === "core") settingNamespace = game.i18n.localize("Core");
        else settingNamespace = game.modules.get(setting.namespace)?.title;
        if (settingNamespace) settingNamespace = `<strong>${settingNamespace}</strong> - `;

        index.push(
            new BaseSearchTerm({
                name: game.i18n.localize(setting.name) + toggle,
                description: settingNamespace + game.i18n.localize(setting.hint),
                query: setting.key,
                keywords: [`${setting.key}${setting.namespace}`],
                type: "setting",
                data: { ...setting },
                img: null,
                icon: [icon],
                onClick: async function () {
                    if (isMenu) {
                        new setting.type().render(true);
                        return;
                    }
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
    };
    game.settings.menus.forEach((s) => processSetting(s, true));
    game.settings.settings.forEach(processSetting);
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
