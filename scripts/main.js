import {initConfig} from "./config.js";
import { registerSettings } from "./settings.js";

export const MODULE_ID = "spotlight-omnisearch";

Hooks.on("init", () => {
    initConfig();
    registerSettings();
});