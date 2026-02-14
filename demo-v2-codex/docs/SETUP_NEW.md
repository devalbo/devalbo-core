# Project Setup Guide

This guide provides explicit steps for setting up a new TypeScript project using npm, following the devalbo-core principles. Replace `$PROJECT_NAME` with your actual project name throughout this guide.

This guide reflects the actual implementation in the `/demo` project, which demonstrates a dual-mode CLI application that works in both terminal and browser environments.

## Prerequisites

Before starting, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

Verify your installation:
```bash
node --version
npm --version
```


## Setup Project

### Initialize the Project

Create a new directory and initialize an npm project:

```bash
mkdir $PROJECT_NAME
cd $PROJECT_NAME
npm init -y
```

Update `package.json` to use ES modules:
```json
{
  "type": "module"
}
```


### Install Core Dependencies

Install TypeScript, Vite, and React:

```bash
npm install --save-dev typescript @types/node
npm install --save-dev vite @vitejs/plugin-react
npm install react
npm install --save-dev @types/react
```

#### TypeScript
```bash
npm install --save-dev typescript @types/node
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Key settings:**
- `moduleResolution: "bundler"` - Required for proper module resolution with Vite
- `jsx: "react-jsx"` - Automatic JSX runtime (no need to import React)
- `paths` - Path aliases for cleaner imports



#### Vite

``` bash
npm install --save-dev vite
npm install react
npm install --save-dev @types/react
```

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isNode = mode === 'node';

  if (isNode) {
    // Node.js CLI build
    return {
      esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react'
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/cli-node.tsx'),
          name: '$PROJECT_NAME',
          fileName: () => 'cli.js',
          formats: ['es']
        },
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
          external: ['commander', 'ink', 'react', 'react/jsx-runtime']
        }
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      }
    };
  }

  // Web browser build - CRITICAL: ink → ink-web alias
  return {
    root: './',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    server: {
      port: 3000,
      open: true,
      host: true
    },
    plugins: [react(), nodePolyfills()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'ink': 'ink-web'  // KEY: This makes Ink components work in browser
      }
    }
  };
});
```

**Critical configuration:**
- `formats: ['es']` - Use ES modules for consistency
- `ink: 'ink-web'` alias - Transparently redirects Ink imports to ink-web in browser builds
- `nodePolyfills()` - Required for ink-web to work in browser (Buffer, process, etc.)

#### React

Install TypeScript, Vite, and React:

```bash
npm install react
npm install --save-dev @types/react
npm install --save-dev @vitejs/plugin-react
```


### Create Project Structure

```bash
mkdir -p src/commands
mkdir -p src/components/ui
mkdir -p src/web
mkdir -p public
mkdir -p tests/unit
mkdir -p tests/bdd/features
mkdir -p tests/bdd/steps/terminal
mkdir -p tests/bdd/steps/browser
mkdir -p tests/scripts
```

**Note:** All test-related files are organized under the `tests/` directory:
- `tests/unit/` - Unit tests mirroring src structure
- `tests/bdd/features/` - Gherkin feature files
- `tests/bdd/steps/` - BDD step definitions
- `tests/scripts/` - Test helper scripts
- `tests/results/` - Test outputs (generated automatically)

### Set up Testing
#### Install/Configure Vitest

```bash
npm install --save-dev vitest @vitest/ui
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/results.json`,
      junit: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/junit.xml`
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: `./${process.env.TEST_OUTPUT_DIR || 'tests/results/unit/latest'}/coverage`,
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```

**Note:** All test-related files are consolidated under `tests/`:
- Unit tests in `tests/unit/` mirror the `src/` directory structure
- Test results output to `tests/results/`
- For example: `src/commands/index.tsx` → `tests/unit/commands/index.test.tsx`


#### Install Behavior Testing Framework

Install Cucumber for BDD testing and Playwright for browser automation:

```bash
# Install Cucumber and Playwright
npm install --save-dev @cucumber/cucumber
npm install --save-dev @playwright/test playwright

# Install tsx for running TypeScript test steps
npm install --save-dev tsx

# Install Playwright browsers
npx playwright install chromium
```

Add a postinstall script to `package.json` to ensure browsers are installed:

```json
{
  "scripts": {
    "postinstall": "playwright install chromium"
  }
}
```

BDD test directories are created as part of the project structure above (see `tests/bdd/`).

Create a feature file `tests/bdd/features/greet.feature`:

```gherkin
Feature: Greet Command
  As a user
  I want to greet someone
  So that I can be friendly

  Scenario: Greet without arguments
    When I run the greet command without arguments
    Then I should see "Hello, World!"

  Scenario: Greet with a name
    When I run the greet command with "Alice"
    Then I should see "Hello, Alice!"

  Scenario: View help
    When I run the help command
    Then I should see "Available Commands"
```

