# Plan 3: Test Suite

## What

Comprehensive verification of the Navigator/Editor PoC in both terminal and browser environments. Follows the established testing patterns from the `demo/` project:

- **Unit tests**: Vitest with Arrange/Act/Assert, parameterized tests, full coverage
- **BDD tests**: Cucumber/Gherkin with separate terminal and browser step definitions
- **Test results**: Timestamped directories with `latest/` copies, HTML report generation
- **Both environments**: Same Gherkin features tested against terminal CLI (spawn) and browser (Playwright + xterm)

**Location**: `/Users/ajb/Projects/devalbo-core/demo-v2-claude/naveditor/tests/`

## Test Structure

```
naveditor/tests/
  unit/
    commands/
      index.test.ts                    # Command registry tests
      navigate.test.ts                 # Navigate command handler tests
      edit.test.ts                     # Edit command handler tests
    hooks/
      use-file-tree.test.ts            # useFileTree hook tests
      use-file-editor.test.ts          # useFileEditor hook tests
      use-file-tree-store.test.ts      # TinyBase integration tests
    lib/
      validate-args.test.ts            # Argument validation tests
      file-operations.test.ts          # File operation utility tests
    components/
      navigator/
        FileTree.test.tsx              # FileTree component tests
        FileTreeItem.test.tsx          # FileTreeItem component tests
        Navigator.test.tsx             # Navigator integration test
      editor/
        EditorContent.test.tsx         # EditorContent component tests
        Editor.test.tsx                # Editor integration test

  bdd/
    features/
      navigate.feature                 # Navigator Gherkin scenarios
      edit.feature                     # Editor Gherkin scenarios
      help.feature                     # Help command scenarios
    steps/
      terminal/
        navigate.steps.ts             # Terminal navigator step definitions
        edit.steps.ts                 # Terminal editor step definitions
        help.steps.ts                 # Terminal help step definitions
      browser/
        navigate.steps.ts             # Browser navigator step definitions
        edit.steps.ts                 # Browser editor step definitions
        help.steps.ts                 # Browser help step definitions

  fixtures/
    sample-project/                    # A small directory tree for navigator tests
      README.md
      src/
        index.ts
        utils.ts
      package.json
    sample-files/
      hello.txt                        # Simple text file for editor tests
      empty.txt                        # Empty file
      large.txt                        # Larger file (100+ lines)
      binary.bin                       # Binary file for edge case testing

  results/
    unit/
      latest/                          # Copy of most recent timestamped unit run
    bdd/
      terminal/
        latest/                        # Copy of most recent terminal BDD run
      browser/
        latest/                        # Copy of most recent browser BDD run

  scripts/
    copy-test-results.ts              # Copy timestamped results to latest/
    generate-html-report.ts           # Generate HTML from Vitest JSON
```

## Test Dependencies (in addition to PoC dependencies)

```json
{
  "devDependencies": {
    "@cucumber/cucumber": "^12.5.0",
    "@playwright/test": "^1.57.0",
    "@testing-library/react": "^16.x",
    "@vitest/coverage-v8": "^4.0.16",
    "@vitest/ui": "^4.0.16",
    "ink-testing-library": "^4.x",
    "playwright": "^1.57.0",
    "vitest": "^4.0.16"
  }
}
```

## Package.json Test Scripts

```json
{
  "scripts": {
    "postinstall": "playwright install chromium",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:unit": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && TEST_OUTPUT_DIR=tests/results/unit/$TIMESTAMP vitest run && tsx tests/scripts/generate-html-report.ts $TIMESTAMP && tsx tests/scripts/copy-test-results.ts unit $TIMESTAMP",
    "test:coverage": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && TEST_OUTPUT_DIR=tests/results/unit/$TIMESTAMP vitest --coverage && tsx tests/scripts/copy-test-results.ts unit $TIMESTAMP",
    "test:bdd": "pnpm test:bdd:terminal && pnpm test:bdd:browser",
    "test:bdd:terminal": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && pnpm build:cli && cucumber-js tests/bdd/features --import tests/bdd/steps/terminal/*.steps.ts --format progress --format json:tests/results/bdd/terminal/$TIMESTAMP/cucumber-report.json --format html:tests/results/bdd/terminal/$TIMESTAMP/cucumber-report.html && tsx tests/scripts/copy-test-results.ts bdd/terminal $TIMESTAMP",
    "test:bdd:browser": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && cucumber-js tests/bdd/features --import tests/bdd/steps/browser/*.steps.ts --format progress --format json:tests/results/bdd/browser/$TIMESTAMP/cucumber-report.json --format html:tests/results/bdd/browser/$TIMESTAMP/cucumber-report.html && tsx tests/scripts/copy-test-results.ts bdd/browser $TIMESTAMP",
    "test:all": "pnpm test:unit && pnpm test:bdd"
  }
}
```

