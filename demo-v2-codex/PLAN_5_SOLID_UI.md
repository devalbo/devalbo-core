# Plan 5: Social UI

Plan 4 built the complete data layer: typed domain model, TinyBase store tables, branded-ID accessors, social commands (persona/contact/group), and JSON-LD import/export. Plan 5 decides how that data surfaces to the user as a UI.

This document captures four proposals for UI strategy. One will be chosen (or combined) and the chosen approach will be expanded into a full phased implementation plan.

---

## Context: What Already Exists

Before choosing a strategy, what the codebase already gives us for free:

- **Tab pattern** — both web and desktop apps have a `Terminal | File Explorer` tab bar. Adding a third tab costs a few lines.
- **Commands produce React components** — `CommandResult.component` is a `React.ReactNode`. Social commands (`persona list`, `contact view`, etc.) can render rich UI directly in the shell. `FileTree` and `Editor` are already done this way.
- **TinyBase store is reactive** — `createDevalboStore()` returns a store with live subscriptions. Any component that reads from the store can re-render automatically on changes.
- **MIME handler registry** — `@devalbo/ui` has a registration system for rendering file content by MIME type. New handlers can be registered at startup.
- **Existing primitives** — `Select`, `StatusBar`, `TextInput`, `ScrollArea`, `Spinner`, `TreeView` are all in `@devalbo/ui`.
- **Social command handlers** — `persona`, `contact`, `group` commands are fully wired into the command registry and accept a `store` in their options.

---

## Proposal A: Shell-First with Rich Command Output

**The premise:** don't add a new UI surface at all. Social data is accessed exclusively through the existing terminal shell. The social commands already work; what they're missing is rich React output components.

### What it looks like

```
$ persona list
┌─────────────────────────────────────────────────────┐
│ ● Alice Liddell      @alice    alice@example.com     │
│   Bob the Builder    @bob      bob@example.com       │
│   Carol Danvers      @carol    carol@example.com     │
└─────────────────────────────────────────────────────┘

$ contact view contact_abc123
┌─ Contact ──────────────────────────────────────────┐
│ Name:    Alice Liddell                              │
│ Email:   alice@example.com                          │
│ Phone:   +1-555-1234                                │
│ Groups:  Avengers (member), Staff (lead)            │
│ Linked:  persona_xyz (Alice Liddell)                │
└─────────────────────────────────────────────────────┘
```

Rich `<Text>` + `<Box>` Ink components, rendered directly into the shell history. Already the pattern for `ls`, `navigate`, `edit`.

### What's new

- **Rich output components** for each command: `PersonaListView`, `ContactDetailView`, `GroupMemberView`, etc. Live in `naveditor-lib/src/components/social/`.
- Commands return these as `result.component`.
- No new packages, no new tabs, no routing.

### Tradeoffs

| | |
|---|---|
| **For** | Zero new surface area. Consistent with the shell-first design philosophy. Cheap to implement. Commands are already wired. |
| **Against** | No persistent view — `persona list` output scrolls away. No live-updating panel. Low discoverability (you have to know the commands exist). Ink output is TUI-only so the terminal box renders it; web views get it too but it's not first-class web UI. |

**Best fit for:** a tool-centric workflow where users are comfortable at the command line and want quick lookup.

---

## Proposal B: Social Panel Tab (Reactive Read-Only)

**The premise:** add a `People` tab alongside `Terminal | File Explorer`. The tab is a live, read-only view of the social store. Mutations still happen through the terminal. The panel auto-updates because it reads directly from TinyBase.

### What it looks like

```
┌─────────────────────────────────────────────────────────────────────┐
│  Terminal  |  File Explorer  |  People                              │
├────────────────┬────────────────────────────────────────────────────┤
│  Personas      │  Contacts                                          │
│  ──────────    │  ──────────────────────────────────────────────    │
│  Alice         │  Alice Liddell    alice@example.com  person        │
│  Bob           │  Bob the Builder  bob@example.com    person        │
│                │  Stark Industries —                  agent         │
│  Groups        │                                                    │
│  ──────────    │  Groups                                            │
│  Avengers      │  ──────────────────────────────────────────────    │
│  Staff         │  Avengers  (org)    3 members                      │
│                │  Staff     (team)   12 members                     │
└────────────────┴────────────────────────────────────────────────────┘
```

