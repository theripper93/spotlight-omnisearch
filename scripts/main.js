import {Spotlight} from "./app/spotlight.js";
import {initConfig} from "./config.js";
import {INDEX} from "./searchTerms/buildTermIndex.js";
import { registerSettings } from "./settings.js";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
    CONFIG.SpotlightOmniseach = {
        app: Spotlight,
        INDEX: INDEX,
        SearchTerm: BaseSearchTerm,
    }
});

Hooks.on("ready", () => {
    new Spotlight().render(true);
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