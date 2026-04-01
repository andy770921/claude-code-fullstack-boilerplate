---
description: Create a PRD through interview, codebase exploration, and module design
---

# Write a PRD

You are tasked with creating a Product Requirements Document (PRD) through systematic discovery.

## TICKET Resolution

**If `$ARGUMENTS` is empty or not provided:**

1. Scan the `documents/` folder for existing FEAT-X folders
2. Find the highest number X in FEAT-X folders
3. Use `FEAT-{X+1}` as the new TICKET
4. Example: If FEAT-1, FEAT-2 exist → use FEAT-3

**If `$ARGUMENTS` is provided:**

- If folder exists → extend existing documents
- If folder doesn't exist → create new folder

**Prefix rules:**

- PRD/Features → `FEAT-X`

## Process

This skill follows 6 main steps:

1. Problem Discovery
2. Codebase Verification
3. Intensive Interview
4. Module Design
5. PRD Documentation
6. Implementation Plan Documentation

### 1. Problem Discovery

Gather detailed problem descriptions and solution ideas from the user. Ask clarifying questions to understand:

- What problem are we solving?
- Who is affected?
- What does success look like?

### 2. Codebase Verification

Explore the repository to validate assumptions:

- Review existing code patterns
- Identify relevant modules
- Assess current architecture

### 3. Intensive Interview

Conduct thorough questioning across all design aspects:

- User stories and acceptance criteria
- Technical constraints
- Integration requirements
- Edge cases

### 4. Module Design

Identify major modules needed, prioritizing "deep modules" that:

- Encapsulate functionality behind simple interfaces
- Are independently testable
- Have stable contracts

### 5. PRD Documentation

**Determine TICKET:** Follow the TICKET Resolution rules defined above.

Create the ticket folder structure if it doesn't exist:

- `documents/{TICKET}/plans/`
- `documents/{TICKET}/development/`

Create the PRD document at: `documents/{TICKET}/plans/prd.md`

## PRD Template

Use this template for the PRD document:

```markdown
# PRD: [Feature Name]

## Problem Statement

[Describe the problem from the user's perspective]

## Solution Overview

[High-level solution description]

## User Stories

1. As a [role], I want [feature] so that [benefit]
2. ...

## Implementation Decisions

### Modules

- [Module 1]: [Purpose and interface]
- [Module 2]: [Purpose and interface]

### Architecture

[Key architectural decisions]

### APIs/Interfaces

[API contracts and interfaces]

## Testing Strategy

[How this will be tested]

## Out of Scope

[What is explicitly NOT included]

## Status

- [ ] Planning
- [ ] In Development
- [ ] Complete
```

### 6. Implementation Plan Documentation

After completing the PRD, create detailed implementation plans for each major module or feature area.

**For each module/topic identified in the PRD:**

Create a document at: `documents/{TICKET}/development/<TOPIC_NAME>.md`

Where `<TOPIC_NAME>` should be a descriptive name (e.g., `backend-api.md`, `frontend-ui.md`, `database-schema.md`)

## Implementation Plan Template

Use this template for each implementation plan document:

```markdown
# Implementation Plan: [Topic Name]

## Overview

[Brief description of what this implementation covers]

## Files to Modify

### Backend Changes

- `path/to/file.ts`
  - Add/modify [specific function/class]
  - Purpose: [why this change is needed]

### Frontend Changes

- `path/to/file.tsx`
  - Add/modify [specific component/hook]
  - Purpose: [why this change is needed]

### Shared Types

- `shared/src/types/[name].ts`
  - Add/modify [specific types]
  - Purpose: [why this change is needed]

## Step-by-Step Implementation

### Step 1: [Description]

**File:** `path/to/file.ts`

**Changes:**

- Add import: `import { X } from 'Y'`
- Create function: `functionName(params) { ... }`
- Modify existing code: [specific changes]

**Rationale:** [Why this step is needed]

### Step 2: [Description]

**File:** `path/to/file.ts`

**Changes:**

- [Detailed code changes]

**Rationale:** [Why this step is needed]

[Continue for all steps...]

## Testing Steps

1. [How to test step 1]
2. [How to test step 2]
3. [Integration testing approach]

## Dependencies

- Must complete before: [other topics]
- Depends on: [other topics]

## Notes

[Any additional context, edge cases, or considerations]
```

**Important Guidelines:**

- Create separate implementation plan files for logically distinct areas (e.g., backend API, frontend UI, database)
- Be specific about file paths and code changes
- Include rationale for each major change
- Ensure implementation plans are detailed enough that they can be followed step-by-step

## Notes

- Skip steps as judgment dictates
- Prioritize deep modules over shallow ones
- Always inform user which TICKET number is being used
- **DO NOT modify actual code files** - only create/update markdown documentation
- Create PRD first (`plans/prd.md`), then implementation plans (`development/<TOPIC_NAME>.md`)
- Implementation plans should be detailed enough to guide development without ambiguity
