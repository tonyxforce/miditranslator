/** @format */

const { constants, midi } = require("./consts.js");

var channel = 0;

function openPortByName(device, name) {
    var portNames = [];
    for (let a = 0; a < device.getPortCount(); a++) {
        portNames.push(device.getPortName(a));
    }

    var portName = portNames.includes(name)
        ? name
        : portNames.find((n) => n.toLowerCase().includes(name.toLowerCase()));

    console.log(`Opening port "${portName}"`);
    device.openPort(portNames.indexOf(portName));
}

function logMessage(data) {
    data[0] = data[0].toString(2).padStart(8, "0");
    data[1] = data[1].toString(2).padStart(8, "0");
    data[2] = data[2].toString(2).padStart(8, "0");
    console.log(`m: ${data}`);
}

(async () => {
    const midi = require("midi");
    const toSoftware = new midi.Output();
    const toConsole = new midi.Output();
    const fromConsole = new midi.Input();
    const fromSoftware = new midi.Input();
    toSoftware.controlChange = (ch, num, val) => {
        toSoftware.sendMessage([(constants.commands.CC << 4) | ch, num, val]);
    };
    toSoftware.noteOn = (ch, note, velocity) => {
        toSoftware.sendMessage([
            (constants.commands.NN << 4) | ch,
            note,
            velocity,
        ]);
    };
    toSoftware.noteOff = (ch, note) => {
        toSoftware.sendMessage([(constants.commands.NF << 4) | ch, note, 0]);
    };
    toSoftware.polyAfterTouch = (ch, note, velocity) => {
        toSoftware.sendMessage(
            [(constants.commands.PA << 4) | ch],
            note,
            velocity
        );
    };
    toSoftware.programChange = (ch, num) => {};
    toSoftware.aftertouchChange = (ch, val) => {};
    toSoftware.pitchBendChange = (ch, val) => {};

    //import midi from "midi";

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    // Set up a new output.

    var count = toSoftware.getPortCount();
    console.log("output devices");
    for (let i = 0; i < count; i++) {
        // Get the name of a specified output port.
        console.log(toSoftware.getPortName(i));
    }

    var count = fromConsole.getPortCount();
    console.log("input devices");
    for (let i = 0; i < count; i++) {
        // Get the name of a specified output port.
        console.log(fromConsole.getPortName(i));
    }

    openPortByName(toSoftware, "consoleout");
    openPortByName(fromSoftware, "consolein");
    openPortByName(fromConsole, "SMC-Mixer");
    openPortByName(toConsole, "SMC-Mixer");

    var commands = constants.commands;

    fromSoftware.on("message", (deltaTime, message) => {
        logMessage(message);
        const status = message[0];
        const command = status & 0b11110000; // upper nibble
        const channel = status & 0b00001111;

        if (command === commands.NF || command === commands.NN) {
            // Note message format: [status, note, velocity]
            const note = message[1];
            const velocity = message[2];

            // Build both Note On and Note Off messages
            const noteOn = [commands.NF | channel, note, velocity];
            const noteOff = [commands.NN | channel, note, 0]; // velocity usually 0

            // Send both (On first, Off second)
            toConsole.sendMessage(noteOn);
            toConsole.sendMessage(noteOff);
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
            // Pass through everything else unchanged
            toSoftware.sendMessage(message);
        }
    });
    // Send a MIDI message.

    console.log("starting");
    toConsole.sendMessage([constants.commands.NF + 0, 129, 127]);
    await delay(100);
    toConsole.sendMessage([constants.commands.NF + 0, 129, 0]);

    /*

    for (let a = 0; a < 32; a++) {
        console.log(`turning on ${a}`);
        toConsole.sendMessage([constants.commands.NF + 0, a, 127]);
        await delay(1);
    }
    for (let a = 91; a < 96; a++) {
        console.log(`turning on ${a}`);
				toConsole.sendMessage([constants.commands.NF + 0, a, 127]);
        await delay(1);
    }

    for (let a = 91; a < 96; a++) {
        console.log(`turning off ${a}`);
				toConsole.sendMessage([constants.commands.NF + 0, a, 0]);
        await delay(1);
    }
    for (let a = 0; a < 32; a++) {
        console.log(`turning off ${a}`);
        toConsole.sendMessage([constants.commands.NF + 0, a, 0]); 
        await delay(1);
    }

		     console.log(`CC ${0} ${0}`);
    output.sendMessage([(constants.commands.CC) + 0, 0, 0]);
    for (let a = 49; a < 58; a++) {
        for (let b = 0; b < 128; b++) {
            console.log(`CC ${a} ${b}`);
            output.sendMessage([(constants.commands.CC) + a, 0, b]);
            await delay(1);
        }
    } */
    // Close the port when done.
    //output.closePort();
})();
