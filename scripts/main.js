import { CompendiumConfig } from "./app/CompendiumConfig.js";
import { Spotlight } from "./app/spotlight.js";
import { initConfig } from "./config.js";
import { BaseSearchTerm } from "./searchTerms/baseSearchTerm.js";
import { INDEX, buildIndex } from "./searchTerms/buildTermIndex.js";
import { getSetting, registerSettings, setSetting } from "./settings.js";
import { updateTimerInterval } from "./timer.js";
import "../scss/module.scss";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
    CompendiumConfig.register();
    CONFIG.SpotlightOmnisearch = {
        app: Spotlight,
        INDEX: INDEX,
        SearchTerm: BaseSearchTerm,
        rebuildIndex: () => buildIndex(true),
        prompt: async (options = {query : ""}) => {
            if (!game.user.isGM && getSetting("gmOnly")) return null;
            const current = Object.values(ui.windows).find((w) => w instanceof Spotlight);
            if (current) {
                current.close();
            }
            const spotlight = new Spotlight({promptOptions: options, isPrompt: true});
            spotlight.render(true);
            return spotlight.promise;
        },
    };
    //setup a getter for the typo in the api config
    Object.defineProperty(CONFIG, "SpotlightOmniseach", {
        get: () => {
            console.warn("The CONFIG.SpotlightOmniseach contained a typo, please update your modules to use the correct spelling by using CONFIG.SpotlightOmnisearch. This will be removed in version 1.0.0.");
            return CONFIG.SpotlightOmnisearch;
        },
    });
});

Hooks.once("canvasReady", () => {
    if (getSetting("firstTime")) {
        setTimeout(() => {
            if (!game.user.isGM && getSetting("gmOnly")) return;
            new Spotlight({ first: true }).render(true);
        }, 1000);
        setSetting("firstTime", false);
    }
});

Hooks.on("ready", () => {
    if (getSetting("enableCtrlSpace")) {
        //hardcode a ctrl + space hotkey
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === " ") {
                if (!game.user.isGM && getSetting("gmOnly")) return;
                const current = Object.values(ui.windows).find((w) => w instanceof Spotlight);
                if (current) {
                    current.close();
                } else {
                    new Spotlight().render(true);
                }
            }
        });
    }
    updateTimerInterval();
});

Hooks.on("init", () => {
    game.keybindings.register(MODULE_ID, "toggleSpotlight", {
        name: `${MODULE_ID}.hotkeys.toggleSpotlight.name`,
        editable: [{ key: "Space", modifiers: ["Shift"] }],
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
        onDown: (e) => {
            if (!game.user.isGM && getSetting("gmOnly")) return;
            const current = Object.values(ui.windows).find((w) => w instanceof Spotlight);
            if (current) {
                current.close();
            } else {
                new Spotlight().render(true);
            }
        },
    });
});
