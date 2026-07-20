import type { CSSProperties } from "react";
import type { KeypadController } from "@/hooks/use-keypad-controller";
import { RGB_COLORS, RGB_MODES } from "@/lib/sikai-keypad";

export function RgbEditor({ controller }: { controller: KeypadController }) {
  const {
    connected, profile, rgbColor, rgbMode, rgbStatus, rgbMessage,
    setRgbColor, setRgbMode, applyRgb, previewPressed, pressPreview,
  } = controller;
  const protocolSupported = profile?.protocol === 0x00 || profile?.protocol === 0x0a;

  return (
    <article className="rgbCard" aria-labelledby="rgb-title">
      <div className="rgbIntro">
        <p className="eyebrow">LIGHTING CONTROL</p>
        <h3 id="rgb-title">RGB settings</h3>
        <p>
          Choose one of the seven firmware colors and six documented effects. The preview
          mirrors the two physical keys before anything is sent to the keypad.
        </p>
        <div
          className={`rgbKeyPreview mode${rgbMode} ${previewPressed === 1 ? "pressed1" : ""} ${previewPressed === 2 ? "pressed2" : ""}`}
          style={{ "--rgb-preview": RGB_COLORS.find((option) => option.value === rgbColor)?.hex } as CSSProperties}
        >
          <div>
            <button type="button" onPointerDown={() => pressPreview(1)} aria-label="Preview key 1 lighting"><i /><span>K1</span></button>
            <button type="button" onPointerDown={() => pressPreview(2)} aria-label="Preview key 2 lighting"><i /><span>K2</span></button>
          </div>
          <p>{RGB_MODES.find((option) => option.value === rgbMode)?.name}{rgbMode === 4 ? " · press a preview key" : ""}</p>
        </div>
      </div>

      <div className="rgbControls">
        <fieldset disabled={!connected}>
          <legend>COLOR</legend>
          <div className="colorOptions">
            {RGB_COLORS.map((option) => (
              <button
                type="button"
                className={rgbColor === option.value ? "selected" : ""}
                onClick={() => setRgbColor(option.value)}
                key={option.value}
                aria-pressed={rgbColor === option.value}
              >
                <i style={{ backgroundColor: option.hex }} />{option.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={!connected}>
          <legend>EFFECT</legend>
          <div className="modeOptions">
            {RGB_MODES.map((mode) => (
              <button
                type="button"
                className={rgbMode === mode.value ? "selected" : ""}
                onClick={() => setRgbMode(mode.value)}
                key={mode.value}
                aria-pressed={rgbMode === mode.value}
              ><span>{mode.name}</span><small>MODE {mode.value} · {mode.detail}</small></button>
            ))}
          </div>
        </fieldset>

        <button
          className="applyRgbButton"
          type="button"
          onClick={applyRgb}
          disabled={!connected || !protocolSupported || rgbStatus === "writing"}
          aria-describedby="rgb-write-status"
        >
          {rgbStatus === "writing" ? "Applying RGB…" : protocolSupported ? "Apply RGB to keypad" : "RGB unavailable for this firmware"}
        </button>
        <p className={`rgbStatus ${rgbStatus}`} id="rgb-write-status" role="status" aria-live="polite">{rgbMessage}</p>
      </div>
    </article>
  );
}