Create terminal step definitions `tests/bdd/steps/terminal/greet.steps.ts`:

```typescript
import { When, Then, Before, After } from '@cucumber/cucumber';
import { execSync } from 'child_process';
import { strict as assert } from 'assert';

interface World {
  output: string;
  error?: string;
}

let world: World = { output: '' };

Before(function () {
  world = { output: '' };
});

After(function () {
  world = { output: '' };
});

When('I run the greet command without arguments', function () {
  try {
    world.output = execSync('node dist/cli.js greet', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error: any) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

When('I run the greet command with {string}', function (name: string) {
  try {
    world.output = execSync(`node dist/cli.js greet ${name}`, {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error: any) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

When('I run the help command', function () {
  try {
    world.output = execSync('node dist/cli.js help', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  } catch (error: any) {
    world.error = error.message;
    world.output = error.stdout || '';
  }
});

Then('I should see {string}', function (expectedText: string) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
```

Create browser step definitions `tests/bdd/steps/browser/greet.steps.ts`:

```typescript
import { When, Then, Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { strict as assert } from 'assert';

interface World {
  output: string;
  page?: Page;
}

let world: World = { output: '' };
let sharedBrowser: Browser | null = null;
let sharedContext: BrowserContext | null = null;
let oldPage: Page | null = null;

setDefaultTimeout(30000);

BeforeAll(async function () {
  sharedBrowser = await chromium.launch({ headless: false });
  sharedContext = await sharedBrowser.newContext();
});

AfterAll(async function () {
  if (sharedContext) await sharedContext.close();
  if (sharedBrowser) await sharedBrowser.close();
});

Before(async function () {
  world = { output: '' };
  const newPage = await sharedContext.newPage();

  if (oldPage) {
    await oldPage.close();
  }

  world.page = newPage;
  oldPage = newPage;

  await world.page.goto('http://localhost:3000');
  await world.page.waitForSelector('.xterm', { timeout: 10000 });
});

After(async function () {
  // Don't close the page here - will be closed before next test
});

async function typeCommand(command: string) {
  if (!world.page) throw new Error('Page not initialized');

  const initialOutput = await world.page.evaluate(() => {
    const terminal = document.querySelector('#cli-terminal .xterm-screen');
    return terminal ? (terminal.innerText || terminal.textContent || '') : '';
  });

  await world.page.click('#cli-terminal');
  await world.page.waitForTimeout(300);

  await world.page.keyboard.type(command, { delay: 50 });
  await world.page.keyboard.press('Enter');

  // Wait for output to change
  let attempts = 0;
  let outputChanged = false;
  while (attempts < 20 && !outputChanged) {
    await world.page.waitForTimeout(200);
    const currentOutput = await world.page.evaluate(() => {
      const terminal = document.querySelector('#cli-terminal .xterm-screen');
      return terminal ? (terminal.innerText || terminal.textContent || '') : '';
    });
    outputChanged = currentOutput !== initialOutput && currentOutput.includes(command);
    attempts++;
  }

  world.output = await world.page.evaluate(() => {
    const terminal = document.querySelector('#cli-terminal .xterm-screen');
    if (!terminal) return '';
    return terminal.innerText || terminal.textContent || '';
  });
}

When('I run the greet command without arguments', async function () {
  await typeCommand('greet');
});

When('I run the greet command with {string}', async function (name: string) {
  await typeCommand(`greet ${name}`);
});

When('I run the help command', async function () {
  await typeCommand('help');
});

Then('I should see {string}', function (expectedText: string) {
  assert.ok(
    world.output.includes(expectedText),
    `Expected output to contain "${expectedText}", but got:\n${world.output}`
  );
});
```

**Note**: All test step files are written in TypeScript. Cucumber will execute them using `tsx` when imported with the `--import` flag.

#### Configure test runners and outputs

Update vitest.config.ts to support timestamped output directories:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: `./${process.env.TEST_OUTPUT_DIR || 'test-results/unit/latest'}/results.json`,
      junit: `./${process.env.TEST_OUTPUT_DIR || 'test-results/unit/latest'}/junit.xml`
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: `./${process.env.TEST_OUTPUT_DIR || 'test-results/unit/latest'}/coverage`,
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
```

Create a script to copy timestamped results to `latest` folder. Create `tests/scripts/copy-test-results.ts`:

```typescript
#!/usr/bin/env node
import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const testsRoot = join(projectRoot, 'tests');

