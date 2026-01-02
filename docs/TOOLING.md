
# Tooling & Libraries

## User Interface

### React

React focuses on data changes and updating a display. Originally browser-based, it can support multiple display ecosystems and platforms. As such, it is the preferred means for interacting with the user.


## Execution Environments

### Web Assembly (WASM)
Prefer WASM applicable design and library choices. Hopefully, in the future, terminal and browser applications will keep converging.

### Command Parsing
Commands should be runnable in two modes:
* as a web app, with a named object in the dev console that can process commands and arguments
* as a compiled nodeJS project. There should also be a way to debug.

Focus on command-line style invocation to enforce modular design and ability to test. Contenders:
* yargs
* commander
* minimist
* clack with command for prompting for missing information


### Terminal 

#### User Interface
* [Ink](https://github.com/vadimdemedes/ink)


### Web Browser

### [Vite](https://vite.dev/)

### [Tanstack](https://tanstack.com/)

### [Web-Ink](https://www.ink-web.dev/)
