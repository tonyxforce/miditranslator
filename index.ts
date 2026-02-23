/** @format */

import { constants, MIDIOutput, MIDIInput, Range } from "./consts.js";

const commands = constants.commands;


const fromConsole = new MIDIInput();
fromConsole.openPort("SMC-Mixer");
fromConsole.ignoreTypes(true, true, true)
const toConsole = new MIDIOutput();
toConsole.openPort(5);

console.log("output devices:");
console.log(toConsole.listPorts());

console.log("input devices:");
console.log(fromConsole.listPorts());

import midi from "midi";

function logMessage(message: midi.MidiMessage, type: string | null = null) {
    var data = ["", "", ""];
    data[0] = message[0].toString(2).padStart(8, "0");
    data[1] = message[1].toString(2).padStart(8, "0");
    data[2] = message[2].toString(2).padStart(8, "0");
    console.log(`${type ? type : "m"}: ${message}`);
}

const bankCount = 3;
var ledStates: {
    mute: boolean[];
    solo: boolean[];
    rec: boolean[];
    select: boolean[];
    bottom: boolean[];
}[] = [{
    mute: Array(8).fill(false),
    solo: Array(8).fill(false),
    rec: Array(8).fill(false),
    select: Array(8).fill(false),
    bottom: Array(11).fill(false),
}];
var faderStates: number[][] = Array(8).fill(0);
var bankIndex = 0;
var banks: {
    from: MIDIInput[];
    to: MIDIOutput[];
} = {
    from: new Array(bankCount).fill(null).map((e, i) => new MIDIInput().openPort(`consolein${i}`).on("message", (dt: number, message: midi.MidiMessage) => fromSoftware(dt, message, i)).ignoreTypes(true, true, true)) as any,
    to: new Array(bankCount).fill(null).map((e, i) => new MIDIOutput().openPort(`consoleout${i}`)) as any,
};

function fromSoftware(deltaTime: number, message: midi.MidiMessage, bankID: number) {
    const status = message[0];
    const command = status & 0b11110000; // upper nibble
    const channel = status & 0b00001111; // lower nibble

    if (command === commands.NF || command === commands.NN) { // LED feedback
        const note: Range<0, 127> = message[1] as any;

        var buttonRegion: "bottom" | "mute" | "solo" | "rec" | "select" =
            constants.ledIDs.bottom.includes(note) ? "bottom" :
                constants.ledIDs.mute.includes(note) ? "mute" :
                    constants.ledIDs.solo.includes(note) ? "solo" :
                        constants.ledIDs.rec.includes(note) ? "rec" :
                            constants.ledIDs.select.includes(note) ? "select" :
                                "bottom";

        if (!ledStates[bankID]) return; // Make typescript happy

        var buttonID: number = constants.ledIDs[buttonRegion].indexOf(note);

        const velocity: Range<0, 127> = message[2] as any;

        ledStates[bankID][buttonRegion][buttonID] = velocity >= 127;


        console.log("fromSoftware", message);

        toConsole.sendMessage([constants.commands.NN + channel, note, velocity]);
        toConsole.sendMessage([constants.commands.NF + channel, note, velocity]);
    } else {
        // Everything else unchanged
        toConsole.sendMessage(message);
    }
}
; (async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    fromConsole.on("message", (deltaTime, message) => {
        console.log("fromConsole", message);
        const status = message[0];
        const command = status & 0b11110000; // upper nibble = type
        const channel = status & 0b00001111; // lower nibble = channel

        if (command === commands.PB) {
            // PB message: [0xEn, lsb, msb]
            const lsb = message[1];
            const msb = message[2];

            // Recombine PB into a 14-bit value
            const value14 = (msb << 7) | lsb;

            // Scale it down to 0–127 for CC
            const value7 = Math.floor(value14 / 128);

            // Build CC message
            const newMessage: midi.MidiMessage = [
                commands.CC | channel, // CC
                channel, // Controller = original channel
                value7, // Value = scaled PB
            ];

            banks.to[bankIndex]?.sendMessage(newMessage);
        } else {
            if (
                command == commands.NN ||
                command == commands.NF ||
                command == commands.CC
            ) {
            }
            // Pass through everything else unchanged
            banks.to[bankIndex]?.sendMessage(message);
        }
    });
    // Send a MIDI message.

    console.log("Turning on leds");
    for (let a = 0; a < 8; a++) {
        toConsole.turnLedOn("mute", a);
        toConsole.turnLedOn("solo", a);
        toConsole.turnLedOn("rec", a);
        toConsole.turnLedOn("select", a);
        await delay(100);
    }
    console.log("Turning on bottom leds");
    for (let a = 0; a < 11; a++) {
        toConsole.turnLedOn("bottom", a);
        await delay(100);
    }

    await delay(500);
    console.log("Turning off leds");

    for (let a = 7; a >= 0; a--) {
        toConsole.turnLedOff("mute", a);
        toConsole.turnLedOff("solo", a);
        toConsole.turnLedOff("rec", a);
        toConsole.turnLedOff("select", a);
        await delay(100);
    }

    console.log("Turning off bottom leds");
    for (let a = 0; a < 11; a++) {
        toConsole.turnLedOff("bottom", a);
        await delay(100);
    }

    console.log("Ready!");
})();
