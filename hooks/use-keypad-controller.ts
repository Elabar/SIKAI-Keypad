"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ASSIGNMENTS,
  DEFAULT_RGB_COLOR,
  DEFAULT_RGB_MODE,
  RGB_COLORS,
  RGB_MODES,
  SikaiKeypad,
  hex,
} from "@/lib/sikai-keypad";
import type { FirmwareProfile, HardwareInfo, KeyAssignment } from "@/lib/sikai-keypad";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
type OperationStatus = "idle" | "reading" | "writing" | "success" | "error";

function copyAssignments(assignments: KeyAssignment[]) {
  return assignments.map((assignment) => ({ ...assignment }));
}

export function useKeypadController() {
  const [keypad, setKeypad] = useState<SikaiKeypad | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Ready to connect.");

  const [packets, setPackets] = useState<string[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<KeyAssignment[] | null>(null);
  const [assignments, setAssignments] = useState<KeyAssignment[]>(() => copyAssignments(DEFAULT_ASSIGNMENTS));
  const [readStatus, setReadStatus] = useState<OperationStatus>("idle");
  const [readMessage, setReadMessage] = useState("Current assignments will load automatically after connecting.");
  const [writeStatus, setWriteStatus] = useState<OperationStatus>("idle");
  const [writeMessage, setWriteMessage] = useState("Connect the keypad to load its current assignments.");

  const [profile, setProfile] = useState<FirmwareProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<OperationStatus>("idle");
  const [profileMessage, setProfileMessage] = useState("Firmware details will load automatically after connecting.");
  const [rgbColor, setRgbColor] = useState(DEFAULT_RGB_COLOR);
  const [rgbMode, setRgbMode] = useState(DEFAULT_RGB_MODE);
  const [rgbStatus, setRgbStatus] = useState<OperationStatus>("idle");
  const [rgbMessage, setRgbMessage] = useState("Connect the keypad to load supported lighting settings.");
  const [previewPressed, setPreviewPressed] = useState<number | null>(null);

  const supported = useMemo(() => SikaiKeypad.browserSupported, []);
  const assignmentsChanged = Boolean(currentAssignments?.some((current, index) => (
    current.modifier !== assignments[index]?.modifier || current.keyCode !== assignments[index]?.keyCode
  )));

  const resetEditors = useCallback(() => {
    setKeypad(null);
    setHardware(null);
    setPackets([]);
    setCurrentAssignments(null);
    setAssignments(copyAssignments(DEFAULT_ASSIGNMENTS));
    setReadStatus("idle");
    setReadMessage("Current assignments will load automatically after connecting.");
    setWriteStatus("idle");
    setWriteMessage("Connect the keypad to load its current assignments.");
    setProfile(null);
    setProfileStatus("idle");
    setProfileMessage("Firmware details will load automatically after connecting.");
    setRgbColor(DEFAULT_RGB_COLOR);
    setRgbMode(DEFAULT_RGB_MODE);
    setRgbStatus("idle");
    setRgbMessage("Connect the keypad to load supported lighting settings.");
    setPreviewPressed(null);
  }, []);

  useEffect(() => {
    if (!keypad) return;
    const handleDisconnect = (event: Event & { device?: Parameters<SikaiKeypad["matches"]>[0] }) => {
      if (!keypad.matches(event.device)) return;
      resetEditors();
      setConnectionStatus("idle");
      setConnectionMessage("Keypad disconnected. The assignment and RGB editors were reset.");
    };
    SikaiKeypad.addDisconnectListener(handleDisconnect);
    return () => SikaiKeypad.removeDisconnectListener(handleDisconnect);
  }, [keypad, resetEditors]);

  const loadAssignments = useCallback(async (target: SikaiKeypad) => {
    setReadStatus("reading");
    setPackets([]);
    setReadMessage("Loading the current layer 1 assignments…");
    try {
      const result = await target.readAssignments(setPackets);
      setPackets(result.packets);
      setCurrentAssignments(copyAssignments(result.assignments));
      setAssignments(copyAssignments(result.assignments));
      setReadStatus("success");
      setReadMessage("Current layer 1 assignments loaded from the keypad.");
      setWriteStatus("idle");
      setWriteMessage("Current assignments loaded. Edit either key, then apply your changes.");
    } catch (error) {
      setReadStatus("error");
      setReadMessage(error instanceof Error ? error.message : "The current assignments could not be loaded.");
    }
  }, []);

  const loadCurrentRgb = useCallback(async (target: SikaiKeypad, detected: FirmwareProfile) => {
    setRgbStatus("idle");
    if (detected.protocol === 0x0a) {
      setRgbMessage("Loading the current RGB table…");
      try {
        const current = await target.readCurrentRgb(detected);
        if (!current) throw new Error("The firmware did not expose an RGB table.");
        setRgbColor(current.color);
        setRgbMode(current.mode);
        setRgbStatus("success");
        setRgbMessage("Current layer 1 lighting was loaded from the keypad.");
      } catch (error) {
        setRgbStatus("error");
        setRgbMessage(error instanceof Error ? error.message : "The current RGB table could not be loaded.");
      }
    } else if (detected.protocol === 0x00) {
      setRgbMessage("Legacy protocol 0x00 supports RGB saving, but does not expose a readable current-lighting record. Choose a setting to replace it.");
    } else {
      setRgbMessage(`RGB is disabled because protocol ${hex(detected.protocol, 2)} is not supported.`);
    }
  }, []);

  const loadProfile = useCallback(async (target: SikaiKeypad) => {
    setProfileStatus("reading");
    setProfile(null);
    setProfileMessage("Reading the keypad firmware identity…");
    try {
      const detected = await target.readFirmwareProfile();
      setProfile(detected);
      setProfileStatus("success");
      setProfileMessage(
        detected.protocol === 0x0a
          ? "Protocol 0x0A confirmed: the three-layer RGB table is supported."
          : detected.protocol === 0x00
            ? "Legacy protocol 0x00 confirmed: RGB saving is supported."
            : `Protocol ${hex(detected.protocol, 2)} is not supported for RGB writes.`,
      );
      await loadCurrentRgb(target, detected);
    } catch (error) {
      setProfileStatus("error");
      setProfileMessage(error instanceof Error ? error.message : "The firmware identity could not be read.");
      setRgbStatus("error");
      setRgbMessage("RGB writing stays disabled until the firmware can be identified.");
    }
  }, [loadCurrentRgb]);

  async function connect() {
    if (!supported) {
      setConnectionStatus("error");
      setConnectionMessage("WebHID is unavailable here. Open this page in Chrome or Edge on Windows.");
      return;
    }

    setConnectionStatus("connecting");
    setConnectionMessage("Choose the SIKAI USB Keyboard shown in the browser prompt.");
    try {
      const selected = await SikaiKeypad.request();
      if (!selected) {
        setConnectionStatus("idle");
        setConnectionMessage("Nothing was selected. You can try again safely.");
        return;
      }

      resetEditors();
      await selected.open();
      setKeypad(selected);
      setHardware(selected.getHardwareInfo());
      setConnectionStatus("connected");
      setConnectionMessage("Connected. Loading current assignments and supported lighting settings…");
      await loadAssignments(selected);
      await loadProfile(selected);
      setConnectionMessage("Finished loading available keypad settings. Changes are saved only when you press Apply.");
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage(error instanceof Error ? error.message : "The browser could not open the device.");
    }
  }

  async function disconnect() {
    await keypad?.close();
    resetEditors();
    setConnectionStatus("idle");
    setConnectionMessage("Keypad disconnected. The assignment and RGB editors were reset.");
  }

  function updateAssignment(index: number, patch: Partial<KeyAssignment>) {
    setAssignments((current) => current.map((assignment, assignmentIndex) => (
      assignmentIndex === index ? { ...assignment, ...patch } : assignment
    )));
    setWriteStatus("idle");
    setWriteMessage("Review the new shortcuts, then press Apply to save and verify them.");
  }

  async function applyAssignments() {
    if (!keypad || !assignmentsChanged || writeStatus === "writing") return;
    setWriteStatus("writing");
    setWriteMessage("Writing the changed key records, saving once, then reading them back…");
    try {
      const verified = await keypad.writeAssignments(assignments);
      setPackets(verified.packets);
      setCurrentAssignments(copyAssignments(verified.assignments));
      setAssignments(copyAssignments(verified.assignments));
      setWriteStatus("success");
      setWriteMessage("Saved and verified from the keypad. The new shortcuts are active in onboard memory.");
    } catch (error) {
      setWriteStatus("error");
      setWriteMessage(error instanceof Error ? error.message : "The keypad could not save the new shortcuts.");
    }
  }

  async function applyRgb() {
    if (!keypad || !profile || rgbStatus === "writing") return;
    if (profile.protocol !== 0x00 && profile.protocol !== 0x0a) return;
    setRgbStatus("writing");
    setRgbMessage(profile.protocol === 0x0a ? "Reading and preserving all three RGB layers…" : "Saving the corrected legacy RGB record…");
    try {
      await keypad.writeRgb(profile, { color: rgbColor, mode: rgbMode });
      const colorName = RGB_COLORS.find((option) => option.value === rgbColor)?.name ?? "Selected color";
      const modeName = RGB_MODES.find((option) => option.value === rgbMode)?.name ?? `Mode ${rgbMode}`;
      setRgbStatus("success");
      setRgbMessage(`${colorName}, ${modeName} was saved using firmware protocol ${hex(profile.protocol, 2)}.`);
    } catch (error) {
      setRgbStatus("error");
      setRgbMessage(error instanceof Error ? error.message : "The RGB setting could not be saved.");
    }
  }

  async function copyPackets() {
    if (!packets.length) return;
    const text = packets.map((packet, index) => `${String(index + 1).padStart(2, "0")}: ${packet}`).join("\n");
    await navigator.clipboard.writeText(text);
    setReadMessage(`Copied ${packets.length} raw configuration packets.`);
  }

  function pressPreview(key: number) {
    setPreviewPressed(key);
    setTimeout(() => setPreviewPressed(null), 450);
  }

  return {
    supported,
    hardware,
    connectionStatus,
    connectionMessage,
    connected: connectionStatus === "connected",
    connect,
    disconnect,
    packets,
    currentAssignments,
    assignments,
    assignmentsChanged,
    readStatus,
    readMessage,
    writeStatus,
    writeMessage,
    reloadAssignments: () => keypad && loadAssignments(keypad),
    updateAssignment,
    applyAssignments,
    profile,
    profileStatus,
    profileMessage,
    detectFirmware: () => keypad && loadProfile(keypad),
    rgbColor,
    rgbMode,
    rgbStatus,
    rgbMessage,
    setRgbColor,
    setRgbMode,
    applyRgb,
    previewPressed,
    pressPreview,
    copyPackets,
  };
}

export type KeypadController = ReturnType<typeof useKeypadController>;
