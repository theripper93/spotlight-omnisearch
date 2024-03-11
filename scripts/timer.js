import {MODULE_ID} from "./main";
import { getSetting } from "./settings";

let interval = null;

export function updateTimerInterval() {
    if (!game.user.isGM) return;
    clearInterval(interval);
    const intervalSetting = getSetting("appData").timer;
    //if there is no timer set, clear the interval
    if (!intervalSetting) {
        return;
    }
    //set the interval
    interval = setInterval(() => {
        console.log("Updating timer interval");
        const timestampNow = Date.now();
        const isExpired = timestampNow > intervalSetting;
        if (isExpired) {
            clearInterval(interval);
            ChatMessage.create({
                content: game.i18n.localize(`${MODULE_ID}.special.timer.expired`),
                speaker: {alias: "Timer"},
                whisper: ChatMessage.getWhisperRecipients("GM"),
            });
            return;
        }
    }, 1000);
}
