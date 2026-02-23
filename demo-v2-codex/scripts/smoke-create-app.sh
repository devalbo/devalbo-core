#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[smoke-create-app] %s\n' "$*"
}

run_cmd() {
  log "RUN: $*"
  "$@"
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-create-app.sh [options]

Creates a fresh app directory using the CREATE_AN_APP.md patterns, installs dependencies,
and runs smoke checks.

Options:
  --dir <path>           Target directory (default: /tmp/devalbo-create-app-smoke)
  --app-dir <path>       Alias for --dir
  --mode <git|local-pack>
                         Install devalbo-cli from git repo or local npm pack
                         (default: git)
  --git-spec <spec>      Full npm git install spec for git mode (overrides --git-ref)
                         (default: auto-built from repo + current branch)
  --git-ref <ref>        Git branch/tag/sha for git mode
                         (default: current branch from this repo)
  --force                Remove target directory if it already exists
  --skip-install         Do not run npm install
  --skip-checks          Do not run type-check/build/smoke checks
  --help                 Show this help
EOF
}

TARGET_DIR="/tmp/devalbo-create-app-smoke"
MODE="git"
GIT_SPEC="git+https://github.com/devalbo/devalbo-core.git"
GIT_REF=""
FORCE=0
SKIP_INSTALL=0
SKIP_CHECKS=0
NPM_CACHE_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --app-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    --git-spec)
      GIT_SPEC="$2"
      shift 2
      ;;
    --git-ref)
      GIT_REF="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      echo "Unexpected positional argument: $1" >&2
      echo "Use --dir <path> (or --app-dir <path>) instead." >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "git" && "$MODE" != "local-pack" ]]; then
  echo "Invalid mode: $MODE (expected git or local-pack)" >&2
  exit 1
fi

# Always run with a fresh npm cache to emulate first-time installs.
NPM_CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/devalbo-create-app-npm-cache.XXXXXX")"
export NPM_CONFIG_CACHE="$NPM_CACHE_DIR"
cleanup() {
  log "Cleaning npm cache dir: $NPM_CACHE_DIR"
  rm -rf "$NPM_CACHE_DIR"
}
trap cleanup EXIT
log "Using fresh npm cache: $NPM_CACHE_DIR"

if [[ -e "$TARGET_DIR" ]]; then
  if [[ "$FORCE" -eq 1 ]]; then
    rm -rf "$TARGET_DIR"
  else
    echo "Target directory exists: $TARGET_DIR" >&2
    echo "Use --force to replace it." >&2
    exit 1
  fi
fi

mkdir -p "$TARGET_DIR/src/commands"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEVALBO_SPEC="$GIT_SPEC"
DEVALBO_FALLBACK_SPEC=""
DEVALBO_GIT_CLONE_DIR=""
DEVALBO_GIT_PROJECT_DIR=""
LOCAL_PACK_FILE=""

if [[ "$MODE" == "local-pack" ]]; then
  log "Mode: local-pack"
  pushd "$REPO_ROOT" >/dev/null
  run_cmd npm run build:dist
  LOCAL_PACK_FILE="$(npm pack --ignore-scripts --silent | tail -n 1)"
  log "Packed local artifact: $LOCAL_PACK_FILE"
  cp "$LOCAL_PACK_FILE" "$TARGET_DIR/"
  rm -f "$LOCAL_PACK_FILE"
  popd >/dev/null
  DEVALBO_SPEC="file:./$(basename "$LOCAL_PACK_FILE")"
else
  log "Mode: git"
  if [[ "$GIT_SPEC" == "git+https://github.com/devalbo/devalbo-core.git" ]]; then
    if [[ -z "$GIT_REF" ]]; then
      GIT_REF="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
    fi
    DEVALBO_SPEC="${GIT_SPEC}#${GIT_REF}"
    DEVALBO_FALLBACK_SPEC="https://codeload.github.com/devalbo/devalbo-core/tar.gz/refs/heads/${GIT_REF}"
  else
    DEVALBO_SPEC="$GIT_SPEC"
  fi
