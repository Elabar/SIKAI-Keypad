"use client";

import { useEffect, useMemo, useState } from "react";

const SIKAI_VENDOR_ID = 0x514c;
const SIKAI_PRODUCT_ID = 0x8851;
const CONFIG_USAGE_PAGE = 0xff00;
const CONFIG_USAGE = 0x0001;

type HidReportInfo = {
  reportId?: number;
  items?: Array<{
    usagePage?: number;
    usages?: number[];
    reportSize?: number;
    reportCount?: number;
  }>;
};

type HidCollectionInfo = {
  usagePage?: number;
  usage?: number;
  type?: number;
  inputReports?: HidReportInfo[];
  outputReports?: HidReportInfo[];
  featureReports?: HidReportInfo[];
  children?: HidCollectionInfo[];
};

type KeypadDevice = {
  opened: boolean;
  productName: string;
  vendorId: number;
  productId: number;
  collections: HidCollectionInfo[];
  open: () => Promise<void>;
  close: () => Promise<void>;
  sendReport: (reportId: number, data: BufferSource) => Promise<void>;
  addEventListener: (type: "inputreport", listener: (event: HidInputReportEvent) => void) => void;
  removeEventListener: (type: "inputreport", listener: (event: HidInputReportEvent) => void) => void;
};

type HidInputReportEvent = Event & {
  reportId: number;
  data: DataView;
};

type HidNavigator = Navigator & {
  hid?: {
    requestDevice: (options: {
      filters: Array<{
        vendorId: number;
        productId: number;
        usagePage?: number;
        usage?: number;
      }>;
    }) => Promise<KeypadDevice[]>;
    addEventListener: (
      type: "disconnect",
      listener: (event: Event & { device?: KeypadDevice }) => void,
    ) => void;
  };
};

type ProbeResult = {
  name: string;
  vendorId: string;
  productId: string;
  collections: HidCollectionInfo[];
};

function hex(value: number | undefined, width = 4) {
  return `0x${(value ?? 0).toString(16).toUpperCase().padStart(width, "0")}`;
}

function reportIds(reports: HidReportInfo[] | undefined) {
  if (!reports?.length) return "none";
  return reports.map((report) => report.reportId ?? 0).join(", ");
}

