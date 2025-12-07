# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.gemini/commands/speckit.plan.toml` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **P1: 規格驅動開發 (SDD)**: The feature is based on a clear specification (`spec.md`).
- [ ] **P2: 設計即安全 (Security by Design)**: Security considerations (authentication, authorization, compliance, encryption) are addressed.
- [ ] **P3: 清晰與可測試性 (Clarity and Testability)**: The feature's user stories have clear, testable acceptance criteria.
- [ ] **P4: 漸進式價值交付 (Incremental Value Delivery)**: The feature is broken down into small, verifiable increments (user stories).
- [ ] **P5: 主要語言（zh-TW） (Primary Language)**: All project artifacts are in Traditional Chinese.
- [ ] **P6: 程式碼品質標準 (Code Quality Standards)**: Code will be reviewed and adhere to standards.
- [ ] **P7: 嚴謹測試標準 (Rigorous Testing Standards)**: The feature will have corresponding tests.
- [ ] **P8: 一致的使用者體驗 (User Experience Consistency)**: The feature's UI/UX is consistent with the design system.
- [ ] **P9: 效能要求 (Performance Requirements)**: Performance requirements are defined in `spec.md`.
- [ ] **P10: 架構設計 (Architectural Design)**: The feature's architecture aligns with DDD, Modular Monolith, and async communication principles.
- [ ] **P11: 技術堆疊 (Technology Stack)**: The feature uses the approved technology stack.
- [ ] **P12: 數據治理 (Data Governance)**: The feature respects data ownership and schema change management.
- [ ] **P13: 可觀測性 (Observability)**: The feature includes support for logging, metrics, and tracing.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
