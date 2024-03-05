import {Spotlight} from "./app/spotlight.js";
import {initConfig} from "./config.js";
import { registerSettings } from "./settings.js";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
});

Hooks.on("ready", () => {
    new Spotlight().render(true);
});

Hooks.on("init", () => {
    game.keybindings.register(MODULE_ID, "toggleSpotlight", {
        name: `${MODULE_ID}.hotkeys.toggleSpotlight.name`,
        editable: [{ key: "Space", modifiers: ["Shift"]}],
        restricted: true,
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
        onDown: () => {
            new Spotlight().render(true);
        },
    });
});