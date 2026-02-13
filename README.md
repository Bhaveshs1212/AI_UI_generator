# Ryze AI UI Generator

## Overview
This project is a deterministic, multi-agent UI generator that produces JSX from a fixed component library. The system enforces strict safety and validation rules, supports iterative modifications with stable component IDs, and renders output via a safe AST-based renderer.

## Architecture
Flow:
1. User prompt -> Planner -> JSON plan
2. Plan -> Generator -> JSX
3. Plan + JSX -> Explainer -> Plain text explanation
4. JSX -> AST validation -> Safe renderer -> Live preview

Key modules:
- Agents: [lib/agent](lib/agent)
- Validation: [lib/validation](lib/validation)
- Safe rendering: [lib/renderer](lib/renderer)
- Versioning: [lib/version](lib/version)
- UI state: [lib/state](lib/state)

## Agent Design and Prompts
Three separate agents run independently:
- Planner: produces strict JSON plans only.
- Generator: produces JSX only.
- Explainer: produces plain English only.

Prompts are separated in [lib/agent/prompts.ts](lib/agent/prompts.ts).

Determinism controls:
- temperature: 0 in both Chat Completions and Responses API paths.
- Deterministic fallback JSX is produced if validation fails.

## Deterministic Component System
Rules enforced:
- Fixed component library: Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart.
- AI cannot create new components or add CSS.
- Inline styles and unknown props are blocked.
- Unknown components are rejected at both prompt and render time.

Component definitions live in [components/system](components/system).

## Safety and Validation
Validation and safety layers:
- Prompt injection checks for script tags, imports, and inline styles.
- AST parsing via @babel/parser.
- Import statements blocked.
- Unknown components and props rejected.
- Inline styles rejected.
- Safe renderer only instantiates approved components.

See [lib/validation/jsxValidator.ts](lib/validation/jsxValidator.ts) and [lib/renderer/safeRenderer.ts](lib/renderer/safeRenderer.ts).

## Iteration Strategy
Modifications are incremental:
- Planner returns changes; previous plan is passed in.
- Modify endpoint coerces non-modify outputs into a modify flow.
- Component IDs are stabilized when applying changes.
- Version history allows rollback without LLM calls.

See [app/api/modify/route.ts](app/api/modify/route.ts) and [lib/agent/planner.ts](lib/agent/planner.ts).

## Known Limitations
- Version history is in-memory and resets on server restart.
- No persistent user sessions; sessionId is local only.
- Determinism depends on the LLM provider honoring temperature: 0.

## Improvements With More Time
- Persist versions per session in a database.
- Add structured analytics for change diffs and usage.
- Add full regression tests for validation and planner outputs.
- Add a deployment health check endpoint.

## Setup
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment Variables
Required:
- OPENAI_API_KEY

Optional:
- OPENAI_BASE_URL (defaults to https://api.openai.com/v1)
- OPENAI_MODEL (defaults to gpt-4o-mini)
- OPENAI_USE_CHAT_COMPLETIONS (set to true to force Chat Completions)

## Deployment
This app is designed for Vercel or any Node-compatible host.

Vercel steps:
1. Push repo to GitHub.
2. Create a Vercel project from the repo.
3. Set environment variables in Vercel.
4. Deploy and verify / and /api/generate.

## Demo Video Checklist
The demo must show:
- Initial UI generation
- Iterative modification
- Live preview updating
- Explanation output
- Version rollback
- Malicious prompt rejection
- Mention of deterministic system and AST validation

Use the checklist in [DEMO_VIDEO_CHECKLIST.md](DEMO_VIDEO_CHECKLIST.md).

## Determinism Stress Test
Run and record results in [DETERMINISM_STRESS_TEST.md](DETERMINISM_STRESS_TEST.md).
