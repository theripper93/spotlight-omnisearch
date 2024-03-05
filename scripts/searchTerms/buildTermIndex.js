import { BaseSearchTerm } from "./baseSearchTerm";

export const INDEX = [];

let indexBuilt = false;

export function buildIndex() {
    if (indexBuilt) return;
    buildCompendiumIndex();
}

async function buildCompendiumIndex() {
    const packs = Array.from(game.packs);
    const index = [];
    for (const pack of packs) {
        const packIndex = Array.from(await pack.getIndex());
        packIndex.forEach((entry) => {
            index.push(
                new BaseSearchTerm({
                    name: entry.name,
                    query: entry.name,
                    keywords: [],
                    type: pack.documentName + " compendium",
                    data: {...entry, documentName: pack.documentName},
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
