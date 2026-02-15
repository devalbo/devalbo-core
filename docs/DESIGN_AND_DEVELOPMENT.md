# Design and Development


## Type Systems

Typing systems provide invaluable metadata for other programmers about the author's intent and semantics. Serialization of types is critical for persisting and transmitting data. As such, tools and libraries that support these objectives are first-class considerations.


## Language(s)

Typescript is the preferred language since it is well supported natively in PC environments via NodeJS (command line) and browser environments (via Typescript -> Javascript compilation). It also can be compiled to WASM for future concerns.

Vite is the preferred infrastructure/tooling for managing Typescript configuration.


Use [Typescript](https://www.typescriptlang.org/) as the default programming for this project. Avoid using `node` specific decisions at all costs. Prefer decisions that support implementation in [WebAssembly](https://webassembly.org/).

Use [Vite](https://vite.dev/) for managing Typescript application organization, configuration, and workflows. 

Use [Zod](https://zod.dev/) for data serialization and management.

Use [React](https://react.dev/) for app UI and execution framework.

Use [Tanstack](https://tanstack.com/) for the development framework.

use [Tinybase](https://tinybase.org/) for persistence management and framework.



## Libraries
Libraries are needed for the following tasks:
* command parsing for environment
  * terminal/command prompt
  * web browser
* hosting user interface
  * terminal/command prompt
  * web browser/HTML
* persisting data locally to environment
* sharing data with other users


#### zod Library

### Command Line Parsing

#### Tinybase (durable streams?)

#### Peer to Peer (durable streams?)