## Gherkin Feature Files

### navigate.feature

```gherkin
Feature: File Navigator
  As a user of the naveditor CLI
  I want to navigate directory structures
  So that I can find and select files to work with

  Scenario: Navigate current directory
    When I run the navigate command without arguments
    Then I should see a list of files in the current directory
    And I should see "package.json" in the output

  Scenario: Navigate a specific directory
    When I run the navigate command with "src"
    Then I should see files in the "src" directory

  Scenario: Navigate a non-existent directory
    When I run the navigate command with "nonexistent"
    Then I should see an error message containing "not found"

  Scenario: Display help for navigate
    When I run the help command
    Then I should see "navigate"
    And I should see "Navigate a directory"
```

### edit.feature

```gherkin
Feature: File Editor
  As a user of the naveditor CLI
  I want to edit files
  So that I can view and modify file contents

  Scenario: View a file
    When I run the edit command with "tests/fixtures/sample-files/hello.txt"
    Then I should see the contents of "hello.txt"
    And I should see line numbers

  Scenario: Edit a non-existent file
    When I run the edit command with "nonexistent.txt"
    Then I should see an error message containing "not found"

  Scenario: Display help for edit
    When I run the help command
    Then I should see "edit"
    And I should see "Edit a file"
```

### help.feature

```gherkin
Feature: Help Command
  As a user of the naveditor CLI
  I want to see help information
  So that I can learn the available commands

  Scenario: Display help information
    When I run the help command
    Then I should see "Usage: naveditor"
    And I should see "Commands:"
    And I should see "navigate"
    And I should see "edit"

  Scenario: Help shows command descriptions
    When I run the help command
    Then I should see "Navigate a directory"
    And I should see "Edit a file"
```

## Test Commands

```bash
# Unit tests
pnpm test:unit              # Run unit tests with timestamped results

# BDD tests
pnpm test:bdd:terminal      # Terminal BDD (builds CLI first)
pnpm test:bdd:browser       # Browser BDD (requires dev server running)
pnpm test:bdd               # Both terminal and browser BDD

# All tests
pnpm test:all               # Unit + BDD

# Coverage
pnpm test:coverage          # Unit tests with V8 coverage

# Interactive
pnpm test:ui                # Vitest UI in browser
```

---

## TODO List

### Phase 1: Test Infrastructure
- [ ] Create `tests/` directory structure matching the layout above
- [ ] Create `vitest.config.ts` with:
  - Path aliases (`@/` -> `src/`)
  - Timestamped output via `TEST_OUTPUT_DIR` env var
  - V8 coverage configuration with exclusions
  - Reporters: default, json, junit
- [ ] Create `tsconfig.vitest.json` extending base with test includes
- [ ] Create `tsconfig.cucumber.json` for BDD step compilation
- [ ] Create `.cucumber.cjs` with terminal and browser profiles
- [ ] Port `tests/scripts/copy-test-results.ts` from demo (adjust paths for naveditor)
- [ ] Port `tests/scripts/generate-html-report.ts` from demo (adjust title/branding)
- [ ] Add all test-related npm scripts to `package.json`
- [ ] Verify `pnpm test:unit` runs (even with zero tests) and creates timestamped output dir

### Phase 2: Test Fixtures
- [ ] Create `tests/fixtures/sample-project/README.md` with sample content
- [ ] Create `tests/fixtures/sample-project/src/index.ts` with sample TypeScript
- [ ] Create `tests/fixtures/sample-project/src/utils.ts` with sample utility functions
- [ ] Create `tests/fixtures/sample-project/package.json` with minimal valid JSON
- [ ] Create `tests/fixtures/sample-files/hello.txt` with `Hello, World!` content
- [ ] Create `tests/fixtures/sample-files/empty.txt` as empty file
- [ ] Create `tests/fixtures/sample-files/large.txt` with 100+ lines of numbered content
- [ ] Create `tests/fixtures/sample-files/binary.bin` with non-UTF8 bytes

