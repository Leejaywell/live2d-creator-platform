# Live2D Demo Technical Notes

These notes summarize the observed technical approach from the Douyin reference video and the linked web demo. They are sanitized: no exposed keys, admin checks, or copied third-party source code are included.

## Reference Summary

- The demo presented a browser-based desktop companion named `尤里 Urzis - 智能桌面伴侣`.
- The runtime was a deployed Netlify web app.
- The project behaved as a client-side Live2D chat companion with activation checks, AI replies, expression triggers, and preset voice playback.

## Observed Frontend Stack

- Plain HTML, CSS, and JavaScript.
- Live2D Cubism Core loaded from the official Cubism web SDK CDN.
- PixiJS 6.5.
- `pixi-live2d-display` Cubism 4 build.
- Browser Web Audio APIs for playback and mouth movement.
- Pointer interaction for model focus, head movement, and eye movement.

## Live2D Model Structure

The reference model followed the standard Cubism 4 layout:

- `*.model3.json`
- `*.moc3`
- texture PNGs
- physics JSON
- expression files such as `*.exp3.json`

The observed model appeared to include expression and state names such as:

- blush
- crying
- love/heart eyes
- fox ears
- eye mask
- ice/frozen state

For a platform product, model uploads should validate this structure and store all assets in private object storage.

## Interaction Model

The demo used a tag-driven state machine:

1. User sends a chat message.
2. AI prompt instructs the model to respond with a visible action tag.
3. Client parses the tag from the AI response.
4. Parsed tag maps to Live2D expression or parameter updates.
5. Voice playback starts if a matching preset audio clip exists.
6. Mouth movement is driven by audio volume analysis.

Typical Live2D parameter targets:

- `ParamMouthOpenY`
- eye openness parameters
- brow parameters
- head/body angle parameters
- custom model-specific parameters

This maps well to a platform feature called `trigger rules`: a streamer can define tags, and each tag can bind prompt text, expression changes, parameter changes, audio clips, and cooldown behavior.

## Backend and Service Clues

The reference demo appeared to use:

- a backend-as-a-service account system for activation and device checks
- an OpenAI-compatible chat completion API
- a DeepSeek-family chat model
- client-side activation and model loading logic

Exact service credentials and authorization code are intentionally omitted.

## Security Observations

The reference architecture is useful for a demo, but it is not suitable for a commercial platform as-is.

Key risks:

- API keys in frontend code can be extracted.
- Client-only activation can be bypassed.
- Client-side model decryption keys can be copied.
- Public model asset URLs can leak paid creator models.
- Admin or payment state stored only in browser logic is not trustworthy.

Recommended platform approach:

- Keep AI provider keys on the backend.
- Proxy chat requests through the application API.
- Validate access codes server-side.
- Issue short-lived signed URLs for model assets.
- Store creator models in private object storage.
- Track quota usage server-side.
- Put payment activation and admin actions behind explicit roles and audit logs.

## Product Implications

The MVP should focus on these stable primitives:

- Creator account
- Model upload package
- Voice asset
- Trigger tag/rule
- Audience access code
- Audience chat page
- Usage quota ledger
- Admin review and manual activation

This avoids overbuilding voice cloning, payment automation, or multi-model marketplaces before the core Live2D sharing workflow is validated.
