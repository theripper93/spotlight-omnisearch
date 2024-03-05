import {BaseSearchTerm} from "./baseSearchTerm";
import { getSetting } from "../settings";

export const INDEX = [];

export let FILE_INDEX = [];

let indexBuilt = false;

export async function buildIndex() {
    if (indexBuilt) return;
    indexBuilt = true;
    if(getSetting("searchFiles")) await buildFiles();
    if(getSetting("searchSettings")) await buildSettings();
    if(getSetting("searchUtils")) await buildSettingsTab();
    if(getSetting("searchSidebar")) await buildCollections();
    if (getSetting("searchCompendium")) await buildCompendiumIndex();
    const promises = [];
    Hooks.callAll("spotlightOmnisearch.indexBuilt", INDEX, promises);
    await Promise.all(promises);
    return INDEX;
}

async function buildCompendiumIndex() {
    const packs = Array.from(game.packs);
    const index = [];
    for (const pack of packs) {
        if(!game.user.isGM && pack.private) continue;
        const packIndex = Array.from(await pack.getIndex());
        packIndex.forEach((entry) => {
            index.push(
                new BaseSearchTerm({
                    name: entry.name,
                    keywords: [],
                    type: pack.documentName + " compendium",
                    data: { ...entry, documentName: pack.documentName },
                    img: entry.img,
                    icon: ["fas fa-book", CONFIG[pack.documentName].sidebarIcon],
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

    const exclude = ["Combat", "Setting"];

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
    if(!game.user.isGM) return;
    const index = [];
    game.settings.settings.forEach((setting) => {
        if (!setting.name) return;
        index.push(
            new BaseSearchTerm({
                name: game.i18n.localize(setting.name),
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
        const icon = button.querySelector("i").className;
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
    if(!game.user.isGM) return;
    //wait 5 seconds for the file index to be built
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
                    data: { dropData },
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