export default function Home() {
  const [device, setDevice] = useState<KeypadDevice | null>(null);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [message, setMessage] = useState("Ready for a read-only check.");
  const [readStatus, setReadStatus] = useState<"idle" | "reading" | "success" | "error">("idle");
  const [packets, setPackets] = useState<string[]>([]);
  const [readMessage, setReadMessage] = useState("Connect the confirmed configuration channel to enable this diagnostic.");

  const supported = useMemo(
    () => typeof navigator !== "undefined" && "hid" in navigator,
    [],
  );

  useEffect(() => {
    const hid = (navigator as HidNavigator).hid;
    if (!hid) return;

    const handleDisconnect = (event: Event & { device?: KeypadDevice }) => {
      if (event.device === device) {
        setDevice(null);
        setStatus("idle");
        setMessage("Keypad disconnected. No settings were changed.");
      }
    };

    hid.addEventListener("disconnect", handleDisconnect);
  }, [device]);

  async function connect() {
    const hid = (navigator as HidNavigator).hid;
    if (!hid) {
      setStatus("error");
      setMessage("WebHID is unavailable here. Open this page in Chrome or Edge on Windows.");
      return;
    }

    setStatus("connecting");
    setMessage("Choose the SIKAI USB Keyboard shown in the browser prompt.");

    try {
      const devices = await hid.requestDevice({
        filters: [{
          vendorId: SIKAI_VENDOR_ID,
          productId: SIKAI_PRODUCT_ID,
          usagePage: CONFIG_USAGE_PAGE,
          usage: CONFIG_USAGE,
        }],
      });

      if (!devices.length) {
        setStatus("idle");
        setMessage("Nothing was selected. You can try again safely.");
        return;
      }

      const selected = devices[0];
      if (!selected.opened) await selected.open();

      setDevice(selected);
      setResult({
        name: selected.productName || "USB Keyboard",
        vendorId: hex(selected.vendorId),
        productId: hex(selected.productId),
        collections: selected.collections ?? [],
      });
      setStatus("connected");
      setReadStatus("idle");
      setPackets([]);
      setReadMessage("Ready to request layer 1. This does not save or change the keypad.");
      setMessage("Configuration channel confirmed. Report ID 3 is available in both directions.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The browser could not open the device.";
      setStatus("error");
      setMessage(detail);
    }
  }

  async function disconnect() {
    if (device?.opened) await device.close();
    setDevice(null);
    setReadStatus("idle");
    setPackets([]);
    setReadMessage("Connect the confirmed configuration channel to enable this diagnostic.");
    setStatus("idle");
    setMessage("Probe closed. No settings were changed.");
  }

  async function readLayerOne() {
    if (!device?.opened || readStatus === "reading") return;

    setReadStatus("reading");
    setPackets([]);
    setReadMessage("Listening for configuration packets from layer 1…");

    const received: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finish: (() => void) | undefined;

    const handleReport = (event: HidInputReportEvent) => {
      if (event.reportId !== 3) return;
      const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
      received.push(Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" "));
      setPackets([...received]);
      if (received.length >= 24) finish?.();
    };

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        finish = () => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          device.removeEventListener("inputreport", handleReport);
          resolve();
        };

        device.addEventListener("inputreport", handleReport);
        timer = setTimeout(finish, 3000);

        const payload = new Uint8Array(64);
        payload.set([0xfa, 0x0f, 0x03, 0x01]);
        device.sendReport(3, payload).catch((error) => {
          if (timer) clearTimeout(timer);
          device.removeEventListener("inputreport", handleReport);
          settled = true;
          reject(error);
        });
      });

      setPackets([...received]);
      if (received.length) {
        setReadStatus("success");
        setReadMessage(`Received ${received.length} configuration packet${received.length === 1 ? "" : "s"}. Nothing was saved or changed.`);
      } else {
        setReadStatus("error");
        setReadMessage("The request was sent, but no report ID 3 response arrived. Reconnect the keypad and try once more.");
      }
    } catch (error) {
      setReadStatus("error");
      setReadMessage(error instanceof Error ? error.message : "The browser could not send the read request.");
    }
  }

  async function copyPackets() {
    if (!packets.length) return;
    const text = packets.map((packet, index) => `${String(index + 1).padStart(2, "0")}: ${packet}`).join("\n");
    await navigator.clipboard.writeText(text);
    setReadMessage(`Copied ${packets.length} raw configuration packet${packets.length === 1 ? "" : "s"}.`);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Keypad Lab home">
          <span className="brandMark" aria-hidden="true"><i /><i /></span>
          KEYPAD LAB
        </a>
          <span className="readOnlyBadge"><span /> SAFE DIAGNOSTIC</span>
      </header>

      <section className="hero" id="top">
        <div className="intro">
          <p className="eyebrow">SIKAI · VENDOR CONFIGURATION CHANNEL</p>
          <h1>Let&apos;s identify your <em>keypad.</em></h1>
          <p className="lede">
            This page targets the keypad&apos;s dedicated vendor interface, not its normal
            keyboard interface. Nothing runs automatically and no save command is used.
          </p>

          <div className={`statusPanel ${status}`} aria-live="polite">
            <span className="statusDot" aria-hidden="true" />
            <div>
              <strong>{status === "connected" ? "SIKAI keypad connected" : status === "connecting" ? "Waiting for selection" : status === "error" ? "Connection needs attention" : "Ready to inspect"}</strong>
              <p>{message}</p>
            </div>
          </div>

          <div className="actions">
            <button className="primary" onClick={connect} disabled={status === "connecting" || status === "connected"}>
              {status === "connecting" ? "Waiting…" : status === "connected" ? "Keypad connected" : "Connect keypad"}
            </button>
            {status === "connected" && <button className="secondary" onClick={disconnect}>Disconnect</button>}
          </div>

          {!supported && (
            <p className="browserWarning">Use a current Chrome or Edge window on Windows for this test.</p>
          )}

          <div className="identityStrip" aria-label="Expected device identity">
            <span><small>VENDOR</small><b>0x514C</b></span>
            <span><small>PRODUCT</small><b>0x8851</b></span>
            <span><small>USAGE</small><b>FF00 / 0001</b></span>
          </div>
        </div>

        <div className="deviceStage" aria-label="Illustration of a two-key RGB keypad">
          <div className="glow glowA" />
          <div className="glow glowB" />
          <div className="keypad">
            <div className="key keyOne"><span>K1</span><small>MACRO</small></div>
            <div className="key keyTwo"><span>K2</span><small>MACRO</small></div>
            <div className="port" />
          </div>
          <p>USB-C · ONBOARD MEMORY · RGB</p>
        </div>
      </section>

      <section className="resultsSection" aria-labelledby="results-title">
        <div className="sectionHeading">
          <p className="eyebrow">HARDWARE REPORT</p>
          <h2 id="results-title">What the browser can see</h2>
        </div>

        {!result ? (
          <div className="emptyResult">
            <span>01</span>
            <div><strong>No report yet</strong><p>Connect the keypad to reveal its HID collections and report IDs.</p></div>
          </div>
        ) : (
          <div className="reportGrid">
            <article className="deviceCard">
              <p>DETECTED DEVICE</p>
              <h3>{result.name}</h3>
              <dl>
                <div><dt>Vendor ID</dt><dd>{result.vendorId}</dd></div>
                <div><dt>Product ID</dt><dd>{result.productId}</dd></div>
                <div><dt>Collections</dt><dd>{result.collections.length}</dd></div>
                <div><dt>Access</dt><dd className="safe">CONFIRMED</dd></div>
              </dl>
            </article>

            <div className="collections">
              {result.collections.map((collection, index) => (
                <article className="collectionCard" key={`${collection.usagePage}-${collection.usage}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>HID collection</h3>
                    <p>Usage page {hex(collection.usagePage)} · Usage {hex(collection.usage)}</p>
                    <ul>
                      <li>Input reports <b>{reportIds(collection.inputReports)}</b></li>
                      <li>Output reports <b>{reportIds(collection.outputReports)}</b></li>
                      <li>Feature reports <b>{reportIds(collection.featureReports)}</b></li>
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <article className={`diagnosticCard ${readStatus}`}>
          <div className="diagnosticCopy">
            <p className="eyebrow">SAFE PROTOCOL TEST</p>
            <h3>Read layer 1</h3>
            <p>
              Sends SIKAI&apos;s non-persistent layer-read request on report ID 3, then listens for
              the reply for three seconds. It does not assign keys, change RGB, or write to flash.
            </p>
            <div className="diagnosticActions">
              <button className="acidButton" onClick={readLayerOne} disabled={status !== "connected" || readStatus === "reading"}>
                {readStatus === "reading" ? "Reading…" : "Read layer 1"}
              </button>
              {packets.length > 0 && <button className="darkButton" onClick={copyPackets}>Copy raw packets</button>}
            </div>
            <p className="diagnosticStatus" aria-live="polite">{readMessage}</p>
          </div>

          <div className="packetViewer" aria-label="Raw configuration packets">
            <div className="packetHeader"><span>REPORT 03</span><span>{packets.length} / 24 PACKETS</span></div>
            {packets.length ? (
              <ol>
                {packets.map((packet, index) => <li key={`${index}-${packet}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{packet}</code></li>)}
              </ol>
            ) : (
              <p>Raw response bytes will appear here. They are diagnostic data only.</p>
            )}
          </div>
        </article>
      </section>

      <footer>
        <p>STEP 2 OF 3</p>
        <div className="steps"><i className="active" /><i className="active" /><i /></div>
        <p>Next: decode the returned key and RGB settings</p>
      </footer>
    </main>
  );
}
