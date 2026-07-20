"use client";

import { AppFooter, AppHeader } from "@/components/app-header";
import { DebugPanel } from "@/components/debug-panel";
import { Hero } from "@/components/hero";
import { KeyAssignmentEditor } from "@/components/key-assignment-editor";
import { RgbEditor } from "@/components/rgb-editor";
import { useKeypadController } from "@/hooks/use-keypad-controller";

export default function Home() {
  const controller = useKeypadController();

  return (
    <main>
      <AppHeader />
      <Hero controller={controller} />
      <section className="resultsSection" aria-labelledby="results-title">
        <div className="sectionHeading">
          <p className="eyebrow">KEYPAD CONFIGURATION</p>
          <h2 id="results-title">Assignments and lighting</h2>
        </div>
        <KeyAssignmentEditor controller={controller} />
        <RgbEditor controller={controller} />
        <DebugPanel controller={controller} />
      </section>
      <AppFooter />
    </main>
  );
}
