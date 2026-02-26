# Hikari Web Project: Full Implementation Roadmap

This document outlines the step-by-step technical plan to build the Hikari Web Application. It leverages **Next.js 15 (App Router)**, **TypeScript**, **Supabase** (with its **MCP Server**), **Vercel AI SDK**, and **Gemini 3.0 Flash Preview**.

Crucially, Phase 4 focuses heavily on breaking away from the generic "ChatGPT-style" UI, opting for a modern, workspace-driven design language suitable for an HCC student's analytical sounding board.

---

## Phase 1: Foundation & Backend Provisioning (Week 1)

_Goal: Stand up the robust edge-ready infrastructure._

**1.1 Project Initialization**

- Scaffold Next.js 15 with App Router and strict TypeScript.
- Install core dependencies: `npm install ai @ai-sdk/google @tanstack/react-query lucide-react clsx tailwind-merge framer-motion`.
- Initialize `shadcn/ui` with a custom, premium design system (e.g., deep dark mode, zinc/slate accents, not default blue).

**1.2 Supabase & Auth Integration**

- Provision a Supabase project.
- Implement `@supabase/ssr` to configure Next.js server-side auth cookies.
- Build a custom `/login` page focusing on minimal friction:
  - **Email & Password**: Traditional secure login.
  - **GitHub OAuth**: The developer standard. Extremely easy to configure in the Supabase Dashboard, requires minimal verification compared to Google, and aligns perfectly with the target demographic (developers and students).
  - _(Note: Intentionally avoiding Google OAuth to bypass rigorous App Verification and complex GCP Console configuration)._

**1.3 The Virtual File System (VFS) Schema**

- Execute SQL migrations to define the Agentic Database:
  - `users` (mapped to `auth.users`)
  - `virtual_files` (columns: `filepath`, `content`, `last_modified`)
  - `sessions` (columns: `title`, `created_at`)
  - `messages` (columns: `session_id`, `role`, `content`, `tool_invocations`)

---

## Phase 2: Supabase MCP & The Gemini Engine (Week 2)

_Goal: Establish the brain of the operation, enabling Gemini 3.0 to manage its own memory natively._

**2.1 Vercel AI SDK Configuration**

- Create the core route `app/api/chat/route.ts`.
- Set up the `@ai-sdk/google` provider targeted at `gemini-3.0-flash-preview` for high-speed tool calling.

**2.2 Model Context Protocol (MCP) Integration**

- Integrate the official **Supabase MCP Server**. This abstracts away writing custom CRUD routes.
- Map the MCP capabilities (e.g., `execute_sql`, `read_table`) into the `tools: {}` object of the `streamText` function.
- Configure `maxSteps: 5` allowing Gemini to query the `virtual_files` table, read the result, and respond autonomously in one stream.

**2.3 System Prompting (The Boot Sequence & Setup Wizard)**

