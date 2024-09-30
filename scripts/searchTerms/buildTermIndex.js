import { BaseSearchTerm } from "./baseSearchTerm";
import { getSetting } from "../settings";
import { initSpecialSearches } from "./special";
import { MODULE_ID } from "../main";

const IMAGE = Object.keys(CONST.IMAGE_FILE_EXTENSIONS);
const AUDIO = Object.keys(CONST.AUDIO_FILE_EXTENSIONS);
const VIDEO = Object.keys(CONST.VIDEO_FILE_EXTENSIONS);

export const INDEX = [];
export const FILTERS = [];

export let FILE_INDEX = [];

let indexBuilt = false;

export async function buildIndex(force = false) {
    if (force) {
        indexBuilt = false;
        INDEX.length = 0;
        FILTERS.length = 0;
        FILE_INDEX.length = 0;
    }
    if (indexBuilt) return;
    indexBuilt = true;

    if (ui.spotlightOmnisearch?._html) {
        const faSearch = ui.spotlightOmnisearch._html.querySelector(".fa-search");
        if (faSearch) {
            faSearch.classList.add("fa-spin");
            faSearch.classList.remove("fa-search");
            faSearch.classList.add("fa-spinner");
        }
    }
    
    await initSpecialSearches();
    await buildModuleIntegration();
    await buildWeatherEffects();
    if (getSetting("searchSettings")) await buildSettings();
    if (getSetting("searchUtils")) await buildSettingsTab();
    if (getSetting("searchSidebar")) await buildCollections();
    await buildStatusEffects();
    if (getSetting("searchCompendium")) await buildCompendiumIndex();
    if (getSetting("searchFiles")) await buildFiles();

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

    if (ui.spotlightOmnisearch?.rendered) {
        const faSpinner = ui.spotlightOmnisearch._html.querySelector(".fa-spinner");
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
    documentName = documentName.toUpperCase();
    //capitalize first letter of documentType
    documentType = documentType.charAt(0).toUpperCase() + documentType.slice(1);
    const localKey = `${documentName}.Type${documentType}`;
    const localized = game.i18n.localize(localKey);
    return localized !== localKey ? ` ${localized}` : ` ${documentType}`;
}

async function buildCompendiumIndex() {
    const allowedCompendiums = getSetting("compendiumConfig");
    const packs = Array.from(game.packs).filter((p) => (game.user.isGM || !p.private) && allowedCompendiums[p.metadata.id] !== false);
    const pageLocalized = game.i18n.localize("DOCUMENT.JournalEntryPage");
    const fullCompendiumJournalIndex = getSetting("fullCompendiumJournalIndex");
    const index = [];
    await Promise.all(packs.map((p) => p.getIndex()));
    const localizedCompendiumName = game.i18n.localize("PACKAGE.TagCompendium");
    for (const pack of packs) {
        const packPackageName = (pack.metadata.packageType === "system" ? game.system.title : game.modules.get(pack.metadata.packageName)?.title) ?? game.i18n.localize("PACKAGE.Type.world");
        const packIndex = Array.from(await pack.getIndex());
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
            if (pack.documentName === "JournalEntry" && fullCompendiumJournalIndex) {
                const document = await pack.getDocument(entry._id);
                const actions = [];
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

                    if (page.type === "image")
                        pageActions.push({
                            name: game.i18n.localize("JOURNAL.ActionShow"),
                            icon: `<i class="fa-solid fa-image"></i>`,
                            callback: async function () {
                                new ImagePopout(page.src, {}).render(true);
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
                                entity.sheet.render(true, { pageId: page.id, anchor: toc.slug });
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
                            data: { ...page, documentName: page.documentName, uuid: page.uuid },
                            img: page.img,
                            icon: ["fas fa-atlas", "fas fa-file-lines"],
                            onClick: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid);
                                const entity = await fromUuid(document.uuid);
                                entity.sheet.render(true, { pageId: page.id, anchor: null });
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
                        type: localizedDocumentName + " " + localizedCompendiumName + createDocumentTypeTypeString(pack.documentName, entry.type),
                        data: { ...entry, documentName: pack.documentName },
                        img: entry.img,
                        icon: ["fas fa-atlas", CONFIG[pack.documentName].sidebarIcon],
                        onClick: async function () {
                            const entity = await fromUuid(entry.uuid);
                            entity.sheet.render(true);
                        },
                    }),
                );
            } else {
                index.push(
                    new BaseSearchTerm({
                        name: entry.name,
                        description: pack.title + " - " + packPackageName,
                        keywords: [pack.title],
                        type: localizedDocumentName + " " + localizedCompendiumName + createDocumentTypeTypeString(pack.documentName, entry.type),
                        data: { ...entry, documentName: pack.documentName },
                        img: entry.img,
                        icon: ["fas fa-atlas", CONFIG[pack.documentName].sidebarIcon],
                        onClick: async function () {
                            const entity = await fromUuid(entry.uuid);
                            entity.sheet.render(true);
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

    const playerLocalized = game.i18n.localize("ACTOR.TypeCharacterPl");

    for (const collection of collections) {
        const localizedCollectionName = game.i18n.localize(`DOCUMENT.${collection.documentName}`);
        if (exclude.includes(collection.documentName)) continue;
        const documents = Array.from(collection);
        documents.forEach((document) => {
            if (!document.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;
            const keywords = [];
            let description = "";
            let extraType = "";
            if (document.folder) description = "<i style='display: inline; opacity: 0.3;' class='fas fa-folder'></i> " + getFoldersRecursive(document).join(" / ");
            const actions = [];
            if (collection.documentName === "JournalEntry") {
                document.pages.forEach((page) => {
                    if (!page.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;
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

                    if (page.type === "image")
                        pageActions.push({
                            name: game.i18n.localize("JOURNAL.ActionShow"),
                            icon: `<i class="fa-solid fa-image"></i>`,
                            callback: async function () {
                                new ImagePopout(page.src, {}).render(true);
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
                            type: pageLocalized,
                            data: { ...page, documentName: page.documentName, uuid: page.uuid },
                            img: page.img,
                            icon: ["fas fa-earth-europe", "fas fa-file-lines"],
                            onClick: async function () {
                                if (ui.simpleQuest && ui.simpleQuest.isSimpleQuestPage(page.uuid)) return ui.simpleQuest.openToPage(page.uuid);
                                const entity = await fromUuid(document.uuid);
                                entity.sheet.render(true, { pageId: page.id, anchor: null });
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
    const localizedKeybindingsName = game.i18n.localize("SETTINGS.Keybindings");
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
                type: localizedKeybindingsName,
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
    const fileCache = canvas.deepSearchCache?._fileIndexCache;
    if (!fileCache) return;
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
                            new ImagePopout(file, {}).render(true);
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
    const effects = CONFIG.statusEffects;
    for (const effect of effects) {
        if (!effect.name) continue;
        INDEX.push(
            new BaseSearchTerm({
                name: () => game.i18n.localize(effect.name),
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

    if (game.modules.get("mastercrafted")?.active) {
        const recipeBooks = ui.RecipeApp._currentApp._recipeBooks;
        for (const book of recipeBooks) {
            for (const recipe of book.recipes) {
                INDEX.push(
                    new BaseSearchTerm({
                        name: recipe.name,
                        description: book.name,
                        keywords: [],
                        type: "mastercrafted recipe",
                        data: {},
                        img: recipe.img,
                        icon: ["fas fa-book", "fas fa-hammer"],
                        onClick: async function () {
                            new ui.RecipeApp(null, null, recipe.name).render(true);
                        },
                    }),
                );
            }
        }
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
                    keywords: [game.i18n.localize("SCENES.WeatherEffect")],
                    type: "fxmaster " + game.i18n.localize("SCENES.WeatherEffect"),
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
                    keywords: [game.i18n.localize("SCENES.WeatherEffect")],
                    type: game.i18n.localize("SCENES.WeatherEffect"),
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
