import {
  CONFIG_USAGE,
  CONFIG_USAGE_PAGE,
  DEFAULT_RGB_COLOR,
  DEFAULT_RGB_MODE,
  RGB_COLORS,
  RGB_MODES,
  SIKAI_PRODUCT_ID,
  SIKAI_VENDOR_ID,
  hex,
} from "./constants";
import type {
  FirmwareProfile,
  HardwareInfo,
  HidDevice,
  HidInputReportEvent,
  HidNavigator,
  KeyAssignment,
  LayerAssignments,
  RgbSelection,
} from "./types";

type RgbLayer = {
  mode: number;
  colors: Uint8Array;
};

function packetBytes(packet: string) {
  return packet.split(" ").map((value) => Number.parseInt(value, 16));
}

function packetForSlot(packets: string[], slot: number) {
  return packets.find((packet) => packetBytes(packet)[1] === slot);
}

function decodeAssignment(packet: string): KeyAssignment {
  const bytes = packetBytes(packet);
  return { modifier: bytes[10], keyCode: bytes[11] };
}

function closestFirmwareColor(colors: Uint8Array) {
  const [red = 0, green = 0, blue = 0] = colors;
  return RGB_COLORS.reduce((closest, option) => {
    const optionRgb = [1, 3, 5].map((index) => Number.parseInt(option.hex.slice(index, index + 2), 16));
    const distance = (red - optionRgb[0]) ** 2 + (green - optionRgb[1]) ** 2 + (blue - optionRgb[2]) ** 2;
    return distance < closest.distance ? { value: option.value, distance } : closest;
  }, { value: DEFAULT_RGB_COLOR as number, distance: Number.POSITIVE_INFINITY }).value;
}

export class SikaiKeypad {
  private packets: string[] = [];

  constructor(private readonly device: HidDevice) {}

  static get browserSupported() {
    return typeof navigator !== "undefined" && "hid" in navigator;
  }

  static async request() {
    const hid = (navigator as HidNavigator).hid;
    if (!hid) throw new Error("WebHID is unavailable here. Open this page in Chrome or Edge on Windows.");

    const devices = await hid.requestDevice({
      filters: [{
        vendorId: SIKAI_VENDOR_ID,
        productId: SIKAI_PRODUCT_ID,
        usagePage: CONFIG_USAGE_PAGE,
        usage: CONFIG_USAGE,
      }],
    });
    return devices[0] ? new SikaiKeypad(devices[0]) : null;
  }

  static addDisconnectListener(listener: (event: Event & { device?: HidDevice }) => void) {
    (navigator as HidNavigator).hid?.addEventListener("disconnect", listener);
  }

  static removeDisconnectListener(listener: (event: Event & { device?: HidDevice }) => void) {
    (navigator as HidNavigator).hid?.removeEventListener("disconnect", listener);
  }

  get opened() {
    return this.device.opened;
  }

  matches(device: HidDevice | undefined) {
    return device === this.device;
  }

  async open() {
    if (!this.device.opened) await this.device.open();
  }

  async close() {
    if (this.device.opened) await this.device.close();
  }

  getHardwareInfo(): HardwareInfo {
    return {
      name: this.device.productName || "USB Keyboard",
      vendorId: hex(this.device.vendorId),
      productId: hex(this.device.productId),
      collections: this.device.collections ?? [],
    };
  }

