/** @format */

import midi from "midi";

type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>

export type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>

const notes = {
    G9: 127,
    Gb9: 126,
    F9: 125,
    E9: 124,
    Eb9: 123,
    D9: 122,
    Db9: 121,
    C9: 120,
    B8: 119,
    Bb8: 118,
    A8: 117,
    Ab8: 116,
    G8: 115,
    Gb8: 114,
    F8: 113,
    E8: 112,
    Eb8: 111,
    D8: 110,
    Db8: 109,
    C8: 108,
    B7: 107,
    Bb7: 106,
    A7: 105,
    Ab7: 104,
    G7: 103,
    Gb7: 102,
    F7: 101,
    E7: 100,
    Eb7: 99,
    D7: 98,
    Db7: 97,
    C7: 96,
    B6: 95,
    Bb6: 94,
    A6: 93,
    Ab6: 92,
    G6: 91,
    Gb6: 90,
    F6: 89,
    E6: 88,
    Eb6: 87,
    D6: 86,
    Db6: 85,
    C6: 84,
    B5: 83,
    Bb5: 82,
    A5: 81,
    Ab5: 80,
    G5: 79,
    Gb5: 78,
    F5: 77,
    E5: 76,
    Eb5: 75,
    D5: 74,
    Db5: 73,
    C5: 72,
    B4: 71,
    Bb4: 70,
    A4: 69,
    Ab4: 68,
    G4: 67,
    Gb4: 66,
    F4: 65,
    E4: 64,
    Eb4: 63,
    D4: 62,
    Db4: 61,
    C4: 60,
    B3: 59,
    Bb3: 58,
    A3: 57,
    Ab3: 56,
    G3: 55,
    Gb3: 54,
    F3: 53,
    E3: 52,
    Eb3: 51,
    D3: 50,
    Db3: 49,
    C3: 48,
    B2: 47,
    Bb2: 46,
    A2: 45,
    Ab2: 44,
    G2: 43,
    Gb2: 42,
    F2: 41,
    E2: 40,
    Eb2: 39,
    D2: 38,
    Db2: 37,
    C2: 36,
    B1: 35,
    Bb1: 34,
    A1: 33,
    Ab1: 32,
    G1: 31,
    Gb1: 30,
    F1: 29,
    E1: 28,
    Eb1: 27,
    D1: 26,
    Db1: 25,
    C1: 24,
    B0: 23,
    Bb0: 22,
    A0: 21,
};

const commands = {
    NN: 0b10000000, // Note on 128
    NF: 0b10010000, // Note off 144
    PA: 0b10100000, // Polyphonic Aftertouch 160
    CC: 0b10110000, // Control Change 176
    PC: 0b11000000, // Program Change 192
    AT: 0b11010000, // AfterTouch 208
    PB: 0b11100000, // Pitch Bend 224
};

const ledIDs: {
    mute: Array<Range<0, 128>>;
    solo: Array<Range<0, 128>>;
    rec: Array<Range<0, 128>>;
    select: Array<Range<0, 128>>;
    bottom: Array<Range<0, 128>>;
} = {
    mute: [16, 17, 18, 19, 20, 21, 22, 23],
    solo: [8, 9, 10, 11, 12, 13, 14, 15],
    rec: [0, 1, 2, 3, 4, 5, 6, 7],
    select: [24, 25, 26, 27, 28, 29, 30, 31],
    bottom: [94, 93, 95, 91, 92, 46, 47, 96, 97, 98],
};

export const constants = {
    notes,
    commands,
    ledIDs,
};

class MIDIDevice {
    protected device: midi.Input | midi.Output = null!;
    constructor() {
    }
    getPortCount(): number {
        return this.device.getPortCount();
    }
    getPortName(index: number): string {
        return this.device.getPortName(index);
    }
    listPorts(): string[] {
        return Array.from(
            { length: this.device.getPortCount() },
            (_, i) => this.device.getPortName(i));
    }
    openPort(name: string | number): void {
        if (typeof name === "number") {
            this.device.openPort(name);
            return;
        }

        var portNames = this.listPorts();

        var portName = portNames.includes(name)
            ? name
            : portNames.find((n) => n.toLowerCase().includes(name.toLowerCase())) as string;
        if(!portName){
            throw new Error(`Port named "${name}" not found`);
        }
        this.device.openPort(portNames.indexOf(portName));
    }
    closePort(): void {
        this.device.closePort();
    }
}

class MIDIInput extends midi.Input {
    device: midi.Input;
    constructor() {
        super();
        this.device = new midi.Input();
    }
    openPort(name: string | number): this {
        if (typeof name === "number") {
            this.device.openPort(name);
            return this;
        }
        var portNames = this.listPorts();
        var portName = portNames.includes(name)
            ? name
            : portNames.find((n) => n.toLowerCase().includes(name.toLowerCase())) as string;
        this.device.openPort(portNames.indexOf(portName));
        return this;
    }
    listPorts(): string[] {
        return Array.from(
            { length: this.device.getPortCount() },
            (_, i) => this.device.getPortName(i));
    }
    getPortCount(): number {
        return this.device.getPortCount();
    }

    getPortName(index: number): string {
        return this.device.getPortName(index);
    }
    on(event: "message", callback: (deltaTime: number, message: midi.MidiMessage) => void): any {
        return this.device.on(event, callback) as midi.Input;
    }
}

class MIDIOutput extends MIDIDevice {
    device: midi.Output;
    constructor() {
        super();
        this.device = new midi.Output();
    }
    controlChange(channel: number, control: number, value: number) {
        this.device.sendMessage([
            (commands.CC << 4) | channel,
            control,
            value,
        ]);
    }
    noteOn(channel: number, note: number, velocity: number) {
        this.device.sendMessage([
            (commands.NN << 4) | channel,
            note,
            velocity,
        ]);
    }
    noteOff(channel: number, note: number) {
        this.device.sendMessage([
            (commands.NF << 4) | channel,
            note,
            0,
        ]);
    }
    turnLedOn(type: "mute" | "solo" | "rec" | "select" | "bottom", ledID: number, ) {
        if(ledID < 0 || ledID >= ledIDs[type].length){
            throw new Error(`LED ID ${ledID} is out of range for type ${type}`);
        }
        this.noteOn(0, ledIDs[type][ledID] as number, 127);
        this.noteOff(0, ledIDs[type][ledID] as number);
    }
    turnLedOff(type: "mute" | "solo" | "rec" | "select" | "bottom", ledID: number, ) {
        this.noteOn(0, ledIDs[type][ledID] as number, 0);
        this.noteOff(0, ledIDs[type][ledID] as number);
    }
    polyAfterTouch(channel: number, note: number, velocity: number) {
        this.device.sendMessage([
            (commands.PA << 4) | channel,
            note,
            velocity,
        ]);
    }
    programChange(channel: number, program: number, value: number) {
        this.device.sendMessage([
            (commands.PC << 4) | channel,
            program,
            value,
        ]);
    }
    aftertouchChange(channel: number, value: number) {
        this.device.sendMessage([
            (commands.AT << 4) | channel,
            value,
            0,
        ]);
    }
    pitchBendChange(channel: number, value: number) {
        this.device.sendMessage([
            (commands.PB << 4) | channel,
            value & 0x7f,
            (value >> 7) & 0x7f,
        ]);
    }
    sendMessage(message: midi.MidiMessage): void {
        this.device.sendMessage(message);
    }
}

export { MIDIDevice, MIDIOutput, MIDIInput };