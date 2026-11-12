import { MODULE_ID } from "../main";
import { getSetting } from "../settings";
import { BaseSearchTerm } from "./baseSearchTerm";
import { initSpecialSearches } from "./special";

const IMAGE = Object.keys(CONST.IMAGE_FILE_EXTENSIONS);
const AUDIO = Object.keys(CONST.AUDIO_FILE_EXTENSIONS);
const VIDEO = Object.keys(CONST.VIDEO_FILE_EXTENSIONS);

export const INDEX = [];
export const FILTERS = [];

export let FILE_INDEX = [];

const INDEXED_DOCUMENTS = ["Actor", "Cards", "Folder", "Item", "JournalEntry", "JournalEntryPage", "Macro", "Playlist", "RollTable", "Scene", "User"];
const INDEXED_FIELDS = ["name", "img", "folder", "ownership", "text", "flags"];

let buildPromise = null;
let indexDirty = false;

export function buildIndex(force = false) {
    if (buildPromise && !force && !indexDirty) return buildPromise;
    indexDirty = false;
    buildPromise = (buildPromise ?? Promise.resolve()).catch(() => {}).then(rebuildIndex);
    return buildPromise;
}

const refreshOpenSpotlight = foundry.utils.debounce(async () => {
    if (!ui.spotlightOmnisearch?.rendered) return;
    await buildIndex();
    ui.spotlightOmnisearch?._onSearch();
}, 500);

function invalidateIndex(document) {
    if (document.parent && document.documentName !== "JournalEntryPage") return;
    indexDirty = true;
    refreshOpenSpotlight();
}

export function registerIndexHooks() {
    for (const documentName of INDEXED_DOCUMENTS) {
        Hooks.on(`create${documentName}`, invalidateIndex);
        Hooks.on(`delete${documentName}`, invalidateIndex);
        Hooks.on(`update${documentName}`, (document, changes) => {
            if (INDEXED_FIELDS.some((field) => field in changes)) invalidateIndex(document);
        });
    }
}

async function rebuildIndex() {
    INDEX.length = 0;
    FILTERS.length = 0;
    FILE_INDEX.length = 0;

    if (ui.spotlightOmnisearch?.element) {
        const faSearch = ui.spotlightOmnisearch.element.querySelector(".fa-search");
        if (faSearch) {
            faSearch.classList.add("fa-spin");
            faSearch.classList.remove("fa-search");
            faSearch.classList.add("fa-spinner");
        }
    }

    try {
        await initSpecialSearches();
    } catch (e) {
        console.error("Spotlight Omnisearch: Error building special searches:", e);
    }

    try {
        await buildModuleIntegration();
    } catch (e) {
        console.error("Spotlight Omnisearch: Error building module integration:", e);
    }

    try {
        await buildWeatherEffects();
    } catch (e) {
        console.error("Spotlight Omnisearch: Error building weather effects:", e);
    }

    if (getSetting("searchSettings")) {
        try {
            await buildSettings();
        } catch (e) {
            console.error("Spotlight Omnisearch: Error building settings:", e);
        }
    }

    if (getSetting("searchUtils")) {
        try {
            await buildSettingsTab();
        } catch (e) {
            console.error("Spotlight Omnisearch: Error building settings tab:", e);
        }
    }

    if (getSetting("searchSidebar")) {
        try {
            await buildCollections();
        } catch (e) {
            console.error("Spotlight Omnisearch: Error building collections:", e);
        }
    }

    try {
        await buildStatusEffects();
    } catch (e) {
        console.error("Spotlight Omnisearch: Error building status effects:", e);
    }

    if (getSetting("searchCompendium")) {
        try {
            await buildCompendiumIndex();
        } catch (e) {
            console.error("Spotlight Omnisearch: Error building compendium index:", e);
        }
    }

    if (getSetting("searchFiles")) {
        try {
            await buildFiles();
        } catch (e) {
            console.error("Spotlight Omnisearch: Error building files:", e);
        }
    }

    const promises = [];
    Hooks.callAll("spotlightOmnisearch.indexBuilt", INDEX, promises);
    await Promise.all(promises);

    const filters = new Set();

    INDEX.forEach((term) => {
        filters.add(term.type);
    });

    let filtersArray = ["mp3", "ogg", "webm", "webp", "png", "jpg", "jpeg"];
    Array.from(filters).forEach((filter) => {
        filtersArray.push(...filter.split(" ").map((f) => f.toLowerCase()));
    });
    filtersArray.sort((a, b) => a.localeCompare(b));
    //remove duplicates
    filtersArray = Array.from(new Set(filtersArray));
    FILTERS.push(...filtersArray);

    if (ui.spotlightOmnisearch?.element) {
        const faSpinner = ui.spotlightOmnisearch.element.querySelector(".fa-spinner");
        if (faSpinner) {
            faSpinner.classList.remove("fa-spin");
            faSpinner.classList.remove("fa-spinner");
            faSpinner.classList.add("fa-search");
        }
    }

    return INDEX;
}