### Phase 3: Unit Tests -- Validation and File Operations
- [ ] Write `tests/unit/lib/validate-args.test.ts` for `validateNavigateArgs()`:
  - [ ] Test: valid path returns success
  - [ ] Test: empty args defaults to current directory (`.`)
  - [ ] Test: non-existent path returns MissingArgument error
- [ ] Write `tests/unit/lib/validate-args.test.ts` for `validateEditArgs()`:
  - [ ] Test: valid file path returns success
  - [ ] Test: empty args returns MissingArgument error
  - [ ] Test: directory path (not file) returns appropriate error
- [ ] Write `tests/unit/lib/file-operations.test.ts` using InMemoryDriver:
  - [ ] Test: read existing file returns content
  - [ ] Test: read non-existent file returns error
  - [ ] Test: write file and read back matches
  - [ ] Test: readdir returns correct entries

### Phase 4: Unit Tests -- Command Handlers
- [ ] Write `tests/unit/commands/index.test.ts` (following demo pattern):
  - [ ] Test: `navigate()` returns component without error
  - [ ] Test: `navigate('src')` with path argument returns component
  - [ ] Test: `edit('file.txt')` returns component without error
  - [ ] Test: `help()` returns component with command list text
- [ ] Write `tests/unit/commands/navigate.test.ts`:
  - [ ] Test: renders Navigator component for valid directory
  - [ ] Test: shows error for non-existent directory
  - [ ] Test: works with InMemoryDriver when injected
- [ ] Write `tests/unit/commands/edit.test.ts`:
  - [ ] Test: renders Editor component for valid file
  - [ ] Test: shows error for non-existent file
  - [ ] Test: works with InMemoryDriver when injected

### Phase 5: Unit Tests -- Hooks
- [ ] Write `tests/unit/hooks/use-file-tree.test.ts`:
  - [ ] Test: loads entries on mount with fixture directory
  - [ ] Test: expand directory adds child entries
  - [ ] Test: collapse directory removes child entries
  - [ ] Test: select updates selectedPath
  - [ ] Test: refresh re-reads from driver
  - [ ] Use parameterized tests for different directory structures
- [ ] Write `tests/unit/hooks/use-file-editor.test.ts`:
  - [ ] Test: loads file content on mount
  - [ ] Test: setContent updates content and marks dirty
  - [ ] Test: save writes to driver and clears dirty flag
  - [ ] Test: revert restores original content from driver
  - [ ] Test: error state for non-existent file
- [ ] Write `tests/unit/hooks/use-file-tree-store.test.ts`:
  - [ ] Test: filesystem entries populate TinyBase store
  - [ ] Test: store updates trigger component re-render
  - [ ] Test: watcher event updates store reactively

### Phase 6: Unit Tests -- Components
- [ ] Write `tests/unit/components/navigator/FileTreeItem.test.tsx`:
  - [ ] Test: renders file name text
  - [ ] Test: shows directory icon for directories
  - [ ] Test: shows file icon for files
  - [ ] Test: shows size when provided
- [ ] Write `tests/unit/components/navigator/FileTree.test.tsx`:
  - [ ] Test: renders list of file entries
  - [ ] Test: renders nested directory structure
  - [ ] Test: empty directory shows empty state message
- [ ] Write `tests/unit/components/navigator/Navigator.test.tsx`:
  - [ ] Test: renders FileTree and NavigatorStatusBar
  - [ ] Test: status bar shows current path
- [ ] Write `tests/unit/components/editor/EditorContent.test.tsx`:
  - [ ] Test: renders file content text
  - [ ] Test: renders placeholder for empty content
- [ ] Write `tests/unit/components/editor/Editor.test.tsx`:
  - [ ] Test: renders content area and status bar
  - [ ] Test: status bar shows filename and dirty indicator