  async readFirmwareProfile() {
    return new Promise<FirmwareProfile>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, profile?: FirmwareProfile) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.device.removeEventListener("inputreport", handleReport);
        if (error) reject(error);
        else if (profile) resolve(profile);
      };
      const handleReport = (event: HidInputReportEvent) => {
        if (event.reportId !== 3) return;
        const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (bytes.length < 4 || bytes[0] !== 0xfb) return;
        finish(undefined, {
          keyCount: bytes[1],
          addOnCount: bytes[2],
          protocol: bytes[3],
          raw: Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" "),
        });
      };
      const timer = setTimeout(() => finish(new Error("No identity response arrived. Reconnect the keypad and try once more.")), 2000);
      this.device.addEventListener("inputreport", handleReport);
      const payload = new Uint8Array(64);
      payload.set([0xfb, 0xfb, 0xfb]);
      this.device.sendReport(3, payload).catch((error) => finish(error instanceof Error ? error : new Error("The identity request could not be sent.")));
    });
  }

  async readAssignments(onPacket?: (packets: string[]) => void): Promise<LayerAssignments> {
    const packets = await this.readLayerPackets(onPacket);
    const physicalKeys = [packetForSlot(packets, 1), packetForSlot(packets, 2)];
    if (!physicalKeys.every(Boolean)) throw new Error("The keypad did not return both physical key assignments.");
    this.packets = packets;
    return {
      packets,
      assignments: physicalKeys.map((packet) => decodeAssignment(packet as string)),
    };
  }

  async writeAssignments(assignments: KeyAssignment[]) {
    if (this.packets.length === 0) throw new Error("Read the keypad before saving assignments.");

    for (let index = 0; index < 2; index += 1) {
      const original = packetForSlot(this.packets, index + 1);
      if (!original) throw new Error(`The original record for key ${index + 1} is missing.`);
      const current = decodeAssignment(original);
      const next = assignments[index];
      if (current.modifier === next.modifier && current.keyCode === next.keyCode) continue;

      const payload = new Uint8Array(64);
      payload.set(packetBytes(original).slice(0, 50));
      payload[0] = 0xfd;
      payload[9] = 1;
      payload[10] = next.modifier;
      payload[11] = next.keyCode;
      payload.fill(0, 12, 50);
      await this.device.sendReport(3, payload);
    }

    const commit = new Uint8Array(64);
    commit.set([0xfd, 0xfe, 0xff]);
    await this.device.sendReport(3, commit);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const verified = await this.readAssignments();
    const matches = verified.assignments.every((assignment, index) => (
      assignment.modifier === assignments[index].modifier && assignment.keyCode === assignments[index].keyCode
    ));
    if (!matches) throw new Error("The keypad did not read back the requested shortcuts. Its previous settings may still be active.");
    return verified;
  }

  async readCurrentRgb(profile: FirmwareProfile): Promise<RgbSelection | null> {
    if (profile.protocol !== 0x0a) return null;
    const current = await this.readRgbLayer(0);
    return {
      mode: RGB_MODES.some((mode) => mode.value === current.mode) ? current.mode : DEFAULT_RGB_MODE,
      color: closestFirmwareColor(current.colors),
    };
  }

  async writeRgb(profile: FirmwareProfile, selection: RgbSelection) {
    if (profile.protocol === 0x00) {
      const payload = new Uint8Array(64);
      payload.set([0xfe, 0xb0, 0x01, 0x08]);
      payload[9] = 0x01;
      payload[11] = selection.color | selection.mode;
      await this.sendReportWithTimeout(payload);

      const commit = new Uint8Array(64);
      commit.set([0xfd, 0xfe, 0xff]);
      await this.sendReportWithTimeout(commit);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await this.readFirmwareProfile();
      return;
    }

    if (profile.protocol !== 0x0a) throw new Error(`RGB writing is not supported for protocol ${hex(profile.protocol, 2)}.`);

    const layers: RgbLayer[] = [];
    for (let layer = 0; layer < 3; layer += 1) layers.push(await this.readRgbLayer(layer));

    const selected = RGB_COLORS.find((option) => option.value === selection.color)?.hex ?? "#35d8e8";
    const color = [1, 3, 5].map((index) => Number.parseInt(selected.slice(index, index + 2), 16));
    layers[0].mode = selection.mode;
    for (let key = 0; key < Math.min(profile.keyCount, 16); key += 1) layers[0].colors.set(color, key * 3);

    for (let layer = 0; layer < 3; layer += 1) {
      const payload = new Uint8Array(64);
      payload.set([0xfe, 0xb0, layer, layers[layer].mode]);
      payload.set(layers[layer].colors, 4);
      await this.sendReportWithTimeout(payload);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    const verified = await this.readRgbLayer(0);
    const expected = layers[0].colors.slice(0, Math.min(profile.keyCount, 16) * 3);
    const actual = verified.colors.slice(0, expected.length);
    if (verified.mode !== selection.mode || !expected.every((byte, index) => byte === actual[index])) {
      throw new Error("The keypad responded, but its RGB table did not match the requested setting.");
    }
  }

  private async readLayerPackets(onPacket?: (packets: string[]) => void) {
    const received: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finish: (() => void) | undefined;

    const handleReport = (event: HidInputReportEvent) => {
      if (event.reportId !== 3) return;
      const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
      received.push(Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" "));
      onPacket?.([...received]);
      if (received.length >= 24) finish?.();
    };

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.device.removeEventListener("inputreport", handleReport);
        resolve();
      };
      this.device.addEventListener("inputreport", handleReport);
      timer = setTimeout(finish, 3000);
      const payload = new Uint8Array(64);
      payload.set([0xfa, 0x0f, 0x03, 0x01]);
      this.device.sendReport(3, payload).catch((error) => {
        if (timer) clearTimeout(timer);
        this.device.removeEventListener("inputreport", handleReport);
        settled = true;
        reject(error);
      });
    });
    return received;
  }

  private async readRgbLayer(layer: number) {
    return new Promise<RgbLayer>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, value?: RgbLayer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.device.removeEventListener("inputreport", handleReport);
        if (error) reject(error);
        else if (value) resolve(value);
      };
      const handleReport = (event: HidInputReportEvent) => {
        if (event.reportId !== 3) return;
        const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (bytes.length < 50 || bytes[0] !== 0xb0) return;
        finish(undefined, { mode: bytes[1], colors: bytes.slice(2, 50) });
      };
      const timer = setTimeout(() => finish(new Error(`RGB layer ${layer + 1} did not answer the read request.`)), 2000);
      this.device.addEventListener("inputreport", handleReport);
      const payload = new Uint8Array(64);
      payload.set([0xfa, 0xb0, layer]);
      this.device.sendReport(3, payload).catch((error) => finish(error instanceof Error ? error : new Error("The RGB read request could not be sent.")));
    });
  }

  private async sendReportWithTimeout(payload: Uint8Array) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.device.sendReport(3, payload),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("The keypad did not finish the RGB write. Reconnect it before trying again.")), 1500);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
