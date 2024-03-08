import { CompendiumConfig } from "./app/CompendiumConfig.js";
import { Spotlight } from "./app/spotlight.js";
import { initConfig } from "./config.js";
import { BaseSearchTerm } from "./searchTerms/baseSearchTerm.js";
import { INDEX, buildIndex } from "./searchTerms/buildTermIndex.js";
import { getSetting, registerSettings, setSetting } from "./settings.js";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
    CompendiumConfig.register();
    CONFIG.SpotlightOmniseach = {
        app: Spotlight,
        INDEX: INDEX,
        SearchTerm: BaseSearchTerm,
        rebuildIndex: () => buildIndex(true),
    };
});

Hooks.on("ready", () => {
    if (getSetting("firstTime")) {
        setTimeout(() => {
            if (!game.user.isGM && getSetting("gmOnly")) return;
            new Spotlight({ first: true }).render(true);
        }, 1000);
        setSetting("firstTime", false);
    }
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
});