fi
log "devalbo-cli dependency spec: $DEVALBO_SPEC"
if [[ -n "$DEVALBO_FALLBACK_SPEC" ]]; then
  log "Fallback spec (if git install fails): $DEVALBO_FALLBACK_SPEC"
fi

cat > "$TARGET_DIR/package.json" <<EOF
{
  "name": "devalbo-create-app-smoke",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node --import tsx src/cli.ts",
    "start:browser": "vite",
    "type-check": "tsc --noEmit",
    "build": "vite build",
    "smoke": "node --import tsx src/smoke.ts"
  },
  "dependencies": {
    "devalbo-cli": "$DEVALBO_SPEC",
    "commander": "^14.0.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "ink-web": "^0.1.9",
    "@xterm/xterm": "^5.5.0"
  },
  "devDependencies": {
    "@types/node": "^24.3.0",
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.2",
    "tsx": "^4.20.4",
    "typescript": "^5.9.2",
    "vite": "^7.1.3"
  }
}
EOF

cat > "$TARGET_DIR/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "vite.config.ts"]
}
EOF

cat > "$TARGET_DIR/vite.config.ts" <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});
EOF

cat > "$TARGET_DIR/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>devalbo-create-app-smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat > "$TARGET_DIR/src/commands/index.ts" <<'EOF'
import type { AsyncCommandHandler, CommandHandler } from 'devalbo-cli';
import { builtinCommands, makeOutput } from 'devalbo-cli';

const hello: AsyncCommandHandler = async (args) => {
  const name = args[0] ?? 'world';
  return makeOutput(`Hello, ${name}!`);
};

const echo: AsyncCommandHandler = async (args) => {
  return makeOutput(args.join(' '));
};

export const commands: Record<string, CommandHandler> = {
  ...builtinCommands,
  hello,
  echo
};
EOF

cat > "$TARGET_DIR/src/program.ts" <<'EOF'
import { Command } from 'commander';
import { registerBuiltinCommands } from 'devalbo-cli';

export const createProgram = (): Command => {
  const program = new Command('devalbo-create-app-smoke')
    .description('Smoke app created from CREATE_AN_APP.md flow')
    .version('0.1.0');

  program.command('hello [name]').description('Say hello');
  program.command('echo <words...>').description('Echo arguments');

  registerBuiltinCommands(program);
  return program;
};
EOF

cat > "$TARGET_DIR/src/config.ts" <<'EOF'
import { createCliAppConfig } from 'devalbo-cli';

export const appConfig = createCliAppConfig({
  appId: 'devalbo-create-app-smoke',
  appName: 'Devalbo Create App Smoke',
  storageKey: 'devalbo-create-app-smoke-store'
});

export const welcomeMessage = 'Welcome to Devalbo Create App Smoke. Type "help" for available commands.';
EOF

cat > "$TARGET_DIR/src/cli.ts" <<'EOF'
import { startInteractiveCli } from 'devalbo-cli';
import { commands } from './commands/index';
import { createProgram } from './program';
import { appConfig, welcomeMessage } from './config';

await startInteractiveCli({
  commands,
  createProgram,
  config: appConfig,
  welcomeMessage
});
EOF

cat > "$TARGET_DIR/src/App.tsx" <<'EOF'
import React, { useEffect, useRef, useState } from 'react';
import { InkTerminalBox } from 'ink-web';
import {
  AppConfigProvider,
  BrowserConnectivityService,
  InteractiveShell,
  bindCliRuntimeSource,
  createDevalboStore,
  createFilesystemDriver,
  unbindCliRuntimeSource,
  useAppConfig
} from 'devalbo-cli';
import { commands } from './commands/index';
import { createProgram } from './program';
import { appConfig, welcomeMessage } from './config';

