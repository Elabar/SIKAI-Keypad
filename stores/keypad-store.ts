"use client";

import { create } from "zustand";
import {
  DEFAULT_ASSIGNMENTS,
  DEFAULT_RGB_COLOR,
  DEFAULT_RGB_MODE,
  RGB_COLORS,
  RGB_MODES,
  SikaiKeypad,
  hex,
} from "@/lib/sikai-keypad";
import type {
  FirmwareProfile,
  HardwareInfo,
  HidDevice,
  KeyAssignment,
} from "@/lib/sikai-keypad";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
type OperationStatus = "idle" | "reading" | "writing" | "success" | "error";

type KeypadActions = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reloadAssignments: () => Promise<void>;
  updateAssignment: (index: number, patch: Partial<KeyAssignment>) => void;
  applyAssignments: () => Promise<void>;
  detectFirmware: () => Promise<void>;
  setRgbColor: (color: number) => void;
  setRgbMode: (mode: number) => void;
  applyRgb: () => Promise<void>;
  pressPreview: (key: number) => void;
  copyPackets: () => Promise<void>;
};

type KeypadState = {
  keypad: SikaiKeypad | null;
  supported: boolean;
  hardware: HardwareInfo | null;
  connectionStatus: ConnectionStatus;
  connectionMessage: string;
  packets: string[];
  currentAssignments: KeyAssignment[] | null;
  assignments: KeyAssignment[];
  assignmentsChanged: boolean;
  readStatus: OperationStatus;
  readMessage: string;
  writeStatus: OperationStatus;
  writeMessage: string;
  profile: FirmwareProfile | null;
  profileStatus: OperationStatus;
  profileMessage: string;
  rgbColor: number;
  rgbMode: number;
  rgbStatus: OperationStatus;
  rgbMessage: string;
  previewPressed: number | null;
  actions: KeypadActions;
};

function copyAssignments(assignments: KeyAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }));
}

function assignmentsDiffer(
  current: KeyAssignment[] | null,
  next: KeyAssignment[],
) {
  return Boolean(
    current?.some(
      (assignment, index) =>
        assignment.modifier !== next[index]?.modifier ||
        assignment.keyCode !== next[index]?.keyCode,
    ),
  );
}

function editorDefaults() {
  return {
    keypad: null,
    hardware: null,
    packets: [],
    currentAssignments: null,
    assignments: copyAssignments(DEFAULT_ASSIGNMENTS),
    assignmentsChanged: false,
    readStatus: "idle" as const,
    readMessage:
      "Current assignments will load automatically after connecting.",
    writeStatus: "idle" as const,
    writeMessage: "Connect the keypad to load its current assignments.",
    profile: null,
    profileStatus: "idle" as const,
    profileMessage:
      "Firmware details will load automatically after connecting.",
    rgbColor: DEFAULT_RGB_COLOR,
    rgbMode: DEFAULT_RGB_MODE,
    rgbStatus: "idle" as const,
    rgbMessage: "Connect the keypad to load supported lighting settings.",
    previewPressed: null,
  };
}

let disconnectListener:
  | ((event: Event & { device?: HidDevice }) => void)
  | null = null;

function detachDisconnectListener() {
  if (!disconnectListener) return;
  SikaiKeypad.removeDisconnectListener(disconnectListener);
  disconnectListener = null;
}

function attachDisconnectListener(keypad: SikaiKeypad) {
  detachDisconnectListener();
  disconnectListener = (event) => {
    if (!keypad.matches(event.device)) return;
    detachDisconnectListener();
    useKeypadStore.setState({
      ...editorDefaults(),
      connectionStatus: "idle",
      connectionMessage:
        "Keypad disconnected. The assignment and RGB editors were reset.",
    });
  };
  SikaiKeypad.addDisconnectListener(disconnectListener);
}

