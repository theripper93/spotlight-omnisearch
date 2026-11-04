import {MODULE_ID} from "./main";
import { getSetting, setSetting } from "./settings";

let timeout = null;

export function updateTimerInterval() {
    clearTimeout(timeout);
    if (!game.users.activeGM?.isSelf) return;
    const endTimestamp = getSetting("appData").timer;
    if (!endTimestamp) return;
    timeout = setTimeout(() => {
        ChatMessage.create({
            content: game.i18n.localize(`${MODULE_ID}.special.timer.expired`),
            speaker: {alias: "Timer"},
            whisper: ChatMessage.getWhisperRecipients("GM"),
        });
        const appData = getSetting("appData");
        appData.timer = null;
        setSetting("appData", appData);
    }, Math.max(0, endTimestamp - Date.now()));
}