Left sidebar: entity type selector (Personas / Contacts / Groups). Right panel: a flat or grouped list view for the selected type. Clicking an item expands an inline detail row. No editing in this panel.

### What's new

- `SocialPanel` component added to `naveditor-lib/src/components/social/`.
- TinyBase subscription hooks: `usePersonas()`, `useContacts()`, `useGroups()` — thin wrappers over existing accessors + `useRow`/`useTable`.
- `SocialPanel` added as a third tab in both `naveditor-web/src/App.tsx` and `naveditor-desktop/src/App.tsx`.
- Read-only: no forms, no inputs. Mutations go through terminal.

### Tradeoffs

| | |
|---|---|
| **For** | Persistent, live view of all social data. Good for observing state while running commands. Clean separation: terminal for mutations, panel for observation. Minimal new complexity — no forms, no validation, no save logic. |
| **Against** | Split context: you open the panel to see state, switch to terminal to change it, switch back to verify. Not ideal for workflows that involve lots of edits. |

**Best fit for:** a workflow where you batch-import data (via `solid-import` or persona/contact add commands) and want a dashboard to confirm what's in the store.

---

## Proposal C: Social Entities as Virtual Files

**The premise:** model social entities as "virtual files" inside the existing file explorer. Personas, contacts, and groups appear as entries under a `/social/` virtual directory. Selecting one opens it in the right panel using the MIME handler system — the same mechanism used for markdown and text files.

### What it looks like

```
┌─ Files ─────────────┬─ Detail ───────────────────────────────────┐
│ ▾ /                 │  MIME: application/x-devalbo-contact        │
│   ▾ social/         │                                             │
│     ▾ personas/     │  ┌─ Contact ───────────────────────────┐   │
│         alice       │  │ Name:   Alice Liddell                │   │
│         bob         │  │ Email:  alice@example.com            │   │
│     ▾ contacts/     │  │ Phone:  +1-555-1234                  │   │
│         alice       │  │ Groups: Avengers, Staff              │   │
│         bob         │  └─────────────────────────────────────┘   │
│         stark-ind   │                                             │
│     ▾ groups/       │                                             │
│         avengers    │                                             │
│         staff       │                                             │
│   ▾ files/          │                                             │
│     README.md       │                                             │
└─────────────────────┴────────────────────────────────────────────┘
```

Social entities appear alongside real files. Custom MIME types (`application/x-devalbo-persona`, `application/x-devalbo-contact`, `application/x-devalbo-group`) get registered handlers that render the entity detail view.

### What's new

- **Virtual filesystem adapter** — a read layer that makes store rows look like file entries. Needs to fit into the existing `listDirectory`/`buildTree` abstraction.
- **New MIME handlers** — registered at startup, one per entity type, rendering entity detail views.
- No new tabs.

### Tradeoffs

| | |
|---|---|
| **For** | No new tabs or navigation paradigms — social entities fit into existing mental model. Leverages the MIME handler registry machinery that's already there. |
| **Against** | Forced metaphor: people aren't files. Virtual filesystem layer is new complexity. Mixed real and virtual entries in one tree is potentially confusing. File explorer was designed for filesystem paths; routing store reads through it adds an abstraction seam. Mutations (creating a persona) don't map cleanly to "create file". |

**Best fit for:** if the filesystem metaphor is central to the product's identity and you want everything to feel like it lives in a filesystem.

---

## Proposal D: Dedicated Social Management Tab (CRM-Style)

**The premise:** add a full-featured `People` tab with its own multi-panel layout — entity type sidebar, searchable list, detail panel with forms. Social data is managed here, not through the terminal. Commands remain available for power users and scripting.

