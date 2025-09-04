/** @format */

const { constants, midi } = require("./consts.js");

var channel = 0;

var ledIDs = {
    mute: [16, 17, 18, 19, 20, 21, 22, 23],
    solo: [8, 9, 10, 11, 12, 13, 14, 15],
    rec: [0, 1, 2, 3, 4, 5, 6, 7],
    select: [24, 25, 26, 27, 28, 29, 30, 31],
    bottom: [94, 93, 95, 91, 92, 46, 47, 96, 97, 98],
};

function openPortByName(device, name, type) {
    var portNames = [];
    for (let a = 0; a < device.getPortCount(); a++) {
        portNames.push(device.getPortName(a));
    }

    var portName = portNames.includes(name)
        ? name
        : portNames.find((n) => n.toLowerCase().includes(name.toLowerCase()));

    console.log(`Opening ${type ? type + " " : ""}port "${portName}"`);
    device.openPort(portNames.indexOf(portName));
}

function logMessage(data, type) {
    data[0] = data[0].toString(2).padStart(8, "0");
    data[1] = data[1].toString(2).padStart(8, "0");
    data[2] = data[2].toString(2).padStart(8, "0");
    console.log(`${type ? type : "m"}: ${data}`);
}

(async () => {
    const midi = require("midi");
    const toSoftware = new midi.Output();
    const toConsole = new midi.Output();
    const fromConsole = new midi.Input();
    const fromSoftware = new midi.Input();

    function turnLedOn(faderNum, arr) {
        toConsole.sendMessage([constants.commands.NN + 0, arr[faderNum], 127]);
        toConsole.sendMessage([constants.commands.NF + 0, arr[faderNum], 127]);
    }

    function turnLedOff(faderNum, arr) {
        toConsole.sendMessage([constants.commands.NN + 0, arr[faderNum], 0]);
        toConsole.sendMessage([constants.commands.NF + 0, arr[faderNum], 0]);
    }

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    var count = toSoftware.getPortCount();
    console.log("output devices:");
    for (let i = 0; i < count; i++) {
        // Get the name of a specified output port.
        console.log("\t", toSoftware.getPortName(i));
    }

    var count = fromConsole.getPortCount();
    console.log("input devices:");
    for (let i = 0; i < count; i++) {
        // Get the name of a specified output port.
        console.log("\t", fromConsole.getPortName(i));
    }

    openPortByName(toSoftware, "consoleout", "control output");
    openPortByName(fromSoftware, "consolein", "feedback input");
    openPortByName(fromConsole, "SMC-Mixer", "control input");
    openPortByName(toConsole, "SMC-Mixer", "feedback output");

    var commands = constants.commands;

    fromSoftware.on("message", (deltaTime, message) => {
        const status = message[0];
        const command = status & 0b11110000; // upper nibble
        const channel = status & 0b00001111;

        if (command === commands.NF || command === commands.NN) {
            const note = message[1];
            const velocity = message[2];

            console.log("fromSoftware", message);

            toConsole.sendMessage([constants.commands.NN + 0, note, velocity]);
            toConsole.sendMessage([constants.commands.NF + 0, note, velocity]);
        } else {
            // Everything else unchanged
            toConsole.sendMessage(message);
        }
    });

    fromConsole.on("message", (deltaTime, message) => {
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
            const newMessage = [
                commands.CC | 0, // CC on channel 0
                channel, // Controller = original channel
                value7, // Value = scaled PB
            ];

            toSoftware.sendMessage(newMessage);
        } else {
            if (
                command == commands.NN ||
                command == commands.NF ||
                command == commands.CC
            ) {
                console.log("fromConsole", message);
            }
            // Pass through everything else unchanged
            toSoftware.sendMessage(message);
        }
    });
    // Send a MIDI message.

    console.log("Turning on leds");
    for (let a = 0; a < 8; a++) {
        turnLedOn(a, ledIDs.mute);
        turnLedOn(a, ledIDs.solo);
        turnLedOn(a, ledIDs.rec);
        turnLedOn(a, ledIDs.select);
        await delay(100);
    }
    console.log("Turning on bottom leds");
    for (let a = 0; a < 11; a++) {
        turnLedOn(a, ledIDs.bottom);
        await delay(100);
    }

    await delay(500);
    console.log("Turning off leds");

    for (let a = 7; a >= 0; a--) {
        turnLedOff(a, ledIDs.mute);
        turnLedOff(a, ledIDs.solo);
        turnLedOff(a, ledIDs.rec);
        turnLedOff(a, ledIDs.select);
        await delay(100);
    }

    console.log("Turning off bottom leds");
    for (let a = 0; a < 11; a++) {
        turnLedOff(a, ledIDs.bottom);
        await delay(100);
    }

    // Ignore sysex, timing, and active sensing messages
    fromSoftware.ignoreTypes(true, true, true);
    fromConsole.ignoreTypes(true, true, true);

    console.log("Ready!");

    /*     console.log(`CC ${0} ${0}`);
	for(let b = 0; b<0b00001111;b++)
    for (let a = 0; a < 255; a++) {
        toConsole.sendMessage([constants.commands.CC + b, a, 127]);
    } */
})();
