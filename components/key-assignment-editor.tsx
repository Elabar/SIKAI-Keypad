import { useShallow } from "zustand/react/shallow";
import {
  KEY_OPTIONS,
  MODIFIER_OPTIONS,
  shortcutLabel,
} from "@/lib/sikai-keypad";
import { useKeypadActions, useKeypadStore } from "@/stores/keypad-store";

export function KeyAssignmentEditor() {
  const {
    connectionStatus,
    currentAssignments,
    assignments,
    assignmentsChanged,
    readStatus,
    readMessage,
    writeStatus,
    writeMessage,
  } = useKeypadStore(
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      currentAssignments: state.currentAssignments,
      assignments: state.assignments,
      assignmentsChanged: state.assignmentsChanged,
      readStatus: state.readStatus,
      readMessage: state.readMessage,
      writeStatus: state.writeStatus,
      writeMessage: state.writeMessage,
    })),
  );
  const { reloadAssignments, updateAssignment, applyAssignments } =
    useKeypadActions();
  const connected = connectionStatus === "connected";

  return (
    <article className={`diagnosticCard ${readStatus}`}>
      <div className="diagnosticCopy">
        <p className="eyebrow">KEY ASSIGNMENT EDITOR</p>
        <h3>Configure layer 1</h3>
        <p>
          Current assignments load automatically when the keypad connects. Edit
          either physical key; the page saves only after explicit confirmation
          and verifies the result by reading it back.
        </p>
        <div className="diagnosticActions">
          <button
            className="acidButton"
            onClick={reloadAssignments}
            disabled={!connected || readStatus === "reading"}
          >
            {readStatus === "reading" ? "Reading…" : "Reload from keypad"}
          </button>
        </div>
        <p className="diagnosticStatus" aria-live="polite">
          {readMessage}
        </p>

        {currentAssignments && (
          <div className="keyEditors" aria-label="Physical key assignments">
            {assignments.map((assignment, index) => (
              <div className="keyEditor" key={index}>
                <div className="keyEditorHeading">
                  <span>KEY {index + 1}</span>
                  <small>
                    CURRENT: {shortcutLabel(currentAssignments[index])}
                  </small>
                </div>
                <div
                  className="modifierChecks"
                  aria-label={`Modifiers for key ${index + 1}`}
                >
                  {MODIFIER_OPTIONS.map(([mask, label]) => (
                    <label key={mask}>
                      <input
                        type="checkbox"
                        checked={(assignment.modifier & mask) !== 0}
                        onChange={(event) =>
                          updateAssignment(index, {
                            modifier: event.target.checked
                              ? assignment.modifier | mask
                              : assignment.modifier & ~mask,
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className="keySelect">
                  <span>KEY</span>
                  <select
                    value={assignment.keyCode}
                    onChange={(event) =>
                      updateAssignment(index, {
                        keyCode: Number(event.target.value),
                      })
                    }
                  >
                    {KEY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <strong className="shortcutPreview">
                  {shortcutLabel(assignment)}
                </strong>
              </div>
            ))}
            <button
              className="applyButton"
              onClick={applyAssignments}
              disabled={!assignmentsChanged || writeStatus === "writing"}
            >
              {writeStatus === "writing"
                ? "Applying & verifying…"
                : assignmentsChanged
                  ? "Apply to keypad"
                  : "No changes to apply"}
            </button>
            <p className={`writeStatus ${writeStatus}`} aria-live="polite">
              {writeMessage}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