### What it looks like

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Terminal  |  File Explorer  |  People                                  │
├──────────────┬────────────────────────┬──────────────────────────────── │
│  Personas    │  Search: [          ]  │  Alice Liddell                   │
│  Contacts    │  ─────────────────────│  ────────────────────────────    │
│  Groups      │  Alice Liddell    ●   │  Handle:  @alice                 │
│              │  Bob the Builder      │  Email:   alice@example.com      │
│              │  Carol Danvers        │  Phone:   +1-555-1234            │
│              │                       │  Avatar:  https://...            │
│              │  [+ Add Contact]      │                                  │
│              │                       │  Groups                          │
│              │                       │  Avengers (member)               │
│              │                       │  Staff (lead)                    │
│              │                       │                                  │
│              │                       │  [Edit]  [Delete]                │
└──────────────┴────────────────────────┴──────────────────────────────── │
```

Three-column layout: entity type selector | searchable list | detail + edit panel. Inline form editing with save/cancel. Entity creation via a "+" button that opens a form.

### What's new

- `SocialManager` top-level component with three-column CSS grid.
- `EntityTypeNav` sidebar (Personas / Contacts / Groups).
- `EntityList` with search input and reactive store subscription.
- `EntityDetail` panel — read view + inline edit form with controlled inputs.
- Form validation uses existing Zod schemas from `@devalbo/shared`.
- Mutations call existing accessor functions from `@devalbo/state` directly (no command parsing needed — the store operations are already tested).
- New tab registered in `App.tsx` for both web and desktop.

### Tradeoffs

| | |
|---|---|
| **For** | Best UX for actually managing people. No command knowledge required. Inline editing is intuitive. TinyBase subscriptions mean list updates live as you save. Zod + accessor pattern is already established — forms validate the same way commands do. |
| **Against** | Most implementation surface. Forms need design. Inline editing duplicates some logic that commands already handle. Requires deciding whether forms are the canonical mutation path (vs. commands). |

**Best fit for:** a product positioning where social/contact management is a primary use case, not a secondary power-user feature.

---

## Comparison Summary

| | New Surface | Mutations | Reactivity | Effort |
|---|---|---|---|---|
| **A: Shell-first** | none (richer command output) | terminal | scroll-away | low |
| **B: Reactive panel** | People tab (read-only) | terminal | live panel | medium |
| **C: Virtual files** | inside FileExplorer | terminal | via file select | medium-high |
| **D: CRM tab** | People tab (full CRUD) | form UI | live list + detail | high |

---

## Recommended Combinations

These proposals aren't fully mutually exclusive. Likely pairings:

- **A + B** — rich command output (cheap, immediate value) plus a read-only people panel. Terminal stays canonical for mutations. Easy to extend B to D later.
- **A + D** — full CRM tab for everyday use, commands remain for power users and automation. Commands and UI both call the same accessor layer.
- **B evolving to D** — start read-only (B), add inline editing in a later plan iteration once the list/detail structure is established.

---

## Decision Needed

Pick one proposal (or combination) to develop into a full phased plan. Things to consider:

1. Is social management a primary daily-driver workflow, or a secondary/admin concern?
>> it's always in the background, so it should be accessible from everywhere. when the user is thinking about it, they should be able to focus on it, so it needs a first class UI, but that UI can be independent of other UI components. keep in mind, though, that certain elements like contact panels, group panels, might want to be available from other UI pages, elements, so make them possible to integrate without a lot of extra effort.

2. Should the terminal remain the canonical way to mutate social data, or should the UI own that?
>> the terminal should always be available to mutate data. the UI should also make that possible, but that's why we go through the same command structure and logic. everything should be (and stay reactive) to changes that could come from anywhere.

3. How much surface area is appropriate for this iteration vs. a future plan?
>> i'd like this to be a good reference implementation for future app ideas. that means the different levels of the spectrum to deal with the areas of Solid data concerns and the social components should all be addressed, but with the expectation that this is the not the final form and that making tweaks, changes, and redesigns should not be particularly onerous.

As for direction/next steps, let's go with A (shell first/prompt), then B (reactive read only panel), making sure that changes via A get reflected in B. Make a full plan to implement that here. Then, we should explore D (full CRM tab) - come up with a few different proposals based on prioritizing some different use cases. Some use cases to consider are:
* making it easy to share information with others via text strings
* making it easy to send a file to a group or contact
* making it possible to share a file link to a group or contact
* making it easy to import data FROM others via the text strings they send (e.g. Friend A sends me contact info for Friend B to add)
* making it easy to launch activities with a friend or for a group

Note that I might want to do Activity 1 with a certain persona (e.g. host or team captain) and Activity 2 with another (e.g. regular player or watcher/non-participant).

Also note that if there are Solid conventions/principles for doing these activities, we should acknowledge those and make extra effort to support them. If we can't be "Solid-compliant", call it out and propose ideas to update our system to make it possible.
