import { BaseSearchTerm } from "./baseSearchTerm";
import { MODULE_ID } from "../main";
import {getSetting, setSetting} from "../settings";
import { FILTERS } from "./buildTermIndex";

export const SPECIAL_SEARCHES = [];

let LAST_COUNTER_FOCUS = null;

export async function initSpecialSearches() {
    SPECIAL_SEARCHES.length = 0;

    const NOTE_MATCHING = ["notes", "note:", "notes:", "n:", "n ", game.i18n.localize(`${MODULE_ID}.special.note.local-keyword`)];
    const ROLL_MATCHING = ["!roll", "roll:", "r:", "r ", game.i18n.localize(`${MODULE_ID}.special.roll.local-keyword`)];
    const TIMER_MATCHING = ["timer:", "time", "time:", "t:", "t ", game.i18n.localize(`${MODULE_ID}.special.timer.local-keyword`)];
    const TRACKER_MATCHING = ["tracker:", "t:", "t ", "track", "track:", "s:", "s ", "f:", "f ", game.i18n.localize(`${MODULE_ID}.special.tracker.local-keyword`)];
    const COUNTER_MATCHING = ["counter:", "c:", "c ", "count", "count:", "c:", "c ", game.i18n.localize(`${MODULE_ID}.special.counter.local-keyword`)];

    const UNITS_MAPPING = {
        ft: (value) => value * 0.3048 + "m",
        in: (value) => value * 2.54 + "cm",
        yd: (value) => value * 0.9144 + "m",
        mi: (value) => value * 1.60934 + "km",
        lb: (value) => value * 0.453592 + "kg",
        lbs: (value) => value * 0.453592 + "kg",
        oz: (value) => value * 28.3495 + "g",
        gal: (value) => value * 3.78541 + "l",
        pt: (value) => value * 473.176 + "ml",
        "fl oz": (value) => value * 29.5735 + "ml",
        tbsp: (value) => value * 14.7868 + "ml",
        f: (value) => ((value - 32) * 5) / 9 + "c",
        "°": (value) => (value * 9) / 5 + 32 + "f",
        "°C": (value) => (value * 9) / 5 + 32 + "°F",
        "°F": (value) => ((value - 32) * 5) / 9 + "°C",
        c: (value) => (value * 9) / 5 + 32 + "f",
        m: (value) => value * 3.28084 + "ft",
        cm: (value) => value * 0.393701 + "in",
        km: (value) => value * 0.621371 + "mi",
        kg: (value) => value * 2.20462 + "lb",
        g: (value) => value * 0.035274 + "oz",
        l: (value) => value * 0.264172 + "gal",
        ml: (value) => value * 0.00211338 + "pt",
    };

    const UNITS = Object.keys(UNITS_MAPPING);

    const LIGHT_LOCALIZATION = game.i18n.localize(`Light`);

    SPECIAL_SEARCHES.push(
        //Calculator
        new BaseSearchTerm({
            name: function (search) {
                try {
                    return `${eval(search.query)}`;
                } catch {
                    //remove characters from the end until the last character is a number
                    let query = search.query;
                    while (query.length > 0 && isNaN(query[query.length - 1])) {
                        query = query.slice(0, -1);
                    }
                    try {
                        return `${eval(query)}`;
                    } catch {
                        return "...";
                    }
                }
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-calculator",
            match: (query) => {
                return query && query.match(/^[0-9\+\-\*\/\(\)\.\s]*$/);
            },
            onClick: function (search) {
                navigator.clipboard.writeText(this.name);
                ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.calc-clipboard`));
            },
        }),
        //unit converter
        new BaseSearchTerm({
            name: function (search) {
                //remove all spaces
                let query = search.query.replaceAll(" ", "");
                //check if the query contains a number and a unit, the number should be matched for plus and minus signs as well
                const numberPart = query.match(/[\d+-.]+/)?.[0];
                //alpha part should also include the ° symbol
                const alphaPart = query.match(/[a-zA-Z°]+/)?.[0];
                const closestUnit = UNITS.find((unit) => alphaPart === unit) ?? UNITS.find((unit) => alphaPart.includes(unit));
                if (numberPart && closestUnit) {
                    const value = parseFloat(numberPart);
                    const unit = closestUnit;
                    const converted = UNITS_MAPPING[unit](value);
                    let convertedValue = converted.match(/[\d+-.]+/)?.[0];
                    const convertedUnit = converted.match(/[a-zA-Z°]+/)?.[0];
                    //round to 2 decimal places
                    if (convertedValue) convertedValue = parseFloat(convertedValue).toFixed(2);
                    return `<div class="unit-converter-result"><span>${value} ${unit}</span> <i class="fas fa-equals"></i> <span data-converted="${convertedValue}">${convertedValue} ${convertedUnit}</span></div>`;
                }
                return "...";
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-calculator",
            match: (query) => {
                //remove all spaces
                query = query.replaceAll(" ", "");
                //check if the query contains a number and a unit
                const numberPart = query.match(/[\d.]+/)?.[0];
                //alpha part should also include the ° symbol
                const alphaPart = query.match(/[a-zA-Z°]+/)?.[0];
                return numberPart && UNITS.includes(alphaPart);
            },
            onClick: function (event, search) {
                const convertedEl = document.createElement("div");
                convertedEl.innerHTML = search.name;
                const convertedValue = convertedEl.querySelector("span[data-converted]").dataset.converted;
                navigator.clipboard.writeText(convertedValue);
                ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.calc-clipboard`));
            },
        }),
        //notes
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.note.name`),
            description: (search) => {
                const noteText = search.query.replace(/(note|notes|!note|!notes|note:|notes:|!n|n:)/i, "").trim();
                return noteText;
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-sticky-note",
            match: (query) => {
                return NOTE_MATCHING.some((keyword) => query.startsWith(keyword));
            },
            onClick: async function (search) {
                const noteText = this.description;
                if (!noteText) return;
                const journalName = `Omnisearch Notes [${game.user.name}]`;
                let journal = game.journal.getName(journalName);
                if (!journal) {
                    journal = await JournalEntry.create({
                        name: journalName,
                    });
                }
                const todayDate = new Date().toLocaleDateString();
                const nowTime = new Date().toLocaleTimeString();
                let page = journal.pages.getName(todayDate);
                if (!page) {
                    page = await journal.createEmbeddedDocuments("JournalEntryPage", [
                        {
                            name: todayDate,
                            type: "text",
                        },
                    ]);
                    page = page[0];
                }
                const currentContent = page.text.content ?? "";
                page.update({
                    "text.content": `${currentContent} <h3>${nowTime}:</h3><p>${noteText}</p>`,
                });
                ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.note`));
            },
        }),
        //roll
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.roll.name`),
            description: (search) => {
                const rollText = search.query.replace(/(roll|!roll|roll:|!r|r:|r )/i, "").trim();
                return rollText;
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-dice-d20",
            match: (query) => {
                return ROLL_MATCHING.some((keyword) => query.startsWith(keyword));
            },
            onClick: async function (search) {
                new Roll(this.description).toMessage();
            },
        }),
        //help
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.help.name`),
            description: (search) => {
                const listElements = game.i18n.translations["spotlight-omnisearch"].special.help.list;
                const baseDescription = `<ul>${listElements.map((element) => `<li style="pointer-events:none">${element}</li>`).join("")}</ul>`;
                const filterSpans = FILTERS.map((filter) => `<span class="filter" data-filter="${filter}">${filter}</span>`).join("");
                return `${baseDescription} <div class="filters-help">${filterSpans}</div>`;
            },
            type: "special-app help",
            data: {},
            img: "",
            icon: "fad fa-question",
            match: (query) => {
                return query.includes("help") || query.startsWith("?");
            },
            onClick: async function (search) {},
        }),
        //timer
        new BaseSearchTerm({
            name: () => {
                let label = game.i18n.localize(`${MODULE_ID}.special.timer.name`);
                const current = getSetting("appData").timer;
                if (current) {
                    const remaining = current - Date.now();
                    if (remaining > 0) {
                        const hours = Math.floor(remaining / 3600000);
                        const minutes = Math.floor((remaining % 3600000) / 60000);
                        let seconds = Math.floor((remaining % 60000) / 1000);
                        if (seconds < 10) seconds = `0${seconds}`;
                        label += `<hr><strong style="font-size: larger;">${hours ? `${hours}:` : ""}${minutes ? `${minutes}:` : ""}${seconds ? `${seconds}` : ""}</strong>`;
                    }
                } else {
                    if (current !== undefined && game.user.isGM) {
                        const setting = getSetting("appData");
                        delete setting.timer;
                        setSetting("appData", setting);
                    }
                }
                return label;
            },
            description: (search) => {
                const noteText = search.query.replace(/(timer|timer:|time|time:|t:|t )/i, "").trim();
                const { hours, minutes, seconds } = parseTime(noteText);
                const textOutput = `${hours ? `${hours}h ` : ""}${minutes ? `${minutes}m ` : ""}${seconds ? `${seconds}s` : ""}`;
                return textOutput;
            },
            type: "special-app timer",
            data: {},
            img: "",
            icon: "fad fa-stopwatch",
            match: (query) => {
                return TIMER_MATCHING.some((keyword) => query.startsWith(keyword));
            },
            onClick: async function (search) {
                if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.timer-gm`));
                const noteText = this.query.replace(/(timer|timer:|time|time:|t:|t )/i, "").trim();
                const { hours, minutes, seconds } = parseTime(noteText);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                if (totalSeconds <= 0) return;
                const startTimestamp = Date.now();
                const endTimestamp = startTimestamp + totalSeconds * 1000;
                const setting = getSetting("appData");
                setting.timer = endTimestamp;
                await setSetting("appData", setting);
                ui.spotlightOmnisearch?._onSearch();
            },
        }),
        //success fail tracker
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.tracker.name`),
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-check-circle",
            match: (query) => {
                return TRACKER_MATCHING.some((keyword) => query.startsWith(keyword));
            },
            onClick: async function (search) {},
            activateListeners: function (html) {
                const successDotsCount = 7;
                const failDotsCount = 7;
                const setting = getSetting("appData");
                if (!setting.tracker) setting.tracker = { success: 2, fail: 3 };
                let checkedSuccessDotsCount = setting.tracker.success;
                let checkedFailDotsCount = setting.tracker.fail;
                const container = document.createElement("div");
                container.classList.add("tracker-container");
                //create success dots then fail dots separated by a  /
                const successEls = [];
                for (let i = 0; i < successDotsCount; i++) {
                    const dot = document.createElement("div");
                    dot.classList.add("tracker-dot", "success");
                    if (i < checkedSuccessDotsCount) dot.classList.add("checked");
                    successEls.push(dot);
                    dot.addEventListener("click", async () => {
                        if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.tracker-gm`));
                        const isChecked = dot.classList.contains("checked");
                        if (isChecked && i === checkedSuccessDotsCount - 1) {
                            dot.classList.remove("checked");
                            setting.tracker.success--;
                            checkedSuccessDotsCount--;
                        } else {
                            //set all dots to unchecked
                            successEls.forEach((el) => el.classList.remove("checked"));
                            for (let j = 0; j <= i; j++) {
                                successEls[j].classList.add("checked");
                            }
                            setting.tracker.success = i + 1;
                            checkedSuccessDotsCount = i + 1;
                        }
                        await setSetting("appData", setting);
                    });
                }
                successEls.reverse().forEach((el) => container.appendChild(el));
                successEls.reverse();
                const slash = document.createElement("div");
                slash.classList.add("tracker-slash");
                slash.innerHTML = `<i class="fa-sharp fa-solid fa-slash-forward"></i>`;
                container.appendChild(slash);
                const failEls = [];
                for (let i = 0; i < failDotsCount; i++) {
                    const dot = document.createElement("div");
                    dot.classList.add("tracker-dot", "fail");
                    if (i < checkedFailDotsCount) dot.classList.add("checked");
                    container.appendChild(dot);
                    failEls.push(dot);
                    dot.addEventListener("click", async () => {
                        if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.tracker-gm`));
                        const isChecked = dot.classList.contains("checked");
                        if (isChecked && i === checkedFailDotsCount - 1) {
                            dot.classList.remove("checked");
                            setting.tracker.fail--;
                            checkedFailDotsCount--;
                        } else {
                            //set all dots to unchecked
                            failEls.forEach((el) => el.classList.remove("checked"));
                            for (let j = 0; j <= i; j++) {
                                failEls[j].classList.add("checked");
                            }
                            setting.tracker.fail = i + 1;
                            checkedFailDotsCount = i + 1;
                        }
                        await setSetting("appData", setting);
                    });
                }
                html.querySelector(".search-info").appendChild(container);
            },
        }),
        //counter
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.counter.name`),
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-plus-circle",
            match: (query) => {
                return COUNTER_MATCHING.some((keyword) => query.startsWith(keyword));
            },
            onClick: async function (search) {},
            activateListeners: function (html) {
                const setting = getSetting("appData");
                if (!setting.counter) {
                    setting.counter = [0, 0, 0, 0];
                    setSetting("appData", setting);
                }
                const counterEls = [];
                const container = document.createElement("div");
                container.classList.add("counter-container");
                for (let i = 0; i < 4; i++) {
                    const counter = document.createElement("input");
                    counter.type = "number";
                    counter.value = setting.counter[i] || 0;
                    const counterContainer = document.createElement("div");
                    counterContainer.classList.add("counter-input-container");
                    counterContainer.appendChild(counter);
                    const upDownContainer = document.createElement("div");
                    upDownContainer.classList.add("up-down-container");
                    const up = document.createElement("i");
                    up.classList.add("fas", "fa-chevron-up");
                    up.addEventListener("click", async () => {
                        if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.counter-gm`));
                        counter.value = parseInt(counter.value) + 1;
                        setting.counter[i] = counter.value;
                        await setSetting("appData", setting);
                    });
                    upDownContainer.appendChild(up);
                    const down = document.createElement("i");
                    down.classList.add("fas", "fa-chevron-down");
                    down.addEventListener("click", async () => {
                        if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.counter-gm`));
                        counter.value = parseInt(counter.value) - 1;
                        setting.counter[i] = counter.value;
                        await setSetting("appData", setting);
                    });
                    upDownContainer.appendChild(down);
                    counterContainer.appendChild(upDownContainer);
                    counterEls.push(counterContainer);
                    counter.addEventListener("keyup", async () => {
                        if (!game.user.isGM) return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.counter-gm`));
                        const currentSetting = getSetting("appData");
                        currentSetting.counter = currentSetting.counter ?? [0, 0, 0, 0];
                        currentSetting.counter[i] = parseInt(counter.value);
                        LAST_COUNTER_FOCUS = i;
                        await setSetting("appData", setting);
                    });
                }
                counterEls.forEach((el) => container.appendChild(el));
                html.querySelector(".search-info").appendChild(container);
            },
        }),
        //attribute
        new BaseSearchTerm({
            name: (search) => {
                const attribute = search.query.replace(/(attr:|@)/i, "").trim();
                return game.i18n.localize(`${MODULE_ID}.special.attribute.name`) + ": " + attribute;
            },
            description: (search) => {
                const query = search.query.replace(/(attr:|@)/i, "").trim();
                const actors = Array.from(
                    new Set(
                        game.users
                            .map((user) => user.character)
                            .concat(canvas.tokens.controlled.map((token) => token.actor))
                            .filter((actor) => actor && actor.isOwner),
                    ),
                ).sort((a, b) => a.name.localeCompare(b.name));
                const container = document.createElement("div");
                const ul = document.createElement("ul");
                container.appendChild(ul);
                actors.forEach((actor) => {
                    const li = document.createElement("li");
                    let value = query ? foundry.utils.getProperty(actor.system, query) : foundry.utils.getProperty(actor, "system");
                    if (value === undefined) {
                        //first remove the last part of the object path
                        const queryWithoutLastPart = query.split(".").slice(0, -1).join(".");
                        value = queryWithoutLastPart ? foundry.utils.getProperty(actor.system, queryWithoutLastPart) ?? "?" : foundry.utils.getProperty(actor, "system");
                    }
                    if (typeof value === "object") {
                        value = Object.keys(value)
                            .map((key) => `<strong>${key}</strong>`)
                            .join(", ");
                    } else {
                        value = `<strong>${value}</strong>`;
                    }
                    li.innerHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;width: 100%"><span>${actor.name}</span><span>${value}</span></div>`;
                    ul.appendChild(li);
                });
                return container.innerHTML;
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fad fa-brackets-curly",
            match: (query) => {
                return query.startsWith("attr:") || query.startsWith("@");
            },
            onClick: async function (search) {},
        }),
    );

    function parseTime(input) {
        let hours = 0,
            minutes = 0,
            seconds = 0;

        // Regular expressions to match different time formats
        const hourMinSecRegex = /(\d+)[\s:]+(\d+)[\s:]+(\d+)/;
        const minSecRegex = /(\d+)[\s:]+(\d+)/;
        const minutesRegex = /(\d+)\s*m/;
        const secondsRegex = /(\d+)\s*s/;

        // Check each regex pattern against the input
        if (hourMinSecRegex.test(input)) {
            const match = input.match(hourMinSecRegex);
            hours = parseInt(match[1]);
            minutes = parseInt(match[2]);
            seconds = parseInt(match[3]);
        } else if (minSecRegex.test(input)) {
            const match = input.match(minSecRegex);
            minutes = parseInt(match[1]);
            seconds = parseInt(match[2]);
        } else if (minutesRegex.test(input)) {
            const match = input.match(minutesRegex);
            minutes = parseInt(match[1]);
        } else if (secondsRegex.test(input)) {
            const match = input.match(secondsRegex);
            seconds = parseInt(match[1]);
        } else {
            const int = parseInt(input);
            if (!isNaN(int)) {
                seconds = int;
            }
            return { hours, minutes, seconds };
        }

        return { hours, minutes, seconds };
    }

    const useMetricForLights = getSetting("useMetricForLights");
    const conversionRatio = useMetricForLights ? 0.3048 : 1;

    const lightEffects = [
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.torch`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/sundries/lights/torch-black.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 360,
                            bright: 20,
                            coloration: 1,
                            dim: 40,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 5,
                                intensity: 5,
                                reverse: false,
                                type: "torch",
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#fea50b",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
        //candle
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.candle`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/sundries/lights/candle-lit-yellow.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 360,
                            bright: 5 * conversionRatio,
                            coloration: 1,
                            dim: 10 * conversionRatio,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 5,
                                intensity: 5,
                                reverse: false,
                                type: "torch",
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#fea50b",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
        //lantern
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.lantern`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/sundries/lights/lantern-iron-yellow.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 360,
                            bright: 30 * conversionRatio,
                            coloration: 1,
                            dim: 60 * conversionRatio,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 5,
                                intensity: 5,
                                reverse: false,
                                type: "torch",
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#fea50b",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
        //lantern shut
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.lantern-shut`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/sundries/lights/lantern-steel.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 360,
                            bright: 0,
                            coloration: 1,
                            dim: 5 * conversionRatio,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 5,
                                intensity: 5,
                                reverse: false,
                                type: "torch",
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#fea50b",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
        //magical
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.magical`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/magic/light/explosion-star-glow-blue.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 360,
                            bright: 20 * conversionRatio,
                            coloration: 1,
                            dim: 20 * conversionRatio,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 2,
                                intensity: 5,
                                reverse: false,
                                type: "torch",
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#b3f0ff",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
        //flashlight
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.flashlight`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/magic/light/orb-lightbulb-gray.webp",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            alpha: 0.5,
                            angle: 90,
                            bright: 20 * conversionRatio,
                            coloration: 1,
                            dim: 20 * conversionRatio,
                            luminosity: 0.5,
                            saturation: 0,
                            contrast: 0,
                            shadows: 0,
                            animation: {
                                speed: 2,
                                intensity: 2,
                                reverse: false,
                                type: null,
                            },
                            darkness: {
                                min: 0,
                                max: 1,
                            },
                            color: "#ffffff",
                            attenuation: 0.5,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),

        //off
        new BaseSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.light.off`),
            description: () => game.i18n.localize(`${MODULE_ID}.special.light.info`),
            img: "icons/svg/light-off.svg",
            icon: ["fas fa-fire-flame", "fas fa-sun"],
            type: LIGHT_LOCALIZATION,
            onClick: async function (search) {
                const updates = canvas.tokens.controlled.map((token) => {
                    return {
                        _id: token.document.id,
                        light: {
                            bright: 0,
                            dim: 0,
                        },
                    };
                });
                canvas.scene.updateEmbeddedDocuments("Token", updates);
            },
        }),
    ];

    SPECIAL_SEARCHES.push(...lightEffects);

    //scene darkness action

    SPECIAL_SEARCHES.push(
        new BaseSearchTerm({
            name: game.i18n.localize(`SCENES.Darkness`),
            description: "",
            keywords: [],
            actions: [
                {
                    name: game.i18n.localize(`${MODULE_ID}.special.darkness.night`),
                    icon: `<i class="fas fa-moon"></i>`,
                    callback: async function () {
                        canvas.scene.update({ darkness: 1 }, { animateDarkness: 10000 });
                    },
                },
                //dawn
                {
                    name: game.i18n.localize(`${MODULE_ID}.special.darkness.dawn`),
                    icon: `<i class="fas fa-sunrise"></i>`,
                    callback: async function () {
                        canvas.scene.update({ darkness: 0.3 }, { animateDarkness: 10000 });
                    },
                },
                //day
                {
                    name: game.i18n.localize(`${MODULE_ID}.special.darkness.day`),
                    icon: `<i class="fas fa-sun"></i>`,
                    callback: async function () {
                        canvas.scene.update({ darkness: 0 }, { animateDarkness: 10000 });
                    },
                },
                //dusk
                {
                    name: game.i18n.localize(`${MODULE_ID}.special.darkness.dusk`),
                    icon: `<i class="fas fa-sunset"></i>`,
                    callback: async function () {
                        canvas.scene.update({ darkness: 0.7 }, { animateDarkness: 10000 });
                    },
                },
            ],
            type: game.i18n.localize(`SCENES.Darkness`),
            data: {},
            img: null,
            icon: ["fas fa-moon-over-sun"],
            onClick: async function () {},
        }),
    );

    if (game.modules.get("splatter")?.active) {
        const getSplatterData = (actor) => {
            const maxHpPath = game.settings.get("splatter", "maxHp");
            const currentHpPath = game.settings.get("splatter", "currentHp");
            const isWoundSystem = game.settings.get("splatter", "useWounds");
            const currentHPValue = foundry.utils.getProperty(actor.system, currentHpPath);
            const maxHPValue = foundry.utils.getProperty(actor.system, maxHpPath);
            const finalPath = `system.${currentHpPath}`;

            return {
                heal: (amount) => {
                    const newHp = isWoundSystem ? currentHPValue - amount : currentHPValue + amount;
                    actor.update({ [finalPath]: newHp });
                },
                damage: (amount) => {
                    const newHp = isWoundSystem ? currentHPValue + amount : currentHPValue - amount;
                    actor.update({ [finalPath]: newHp });
                },
                kill: () => {
                    isWoundSystem ? actor.update({ [finalPath]: maxHPValue }) : actor.update({ [finalPath]: 0 });
                },
                restore: () => {
                    isWoundSystem ? actor.update({ [finalPath]: 0 }) : actor.update({ [finalPath]: maxHPValue });
                },
            };
        };

        //add the kill, restore, damage and heal terms

        SPECIAL_SEARCHES.push(
            //kill
            new BaseSearchTerm({
                name: game.i18n.localize(`${MODULE_ID}.special.kill.name`),
                description: game.i18n.localize(`${MODULE_ID}.special.kill.description`),
                keywords: [],
                type: "special-app",
                data: {},
                img: null,
                icon: ["fas fa-skull-crossbones"],
                onClick: async function () {
                    const actors = canvas.tokens.controlled.map((t) => t.actor);
                    actors.forEach((actor) => {
                        const splatterData = getSplatterData(actor);
                        splatterData.kill();
                    });
                },
            }),
            //restore
            new BaseSearchTerm({
                name: game.i18n.localize(`${MODULE_ID}.special.restore.name`),
                description: game.i18n.localize(`${MODULE_ID}.special.restore.description`),
                keywords: [],
                type: "special-app",
                data: {},
                img: null,
                icon: ["fas fa-heart"],
                onClick: async function () {
                    const actors = canvas.tokens.controlled.map((t) => t.actor);
                    actors.forEach((actor) => {
                        const splatterData = getSplatterData(actor);
                        splatterData.restore();
                    });
                },
            }),
            //damage
            new BaseSearchTerm({
                name: game.i18n.localize(`${MODULE_ID}.special.damage.name`),
                description: (search) => {
                    let query = search.query;
                    const numericPartWithSign = query.match(/-?\d+/);
                    const damageValue = numericPartWithSign ? parseInt(numericPartWithSign[0]) : 0;
                    return damageValue;
                },
                keywords: [],
                type: "special-app",
                data: {},
                img: null,
                icon: ["fas fa-sword"],
                match: function (query) {
                    //remove numbers from the query
                    query = query.replace(/-?\d+/g, "").trim();
                    return this.name.toLowerCase().includes(query);
                },
                onClick: async function (event, search) {
                    const actors = canvas.tokens.controlled.map((t) => t.actor);
                    const val = parseInt(search.query.match(/-?\d+/)?.[0] ?? 0);
                    actors.forEach((actor) => {
                        const splatterData = getSplatterData(actor);
                        splatterData.damage(val);
                    });
                },
            }),
            //heal
            new BaseSearchTerm({
                name: game.i18n.localize(`${MODULE_ID}.special.heal.name`),
                description: (search) => {
                    let query = search.query;
                    const numericPartWithSign = query.match(/-?\d+/);
                    const healValue = numericPartWithSign ? parseInt(numericPartWithSign[0]) : 0;
                    return healValue;
                },
                keywords: [],
                type: "special-app",
                data: {},
                img: null,
                icon: ["fas fa-plus"],
                match: function (query) {
                    //remove numbers from the query
                    query = query.replace(/-?\d+/g, "").trim();
                    return this.name.toLowerCase().includes(query);
                },
                onClick: async function (event, search) {
                    const actors = canvas.tokens.controlled.map((t) => t.actor);
                    const val = parseInt(search.query.match(/-?\d+/)?.[0] ?? 0);
                    actors.forEach((actor) => {
                        const splatterData = getSplatterData(actor);
                        splatterData.heal(val);
                    });
                },
            }),
        );
    }

    //add action for reindexing
    SPECIAL_SEARCHES.push(
        new BaseSearchTerm({
            name: game.i18n.localize(`${MODULE_ID}.special.reindex.name`),
            description: game.i18n.localize(`${MODULE_ID}.special.reindex.description`),
            keywords: [],
            type: game.i18n.localize(`${MODULE_ID}.special.reindex.name`),
            data: {},
            img: null,
            icon: ["fas fa-search"],
            onClick: async function () {
                CONFIG.SpotlightOmniseach.rebuildIndex();
            },
        }),
    );
}
