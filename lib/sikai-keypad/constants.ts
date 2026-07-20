import type { KeyAssignment } from "./types";

export const SIKAI_VENDOR_ID = 0x514c;
export const SIKAI_PRODUCT_ID = 0x8851;
export const CONFIG_USAGE_PAGE = 0xff00;
export const CONFIG_USAGE = 0x0001;

export const KEY_NAMES: Record<number, string> = {
  0x04: "A", 0x05: "B", 0x06: "C", 0x07: "D", 0x08: "E", 0x09: "F",
  0x0a: "G", 0x0b: "H", 0x0c: "I", 0x0d: "J", 0x0e: "K", 0x0f: "L",
  0x10: "M", 0x11: "N", 0x12: "O", 0x13: "P", 0x14: "Q", 0x15: "R",
  0x16: "S", 0x17: "T", 0x18: "U", 0x19: "V", 0x1a: "W", 0x1b: "X",
  0x1c: "Y", 0x1d: "Z", 0x1e: "1", 0x1f: "2", 0x20: "3", 0x21: "4",
  0x22: "5", 0x23: "6", 0x24: "7", 0x25: "8", 0x26: "9", 0x27: "0",
  0x28: "Enter", 0x29: "Escape", 0x2a: "Backspace", 0x2b: "Tab", 0x2c: "Space",
  0x2d: "-", 0x2e: "=", 0x2f: "[", 0x30: "]", 0x31: "\\", 0x33: ";",
  0x34: "'", 0x35: "`", 0x36: ",", 0x37: ".", 0x38: "/", 0x39: "Caps Lock",
  0x3a: "F1", 0x3b: "F2", 0x3c: "F3", 0x3d: "F4", 0x3e: "F5", 0x3f: "F6",
  0x40: "F7", 0x41: "F8", 0x42: "F9", 0x43: "F10", 0x44: "F11", 0x45: "F12",
  0x49: "Insert", 0x4a: "Home", 0x4b: "Page Up", 0x4c: "Delete", 0x4d: "End",
  0x4e: "Page Down", 0x4f: "Right Arrow", 0x50: "Left Arrow", 0x51: "Down Arrow", 0x52: "Up Arrow",
};

export const KEY_OPTIONS = Object.entries(KEY_NAMES).map(([code, name]) => ({ code: Number(code), name }));

export const MODIFIER_OPTIONS = [
  [0x01, "Ctrl"], [0x02, "Shift"], [0x04, "Alt"], [0x08, "Win"],
  [0x10, "Right Ctrl"], [0x20, "Right Shift"], [0x40, "Right Alt"], [0x80, "Right Win"],
] as const;

export const RGB_COLORS = [
  { value: 0x10, name: "Red", hex: "#ff4b55" },
  { value: 0x20, name: "Orange", hex: "#ff9f32" },
  { value: 0x30, name: "Yellow", hex: "#ffe34d" },
  { value: 0x40, name: "Green", hex: "#50e878" },
  { value: 0x50, name: "Cyan", hex: "#35d8e8" },
  { value: 0x60, name: "Blue", hex: "#4c78ff" },
  { value: 0x70, name: "Purple", hex: "#a66bff" },
] as const;

export const RGB_MODES = [
  { value: 0, name: "Off", detail: "Close the light" },
  { value: 1, name: "Steady", detail: "All keys" },
  { value: 2, name: "Forward glow", detail: "First to last" },
  { value: 3, name: "Reverse glow", detail: "Last to first" },
  { value: 4, name: "Press reactive", detail: "Single key" },
  { value: 5, name: "White steady", detail: "All keys" },
] as const;

export const DEFAULT_ASSIGNMENTS: KeyAssignment[] = [
  { modifier: 0x01, keyCode: 0x06 },
  { modifier: 0x01, keyCode: 0x19 },
];
export const DEFAULT_RGB_COLOR = 0x50;
export const DEFAULT_RGB_MODE = 0;

export function hex(value: number | undefined, width = 4) {
  return `0x${(value ?? 0).toString(16).toUpperCase().padStart(width, "0")}`;
}

export function shortcutLabel(assignment: KeyAssignment) {
  return [
    ...MODIFIER_OPTIONS.filter(([mask]) => (assignment.modifier & mask) !== 0).map(([, label]) => label),
    KEY_NAMES[assignment.keyCode] ?? hex(assignment.keyCode, 2),
  ].join(" + ");
}
