export function AppHeader() {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Keypad Lab home">
        <span className="brandMark" aria-hidden="true"><i /><i /></span>
        KEYPAD LAB
      </a>
      <span className="readOnlyBadge"><span /> CONFIGURATION MODE</span>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer>
      <p>SHORTCUT EDITOR READY</p>
      <div className="steps"><i className="active" /><i className="active" /><i className="active" /></div>
      <p>Read · edit · apply · verify</p>
    </footer>
  );
}