type StoreInstance = ReturnType<typeof createDevalboStore>;
type DriverInstance = Awaited<ReturnType<typeof createFilesystemDriver>>;

const AppContent: React.FC<{ store: StoreInstance }> = ({ store }) => {
  const [driver, setDriver] = useState<DriverInstance | null>(null);
  const [cwd, setCwd] = useState('/');
  const [connectivity] = useState(() => new BrowserConnectivityService());
  const config = useAppConfig();

  const cwdRef = useRef(cwd);
  const driverRef = useRef(driver);
  const configRef = useRef(config);
  cwdRef.current = cwd;
  driverRef.current = driver;
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    void createFilesystemDriver().then((nextDriver) => {
      if (!cancelled) setDriver(nextDriver);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bindCliRuntimeSource({
      getContext: () => {
        if (!driverRef.current) return null;
        return {
          commands,
          createProgram,
          store,
          config: configRef.current,
          driver: driverRef.current,
          connectivity,
          cwd: cwdRef.current,
          setCwd
        };
      }
    });
    return () => unbindCliRuntimeSource();
  }, [store, connectivity]);

  return (
    <div style={{ maxWidth: '960px', margin: '24px auto', padding: '0 16px' }}>
      <h1>Devalbo Create App Smoke</h1>
      <InkTerminalBox rows={24} focus>
        <InteractiveShell
          commands={commands}
          createProgram={createProgram}
          store={store}
          config={config}
          driver={driver}
          cwd={cwd}
          setCwd={setCwd}
          welcomeMessage={welcomeMessage}
        />
      </InkTerminalBox>
    </div>
  );
};

export const App: React.FC = () => {
  const [store] = useState(() => createDevalboStore());

  return (
    <AppConfigProvider config={appConfig}>
      <AppContent store={store} />
    </AppConfigProvider>
  );
};
EOF

cat > "$TARGET_DIR/src/main.tsx" <<'EOF'
import React from 'react';
import { createRoot } from 'react-dom/client';
import 'ink-web/css';
import '@xterm/xterm/css/xterm.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
EOF

cat > "$TARGET_DIR/src/smoke.ts" <<'EOF'
import {
  bindCliRuntimeSource,
  cli,
  createCliAppConfig,
  createDevalboStore,
  unbindCliRuntimeSource
} from 'devalbo-cli';
import { commands } from './commands/index';
import { createProgram } from './program';

const config = createCliAppConfig({
  appId: 'devalbo-create-app-smoke',
  appName: 'Devalbo Create App Smoke',
  storageKey: 'devalbo-create-app-smoke-store'
});

const store = createDevalboStore();
let cwd = '/';

bindCliRuntimeSource({
  getContext: () => ({
    commands,
    createProgram,
    store,
    config,
    cwd,
    setCwd: (next) => {
      cwd = next;
    }
  })
});

const assertOk = (label: string, payload: { text: string; error: string | null }, expected: string) => {
  if (payload.error) {
    throw new Error(`${label} failed: ${payload.error}`);
  }
  if (!payload.text.includes(expected)) {
    throw new Error(`${label} failed: expected text to include "${expected}", got "${payload.text}"`);
  }
};

try {
  const hello = await cli.execText('hello', ['Alice']);
  const echo = await cli.execText('echo', ['foo', 'bar']);
  const help = await cli.execText('help', []);
  const appConfig = await cli.execText('app-config', []);

  assertOk('hello', hello, 'Hello, Alice!');
  assertOk('echo', echo, 'foo bar');
  assertOk('help', help, 'hello');
  assertOk('app-config', appConfig, 'appId: devalbo-create-app-smoke');
  console.log('Smoke checks passed.');
} finally {
  unbindCliRuntimeSource();
}
EOF

log "Created scaffold in: $TARGET_DIR"

