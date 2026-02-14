# **Engineering High-Performance Universal Applications: A Systems Architecture for Isomorphic WASM and TypeScript Runtimes \- v2**

The modern software landscape is characterized by a drive toward environment-agnostic runtimes, where the traditional boundaries between browser-based execution and local terminal environments are increasingly blurred. This architectural shift is necessitated by the requirement for high-performance, responsive applications that maintain a single logic core while adapting their input/output modalities to the host environment. The development of a WebAssembly (WASM) and TypeScript Universal Application Proof of Concept (PoC) represents a sophisticated intersection of systems programming and web technologies. By synthesizing the Origin Private File System (OPFS), the ZenFS abstraction layer, the TinyBase reactive state engine, and cross-platform UI frameworks like React and Ink, it is possible to construct an application that provides near-native filesystem performance and consistent user experiences across terminal and web interfaces. This report analyzes the technical requirements and implementation strategies for such a system, emphasizing the bridge between high-level TypeScript logic and low-level WASM execution.

## **The Architecture of Isomorphic Filesystem Roots**

A foundational requirement for a universal application is a filesystem abstraction that provides a consistent API across different runtimes. In a standard Node.js environment, the fs module provides direct access to the host operating system's filesystem. In the browser, however, direct access is restricted for security reasons. ZenFS emerges as a critical infrastructure component by emulating the Node.js filesystem API within the browser using a system of pluggable backends.1 This allows the application to utilize a unified fs interface regardless of whether it is running on a server or within a sandboxed browser environment.

### **Integrating Zen-FS and the Origin Private File System**

ZenFS operates through a modular architecture where various storage mechanisms are mounted as backends. For a high-performance PoC, the Origin Private File System (OPFS) is the primary target for persistence. Unlike traditional browser storage such as IndexedDB, OPFS is designed for high-performance file operations, offering a sandboxed filesystem private to the origin.2 The integration of OPFS into ZenFS is typically achieved through the @zenfs/dom package, which provides the WebAccess backend.1

The filesystem configuration for an isomorphic application requires a strategic mounting plan. A common pattern involves mounting an InMemory backend for transient data, a Fetch backend for read-only remote assets, and the WebAccess (OPFS) backend for persistent user data.1 This hierarchical arrangement allows the application to treat different storage locations as part of a single, unified tree.

| Backend Identifier | Storage Medium | Primary Advantage | Typical Isomorphic Use Case |
| :---- | :---- | :---- | :---- |
| InMemory | Volatile RAM | Lowest latency for non-persistent data.1 | Temporary cache, system logs. |
| IndexedDB | Browser Database | Widely supported, persistent storage.5 | Metadata storage, legacy browser support. |
| WebAccess (OPFS) | Sandboxed Local Disk | High-performance, byte-level sync access.3 | Databases (SQLite), large file editing. |
| Fetch | HTTP Endpoints | Remote file access via standard web protocols.1 | Static assets, remote configuration. |
| Port | Message Channel | Offloads I/O to Web Workers.1 | Multithreaded I/O orchestration. |

Recent updates to ZenFS have introduced the StoreFS implementation, which optimizes performance by building an inode lookup table during initialization. This enhancement is particularly beneficial for backends with higher latency, such as IndexedDB, by reducing the O(n) overhead of ID allocation to constant time O(1).7 This architectural improvement ensures that as the filesystem grows, the performance of file resolution remains stable.

### **SQLite Persistence within the OPFS Context**

The persistence of relational data within a universal application is most effectively handled by SQLite, compiled to WebAssembly. The official SQLite WASM build includes specific support for OPFS, leveraging its synchronous access handles to provide performance comparable to native desktop implementations.8 When initializing SQLite within the browser, the application must choose an appropriate Virtual File System (VFS) to manage communication with the underlying storage.

The standard OPFS VFS utilizes the createSyncAccessHandle method of the FileSystemFileHandle interface. These handles are exclusive, meaning only one instance of the database can hold a lock on the file at a given time.8 This presents a concurrency challenge for applications that may be open in multiple browser tabs. To address this, SQLite provides the opfs-sahpool VFS, which manages a pool of pre-allocated synchronous access handles and supports cooperative concurrency by "pausing" and "unpausing" the VFS when a tab loses focus.8

