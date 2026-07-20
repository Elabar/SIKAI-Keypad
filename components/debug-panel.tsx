import { useShallow } from "zustand/react/shallow";
import { hex } from "@/lib/sikai-keypad";
import type { HidReportInfo } from "@/lib/sikai-keypad";
import { useKeypadStore } from "@/stores/keypad-store";

function reportIds(reports: HidReportInfo[] | undefined) {
  if (!reports?.length) return "none";
  return reports.map((report) => report.reportId ?? 0).join(", ");
}

export function DebugPanel() {
  const {
    connectionStatus, hardware, packets, profile, profileStatus, profileMessage,
    detectFirmware, copyPackets,
  } = useKeypadStore(useShallow((state) => ({
    connectionStatus: state.connectionStatus,
    hardware: state.hardware,
    packets: state.packets,
    profile: state.profile,
    profileStatus: state.profileStatus,
    profileMessage: state.profileMessage,
    detectFirmware: state.detectFirmware,
    copyPackets: state.copyPackets,
  })));
  const connected = connectionStatus === "connected";

  return (
    <details className="debugPanel">
      <summary><span>Debug information</span><small>HARDWARE · FIRMWARE · RAW PACKETS</small></summary>
      <div className="debugContent">
        {!hardware ? (
          <div className="emptyResult">
            <span>01</span>
            <div><strong>No connected device</strong><p>Hardware details will appear here after connecting.</p></div>
          </div>
        ) : (
          <div className="reportGrid">
            <article className="deviceCard">
              <p>DETECTED DEVICE</p>
              <h3>{hardware.name}</h3>
              <dl>
                <div><dt>Vendor ID</dt><dd>{hardware.vendorId}</dd></div>
                <div><dt>Product ID</dt><dd>{hardware.productId}</dd></div>
                <div><dt>Collections</dt><dd>{hardware.collections.length}</dd></div>
                <div><dt>Access</dt><dd className="safe">CONFIRMED</dd></div>
              </dl>
            </article>
            <div className="collections">
              {hardware.collections.map((collection, index) => (
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

        <div className="debugActions">
          <button className="darkButton" type="button" onClick={detectFirmware} disabled={!connected || profileStatus === "reading"}>
            {profileStatus === "reading" ? "Detecting…" : "Check firmware again"}
          </button>
          <button className="darkButton" type="button" onClick={copyPackets} disabled={!packets.length}>Copy raw packets</button>
        </div>
        <p className={`rgbStatus ${profileStatus === "error" ? "error" : profileStatus === "success" ? "success" : ""}`}>{profileMessage}</p>
        {profile && (
          <div className="firmwareProfile" aria-label="Firmware identity result">
            <span>KEYS {profile.keyCount} · ADD-ONS {profile.addOnCount} · PROTOCOL {hex(profile.protocol, 2)}</span>
            <code>{profile.raw}</code>
          </div>
        )}
        <div className="packetViewer" aria-label="Raw configuration packets">
          <div className="packetHeader"><span>REPORT 03</span><span>{packets.length} / 24 PACKETS</span></div>
          {packets.length ? (
            <ol>
              {packets.map((packet, index) => <li key={`${index}-${packet}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{packet}</code></li>)}
            </ol>
          ) : (
            <p>Raw response bytes will appear here after connecting.</p>
          )}
        </div>
      </div>
    </details>
  );
}
