# Live2D Creator Platform

This project collects the current product specification, sanitized technical research, and prototype code for a Live2D creator platform.

The intended product is a cloud platform where streamers can upload and manage their own Live2D models, configure voices and trigger tags, issue audience access codes, and let viewers interact with an AI-powered Live2D character page.

## Contents

- `docs/specs/2026-06-06-live2d-creator-platform-design.md`
  - Approved product and technical specification for the MVP.
- `docs/research/live2d-demo-technical-notes.md`
  - Sanitized notes from the Douyin reference project and related technical analysis.
- `prototypes/live2d-companion-clone/`
  - Static browser prototype based on `pixi-live2d-display`.

## Prototype

Run the local prototype with:

```bash
cd /Users/lee/workspaces/work/live2d-creator-platform/prototypes/live2d-companion-clone
python3 -m http.server 5177
```

Then open:

```text
http://localhost:5177
```

The prototype is intentionally static. It demonstrates Live2D loading, chat UI, tag-driven expressions, voice playback behavior, and basic configuration flow. It is not the final platform implementation.

## Security Note

The third-party reference page exposed client-side credentials, model authorization logic, and service configuration. Those materials were not copied into this project. Only sanitized technical observations are included.

For the real platform, secrets, model decryption, payments, access-code validation, quota accounting, and AI provider calls must be handled through backend services rather than client-side JavaScript.