| VFS Implementation | Mechanism | Concurrency Model | Performance Characteristics |
| :---- | :---- | :---- | :---- |
| opfs | Direct Sync Access Handle | Exclusive locking per file; one tab at a time.8 | High throughput; limited multi-tab support. |
| opfs-sahpool | Pre-allocated handle pool | Cooperative VFS pausing/unpausing.8 | Highest performance; better concurrency. |
| wasmfs | Emscripten abstraction | Exclusive locks held for duration of handle.8 | Simple API; lacks concurrent access. |

Integrating SQLite with ZenFS allows the database to reside within the virtual filesystem tree. For example, a database file could be mounted at /home/db.sqlite using the OPFS backend, allowing standard Node.js-style file operations and SQLite-specific database calls to operate on the same physical bits.1

## **State Management and Reactive Synchronization with TinyBase**

State management in a universal application must be both reactive and persistent. TinyBase provides an in-memory data structure optimized for reactivity, which can be synchronized with an underlying SQLite database through the use of persisters.11 In an isomorphic architecture, the TinyBase store acts as the source of truth for the UI components, while the persister ensures that changes are reflected in the persistent storage layer.

### **Tabular Mapping and Database Persistence**

The integration between TinyBase and SQLite can be performed in two primary modes: JSON serialization and tabular mapping. In JSON mode, the entire store is saved as a single blob in the database, which is efficient for small datasets but lacks granular querying capabilities.9 For the Navigator/Editor PoC, tabular mapping is preferred, as it maps TinyBase tables directly to SQLite tables, allowing for structured data persistence.9

One critical consideration when using database persisters is the transformation of "sparse" tables into "dense" tables. TinyBase naturally supports sparse rows where cells may be missing entirely. However, because SQL databases have fixed schemas, missing cells are stored as NULL.9 When the data is reloaded into TinyBase, these null values are preserved, which may increase memory consumption.9 Developers must utilize the allowNull property in the TinyBase schema to explicitly manage these types and ensure consistency across the persistence boundary.9

### **Real-Time Synchronization Patterns**

TinyBase provides the startAutoSave and startAutoLoad methods to facilitate real-time synchronization between the in-memory store and the database.12 In the context of a universal app, these patterns allow the UI to remain highly responsive; user interactions modify the in-memory store, which then triggers an asynchronous save to the OPFS-backed SQLite database. Conversely, if an external process (such as a separate worker or a background sync task) modifies the database, the autoLoad mechanism—configured with a specific polling interval or utilizing a notification system—will update the UI accordingly.9

## **Unified UI Component Abstraction for Universal Interaction**

To enable developers to build simple applications without considering the host platform, a unified UI component package is required. This layer abstracts the differences between browser-native DOM elements and terminal-native Ink primitives, providing a set of interaction defaults that work across both environments.

### **Universal Primitives and Interaction Defaults**

The @inkjs/ui library serves as a robust candidate for interaction elements, providing pre-built React components like TextInput, Select, and Spinner for the terminal. To make these isomorphic, the PoC utilizes the ink-web package, which brings Ink-based CLI applications into the browser using Xterm.js or Ghostty as the rendering target.

For the application developer, this means a single set of primitives:

* **Interaction**: TextInput maps to an HTML \<input\> in the browser and a buffered stdin reader in the terminal.  
* **Layout**: Box behaves as a Flexbox container in both environments, utilizing the Yoga engine to ensure consistent spacing and alignment.21  
* **Feedback**: ProgressBar and Spinner provide immediate user feedback without requiring platform-specific polling or rendering logic.

### **Environment-Aware Rendering Decisions**

While the framework provides defaults, developers can make platform-specific rendering decisions using an environment detection hook. By checking for the presence of browser globals or Node.js-specific process variables, the application can selectively render rich graphical elements in the web while maintaining a clean, character-based interface in the terminal.

TypeScript

const MyComponent \= () \=\> {  
  const isWeb \= typeof window\!== 'undefined';  
  return isWeb? \<BrowserSpecificComponent /\> : \<TerminalSpecificComponent /\>;  
};

