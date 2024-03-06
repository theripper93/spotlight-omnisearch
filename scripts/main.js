import {CompendiumConfig} from "./app/CompendiumConfig.js";
import {Spotlight} from "./app/spotlight.js";
import {initConfig} from "./config.js";
import {BaseSearchTerm} from "./searchTerms/baseSearchTerm.js";
import {INDEX, buildIndex} from "./searchTerms/buildTermIndex.js";
import {getSetting, registerSettings, setSetting} from "./settings.js";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
    CompendiumConfig.register();    
    CONFIG.SpotlightOmniseach = {
        app: Spotlight,
        INDEX: INDEX,
        SearchTerm: BaseSearchTerm,
        buildIndex: buildIndex,
    }
});

Hooks.on("ready", () => {
    if (getSetting("firstTime")) {
        new Spotlight({first: true}).render(true);
        setSetting("firstTime", false);
    }
});

Hooks.on("init", () => {
    game.keybindings.register(MODULE_ID, "toggleSpotlight", {
        name: `${MODULE_ID}.hotkeys.toggleSpotlight.name`,
        editable: [{ key: "Space", modifiers: ["Shift"]}],
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
        onDown: () => {
            const current = Object.values(ui.windows).find(w => w instanceof Spotlight);
            if (current) {
                current.close();
            } else {
                new Spotlight().render(true);
            }
        },
    });
});