function createDocumentTypeTypeString(documentName, documentType) {
    if (!documentType) return "";
    const capitalizedType = documentType.capitalize();
    const validLocStrings = [`${documentName.toUpperCase()}.Type${capitalizedType}`, `TYPES.${documentName}.${documentType}`];
    for (const str of validLocStrings) {
        const loc = game.i18n.localize(str);
        if (str !== loc) return loc;
    }
    return capitalizedType;
}

const INVALID_PACKS = new Set();
const INVALID_JOURNAL_PACKS = new Set();

function markPackInvalid(set, pack, message, error) {
    set.add(pack.collection);
    console.error(`Spotlight Omnisearch: ${message}: ${pack.collection}`, error);
}

async function buildCompendiumIndex() {
    const allowedCompendiums = getSetting("compendiumConfig");
    const allowedPacks = Array.from(game.packs).filter((p) => (game.user.isGM || p.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) && allowedCompendiums[p.metadata.id] !== false);
    const pageLocalized = game.i18n.localize("DOCUMENT.JournalEntryPage");
    const fullCompendiumJournalIndex = getSetting("fullCompendiumJournalIndex");
    const index = [];
    const packsToIndex = allowedPacks.filter((p) => !INVALID_PACKS.has(p.collection));
    const indexResults = await Promise.allSettled(packsToIndex.map((p) => p.getIndex()));
    const packs = packsToIndex.filter((p, i) => {
        if (indexResults[i].status === "fulfilled") return true;
        markPackInvalid(INVALID_PACKS, p, "Error indexing compendium, skipping it", indexResults[i].reason);
        return false;
    });
    const journalDocuments = new Map();
    if (fullCompendiumJournalIndex) {
        const journalPacks = packs.filter((p) => p.documentName === "JournalEntry" && !INVALID_JOURNAL_PACKS.has(p.collection));
        const documentResults = await Promise.allSettled(journalPacks.map((p) => p.getDocuments()));
        documentResults.forEach((result, i) => {
            if (result.status === "fulfilled") return result.value.forEach((document) => journalDocuments.set(document.uuid, document));
            markPackInvalid(INVALID_JOURNAL_PACKS, journalPacks[i], "Error loading journals from compendium, falling back to basic index", result.reason);
        });
    }
    const failedJournalPacks = new Set(packs.filter((p) => INVALID_JOURNAL_PACKS.has(p.collection)));
    const localizedCompendiumName = game.i18n.localize("PACKAGE.TagCompendium");
    for (const pack of packs) {
        const packPackageName = (pack.metadata.packageType === "system" ? game.system.title : game.modules.get(pack.metadata.packageName)?.title) ?? game.i18n.localize("PACKAGE.Type.world");
        const packIndex = Array.from(pack.index);
        const localizedDocumentName = game.i18n.localize(`DOCUMENT.${pack.documentName}`);

        index.push(
            new BaseSearchTerm({
                name: pack.title,
                description: packPackageName,
                img: pack.banner,
                keywords: [],
                type: localizedCompendiumName,
                data: { ...pack.metadata },
                icon: [CONFIG[pack.documentName].sidebarIcon, "fas fa-atlas"],
                onClick: async function () {
                    pack.render(true);
                },
            }),
        );

        for (const entry of packIndex) {
            const document = pack.documentName === "JournalEntry" && fullCompendiumJournalIndex && !failedJournalPacks.has(pack) ? (journalDocuments.get(entry.uuid) ?? (await pack.getDocument(entry._id).catch(() => null))) : null;
            if (document) {
                const actions = [];
                document.pages.forEach((page) => {
                    actions.push({
                        name: page.name,
                        icon: `<i class="fa-solid fa-file-lines"></i>`,
                        callback: async function () {
                            const entity = await fromUuid(document.uuid);
                            entity?.sheet.render(true, { pageId: page.id, anchor: null });
                        },
                    });

                    const pageActions = [];
                    const tocKeywords = [];

                    if (page.type === "image")
                        pageActions.push({
                            name: game.i18n.localize("JOURNAL.ActionShow"),
                            icon: `<i class="fa-solid fa-image"></i>`,
                            callback: async function () {
                                new foundry.applications.apps.ImagePopout({ src: page.src }).render(true);
                            },
                        });

                    Object.values(page.toc).forEach((toc) => {
                        tocKeywords.push(toc.text.toLowerCase());
                        pageActions.push({
                            name: toc.text,
                            icon: `<i class="fa-solid fa-hashtag"></i>`,
                            callback: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid, toc.slug);
                                const entity = await fromUuid(document.uuid);
                                entity?.sheet.render(true, { pageId: page.id, anchor: toc.slug });
                            },
                        });
                    });

                    index.push(
                        new BaseSearchTerm({
                            name: page.name + ` (${document.name})`,
                            actions: pageActions,
                            keywords: tocKeywords,
                            description: packPackageName,
                            type: pageLocalized,
                            data: { _id: page.id, name: page.name, type: page.type, documentName: page.documentName, uuid: page.uuid },
                            img: page.img,
                            icon: ["fas fa-atlas", "fas fa-file-lines"],
                            onClick: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid);
                                const entity = await fromUuid(document.uuid);
                                entity?.sheet.render(true, { pageId: page.id, anchor: null });
                            },
                        }),
                    );
                });

                index.push(
                    new BaseSearchTerm({
                        name: entry.name,
                        description: pack.title + " - " + packPackageName,
                        keywords: [pack.title],
                        actions: actions,
                        type: [localizedDocumentName, localizedCompendiumName, createDocumentTypeTypeString(pack.documentName, entry.type)].filterJoin(" "),
                        data: { ...entry, documentName: pack.documentName },
                        img: entry.img,
                        icon: ["fas fa-atlas", CONFIG[pack.documentName].sidebarIcon],
                        onClick: async function () {
                            const entity = await fromUuid(entry.uuid);
                            entity?.sheet.render(true);
                        },
                    }),
                );
            } else {
                index.push(
                    new BaseSearchTerm({
                        name: entry.name,
                        description: pack.title + " - " + packPackageName,
                        keywords: [pack.title],
                        type: [localizedDocumentName, localizedCompendiumName, createDocumentTypeTypeString(pack.documentName, entry.type)].filterJoin(" "),
                        data: { ...entry, documentName: pack.documentName },
                        img: entry.img,
                        icon: ["fas fa-atlas", CONFIG[pack.documentName].sidebarIcon],
                        onClick: async function () {
                            const entity = await fromUuid(entry.uuid);
                            entity?.sheet.render(true);
                        },
                    }),
                );
            }
        }
    }
    //sort index by type
    index.sort((a, b) => a.type.localeCompare(b.type));
    INDEX.push(...index);
}

