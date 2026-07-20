import { useShallow } from "zustand/react/shallow";
import { useKeypadStore } from "@/stores/keypad-store";

function KeypadIllustration() {
  return (
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
  );
}

export function Hero() {
  const { connectionStatus, connectionMessage, supported, connect, disconnect } = useKeypadStore(useShallow((state) => ({
    connectionStatus: state.connectionStatus,
    connectionMessage: state.connectionMessage,
    supported: state.supported,
    connect: state.connect,
    disconnect: state.disconnect,
  })));
  const connected = connectionStatus === "connected";
  const statusTitle = connected
    ? "SIKAI keypad connected"
    : connectionStatus === "connecting"
      ? "Waiting for selection"
      : connectionStatus === "error"
        ? "Connection needs attention"
        : "Ready to inspect";

  return (
    <section className="hero" id="top">
      <div className="intro">
        <p className="eyebrow">SIKAI · VENDOR CONFIGURATION CHANNEL</p>
        <h1>Make it your <em>keypad.</em></h1>
        <p className="lede">
          Read the two onboard shortcuts, choose any standard keyboard combination,
          and apply it directly from Chrome or Edge. Nothing is written automatically.
        </p>

        <div className={`statusPanel ${connectionStatus}`} aria-live="polite">
          <span className="statusDot" aria-hidden="true" />
          <div><strong>{statusTitle}</strong><p>{connectionMessage}</p></div>
        </div>

        <div className="actions">
          <button className="primary" onClick={connect} disabled={connectionStatus === "connecting" || connected}>
            {connectionStatus === "connecting" ? "Waiting…" : connected ? "Keypad connected" : "Connect keypad"}
          </button>
          {connected && <button className="secondary" onClick={disconnect}>Disconnect</button>}
        </div>

        {!supported && <p className="browserWarning">Use a current Chrome or Edge window on Windows.</p>}
      </div>
      <KeypadIllustration />
    </section>
  );
}