This strategy is further refined by aliasing ink to ink-web in the bundler configuration (e.g., Vite), allowing the same import statements to resolve to the appropriate renderer at build time.

## **First-Class Command Handler Registration and Hierarchical Parsing**

The application's command parser is designed as a first-class programming interface, allowing developers to register command handlers directly within a hierarchy. This approach mirrors the "Typer" pattern in Python, where function signatures and nested structures define the CLI's behavior and validation.

### **TypeScript Command Hierarchy with Clipanion and cmd-ts**

For the TypeScript logic layer, Clipanion and cmd-ts provide hierarchical registration as a primary method. Clipanion, which powers complex tools like Yarn Modern, utilizes a class-based approach with decorators (e.g., @Command.Path) to map nested commands to their respective handlers. This eliminates the "wall of method chains" common in traditional parsers like Commander or Yargs and allows for sub-applications to be registered as independent, modular units.

Key advantages of this registration method include:

* **First-Pass Validation**: Arguments are validated against a schema (e.g., Zod) before the handler is even executed.  
* **Hierarchical Composition**: Sub-applications can be added to a parent parser, enabling deep command structures like app plugin install \<name\> where each segment is handled by a distinct class or function.  
* **Type-Safe Parameters**: Commands are defined as classes or structured objects where parameters are strictly typed, allowing for automatic help generation and autocompletion.

### **Rust Logic Core and clap-noun-verb**

On the WASM side, the logic core utilizes the clap-noun-verb crate, which provides a high-level API for building "noun-verb" CLI patterns on top of the standard clap library. This crate is specifically designed for agent-grade CLIs, where the CLI layer is a thin validation and routing wrapper around pure domain logic functions. This architecture ensures that the same hierarchical command structure is maintained from the top-level TypeScript entry point down to the high-performance WASM execution core.

## **Design of a Unified Filesystem Monitoring Service**

Monitoring filesystem changes is essential for keeping the application state synchronized with the disk. However, the mechanisms for monitoring differ significantly between Node.js and the browser. A unified filesystem monitoring service must abstract these differences into a single, isomorphic API.

### **Abstracting Node.js and Browser Monitoring**

In a Node.js environment, the fs.watch and fs.watchFile APIs provide access to operating system events. While fs.watch is more efficient as it leverages OS-level primitives like inotify or FSEvents, it is known for inconsistencies across different platforms, such as missing events during atomic saves or duplicate event firing.14 In contrast, fs.watchFile uses polling, which is more reliable but less efficient.15

The browser environment has historically lacked a direct equivalent, but the experimental FileSystemObserver API now provides a mechanism to observe changes to the Origin Private File System.17 This API provides FileSystemChangeRecord objects detailing modifications, deletions, or moves within a directory.17

| Environment | Primary Monitoring API | Mechanism | Limitations |
| :---- | :---- | :---- | :---- |
| Node.js | fs.watch | OS-native notifications | Platform-dependent behavior, duplicate events.14 |
| Node.js | fs.watchFile | Polling (stat-based) | High CPU/IO overhead, polling delay.16 |
| Browser | FileSystemObserver | Browser-native observation | Experimental, limited browser support.17 |
| Browser | Polling Fallback | Interval-based stat checks | Inefficient for large filesystems.16 |

The unified service must implement an adapter pattern. It detects the host environment and initializes the most efficient watcher available. To mitigate the duplicate event problem common in fs.watch, the service should implement a "two-bite" stability check: a change is only broadcast to the rest of the application once the file attributes (such as mtime or size) have stabilized over two successive checks.19

### **Event Normalization and Reactive Flow**

The monitoring service normalizes events from different backends into a common schema:

1. **Modified**: The content or metadata of a file has changed.  
2. **Created**: A new file or directory has appeared in the watched path.  
3. **Deleted**: An entry has been removed from the filesystem.  
4. **Moved**: An entry has been renamed or relocated.

These events are then fed into the TinyBase store or a global event bus. In the Navigator component, for instance, a "Created" event on the disk would trigger an update to the entries table in TinyBase, which in turn causes the UI tree to re-render, reflecting the new file immediately.12

## **High-Performance Bridge using Web Workers and WASM Memory**