async function buildCollections() {
    const collections = Array.from(game.collections);

    const index = [];

    const exclude = ["Combat", "Setting", "FogExploration", "ChatMessage", "Folder"];

    const pageLocalized = game.i18n.localize("DOCUMENT.JournalEntryPage");

    const playerLocalized = game.i18n.localize("PLAYERS.Title");

    for (const collection of collections) {
        const localizedCollectionName = game.i18n.localize(`DOCUMENT.${collection.documentName}`);
        if (exclude.includes(collection.documentName)) continue;
        const documents = Array.from(collection);
        documents.forEach((document) => {
            if (!document.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;
            const keywords = [];
            let description = "";
            let extraType = "";
            if (document.folder) description = "<i style='display: inline; opacity: 0.3;' class='fas fa-folder'></i> " + foundry.utils.escapeHTML(getFoldersRecursive(document).join(" / "));
            const actions = [];
            if (collection.documentName === "JournalEntry") {
                document.pages.forEach((page) => {
                    if (!page.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;
                    actions.push({
                        name: page.name,
                        icon: `<i class="fa-solid fa-file-lines"></i>`,
                        callback: async function () {
                            const entity = await fromUuid(document.uuid);
                            entity?.sheet.render(true, { pageId: page.id, anchor: null });
                        },
                    });

                    const pageActions = [];
                    const tocKeywords = [];

                    if (page.type === "image")
                        pageActions.push({
                            name: game.i18n.localize("JOURNAL.ActionShow"),
                            icon: `<i class="fa-solid fa-image"></i>`,
                            callback: async function () {
                                new foundry.applications.apps.ImagePopout({ src: page.src }).render(true);
                            },
                        });

                    Object.values(page.toc).forEach((toc) => {
                        tocKeywords.push(toc.text.toLowerCase());
                        pageActions.push({
                            name: toc.text,
                            icon: `<i class="fa-solid fa-hashtag"></i>`,
                            callback: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid, toc.slug);
                                const entity = await fromUuid(document.uuid);
                                entity?.sheet.render(true, { pageId: page.id, anchor: toc.slug });
                            },
                        });
                    });

                    index.push(
                        new BaseSearchTerm({
                            name: page.name + ` (${document.name})`,
                            actions: pageActions,
                            keywords: tocKeywords,
                            description: description,
                            type: pageLocalized,
                            data: { _id: page.id, name: page.name, type: page.type, documentName: page.documentName, uuid: page.uuid },
                            img: page.img,
                            icon: ["fas fa-earth-europe", "fas fa-file-lines"],
                            onClick: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid);
                                const entity = await fromUuid(document.uuid);
                                entity?.sheet.render(true, { pageId: page.id, anchor: null });
                            },
                        }),
                    );
                });
            }
            if (collection.documentName === "Actor") {
                const itemPileType = document.flags["item-piles"]?.data?.type;
                if (itemPileType) {
                    keywords.push(itemPileType);
                    extraType += ` ${itemPileType}`;
                }
                if (document.hasPlayerOwner) extraType += ` ${playerLocalized}`;
            }
            index.push(
                new BaseSearchTerm({
                    name: document.name ?? document.speaker?.alias ?? document.content,
                    description: description,
                    keywords: keywords,
                    actions: actions,
                    type: localizedCollectionName + extraType,
                    data: { _id: document.id, name: document.name, type: document.type, img: document.img, documentName: collection.documentName, uuid: document.uuid },
                    img: document.img,
                    icon: ["fas fa-earth-europe", CONFIG[collection.documentName].sidebarIcon],
                    onClick: async function () {
                        const entity = await fromUuid(document.uuid);
                        entity?.sheet.render(true);
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
    const localizedSettingName = game.i18n.localize("DOCUMENT.Setting");
    const processSetting = (setting, isMenu = false) => {
        isMenu = isMenu === true ? true : false;
        if (!setting.name || (!setting.config && !isMenu) || setting.config === false) return;
        if (!game.user.isGM && setting.scope === "world") return;
        if (!game.user.isGM && setting.restricted) return;
        let toggle = "";
        if (setting.type === Boolean) {
            toggle = () => {
                const state = game.settings.get(setting.namespace, setting.key);
                return `<i class="s-toggle-setting fad fa-toggle-${state ? "on" : "off"}" data-namespace="${setting.namespace}" data-key="${setting.key}"></i>`;
            };
        }
        const icon = setting.icon ?? "fas fa-cogs";

        let settingNamespace = "";
        if (setting.namespace === game.system.id) settingNamespace = game.system.title;
        else if (setting.namespace === "core") settingNamespace = game.i18n.localize("Core");
        else settingNamespace = game.modules.get(setting.namespace)?.title;
        if (settingNamespace) settingNamespace = `<strong>${settingNamespace}</strong> - `;

        index.push(
            new BaseSearchTerm({
                name: game.i18n.localize(setting.name),
                nameExtra: toggle,
                description: settingNamespace + game.i18n.localize(setting.hint),
                query: setting.key,
                keywords: [`${setting.key}${setting.namespace}`],
                type: localizedSettingName,
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
                        const settingFG = html.querySelector(`[name="${setting.namespace}.${setting.key}"]`)?.closest(".form-group");
                        highlightInApp(app, settingFG);
                    });
                },
            }),
        );
    };
    game.settings.menus.forEach((s) => processSetting(s, true));
    game.settings.settings.forEach(processSetting);
    const localizedKeybindingsName = game.i18n.localize("spotlight-omnisearch.KEYBINDING");
    game.keybindings.actions.forEach((binding, key) => {
        if (!game.user.isGM && binding.restricted) return;
        const name = game.i18n.localize(binding.name);
        let description = "";
        const bindings = game.keybindings.bindings.get(key);
        bindings.forEach((b) => {
            description += `<span class="key">${foundry.applications.sidebar.apps.ControlsConfig.humanizeBinding(b)}</span>`;
        });
        if (binding.hint) description += game.i18n.localize(binding.hint);
        index.push(
            new BaseSearchTerm({
                name: name,
                description: description,
                keywords: [],
                type: localizedKeybindingsName,
                data: { ...binding },
                img: null,
                icon: ["fas fa-keyboard"],
                onClick: async function () {
                    Hooks.once("renderControlsConfig", (app, html) => {
                        highlightInApp(app, html.querySelector(`[data-action-id="${key}"]`));
                    });
                    new foundry.applications.sidebar.apps.ControlsConfig().render(true);
                },
            }),
        );
    });
    INDEX.push(...index);
}

function highlightInApp(app, element) {
    if (!element) return;
    const tab = element.closest(".tab[data-group]");
    if (tab) app.changeTab(tab.dataset.tab, tab.dataset.group);
    setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth" });
    }, 100);
    element.style.backgroundColor = "#0000ff29";
}