const [testType, timestamp] = process.argv.slice(2);

if (!testType || !timestamp) {
  console.error('Usage: copy-test-results.ts <test-type> <timestamp>');
  process.exit(1);
}

const sourceDir = join(testsRoot, 'results', testType, timestamp);
const latestDir = join(testsRoot, 'results', testType, 'latest');

try {
  mkdirSync(sourceDir, { recursive: true });
  cpSync(sourceDir, latestDir, { recursive: true, force: true });
  console.log(`Copied ${sourceDir} to ${latestDir}`);
} catch (error) {
  console.error('Error copying test results:', error);
  process.exit(1);
}
```

Create a script to generate HTML reports from Vitest JSON output. Create `tests/scripts/generate-html-report.ts`:

```typescript
#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const testsRoot = join(projectRoot, 'tests');

const timestampArg = process.argv[2] || 'latest';
const testDir = join(testsRoot, 'results', 'unit', timestampArg);
const jsonPath = join(testDir, 'results.json');

const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

const stats = {
  passed: data.numPassedTests || 0,
  failed: data.numFailedTests || 0,
  skipped: data.numPendingTests || 0,
  total: data.numTotalTests || 0
};

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Test Results - ${timestampArg}</title>
  <style>
    body { font-family: system-ui; margin: 20px; background: #f5f5f5; }
    .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .pass { color: green; }
    .fail { color: red; }
    .skip { color: orange; }
  </style>
</head>
<body>
  <h1>Test Results</h1>
  <div class="summary">
    <p>Total: ${stats.total}</p>
    <p class="pass">Passed: ${stats.passed}</p>
    <p class="fail">Failed: ${stats.failed}</p>
    <p class="skip">Skipped: ${stats.skipped}</p>
  </div>
</body>
</html>`;

const outputPath = join(testDir, 'report.html');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log('HTML report written to:', outputPath);
```

Update package.json scripts to generate timestamped test results:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && TEST_OUTPUT_DIR=tests/results/unit/$TIMESTAMP vitest run && tsx tests/scripts/generate-html-report.ts $TIMESTAMP && tsx tests/scripts/copy-test-results.ts unit $TIMESTAMP",
    "test:bdd": "npm run test:bdd:terminal && npm run test:bdd:browser",
    "test:bdd:terminal": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && npm run build:cli && cucumber-js tests/bdd/features --import tests/bdd/steps/terminal/greet.steps.ts --format progress --format json:tests/results/bdd/terminal/$TIMESTAMP/cucumber-report.json --format html:tests/results/bdd/terminal/$TIMESTAMP/cucumber-report.html && tsx tests/scripts/copy-test-results.ts bdd/terminal $TIMESTAMP",
    "test:bdd:browser": "TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S) && cucumber-js tests/bdd/features --import tests/bdd/steps/browser/greet.steps.ts --format progress --format json:tests/results/bdd/browser/$TIMESTAMP/cucumber-report.json --format html:tests/results/bdd/browser/$TIMESTAMP/cucumber-report.html && tsx tests/scripts/copy-test-results.ts bdd/browser $TIMESTAMP",
    "test:all": "npm run test && npm run test:bdd"
  }
}
```

**Test results structure (all under `tests/` directory):**
- `tests/results/unit/{timestamp}/` - Timestamped unit test results
- `tests/results/unit/latest/` - Latest unit test results (copy of most recent)
- `tests/results/bdd/terminal/{timestamp}/` - Timestamped terminal BDD results
- `tests/results/bdd/terminal/latest/` - Latest terminal BDD results
- `tests/results/bdd/browser/{timestamp}/` - Timestamped browser BDD results
- `tests/results/bdd/browser/latest/` - Latest browser BDD results


### Install UI Libraries

#### Terminal UI (Ink)

```bash
npm install --save-dev ink
```

**Note:** Ink is a dev dependency because it's only used for the terminal build.

#### Browser UI (ink-web)

##### Installation
Follow the installation guide at https://www.ink-web.dev/docs/installation/vite

```bash
# Install ink-web
npm install ink-web

# Install xterm for terminal emulation
npm install xterm
npm install --save-dev @types/xterm

# Install Node.js polyfills for browser compatibility
npm install --save-dev vite-plugin-node-polyfills

# Install shadcn for ink-web components
npm install --save-dev @ink-web/shadcn-cli

# Initialize shadcn
npx shadcn@latest init

# Install Tailwind CSS (required for shadcn)
npm install tailwindcss @tailwindcss/postcss

# Install ink-web components
npx shadcn@latest add text-input
npx shadcn@latest add spinner
```

##### Configure Tailwind CSS

Create `tailwind.config.js`:

```javascript
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Create `postcss.config.js`:

```javascript
import tailwindcss from '@tailwindcss/postcss';

export default {
  plugins: [tailwindcss()],
};
```

Create `src/index.css`:

```css
@import 'tailwindcss';
```



#### Browser Dev Console CLI Object

TODO: add some description about adding cli object for user to interact with in dev console here.


### Install CLI Framework

```bash
# Commander for command parsing
npm install commander

# Zod for validation (optional but recommended)
npm install zod
```

**Note:** The demo originally used `@clack/prompts` but replaced it with Ink-based interactive prompts for a unified experience across terminal and browser.


### Update `package.json` Scripts

Add the following scripts to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "build": "vite build && vite build --mode node",
    "build:web": "vite build",
    "build:cli": "vite build --mode node",
    "dev": "vite",
    "dev:host": "vite --host",
    "preview": "vite preview",
    "cli": "node dist/cli.js",
    "type-check": "tsc --noEmit"
  },
  "bin": {
    "$PROJECT_NAME": "./dist/cli.js"
  }
}
```


### Setup Shared Commands Registry

#### Create Commands
Create `src/commands/index.tsx` - the single source of truth for all commands:

```typescript
import React from 'react';
import { Box, Text } from 'ink';

export interface CommandResult {
  component: React.ReactNode;
  error?: string;
}

export interface CommandOptions {
  interactive?: boolean;
  onComplete?: () => void;
}

export const commands = {
  greet: (args: string[], options?: CommandOptions): CommandResult => {
    const name = args.join(' ') || 'World';
    return {
      component: (
        <Box flexDirection="column" padding={1}>
          <Text color="green">Hello, {name}!</Text>
        </Box>
      )
    };
  },

  help: (args?: string[], options?: CommandOptions): CommandResult => {
    return {
      component: (
        <Box flexDirection="column">
          <Text bold color="yellow">Available Commands:</Text>
          <Text>  greet [name]  - Greet someone (default: World)</Text>
          <Text>  help          - Show this help message</Text>
        </Box>
      )
    };
  }
};

export type CommandName = keyof typeof commands;
```

#### Terminal CLI

Create `src/cli.tsx`:

```typescript
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { commands } from './commands';

export async function setupCLI(argv?: string[]) {
  const program = new Command();

  program
    .name('$PROJECT_NAME')
    .description('CLI application following devalbo-core principles')
    .version('1.0.0');

  program
    .command('greet')
    .description('Greet someone')
    .argument('[name...]', 'Name to greet', [])
    .action(async (nameArgs: string[]) => {
      const result = commands.greet(nameArgs);
      render(result.component);
    });

  await program.parseAsync(argv || process.argv);
  return program;
}
```

Create `src/cli-node.tsx`:

```typescript
#!/usr/bin/env node
import { setupCLI } from './cli.js';

setupCLI().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
```

#### Browser Interactive Shell

Create `src/components/InteractiveShell.tsx`:

```typescript
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from './ui/text-input';
import { commands, CommandName, CommandOptions } from '../commands';

interface CommandOutput {
  command: string;
  timestamp: Date;
  component?: React.ReactNode;
  error?: string;
}

export const InteractiveShell: React.FC = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to $PROJECT_NAME',
      timestamp: new Date(),
      component: <Text color="cyan">Type "help" to see available commands</Text>
    }
  ]);

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    const [commandName, ...args] = trimmedCmd.split(' ');

    let output: CommandOutput = {
      command: `$ ${trimmedCmd}`,
      timestamp: new Date()
    };

    if (commandName === 'clear') {
      setHistory([{
        command: 'Terminal cleared',
        timestamp: new Date(),
        component: <Text dimColor>Type "help" for available commands</Text>
      }]);
      setInput('');
      return;
    }

    if (!commandName) return;

    const command = commands[commandName.toLowerCase() as CommandName];
    if (command) {
      const result = command(args);
      output.component = result.component;
      output.error = result.error;
    } else {
      output.error = `Command not found: ${commandName}`;
      output.component = <Text color="red">{output.error}</Text>;
    }

    setHistory([...history, output]);
    setInput('');
  };

  const handleSubmit = () => {
    if (input.trim()) {
      executeCommand(input);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        {history.map((item, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text dimColor>{item.command}</Text>
            {item.component && <Box marginLeft={2}>{item.component}</Box>}
          </Box>
        ))}
      </Box>

      <Box>
        <Text color="green">$ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a command..."
        />
      </Box>
    </Box>
  );
};
```

#### Browser App

##### React

Create `src/web/App.tsx`:

```typescript
import React from 'react';
import { InkTerminalBox } from 'ink-web';
import { InteractiveShell } from '../components/InteractiveShell';