### Phase 7: BDD -- Gherkin Feature Files
- [ ] Write `tests/bdd/features/navigate.feature`:
  - [ ] Scenario: Navigate current directory (no args)
  - [ ] Scenario: Navigate a specific directory
  - [ ] Scenario: Navigate a non-existent directory shows error
  - [ ] Scenario: Display help shows navigate command
- [ ] Write `tests/bdd/features/edit.feature`:
  - [ ] Scenario: View a text file shows contents
  - [ ] Scenario: Edit non-existent file shows error
  - [ ] Scenario: Display help shows edit command
- [ ] Write `tests/bdd/features/help.feature`:
  - [ ] Scenario: Help command shows all available commands
  - [ ] Scenario: Help shows usage information

### Phase 8: BDD -- Terminal Step Definitions
- [ ] Write `tests/bdd/steps/terminal/navigate.steps.ts`:
  - [ ] Implement `runCommand()` helper (spawn `node dist/cli.js`, capture stdout/stderr)
  - [ ] Step: "When I run the navigate command without arguments"
  - [ ] Step: "When I run the navigate command with {string}"
  - [ ] Step: "Then I should see a list of files"
  - [ ] Step: "Then I should see an error message containing {string}"
  - [ ] Strip ANSI codes from output before assertions
- [ ] Write `tests/bdd/steps/terminal/edit.steps.ts`:
  - [ ] Step: "When I run the edit command with {string}"
  - [ ] Step: "Then I should see the contents of {string}"
  - [ ] Step: "Then I should see line numbers"
- [ ] Write `tests/bdd/steps/terminal/help.steps.ts`:
  - [ ] Step: "When I run the help command"
  - [ ] Step: "Then I should see {string}"

### Phase 9: BDD -- Browser Step Definitions
- [ ] Write `tests/bdd/steps/browser/navigate.steps.ts`:
  - [ ] Implement `typeCommand()` helper (Playwright, xterm-screen selectors)
  - [ ] `BeforeAll`: launch chromium, create context
  - [ ] `Before`: create new page, navigate to `localhost:3000`, wait for `.xterm`
  - [ ] `AfterAll`: close browser
  - [ ] Step: "When I run the navigate command without arguments"
  - [ ] Step: "When I run the navigate command with {string}"
  - [ ] Step: "Then I should see a list of files"
  - [ ] Step: "Then I should see an error message containing {string}"
- [ ] Write `tests/bdd/steps/browser/edit.steps.ts`:
  - [ ] Step: "When I run the edit command with {string}"
  - [ ] Step: "Then I should see the contents of {string}"
  - [ ] Step: "Then I should see line numbers"
- [ ] Write `tests/bdd/steps/browser/help.steps.ts`:
  - [ ] Step: "When I run the help command"
  - [ ] Step: "Then I should see {string}"

### Phase 10: Test Reporting and Verification
- [ ] Verify `pnpm test:unit` produces timestamped JSON and JUnit output
- [ ] Verify `generate-html-report.ts` creates readable HTML from unit test results
- [ ] Verify `copy-test-results.ts` copies timestamped results to `latest/`
- [ ] Verify `pnpm test:bdd:terminal` produces timestamped cucumber JSON + HTML reports
- [ ] Verify `pnpm test:bdd:browser` produces timestamped cucumber JSON + HTML reports
- [ ] Verify `pnpm test:all` runs unit + terminal BDD + browser BDD in sequence
- [ ] Verify `latest/` directories always contain the most recent run
- [ ] Verify `pnpm test:coverage` produces V8 coverage reports (text, lcov, HTML)
- [ ] Add test result directories to `.gitignore`
- [ ] Document test running instructions in README.md

---

## Cross-Plan Dependencies

This test suite depends on:
- **Plan 1** (Library): `InMemoryDriver` for unit test injection, `@devalbo/state` for store tests
- **Plan 2** (PoC): All components, commands, and hooks under test must exist

### Parallelization Opportunities
- Phase 1-2 (infrastructure + fixtures) can begin as soon as Plan 2 Phase 1 (scaffolding) is done
- Phase 7 (Gherkin features) can be written as soon as command names are known (Plan 2 Phase 2)
- Phases 3-6 (unit tests) require their corresponding Plan 2 implementations
- Phases 8-9 (BDD steps) require Plan 2 Phase 7 (shell integration) to be complete
