import { MODULE_ID } from "../main.js";

export class CompendiumConfig extends FormApplication {
    constructor() {
        super();
    }

    static get APP_ID() {
        return this.name
            .split(/(?=[A-Z])/)
            .join("-")
            .toLowerCase();
    }

    get APP_ID() {
        return this.constructor.APP_ID;
    }

    static get SETTING_KEY() {
        return this.name.charAt(0).toLowerCase() + this.name.slice(1);
    }

    get SETTING_KEY() {
        return this.constructor.SETTING_KEY;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: this.APP_ID,
            template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
            popOut: true,
            minimizable: true,
            resizable: true,
            width: 800,
            title: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.label`),
            closeOnSubmit: true,
        });
    }

    async getData() {
        const sett = game.settings.get(MODULE_ID, this.SETTING_KEY);
        const compendiums = Array.from(game.packs);
        const data = [];
        for (const compendium of compendiums) {
            const id = compendium.metadata.id;
            data.push({
                id,
                checked: sett[id] ?? true,
                name: compendium.metadata.label,
                package: compendium.metadata.packageName,
            });
        }
        data.sort((a, b) => a.name.localeCompare(b.name));

        return { data };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
    }

    async _updateObject(event, formData) {
        console.log(formData);
        return game.settings.set(MODULE_ID, this.SETTING_KEY, formData);
    }

    static register() {
        game.settings.registerMenu(MODULE_ID, this.APP_ID, {
            name: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.name`),
            label: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.label`),
            hint: game.i18n.localize(`${MODULE_ID}.settings.${this.SETTING_KEY}.hint`),
            icon: "fas fa-cogs",
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