export const App: React.FC = () => {
  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '20px' }}>
      <h1>$PROJECT_NAME - Interactive Terminal</h1>

      <div style={{
        border: '2px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#1e1e1e',
        maxWidth: '900px'
      }}>
        <InkTerminalBox rows={25} focus>
          <InteractiveShell />
        </InkTerminalBox>
      </div>
    </div>
  );
};
```

Create `src/web/console-helpers.ts`:

```typescript
import { ReactNode } from 'react';
import { commands, CommandName, CommandOptions } from '../commands';

function extractText(node: ReactNode): string {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as any).props;
    if (props && props.children) {
      return extractText(props.children);
    }
  }
  return '';
}

function exec(commandName: string, args: string[] = [], options?: CommandOptions) {
  const command = commands[commandName as CommandName];
  if (!command) {
    console.error(`❌ Command not found: ${commandName}`);
    return null;
  }

  const result = command(args, options);
  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    return result;
  }

  const text = extractText(result.component);
  if (text) console.log(`\n${text}\n`);
  return result;
}

export const cli = {
  ...commands,
  exec,
  greet: (name?: string) => exec('greet', name ? [name] : []),
  help: () => exec('help'),
};
```

Create `src/web/index.tsx`:

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import 'ink-web/css';
import 'xterm/css/xterm.css';
import { App } from './App';
import { cli } from './console-helpers';

// Expose CLI to browser dev console
declare global {
  interface Window {
    cli: typeof cli;
  }
}

window.cli = cli;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
```

##### HTML Entry Point

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>$PROJECT_NAME</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/web/index.tsx"></script>
  </body>
</html>
```

## Step 12: Create Tests

Create `tests/unit/commands/index.test.tsx` (mirroring the `src/commands/index.tsx` structure):

```typescript
import { describe, it, expect } from 'vitest';
import { commands } from '@/commands/index';

describe('commands', () => {
  describe('greet', () => {
    it('should greet with default name', () => {
      // Arrange & Act
      const result = commands.greet([]);

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should greet with specific name', () => {
      // Arrange & Act
      const result = commands.greet(['Alice']);

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('help', () => {
    it('should return help component', () => {
      // Arrange & Act
      const result = commands.help();

      // Assert
      expect(result.component).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});
```

**Test Organization:**
- Unit tests live in `tests/unit/` directory
- Test file structure mirrors `src/` directory structure
- Import paths use the `@/` alias (e.g., `import { commands } from '@/commands/index'`)
- Follow Arrange/Act/Assert pattern for clarity

## Step 13: Create .gitignore

```
node_modules/
dist/
coverage/
tests/results/
*.log
.DS_Store
.env
.env.local
```

## Step 14: Verify Setup

```bash
# Type check
npm run type-check

# Run tests
npm test

# Build both web and CLI
npm run build

# Test the CLI
node dist/cli.js greet Alice

# Start dev server
npm run dev
# Open http://localhost:3000
# Try in browser console: cli.greet('World')
```

## Key Architecture Decisions

### Unified Command System
- **Single source of truth**: `src/commands/index.tsx` defines all commands
- **Works everywhere**: Same commands run in terminal, browser shell, and browser console
- **Type-safe**: Full TypeScript support across all environments

### Dual-Mode Rendering
- **Terminal**: Ink renders React components to terminal using Node.js
- **Browser**: ink-web renders same Ink components via Vite alias (`ink → ink-web`)
- **No duplication**: Write components once, run everywhere

### Browser Console Access
- **Global `cli` object**: Access commands via `window.cli` or just `cli`
- **Helper methods**: Convenient `cli.greet('name')` syntax
- **Text extraction**: Console output shows readable text, not React objects

## Common Issues

### Module Resolution Errors
- **Solution**: Use `moduleResolution: "bundler"` in tsconfig.json

### Missing Terminal in Browser
- **Solution**: Import required CSS: `import 'ink-web/css'` and `import 'xterm/css/xterm.css'`

### Buffer/Process Not Defined
- **Solution**: Install and configure `vite-plugin-node-polyfills`

### Ink Components Not Working in Browser
- **Solution**: Ensure Vite config has `ink: 'ink-web'` alias for browser builds

## Next Steps

1. Review [PRINCIPLES.md](../PRINCIPLES.md)
2. Explore the `/demo` project for a complete working example
3. Add more commands to `src/commands/index.tsx`
4. Create interactive prompts using Ink components
5. Deploy your dual-mode CLI application

## Reference Implementation

See `/demo` for a complete working example following this guide.
