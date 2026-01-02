# Demo - devalbo-core CLI Application

A demonstration CLI application built following the [devalbo-core principles](../PRINCIPLES.md), showcasing a dual-mode application that runs in both terminal and web browser environments.

## Features

- **Dual-mode execution**: Runs as a terminal CLI and as a web application
- **Ink UI**: React-based terminal interface with [Ink](https://github.com/vadimdemedes/ink)
- **ink-web**: Browser-based terminal using [ink-web](https://www.ink-web.dev/) - same Ink components run in both terminal and browser!
- **shadcn**: Component registry for ink-web components
- **Tailwind CSS**: Styling for the web interface
- **Commander**: Structured command parsing with [Commander.js](https://github.com/tj/commander.js/)
- **Clack prompts**: Beautiful interactive prompts with [@clack/prompts](https://github.com/natemoo-re/clack)
- **TypeScript**: Full type safety with strict mode
- **Vite**: Fast development and optimized builds
- **Vitest**: Modern testing framework
- **React**: Shared UI components across terminal and browser

## Installation

```bash
npm install
```

## Development

### Terminal Development

Build and run the CLI:

```bash
# Build the CLI
npm run build:cli

# Run commands
node dist/cli.js greet Alice
node dist/cli.js greet --interactive
node dist/cli.js info
node dist/cli.js --help
```

### Web Browser Development

Start the development server:

```bash
# Start Vite dev server
npm run dev

# Or with host access
npm run dev:host
```

Then open http://localhost:3000 in your browser.

You can also use the console API:

```javascript
demo.greet('Alice')
demo.info()
demo.help()
```

## Building

```bash
# Build both web and CLI
npm run build

# Build web only
npm run build:web

# Build CLI only
npm run build:cli
```

## Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check
```

## Project Structure

```
demo/
├── src/
│   ├── components/          # Ink React components
│   │   ├── Greeter.tsx      # Greeting component
│   │   └── Info.tsx         # Info display component
│   ├── web/                 # Web browser entry points
│   │   ├── App.tsx          # Browser React app
│   │   └── index.tsx        # Web entry point
│   ├── cli.tsx              # CLI setup with Commander + Ink
│   ├── cli-node.tsx         # Node.js CLI entry point
│   ├── index.ts             # Core functionality
│   └── index.test.ts        # Tests
├── public/                  # Static web assets
├── dist/                    # Build output
├── index.html               # Web app HTML
├── vite.config.ts           # Vite configuration
├── vitest.config.ts         # Vitest configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project metadata
```

## Architecture

This demo follows the devalbo-core principles:

### Testability
- Full test coverage with Vitest
- Arrange/Act/Assert pattern
- Easy to test pure functions

### Maintainability
- Clean separation of concerns
- Type-safe TypeScript
- Modular command structure

### Cross-platform
- **Terminal**: Full Ink UI with commander and clack
- **Browser**: ink-web renders the same Ink components in a browser-based terminal!

###  The ink-web Magic

The same Ink components (`Greeter.tsx`, `Info.tsx`) run in BOTH environments:
1. **Terminal**: Uses real Ink library
2. **Browser**: Vite aliases `ink` → `ink-web`, rendering components in `InkTerminalBox`

This means you write your UI components once and they work everywhere!

### Key Technologies

1. **Ink**: React renderer for terminal UIs
   - Used for all terminal output
   - Provides consistent component model
   - Works with React's paradigm

2. **ink-web**: Browser terminal emulator
   - Renders Ink components in the browser
   - Uses xterm.js for terminal emulation
   - Vite alias makes it transparent
   - Same components, zero code changes!

3. **shadcn**: Component infrastructure
   - Provides component registry for ink-web
   - Tailwind CSS for styling
   - Easy component installation

4. **Commander**: Command-line framework
   - Parses commands and arguments
   - Generates help documentation
   - Handles command routing

5. **Clack**: Interactive prompts
   - Beautiful terminal prompts
   - User-friendly interactions
   - Cancel handling

6. **Vite**: Build tooling
   - Fast development
   - Optimized production builds
   - Dual-mode configuration (web + Node.js)
   - Critical for ink → ink-web aliasing

## Commands

### greet [name]

Greet someone with a friendly message.

```bash
# Terminal
node dist/cli.js greet
node dist/cli.js greet Alice
node dist/cli.js greet --interactive

# Browser console
demo.greet()
demo.greet('Alice')
```

Options:
- `-i, --interactive`: Use interactive prompts (terminal only)

### info

Display information about the application.

```bash
# Terminal
node dist/cli.js info

# Browser console
demo.info()
```

## devalbo-core Principles

This demo implements the following principles:

1. **Philosophy**: Runs in multiple environments (terminal and browser)
2. **Testing**: Full test coverage with Vitest using Arrange/Act/Assert
3. **Design**: TypeScript with Zod for validation (ready to add)
4. **Tooling**: Vite, React, Ink, Commander, Clack
5. **Type System**: Strict TypeScript with full type safety

## Future Enhancements

Areas for expansion:

- [ ] Add Tinybase for persistence layer
- [ ] Implement ink-web for full Ink UI in browser (when stable)
- [ ] Add peer-to-peer communication features
- [ ] Expand command set with real-world examples
- [ ] Add BDD testing with Gherkin scenarios
- [ ] Deploy web version to hosting platform

## License

ISC

## References

- [devalbo-core Principles](../PRINCIPLES.md)
- [Setup Guide](../docs/SETUP_NEW.md)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Commander.js](https://github.com/tj/commander.js/)
- [Clack Prompts](https://github.com/natemoo-re/clack)