To ensure the UI remains responsive during heavy computational tasks—such as file indexing, search, or database operations—the application must utilize a multithreaded architecture. Web Workers provide the necessary isolation, and WebAssembly enables high-performance execution.

### **OPFS Sync Access Handles and Synchronous I/O**

The performance of OPFS is maximized through the use of FileSystemSyncAccessHandle. This API provides synchronous read and write methods that bypass the overhead of asynchronous promise-based I/O. However, because these methods are synchronous, they can only be used within a Web Worker to avoid blocking the main thread's event loop.2

The bridge between the main thread and the worker is constructed using postMessage for control signals and SharedArrayBuffer for data transfer.22 In a WASM-TS environment, the WASM memory can be backed by a SharedArrayBuffer, allowing multiple workers and the main thread to view and modify the same memory space simultaneously.24

![][image1]  
By using SharedArrayBuffer, the serialization and deserialization times are effectively reduced to zero, as both threads access the same underlying memory. This is particularly effective when working with Uint8Array views of the WASM memory, as it allows the TypeScript logic on the main thread to read the results of WASM computations (e.g., a processed file buffer) without copying the data.25

### **Multi-threaded WASM and Atomics**

Synchronizing state across threads requires the use of the Atomics object. In the main thread, which cannot block, Atomics.waitAsync allows the application to wait for signals from a worker without freezing the UI.23 In the worker, WASM can use the Atomics.wait instruction to block until data is ready, which is a common pattern in systems programming for implementing mutexes and semaphores.23

The Wasm Workers API provides a "direct mapping" to web multithreading primitives, offering simpler compiled output and potentially better performance than the traditional Emscripten pthread implementation, which involves a more complex flattening of worker hierarchies.24 This lighter-weight approach is ideal for a PoC application where performance and code size are critical.

## **Environment-Aware Bootstrapping and Driver Injection**

To maintain a single codebase, the application must detect its execution environment at startup and inject the appropriate drivers for that platform.

### **Platform Detection Mechanisms**

The bootstrapping process begins with environment detection. The application checks for global variables like window (browser) or process (Node.js) to determine the host platform.27 More robust detection checks process.release.name to distinguish between Node.js, Bun, and other runtimes.28

| Feature | Browser Environment | Node.js Environment |
| :---- | :---- | :---- |
| Global Object | window or self.27 | global.29 |
| Filesystem | OPFS / ZenFS.1 | Native node:fs.30 |
| Process Info | navigator.userAgent | process.argv, process.env.32 |
| Buffer Type | Uint8Array / ArrayBuffer | Buffer (Node-specific).29 |
| Event Loop | Browser Tasks / Microtasks | Node.js Libuv-based loop. |

Once the platform is identified, the application uses dependency injection to provide the core logic with concrete implementations of the required services. For instance, the IFilesystem interface is satisfied by a ZenFSDriver in the browser and a NativeFSDriver in Node.js.33

## **Unified Build and Bundling Pipeline**

Managing a project that involves Rust, WASM, Web Workers, and dual-target UI code requires a sophisticated build and bundling pipeline. The project is structured as a pnpm monorepo to handle shared dependencies and internal package linking.35

### **Monorepo Structure and Dependency Management**

The pnpm-workspace.yaml file defines the structure of the repository, typically separating the core logic from the host environments.36

* packages/core: The Rust logic core and its WASM bindings.  
* packages/shared: Common TypeScript types, interfaces, and business logic.  
* packages/ui: Shared React components and platform-specific wrappers.  
* apps/web: The Vite-based web host environment.  
* apps/cli: The terminal binary entry point.

### **Bundling with Vite, esbuild, and wasm-pack**

The build pipeline orchestrates several tools to package the application. wasm-pack compiles the Rust code into WASM and generates the necessary TypeScript bindings.35 Vite is used for the web target, providing a fast development server and optimized production bundles with built-in support for Web Workers and WASM modules through plugins like vite-plugin-wasm.35

## **Isomorphic Application Architecture: The Navigator and Editor**

The Navigator/Editor PoC serves as a practical demonstration of the isomorphic architecture. It shares the majority of its component logic between the terminal and the web browser.

