import { MODULE_ID } from "../main.js";
import { HandlebarsApplication, mergeClone } from "../lib/utils.js";

export class CompendiumConfig extends HandlebarsApplication {
    constructor() {
        super();
    }

    static get SETTING_KEY() {
        return this.name.charAt(0).toLowerCase() + this.name.slice(1);
    }

    get SETTING_KEY() {
        return this.constructor.SETTING_KEY;
    }

    static get DEFAULT_OPTIONS() {
        return mergeClone(super.DEFAULT_OPTIONS, {
            tag: "form",
            window: {
                title: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.label`),
                contentClasses: ["standard-form"],
            },
            actions: {
                onCheckAll: this.checkAll,
                onUncheckAll: this.uncheckAll,
            },
            form: {
                handler: this.#onSubmit,
                closeOnSubmit: true,
            },
            position: {
                width: 800,
            },
        });
    }

    static get PARTS() {
        return {
            content: {
                template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
                classes: ["standard-form", "scrollable"],
            },
            footer: {
                template: "templates/generic/form-footer.hbs",
            }
        };
    }

    async _prepareContext(options) {
        const sett = game.settings.get(MODULE_ID, this.SETTING_KEY);
        const compendiums = Array.from(game.packs);
        const data = [];
        for (const compendium of compendiums) {
            const id = compendium.metadata.id;
            data.push({
                id,
                checked: sett[id] ?? true,
                name: compendium.metadata.label,
                package: (compendium.metadata.packageType === "system" ? game.system.title : game.modules.get(compendium.metadata.packageName)?.title) ?? game.i18n.localize("PACKAGE.Type.world"),
            });
        }

        //sort by package name
        data.sort((a, b) => a.package.localeCompare(b.package));

        const compendiumsByPackage = {};
        for (const compendium of data) {
            if (!compendiumsByPackage[compendium.package]) {
                compendiumsByPackage[compendium.package] = [];
            }
            compendiumsByPackage[compendium.package].push(compendium);
        }
        // Sort by package name
        for (const p in compendiumsByPackage) {
            compendiumsByPackage[p].sort((a, b) => a.name.localeCompare(b.name));
        }

        const checkAllButton = {
            type: "button",
            action: "onCheckAll",
            icon: "fas fa-check-square",
            label: "Select All",
        };
        const uncheckAllButton = {
            type: "button",
            action: "onUncheckAll",
            icon: "fas fa-square",
            label: "Unselect All",
        };
        const saveButton = {
            type: "submit",
            action: "submit",
            icon: "fas fa-save",
            label: "Save",
        };
        return { compendiumsByPackage, buttons: [checkAllButton, uncheckAllButton, saveButton] };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;
        html.querySelectorAll(".check-all").forEach((el) => {
            el.addEventListener("click", (event) => {
                event.preventDefault();
                const group = el.closest("fieldset").querySelectorAll("input[type=checkbox]");
                for (const checkbox of group) {
                    checkbox.checked = true;
                }
            });
        });
        html.querySelectorAll(".uncheck-all").forEach((el) => {
            el.addEventListener("click", (event) => {
                event.preventDefault();
                const group = el.closest("fieldset").querySelectorAll("input[type=checkbox]");
                for (const checkbox of group) {
                    checkbox.checked = false;
                }
            });
        });
    }

    static checkAll() {
        for (const checkbox of this.element.querySelectorAll("input[type=checkbox]")) {
            checkbox.checked = true;
        }
    }

    static uncheckAll() {
        for (const checkbox of this.element.querySelectorAll("input[type=checkbox]")) {
            checkbox.checked = false;
        }
    }

    static async #onSubmit() {
        const form = this.element;
        const formData = new foundry.applications.ux.FormDataExtended(form).object;
        const result = await game.settings.set(MODULE_ID, this.SETTING_KEY, formData);
        CONFIG.SpotlightOmnisearch.rebuildIndex();
        return result;
    }

    static register() {
        game.settings.registerMenu(MODULE_ID, this.APP_ID, {
            name: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.name`),
            label: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.label`),
            hint: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.hint`),
            icon: "fas fa-atlas",
            type: this,
            restricted: true,
            scope: "world",
        });

        game.settings.register(MODULE_ID, this.SETTING_KEY, {
            scope: "world",
            config: false,
            default: {},
            type: Object,
        });
    }
}