async function buildSettingsTab() {
    const settingsSidebar = document.querySelector(".settings-sidebar#settings");
    const buttons = settingsSidebar.querySelectorAll("button");
    const tabSettingsLocalized = game.i18n.localize("SIDEBAR.TabSettings");
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
                type: tabSettingsLocalized,
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

let previewAudio = null;

async function buildFiles() {
    if (!game.user.isGM) return;
    const indexedFiles = game.modules.get("fuzzy-foundry")?.api?.fileIndex?.files;
    if (!indexedFiles?.length) return;
    const fileCache = {};
    for (const { path } of indexedFiles) (fileCache[path.split("/").pop()] ??= []).push(path);
    const index = [];
    for (const [fileName, files] of Object.entries(fileCache)) {
        const ext = fileName.split(".").pop().toLowerCase();
        let icon = "fas fa-file";
        let isImageOrVideo = false;
        let isAudio = false;
        if (IMAGE.includes(ext)) {
            icon = "fas fa-image";
            isImageOrVideo = true;
        }
        if (VIDEO.includes(ext)) {
            icon = "fas fa-film";
            isImageOrVideo = true;
        }
        if (AUDIO.includes(ext)) {
            icon = "fas fa-volume-up";
            isAudio = true;
        }

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
            if (isAudio) {
                dropData = {
                    src: file,
                };
            }
            let onDrop = null;
            const actions = [];
            if (isAudio) {
                onDrop = async function (event) {
                    const target = document.elementFromPoint(event.clientX, event.clientY);
                    if (!target) return;
                    console.log("Dropped audio", target);
                    const isPlaylist = target.closest(".document.playlist");
                    const isCanvas = target.closest("#board");
                    if (isPlaylist) {
                        const playlistDocument = game.playlists.get(isPlaylist.dataset.entryId);
                        const fnNoExt = fileName.split(".").slice(0, -1).join(".");
                        const soundName = decodeURIComponent(fnNoExt);
                        playlistDocument.createEmbeddedDocuments("PlaylistSound", [
                            {
                                name: soundName,
                                path: file,
                            },
                        ]);
                    }
                    if (isCanvas) {
                        const [x, y] = [event.clientX, event.clientY];
                        const t = canvas.stage.worldTransform;
                        const cX = (x - t.tx) / canvas.stage.scale.x;
                        const cy = (y - t.ty) / canvas.stage.scale.y;
                        canvas.sounds.activate();
                        canvas.scene.createEmbeddedDocuments("AmbientSound", [
                            {
                                path: file,
                                radius: canvas.scene.dimensions.distance * 3,
                                x: cX,
                                y: cy,
                            },
                        ]);
                    }
                };
                actions.push({
                    name: game.i18n.localize(`${MODULE_ID}.actions.playForEveryone`),
                    icon: `<i class="fas fa-play"></i>`,
                    callback: async function () {
                        if (previewAudio) previewAudio.stop();
                        await foundry.audio.AudioHelper.play({ src: file, autoplay: true, volume: 0.7, loop: false }, true);
                    },
                });
            }
            index.push(
                new BaseSearchTerm({
                    name: decodeURIComponent(fileName),
                    keywords: [file],
                    type: "file " + fileName.split(".").pop().toLowerCase(),
                    dragData: dropData,
                    img: null,
                    actions: actions,
                    icon: [icon],
                    onDragEnd: onDrop,
                    onClick: async function () {
                        if (isImageOrVideo) {
                            new foundry.applications.apps.ImagePopout({ src: file }).render(true);
                        }
                        if (isAudio) {
                            if (previewAudio) previewAudio.stop();
                            previewAudio = await foundry.audio.AudioHelper.play({ src: file, autoplay: true, volume: 0.5, loop: false }, false);
                            const current = previewAudio;
                            setTimeout(() => {
                                if (current === previewAudio) previewAudio.stop();
                            }, 5000);
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
    const effects = Object.values(CONFIG.statusEffects);
    for (const effect of effects) {
        if (!effect.name) continue;
        INDEX.push(
            new BaseSearchTerm({
                name: () => game.i18n.localize(effect.name),
                keywords: [],
                type: "statusEffect",
                data: { ...effect },
                img: effect.img,
                icon: ["fas fa-earth-europe", "fas fa-bolt"],
                onClick: async function () {
                    canvas.tokens.controlled.forEach((token) => {
                        token.actor?.toggleStatusEffect(effect.id);
                    });
                },
            }),
        );
    }
}

async function buildModuleIntegration() {
    //dfreds
    if (game.modules.get("dfreds-convenient-effects")?.active) {
        const allEffects = game.dfreds.effectInterface.findEffects();
        const moduleName = game.modules.get("dfreds-convenient-effects").title;
        for (const effect of allEffects) {
            INDEX.push(
                new BaseSearchTerm({
                    name: effect.name,
                    description: effect.description,
                    keywords: [],
                    type: moduleName,
                    data: { ...effect },
                    img: effect.img,
                    icon: ["fas fa-hand-sparkles", "fas fa-bolt"],
                    onClick: async function () {
                        game.dfreds.effectInterface.toggleEffect({effectId: effect.id});
                    },
                }),
            );
        }
    }

    if (game.itempiles) {
        const users = Array.from(game.users).filter((u) => u !== game.user);
        const actions = users.map((u) => {
            return {
                name: u.name,
                icon: `<i class="fas fa-handshake"></i>`,
                callback: async function () {
                    game.itempiles.API.requestTrade(u);
                },
            };
        });
        INDEX.push(
            new BaseSearchTerm({
                name: game.i18n.localize("ITEM-PILES.ContextMenu.RequestTrade"),
                actions: actions,
                keywords: [],
                type: "item-piles",
                data: {},
                img: null,
                icon: ["fas fa-boxes"],
                onClick: async function () {
                    game.itempiles.toggle();
                },
            }),
        );
    }
}

async function buildWeatherEffects() {
    if (!game.user.isGM) return;
    const weatherFX = CONFIG.weatherEffects;
    for (const [key, effect] of Object.entries(weatherFX)) {
        const isFxMaster = CONFIG.fxmaster && key.includes("fxmaster");
        if (isFxMaster) {
            const FXMKEY = key.replace("fxmaster.", "");
            const FXMEffect = CONFIG.fxmaster.particleEffects[FXMKEY];
            INDEX.push(
                new BaseSearchTerm({
                    name: game.i18n.localize(FXMEffect.label),
                    description: FXMEffect.description,
                    keywords: [game.i18n.localize("SCENE.FIELDS.weather.label")],
                    type: "fxmaster " + game.i18n.localize("SCENE.FIELDS.weather.label"),
                    img: FXMEffect.icon,
                    icon: ["fas fa-wand-magic-sparkles", "fas fa-cloud-rain"],
                    onClick: async function () {
                        const currentSceneWeather = game.scenes.viewed.weather;
                        if (currentSceneWeather === key) {
                            game.scenes.viewed.update({ weather: "" });
                        } else {
                            game.scenes.viewed.update({ weather: key });
                        }
                    },
                }),
            );
        } else {
            INDEX.push(
                new BaseSearchTerm({
                    name: game.i18n.localize(effect.label),
                    description: effect.description,
                    keywords: [game.i18n.localize("SCENE.FIELDS.weather.label")],
                    type: game.i18n.localize("SCENE.FIELDS.weather.label"),
                    icon: ["fas fa-map", "fas fa-cloud-sun-rain"],
                    onClick: async function () {
                        const currentSceneWeather = game.scenes.viewed.weather;
                        if (currentSceneWeather === key) {
                            game.scenes.viewed.update({ weather: "" });
                        } else {
                            game.scenes.viewed.update({ weather: key });
                        }
                    },
                }),
            );
        }
    }
}
