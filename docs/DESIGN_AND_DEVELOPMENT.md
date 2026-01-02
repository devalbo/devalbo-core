# Design and Development


## Type Systems

Typing systems provide invaluable metadata for other programmers about the author's intent and semantics. Serialization of types is critical for persisting and transmitting data. As such, tools and libraries that support these objectives are first-class considerations.


## Language(s)

Typescript is the preferred language since it is well supported natively in PC environments via NodeJS (command line) and browser environments (via Typescript -> Javascript compilation). It also can be compiled to WASM for future concerns.

Vite is the preferred infrastructure/tooling for managing Typescript configuration.

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