export const useKeypadStore = create<KeypadState>((set, get) => ({
  ...editorDefaults(),
  supported: SikaiKeypad.browserSupported,
  connectionStatus: "idle",
  connectionMessage: "Ready to connect.",

  actions: {
    connect: async () => {
      if (!get().supported) {
        set({
          connectionStatus: "error",
          connectionMessage:
            "WebHID is unavailable here. Open this page in Chrome or Edge on Windows.",
        });
        return;
      }

      set({
        connectionStatus: "connecting",
        connectionMessage:
          "Choose the SIKAI USB Keyboard shown in the browser prompt.",
      });
      try {
        const selected = await SikaiKeypad.request();
        if (!selected) {
          set({
            connectionStatus: "idle",
            connectionMessage:
              "Nothing was selected. You can try again safely.",
          });
          return;
        }

        detachDisconnectListener();
        set(editorDefaults());
        await selected.open();
        attachDisconnectListener(selected);
        set({
          keypad: selected,
          hardware: selected.getHardwareInfo(),
          connectionStatus: "connected",
          connectionMessage:
            "Connected. Loading current assignments and supported lighting settings…",
        });
        await get().actions.reloadAssignments();
        await get().actions.detectFirmware();
        set({
          connectionMessage:
            "Finished loading available keypad settings. Changes are saved only when you press Apply.",
        });
      } catch (error) {
        set({
          connectionStatus: "error",
          connectionMessage:
            error instanceof Error
              ? error.message
              : "The browser could not open the device.",
        });
      }
    },

    disconnect: async () => {
      const keypad = get().keypad;
      detachDisconnectListener();
      await keypad?.close();
      set({
        ...editorDefaults(),
        connectionStatus: "idle",
        connectionMessage:
          "Keypad disconnected. The assignment and RGB editors were reset.",
      });
    },

    reloadAssignments: async () => {
      const keypad = get().keypad;
      if (!keypad || get().readStatus === "reading") return;
      set({
        readStatus: "reading",
        packets: [],
        readMessage: "Loading the current layer 1 assignments…",
      });
      try {
        const result = await keypad.readAssignments((packets) =>
          set({ packets }),
        );
        set({
          packets: result.packets,
          currentAssignments: copyAssignments(result.assignments),
          assignments: copyAssignments(result.assignments),
          assignmentsChanged: false,
          readStatus: "success",
          readMessage: "Current layer 1 assignments loaded from the keypad.",
          writeStatus: "idle",
          writeMessage:
            "Current assignments loaded. Edit either key, then apply your changes.",
        });
      } catch (error) {
        set({
          readStatus: "error",
          readMessage:
            error instanceof Error
              ? error.message
              : "The current assignments could not be loaded.",
        });
      }
    },

    updateAssignment: (index, patch) => {
      set((state) => {
        const assignments = state.assignments.map(
          (assignment, assignmentIndex) =>
            assignmentIndex === index
              ? { ...assignment, ...patch }
              : assignment,
        );
        return {
          assignments,
          assignmentsChanged: assignmentsDiffer(
            state.currentAssignments,
            assignments,
          ),
          writeStatus: "idle",
          writeMessage:
            "Review the new shortcuts, then press Apply to save and verify them.",
        };
      });
    },

    applyAssignments: async () => {
      const { keypad, assignments, assignmentsChanged, writeStatus } = get();
      if (!keypad || !assignmentsChanged || writeStatus === "writing") return;
      set({
        writeStatus: "writing",
        writeMessage:
          "Writing the changed key records, saving once, then reading them back…",
      });
      try {
        const verified = await keypad.writeAssignments(assignments);
        set({
          packets: verified.packets,
          currentAssignments: copyAssignments(verified.assignments),
          assignments: copyAssignments(verified.assignments),
          assignmentsChanged: false,
          writeStatus: "success",
          writeMessage:
            "Saved and verified from the keypad. The new shortcuts are active in onboard memory.",
        });
      } catch (error) {
        set({
          writeStatus: "error",
          writeMessage:
            error instanceof Error
              ? error.message
              : "The keypad could not save the new shortcuts.",
        });
      }
    },

    detectFirmware: async () => {
      const keypad = get().keypad;
      if (!keypad || get().profileStatus === "reading") return;
      set({
        profileStatus: "reading",
        profile: null,
        profileMessage: "Reading the keypad firmware identity…",
      });
      try {
        const profile = await keypad.readFirmwareProfile();
        set({
          profile,
          profileStatus: "success",
          profileMessage:
            profile.protocol === 0x0a
              ? "Protocol 0x0A confirmed: the three-layer RGB table is supported."
              : profile.protocol === 0x00
                ? "Legacy protocol 0x00 confirmed: RGB saving is supported."
                : `Protocol ${hex(profile.protocol, 2)} is not supported for RGB writes.`,
        });

        if (profile.protocol === 0x0a) {
          set({
            rgbStatus: "idle",
            rgbMessage: "Loading the current RGB table…",
          });
          try {
            const current = await keypad.readCurrentRgb(profile);
            if (!current)
              throw new Error("The firmware did not expose an RGB table.");
            set({
              rgbColor: current.color,
              rgbMode: current.mode,
              rgbStatus: "success",
              rgbMessage:
                "Current layer 1 lighting was loaded from the keypad.",
            });
          } catch (error) {
            set({
              rgbStatus: "error",
              rgbMessage:
                error instanceof Error
                  ? error.message
                  : "The current RGB table could not be loaded.",
            });
          }
        } else if (profile.protocol === 0x00) {
          set({
            rgbStatus: "idle",
            rgbMessage:
              "Legacy protocol 0x00 supports RGB saving, but does not expose a readable current-lighting record. Choose a setting to replace it.",
          });
        } else {
          set({
            rgbStatus: "idle",
            rgbMessage: `RGB is disabled because protocol ${hex(profile.protocol, 2)} is not supported.`,
          });
        }
      } catch (error) {
        set({
          profileStatus: "error",
          profileMessage:
            error instanceof Error
              ? error.message
              : "The firmware identity could not be read.",
          rgbStatus: "error",
          rgbMessage:
            "RGB writing stays disabled until the firmware can be identified.",
        });
      }
    },

    setRgbColor: (rgbColor) => set({ rgbColor }),
    setRgbMode: (rgbMode) => set({ rgbMode }),

    applyRgb: async () => {
      const { keypad, profile, rgbColor, rgbMode, rgbStatus } = get();
      if (!keypad || !profile || rgbStatus === "writing") return;
      if (profile.protocol !== 0x00 && profile.protocol !== 0x0a) return;
      set({
        rgbStatus: "writing",
        rgbMessage:
          profile.protocol === 0x0a
            ? "Reading and preserving all three RGB layers…"
            : "Saving the corrected legacy RGB record…",
      });
      try {
        await keypad.writeRgb(profile, { color: rgbColor, mode: rgbMode });
        const colorName =
          RGB_COLORS.find((option) => option.value === rgbColor)?.name ??
          "Selected color";
        const modeName =
          RGB_MODES.find((option) => option.value === rgbMode)?.name ??
          `Mode ${rgbMode}`;
        set({
          rgbStatus: "success",
          rgbMessage: `${colorName}, ${modeName} was saved using firmware protocol ${hex(profile.protocol, 2)}.`,
        });
      } catch (error) {
        set({
          rgbStatus: "error",
          rgbMessage:
            error instanceof Error
              ? error.message
              : "The RGB setting could not be saved.",
        });
      }
    },

    pressPreview: (previewPressed) => {
      set({ previewPressed });
      setTimeout(() => set({ previewPressed: null }), 450);
    },

    copyPackets: async () => {
      const packets = get().packets;
      if (!packets.length) return;
      const text = packets
        .map(
          (packet, index) => `${String(index + 1).padStart(2, "0")}: ${packet}`,
        )
        .join("\n");
      await navigator.clipboard.writeText(text);
      set({
        readMessage: `Copied ${packets.length} raw configuration packets.`,
      });
    },
  },
}));

export const useKeypadActions = () => useKeypadStore((state) => state.actions);

export type { KeypadActions, KeypadState };
