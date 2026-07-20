"use client";

import { useEffect, useMemo, useState } from "react";

const SIKAI_VENDOR_ID = 0x514c;
const SIKAI_PRODUCT_ID = 0x8851;

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
};

type HidNavigator = Navigator & {
  hid?: {
    requestDevice: (options: {
      filters: Array<{ vendorId: number; productId: number }>;
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
    setMessage("Choose the USB Keyboard with vendor ID 514C in the browser prompt.");

    try {
      const devices = await hid.requestDevice({
        filters: [{ vendorId: SIKAI_VENDOR_ID, productId: SIKAI_PRODUCT_ID }],
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
      setMessage("Keypad detected. Only its public HID description was read.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The browser could not open the device.";
      setStatus("error");
      setMessage(detail);
    }
  }

  async function disconnect() {
    if (device?.opened) await device.close();
    setDevice(null);
    setStatus("idle");
    setMessage("Probe closed. No settings were changed.");
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Keypad Lab home">
          <span className="brandMark" aria-hidden="true"><i /><i /></span>
          KEYPAD LAB
        </a>
        <span className="readOnlyBadge"><span /> READ-ONLY MODE</span>
      </header>

      <section className="hero" id="top">
        <div className="intro">
          <p className="eyebrow">SIKAI · 2-KEY RGB MACROPAD</p>
          <h1>Let&apos;s identify your <em>keypad.</em></h1>
          <p className="lede">
            This first check reads the keypad&apos;s USB capabilities. It does not assign keys,
            change lighting, install drivers, or write anything to the device.
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
            <span><small>CONNECTION</small><b>USB HID</b></span>
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
                <div><dt>Access</dt><dd className="safe">READ ONLY</dd></div>
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
      </section>

      <footer>
        <p>STEP 1 OF 3</p>
        <div className="steps"><i className="active" /><i /><i /></div>
        <p>Next: decode the safe configuration protocol</p>
      </footer>
    </main>
  );
}