### **The Navigator Component**

The Navigator is responsible for displaying the directory structure and allowing the user to select files. It interacts with the unified filesystem monitoring service to reflect real-time changes on the disk.

* **Logic**: A useFileTree hook that queries ZenFS for the directory structure and listens for filesystem events to update the state.1  
* **Web View**: A tree component that renders a nested list of files using React-DOM.  
* **Terminal View**: A selectable list component using Ink's ink-select-input for keyboard-based navigation.38

### **The Editor Component**

The Editor allows the user to view and modify file contents. It utilizes the high-performance WASM bridge for file reading and writing.

* **Logic**: A useFileEditor hook that manages the current file buffer, handles unsaved changes, and triggers save operations through the OPFS/Node.js drivers.2  
* **Web View**: An instance of xterm.js for a terminal-like editing experience or a standard controlled text area.  
* **Terminal View**: An Ink-based text display with keyboard input handling for character insertions and deletions.21

## **Future Outlook and Scalability**

The PoC establishes a foundation that can be scaled to support more complex features, such as collaborative editing and remote synchronization.

### **Collaborative Workflows and CRDTs**

TinyBase's support for mergeable stores and synchronization via WebSockets or Durable Objects opens the door for real-time collaboration.12 By integrating a CRDT (Conflict-free Replicated Data Type) framework like Automerge or Yjs, the application could allow multiple users to edit the same file across different environments, with changes reconciled deterministically.13

### **Expanding the Filesystem Ecosystem**

As the ZenFS project continues to grow, more backends—such as Google Drive, S3, or Dropbox—can be integrated into the PoC.1 This would allow the Navigator/Editor to act as a universal file manager, providing a single interface for local, browser, and cloud-based storage.

The WASM/TypeScript Universal App PoC demonstrates that the web platform has evolved into a powerful environment for high-performance systems applications. By combining the strengths of low-level languages like Rust with the agility of TypeScript and the reactivity of React, developers can create software that is truly universal—performant, responsive, and environment-aware. The architectural patterns established in this report provide a roadmap for the next generation of cross-platform development, where the terminal and the web are no longer separate silos but parts of a unified computing experience.

#### **Works cited**

