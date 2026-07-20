# SIKAI Keypad Lab

A browser-based configurator for the SIKAI two-key RGB keypad. It uses WebHID
to read and update onboard key assignments and supported lighting settings.

## Requirements

- Windows with a current Chrome or Edge browser
- Bun
- SIKAI keypad with USB vendor ID `0x514C` and product ID `0x8851`

## Development

```bash
bun install
bun run dev
```

## Validation

```bash
bun run lint
bun run test
```

## Structure

- `lib/sikai-keypad/` — reusable WebHID device and protocol implementation
- `stores/keypad-store.ts` — Zustand session state and namespaced actions
- `components/` — connection, assignment, RGB, and diagnostic UI
- `app/` — application shell and styles

The deployed configurator is private and uses `.openai/hosting.json` for its
Sites project binding.
