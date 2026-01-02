# Project Setup Guide

This guide provides explicit steps for setting up a new TypeScript project using npm, following the devalbo-core principles. Replace `$PROJECT_NAME` with your actual project name throughout this guide.

## Prerequisites

Before starting, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

Verify your installation:
```bash
node --version
npm --version
```

## Step 1: Initialize the Project

Create a new directory and initialize an npm project:

```bash
mkdir $PROJECT_NAME
cd $PROJECT_NAME
npm init -y
```

## Step 2: Install TypeScript and Core Dependencies

Install TypeScript and essential development dependencies:

```bash
npm install --save-dev typescript @types/node
npm install --save-dev vite
```

Make sure JSX/TSX is supported as well.

## Step 3: Install Preferred Libraries

Based on devalbo-core principles, install the recommended libraries for the following phases:

### Type System and Validation

```bash
# Zod for runtime type validation and serialization
npm install zod
```

### User Interaction Setup with React Basics

**Important:** `ink-web` is currently experimental and not available as a stable npm package (see [ink-web.dev](https://ink-web.dev)).

The recommended approach is to:
- Use **Ink** for terminal UI (React components in the terminal)
- Use **standard React** for browser UI (React components in the browser)
- Share business logic between both environments

See the `/demo` project for a complete working example following this pattern.

#### Terminal

```bash
# Ink - React for terminal/CLI interfaces
npm install ink react
npm install --save-dev @types/react
```

**Setup:** Ink allows you to build terminal UIs using React components. Create terminal components using React and Ink's built-in components.

#### Web Browser (as web page)

Install Ink Web as described here: https://www.ink-web.dev/docs/installation/vite
Install Ink Web components as described here: https://www.ink-web.dev/docs/components

```bash
# React for web browser interfaces
npm install react react-dom
npm install --save-dev @types/react @types/react-dom

# Web-Ink - Use Ink components in the browser (https://www.ink-web.dev/)
# Note: Check ink-web.dev for the latest package name and installation instructions
# npm install @ink-web/core @ink-web/react

# Tanstack Query for data fetching and state management
npm install @tanstack/react-query
```

**Setup:** 
- React DOM is used for rendering React components in the browser
- Web-Ink allows sharing Ink terminal components in browser environments
- Tanstack Query provides powerful data synchronization for React applications
- If using React, also install the Vite React plugin: `npm install --save-dev @vitejs/plugin-react` (see Step 5 for Vite configuration)


### Command Parser

The command parser must support the following environments:
* terminal
* web browser page
* web browser dev console/window object

It is critical that there only be a single configuration for the command parser. It has to be connected to the terminal and in-browser command line libraries, but once the command is entered and feedback is required from the user, there should be no distinction at the environment level!

**Option 1: yargs (recommended for simple use cases)**
```bash
# yargs - Command-line argument parser (works in both terminal and browser)
npm install yargs
npm install --save-dev @types/yargs
```

**Option 2: commander + clack (recommended for interactive CLIs)**
```bash
# commander - Command-line framework
npm install commander

# @clack/prompts - Beautiful prompts for interactive CLI
npm install @clack/prompts
```

**Setup:** Both yargs and commander can be used in both Node.js (with `process.argv`) and browser environments (with mock argv arrays). Clack provides interactive prompts for better user experience. See Step 8 for CLI setup that works in both environments.

### Persistence

The ideal persistence layer will work without modification in the following environments:
* terminal
* web browser

```bash
# Tinybase - Reactive data store that works in both Node.js and browser
npm install tinybase
# Optional: Additional Tinybase packages for specific features
# npm install @tinybase/persisters  # For persistence adapters
# npm install @tinybase/react  # For React bindings
```

**Setup:** Tinybase provides a reactive data store that works in both Node.js and browser environments. The core `tinybase` package includes the store functionality. Additional packages like `@tinybase/persisters` add persistence capabilities for both browser (IndexedDB, LocalStorage) and Node.js (file system) environments.

**Note:** Tinybase is under consideration. Alternative persistence options include:
- LocalStorage/SessionStorage (browser only)
- File system (Node.js only)
- IndexedDB (browser only)
- SQLite (via better-sqlite3 for Node.js, sql.js for browser)

### Sharing/Communication

The ideal sharing/communication layer will work without modification in the following environments:
* terminal
* web browser

```bash
# Peer-to-peer communication libraries (under consideration)
# Options to explore:
# - libp2p for peer-to-peer networking
# - WebRTC for browser-to-browser communication
# - WebSockets for client-server communication
# 
# Installation commands will be added once a specific library is chosen
```

**Note:** Sharing/communication libraries are under consideration. The choice depends on specific requirements for peer-to-peer vs. client-server architecture.

### Testing Framework

```bash
# Vitest for unit testing (recommended - integrates with Vite)
npm install --save-dev vitest @vitest/ui

# Alternative: Jest for unit testing
# npm install --save-dev jest @types/jest ts-jest

# BDD testing framework (under consideration)
# Options: Cucumber.js, Mocha with Chai, Vitest with custom matchers
# Installation commands will be added once a specific framework is chosen
```

## Step 4: Configure TypeScript

Create a `tsconfig.json` file in the project root:

```bash
npx tsc --init
```

Then update `tsconfig.json` with recommended settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Step 5: Configure Vite

Vite will be configured to support both web browser and Node.js CLI execution, allowing the same commands to run in both environments.

Create a `vite.config.ts` file in the project root:

```typescript
import { defineConfig } from 'vite';
// Uncomment if using React:
// import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isNode = mode === 'node';
  
  if (isNode) {
    // Node.js CLI build
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/cli-node.ts'),
          name: '$PROJECT_NAME',
          fileName: () => 'cli.js',
          formats: ['cjs']
        },
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
          external: ['yargs', 'yargs/helpers']
        }
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      }
    };
  }
  
  // Web browser build
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
    // Uncomment if using React:
    // plugins: [react()],
    plugins: [],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  };
});
```

If using React, also install the Vite React plugin:
```bash
npm install --save-dev @vitejs/plugin-react
```

### Create Web Browser Entry Point

Create an `index.html` file in the project root for web browser development:

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
    <script type="module" src="/src/web/index.ts"></script>
  </body>
</html>
```

Create a web entry point at `src/web/index.ts`:

```typescript
// Web browser entry point
// This allows running commands in the browser dev console
import { setupCLI } from '../cli';

// Expose CLI to the browser console
// Usage: $PROJECT_NAME.run(['command', 'arg1', 'arg2'])
(window as any).$PROJECT_NAME = {
  run: async (args: string[] = []) => {
    // Simulate process.argv for browser environment
    const mockArgv = ['node', 'cli.js', ...args];
    return setupCLI(mockArgv);
  }
};

console.log('$PROJECT_NAME CLI available in browser console.');
console.log('Usage: $PROJECT_NAME.run([\'command\', \'arg1\', \'arg2\'])');
```

Create the web directory:
```bash
mkdir -p src/web
mkdir -p public
```

## Step 6: Configure Testing

Create a `vitest.config.ts` file in the project root:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
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

Update `package.json` to include test scripts and build commands:

```json
{
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

## Step 7: Create Project Structure

Create the basic directory structure:

```bash
mkdir -p src
mkdir -p tests
mkdir -p dist
```

Create an initial `src/index.ts` file:

```typescript
export function main() {
  console.log('Hello from $PROJECT_NAME');
}

// Allow running as a Node.js script
if (require.main === module) {
  main();
}
```

## Step 8: Set Up Command-Line Interface

The CLI will be set up to run in both terminal (Node.js) and web browser environments.

Create `src/cli.ts` that works in both environments:

```typescript
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * CLI setup function that works in both Node.js and browser environments
 * @param argv - Command line arguments (defaults to process.argv in Node.js)
 */
export async function setupCLI(argv?: string[]) {
  const args = argv || process.argv;
  
  return yargs(hideBin(args))
    .command('*', 'Default command', {}, (parsedArgs) => {
      console.log('Running $PROJECT_NAME with args:', parsedArgs);
    })
    .help()
    .parseAsync();
}

// Node.js entry point - only run if this is the main module
if (typeof require !== 'undefined' && require.main === module) {
  setupCLI().catch(console.error);
}
```

Create a Node.js entry point at `src/cli-node.ts`:

```typescript
#!/usr/bin/env node
// Node.js CLI entry point
import { setupCLI } from './cli';

setupCLI().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
```

**Using the CLI:**

After building (`npm run build`), the CLI can be used in two ways:

1. **Terminal/Node.js**: 
   ```bash
   # Run directly
   node dist/cli.js [args]
   
   # Or use npm script
   npm run cli -- [args]
   
   # Or link globally (after building)
   npm link
   $PROJECT_NAME [args]
   ```

2. **Web Browser**:
   - Start dev server: `npm run dev`
   - Open http://localhost:3000
   - In browser console: `$PROJECT_NAME.run(['arg1', 'arg2'])`

## Step 9: Create Initial Test

Create `src/index.test.ts` to demonstrate testing setup:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { main } from './index';

describe('$PROJECT_NAME', () => {
  it('should have a main function', () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    main();

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Hello from $PROJECT_NAME');

    // Cleanup
    consoleSpy.mockRestore();
  });
});
```

## Step 10: Create .gitignore

Create a `.gitignore` file:

```
node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.local
```

## Step 11: Verify Setup

Run the following commands to verify everything is set up correctly:

```bash
# Type check
npm run type-check

# Build both web application and CLI
npm run build

# Test the CLI in terminal
npm run cli -- --help
# Or directly:
node dist/cli.js --help

# Start the development server (for web browser testing)
npm run dev
# Then open http://localhost:3000 in your browser
# You can test commands in the browser console using:
# $PROJECT_NAME.run(['--help'])
# $PROJECT_NAME.run(['command', 'arg1'])

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

**Dual-mode CLI:**
- **Terminal mode**: Run `npm run cli` or `node dist/cli.js [args]` after building
- **Browser mode**: Open the dev server and use `$PROJECT_NAME.run([...args])` in the browser console

## Step 12: Update package.json Metadata

Edit `package.json` to update project metadata:

```json
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "Description of $PROJECT_NAME",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
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
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

**Note:** The `bin` entry allows the CLI to be installed globally via `npm install -g` or linked locally via `npm link`. After building, you can run `npm link` in the project directory to make `$PROJECT_NAME` available as a command in your terminal.

## Next Steps

After completing the setup:

1. Review the [PRINCIPLES.md](./PRINCIPLES.md) document
2. Read the detailed documentation in the [/docs](./docs/) directory:
   - [Testing](./docs/TESTING.md) - Testing principles and patterns
   - [Design and Development](./docs/DESIGN_AND_DEVELOPMENT.md) - Development guidelines
   - [Tooling](./docs/TOOLING.md) - Recommended tools and libraries
   - [Deployment and Operation](./docs/DEPLOYMENT_AND_OPERATION.md) - Deployment considerations

3. Set up your development environment according to your needs (web browser, command line, or both)

4. Begin implementing your project following the Arrange/Act/Assert pattern for tests and the principles outlined in the documentation