1. zen-fs/core: A filesystem, anywhere. \- GitHub, accessed February 14, 2026, [https://github.com/zen-fs/core](https://github.com/zen-fs/core)  
2. Origin Private File System (OPFS) Database with the RxDB OPFS-RxStorage, accessed February 14, 2026, [https://rxdb.info/rx-storage-opfs.html](https://rxdb.info/rx-storage-opfs.html)  
3. Origin private file system \- Web APIs \- MDN \- Mozilla, accessed February 14, 2026, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API/Origin\_private\_file\_system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)  
4. trasherdk/zen-fs-core: A filesystem, anywhere \- GitHub, accessed February 14, 2026, [https://github.com/trasherdk/zen-fs-core](https://github.com/trasherdk/zen-fs-core)  
5. Bring Your Own FS \- isomorphic-git, accessed February 14, 2026, [https://isomorphic-git.org/docs/en/0.78.0/fs](https://isomorphic-git.org/docs/en/0.78.0/fs)  
6. @componentor/fs \- npm, accessed February 14, 2026, [https://www.npmjs.com/package/@componentor/fs](https://www.npmjs.com/package/@componentor/fs)  
7. zen-fs/core v1.9.0 on GitHub \- NewReleases.io, accessed February 14, 2026, [https://newreleases.io/project/github/zen-fs/core/release/v1.9.0](https://newreleases.io/project/github/zen-fs/core/release/v1.9.0)  
8. Persistent Storage Options \- SQLite, accessed February 14, 2026, [https://sqlite.org/wasm/doc/trunk/persistence.md](https://sqlite.org/wasm/doc/trunk/persistence.md)  
9. Database Persistence | TinyBase, accessed February 14, 2026, [https://tinybase.org/guides/persistence/database-persistence/](https://tinybase.org/guides/persistence/database-persistence/)  
10. FileSystemFileHandle: createSyncAccessHandle() method \- Web APIs | MDN, accessed February 14, 2026, [https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)  
11. persisters | TinyBase, accessed February 14, 2026, [https://tinybase.org/api/persisters/](https://tinybase.org/api/persisters/)  
12. An Intro To Persistence \- TinyBase, accessed February 14, 2026, [https://tinybase.org/guides/persistence/an-intro-to-persistence/](https://tinybase.org/guides/persistence/an-intro-to-persistence/)  
13. Architectural Options \- TinyBase, accessed February 14, 2026, [https://tinybase.org/guides/the-basics/architectural-options/](https://tinybase.org/guides/the-basics/architectural-options/)  
14. Node.js File System method: fs.watch | by Volodymyr Klymenko \- Medium, accessed February 14, 2026, [https://medium.com/@volodymyrklymenko/node-js-file-system-method-fs-watch-ba16d5c9a3c9](https://medium.com/@volodymyrklymenko/node-js-file-system-method-fs-watch-ba16d5c9a3c9)  
15. How to Watch File Changes in Node.js \- OneUptime, accessed February 14, 2026, [https://oneuptime.com/blog/post/2026-01-22-nodejs-watch-file-changes/view](https://oneuptime.com/blog/post/2026-01-22-nodejs-watch-file-changes/view)  
16. How to Watch for File Changes in Node.js \- thisDaveJ, accessed February 14, 2026, [https://thisdavej.com/how-to-watch-for-file-changes-in-node-js/](https://thisdavej.com/how-to-watch-for-file-changes-in-node-js/)  
17. File System API \- Web APIs | MDN \- Mozilla, accessed February 14, 2026, [https://developer.mozilla.org/en-US/docs/Web/API/File\_System\_API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)  
18. Chris Mills @chrisdavidmills \- Front-End Social, accessed February 14, 2026, [https://front-end.social/@chrisdavidmills](https://front-end.social/@chrisdavidmills)  
19. File changed listener in Java \- Stack Overflow, accessed February 14, 2026, [https://stackoverflow.com/questions/494869/file-changed-listener-in-java](https://stackoverflow.com/questions/494869/file-changed-listener-in-java)  
20. Using the File Listener to Initiate a Cloud Date Integration TaskFlow \- Informatica, accessed February 14, 2026, [https://www.informatica.com/content/dam/informatica-cxp/techtuesdays-slides-pdf/Use%20File%20Listener%20to%20Initiate%20a%20Cloud%20Data%20Integration%20TaskFlow.pdf](https://www.informatica.com/content/dam/informatica-cxp/techtuesdays-slides-pdf/Use%20File%20Listener%20to%20Initiate%20a%20Cloud%20Data%20Integration%20TaskFlow.pdf)  
21. vadimdemedes/ink: React for interactive command-line apps \- GitHub, accessed February 14, 2026, [https://github.com/vadimdemedes/ink](https://github.com/vadimdemedes/ink)  
22. SharedArrayBuffer \- JavaScript \- MDN \- Mozilla, accessed February 14, 2026, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)  
23. About SharedArrayBuffer & Atomics | by Andrea Giammarchi, accessed February 14, 2026, [https://webreflection.medium.com/about-sharedarraybuffer-atomics-87f97ddfc098](https://webreflection.medium.com/about-sharedarraybuffer-atomics-87f97ddfc098)  
24. Wasm Workers API — Emscripten 5.0.1-git (dev) documentation, accessed February 14, 2026, [https://emscripten.org/docs/api\_reference/wasm\_workers.html](https://emscripten.org/docs/api_reference/wasm_workers.html)  
25. How to use Shared Array Buffer as the wasm memory · Issue \#3298 \- GitHub, accessed February 14, 2026, [https://github.com/wasm-bindgen/wasm-bindgen/issues/3298](https://github.com/wasm-bindgen/wasm-bindgen/issues/3298)  
26. Browser and Node.js Differences in Concurrency | by Artem Khrienov \- Medium, accessed February 14, 2026, [https://medium.com/@artemkhrenov/browser-and-node-js-differences-in-concurrency-bc2f24cf4e56](https://medium.com/@artemkhrenov/browser-and-node-js-differences-in-concurrency-bc2f24cf4e56)  
27. Environment detection: node.js or browser \- javascript \- Stack Overflow, accessed February 14, 2026, [https://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser](https://stackoverflow.com/questions/17575790/environment-detection-node-js-or-browser)  
28. How to check whether a script is running under Node.js? \- Stack Overflow, accessed February 14, 2026, [https://stackoverflow.com/questions/4224606/how-to-check-whether-a-script-is-running-under-node-js](https://stackoverflow.com/questions/4224606/how-to-check-whether-a-script-is-running-under-node-js)  
29. Understanding the Dichotomy: Node.js vs. Browser JavaScript Execution | by Pradeep singh, accessed February 14, 2026, [https://medium.com/@pradeepsinghonline/understanding-the-dichotomy-node-js-vs-browser-javascript-execution-83e1a1f000fe](https://medium.com/@pradeepsinghonline/understanding-the-dichotomy-node-js-vs-browser-javascript-execution-83e1a1f000fe)  
30. File system | Node.js v25.6.1 Documentation, accessed February 14, 2026, [https://nodejs.org/api/fs.html](https://nodejs.org/api/fs.html)  
31. Differences between Node environment and browser javascript environment, accessed February 14, 2026, [https://stackoverflow.com/questions/23959868/differences-between-node-environment-and-browser-javascript-environment](https://stackoverflow.com/questions/23959868/differences-between-node-environment-and-browser-javascript-environment)  
32. Differences between Node.js and the Browser, accessed February 14, 2026, [https://nodejs.org/en/learn/getting-started/differences-between-nodejs-and-the-browser](https://nodejs.org/en/learn/getting-started/differences-between-nodejs-and-the-browser)  
33. Understanding Dependency Injection in TypeScript | by Ali Pouryousefi | Stackademic, accessed February 14, 2026, [https://blog.stackademic.com/understanding-dependency-injection-in-typescript-0bc87a11b6dd](https://blog.stackademic.com/understanding-dependency-injection-in-typescript-0bc87a11b6dd)  
34. The Power of Dependency Injection in TypeScript \- DEV Community, accessed February 14, 2026, [https://dev.to/ruben\_alapont/the-power-of-dependency-injection-in-typescript-3m5e](https://dev.to/ruben_alapont/the-power-of-dependency-injection-in-typescript-3m5e)  
35. Wasm (rust), vite, and pnpm workspace | by Agnislav Onufriichuk \- Medium, accessed February 14, 2026, [https://medium.com/@agnislav/wasm-rust-vite-and-pnpm-workspace-db561f77c5ca](https://medium.com/@agnislav/wasm-rust-vite-and-pnpm-workspace-db561f77c5ca)  
36. Ultimate Guide: How to Set Up a Frontend Monorepo with Vite, pnpm, and Shared UI Libraries | by Hiba Malhis | Medium, accessed February 14, 2026, [https://medium.com/@hibamalhiss/ultimate-guide-how-to-set-up-a-frontend-monorepo-with-vite-pnpm-and-shared-ui-libraries-4081585c069e](https://medium.com/@hibamalhiss/ultimate-guide-how-to-set-up-a-frontend-monorepo-with-vite-pnpm-and-shared-ui-libraries-4081585c069e)  
37. How to Set Up a Monorepo With Vite, TypeScript, and Pnpm Workspaces | HackerNoon, accessed February 14, 2026, [https://hackernoon.com/how-to-set-up-a-monorepo-with-vite-typescript-and-pnpm-workspaces](https://hackernoon.com/how-to-set-up-a-monorepo-with-vite-typescript-and-pnpm-workspaces)  
38. Creating a terminal application with ink \+ React \+ Typescript — An introduction \- Medium, accessed February 14, 2026, [https://medium.com/@pixelreverb/creating-a-terminal-application-with-ink-react-typescript-an-introduction-da49f3c012a8](https://medium.com/@pixelreverb/creating-a-terminal-application-with-ink-react-typescript-an-introduction-da49f3c012a8)  
39. What is React Ink? \- Harry Wolff, accessed February 14, 2026, [https://hswolff.com/blog/what-is-react-ink/](https://hswolff.com/blog/what-is-react-ink/)

[image1]: <data:image/png;base64,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>