if [[ "$SKIP_INSTALL" -eq 1 ]]; then
  log "Skipping npm install (--skip-install)."
  exit 0
fi

pushd "$TARGET_DIR" >/dev/null
log "Installing dependencies in: $TARGET_DIR"
if ! npm install; then
  if [[ -n "$DEVALBO_FALLBACK_SPEC" ]]; then
    log "npm install failed with git spec; retrying with GitHub tarball fallback."
    run_cmd npm pkg set "dependencies.devalbo-cli=${DEVALBO_FALLBACK_SPEC}"
    rm -rf node_modules package-lock.json
    if ! npm install; then
      if [[ -n "${GIT_REF:-}" ]]; then
        log "Tarball fallback also failed; retrying via direct git clone of branch: $GIT_REF"
        DEVALBO_GIT_CLONE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/devalbo-core-clone.XXXXXX")"
        run_cmd git clone --depth 1 --branch "$GIT_REF" https://github.com/devalbo/devalbo-core.git "$DEVALBO_GIT_CLONE_DIR"
        DEVALBO_GIT_PROJECT_DIR="$DEVALBO_GIT_CLONE_DIR"
        if [[ ! -f "$DEVALBO_GIT_PROJECT_DIR/package.json" ]]; then
          if [[ -f "$DEVALBO_GIT_CLONE_DIR/demo-v2-codex/package.json" ]]; then
            DEVALBO_GIT_PROJECT_DIR="$DEVALBO_GIT_CLONE_DIR/demo-v2-codex"
          else
            FOUND_PKG_FILE="$(find "$DEVALBO_GIT_CLONE_DIR" -maxdepth 3 -name package.json -print | head -n 1)"
            FOUND_PKG_DIR=""
            if [[ -n "$FOUND_PKG_FILE" ]]; then
              FOUND_PKG_DIR="$(dirname "$FOUND_PKG_FILE")"
            fi
            if [[ -n "$FOUND_PKG_DIR" && -f "$FOUND_PKG_DIR/package.json" ]]; then
              DEVALBO_GIT_PROJECT_DIR="$FOUND_PKG_DIR"
            fi
          fi
        fi
        log "Using cloned project directory: $DEVALBO_GIT_PROJECT_DIR"
        log "Installing clone dependencies and building dist before file: install"
        if command -v pnpm >/dev/null 2>&1; then
          log "Using pnpm for cloned workspace dependency install/build"
          run_cmd pnpm -C "$DEVALBO_GIT_PROJECT_DIR" install
          run_cmd pnpm -C "$DEVALBO_GIT_PROJECT_DIR" run build:dist
        else
          log "pnpm not found; using npm for cloned project dependency install/build"
          run_cmd npm --prefix "$DEVALBO_GIT_PROJECT_DIR" install --ignore-scripts
          run_cmd npm --prefix "$DEVALBO_GIT_PROJECT_DIR" run build:dist
        fi
        run_cmd npm pkg set "dependencies.devalbo-cli=file:${DEVALBO_GIT_PROJECT_DIR}"
        rm -rf node_modules package-lock.json
        run_cmd npm install
      else
        log "Tarball fallback failed and no git ref is available for clone fallback."
        exit 1
      fi
    fi
  else
    log "npm install failed and no fallback is available."
    exit 1
  fi
fi

if [[ "$SKIP_CHECKS" -eq 1 ]]; then
  log "Install complete. Skipping checks (--skip-checks)."
  popd >/dev/null
  exit 0
fi

run_cmd npm run type-check
run_cmd npm run build
run_cmd npm run smoke
popd >/dev/null

cat <<EOF

All automated checks passed for $TARGET_DIR

Optional manual checks:
  cd $TARGET_DIR
  npm run start
  npm run start:browser
EOF

if [[ -n "$DEVALBO_GIT_CLONE_DIR" ]]; then
  log "Keeping cloned repo for inspection: $DEVALBO_GIT_CLONE_DIR"
fi