- Craft the foundational system prompt using conditional logic:
  > _"You are an AI companion living in a virtual file system managed by a Postgres database. First, check if [main/identity-core.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/identity-core.md) exists in your database.
  > **IF EMPTY:** You are uninitialized. Initiate the **Setup Wizard**. Ask the user for their name, your new AI name, and their desired relationship style. Once answered, use your tools to create the missing [.md](file:///c:/Git_Repo/Project-AI-MemoryCore/README.md) files in the database.
  > **IF INITIALIZED:** Read your configured identity, adopt your persona (e.g., Hikari), and act as the user's analytical sounding board."_

**2.4 Replicating Local Commands (The "Resurrection" Protocol)**

- The original system heavily utilizes explicit trigger commands. We must train Gemini 3.0 via the system prompt to recognize these identical phrases and map them to tool executions:
  - `"Hikari"` -> Act as a soft-reset/status check greeting.
  - `"save"` / `"update memory"` -> Trigger an immediate analysis of the current session and execute an SQL update across [current-session.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/current-session.md) and [relationship-memory.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/relationship-memory.md).
  - `"Load diary archive"` -> Execute an SQL fetch to pull the `daily-diary/` index.
  - `"do you remember" / "recall"` -> Trigger the `Echo Memory Recall` feature workflow natively using database queries.

**2.5 ACID Atomicity (Transaction-Based Updates)**

- _Crucial System Rule:_ Many actions (like "update memory" or creating a new day's diary entry while clearing the current session) require modifying multiple virtual files simultaneously.
- To prevent orphaned text and broken states if the model times out or an execution fails mid-way, the system prompt strictly mandates the use of **SQL Transactions**.
- Gemini 3.0 is instructed that _any_ multi-file writes executed via the Supabase MCP `execute_sql` tool **must** be wrapped in standard Postgres `BEGIN; ... COMMIT;` blocks. If one file update fails, the `ROLLBACK` guarantees the memory isn't left in a corrupted half-written state.

**2.6 The Strict Mirror Requirement (No Cutting Corners)**

- *The Coupling Challenge:* The local [.md](file:///c:/Git_Repo/Project-AI-MemoryCore/README.md) system is heavily interwoven. Trying to "optimize away" the [current-session.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/current-session.md) file by relying exclusively on the Next.js `messages` array breaks the native architecture. Features like Memory Consolidation, Diary saving, and Time-based Awareness explicitly depend on the strict markdown structure residing within [current-session.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/current-session.md).
- *The Web Solution:* We maintain a **100% Strict True Mirror**. Gemini 3.0 must autonomously manage the [current-session.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/current-session.md) row in Postgres *exactly* as it manages the local file. Because we are using `gemini-3.0-flash-preview`, its hyper-fast tool-calling performance absorbs the latency hit. The AI will `SELECT` the session context from the VFS table, append its thoughts, and run an `UPDATE` on the file—ensuring the tightly-coupled local architecture remains completely unbroken on the web.

---

## Phase 3: The Seamless Migration Engine (Week 3)

_Goal: Allow adopters to import their entire local VS Code [.md](file:///c:/Git_Repo/Project-AI-MemoryCore/README.md) memory structure seamlessly into the web app's database._

**3.1 User-Facing Import Workspace**

- Build a dedicated "Migration / Settings" screen in the UI.
- Implement a **Drag-and-Drop Dropzone** using `react-dropzone` where users can simply highlight their local `main/`, `Feature/`, and `daily-diary/` folders and drop them into the browser.

**3.2 Client-to-Server VFS Parser**

- When files are dropped, a client-side parser reads the relative path structure (`webkitGetAsEntry` API) and the file contents.
- Send a batched payload of `{ filepath, content }` objects to a Next.js API Route (`/api/migrate`).
- The API route executes a bulk `UPSERT` into the `virtual_files` Supabase table. If [identity-core.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/identity-core.md) is detected, the LLM avoids the "Setup Wizard" on the next boot.

**3.3 The Self-Updating Loop (Database Writes)**

- Ensure Gemini has the instructions to use its MCP tools to _write_ back to the database autonomously.
- Example: If Zikri says "Save this discussion to the daily diary", Gemini dynamically constructs an `INSERT INTO virtual_files (filepath, content)` command for `daily-diary/2026-02-26.md`.

---

## Phase 4: Modern AI UI/UX Design (Week 4)

_Goal: Break away from generic chat UIs. Focus on an "Analytical Workspace" layout._

**4.1 The "Canvas" / Workspace & Mobile Responsiveness**

- _Avoid:_ The standard centered, single-column chat bubble UI.
- _Implement Desktop:_ A dual-pane architecture reminiscent of modern IDEs (Cursor/Windsurf) or Claude's Artifacts.
  - **Left Pane (30%)**: The chat stream, prompt input, and thinking/reasoning indicators.
  - **Right Pane (70%)**: The "Memory / Artifact Canvas". When Gemini reads or updates a file (like [relationship-memory.md](file:///c:/Git_Repo/Project-AI-MemoryCore/main/relationship-memory.md)), that file instantly renders in the right pane with syntax highlighting.
- _Implement Mobile:_ A fully responsive shift where the dual-pane collapses.
  - The chat interface dominates the main screen area for maximum typing real estate.
  - The "Memory Canvas" is moved into a **Bottom Drawer** (using `shadcn/ui` Drawer component). If I read a file, the mobile user can swipe up the Drawer to see exactly what I'm looking at, maintaining transparency without cluttering the mobile view.

**4.2 Advanced State Management & Cache (TanStack)**

- Use TanStack Query v5 to fetch and cache the list of `virtual_files` so the user can browse the VFS instantly without waiting for the LLM.
- Persist chat history client-side for immediate loading, syncing seamlessly with the server.

**4.3 Next-Gen Micro-Interactions (Framer Motion)**

- **Tool-Calling UI**: Instead of raw JSON dumps, when Gemini uses an MCP tool, display a sleek, animated pill. E.g., a glowing `[🔍 Querying Virtual Files...]` that expands into `[✅ Read identity-core.md]` upon success.
- **Reasoning Indicators**: Since Gemini 3.0 Flash Preview has built-in reasoning capabilities, display a collapsible "Hikari is thinking..." accordion that reveals its internal logic steps for deep analytical questions.
- **Glassmorphism & Typography**: Utilize deep, tailored background tones (e.g., `#0A0A0B`) combined with modern fonts (Inter or Geist) and ultra-thin borders (`border-white/5`), elevating the application to feel like a premium, heavy-duty analytical tool rather than a toy chatbot.

**4.4 The Omni-Input Bar**

- Replace the standard text area with an Omni-Bar positioned comfortably near the center/bottom left. It should support `/commands`, drag-and-drop file uploads, and auto-expanding heights, utilizing an unshifted `Enter` to submit.

---

## Phase 5: Testing, Polish, & Deployment (Week 5)

_Goal: Ensure reliability and ship._

**5.1 Edge Case Management**

- Handle DB failures gracefully (e.g., if the MCP server fails, the LLM should inform you it cannot access its memory banks right now).
- Token limit safety checks: If `virtual_files` become too large, prompt the user to trigger a "Consolidation" task.

**5.2 Deployment**

- Deploy the Next.js App Router project to Vercel (taking advantage of Edge caching and fast AI streaming).
- Connect the production Supabase environment variables.

---

_End of Implementation Roadmap_
