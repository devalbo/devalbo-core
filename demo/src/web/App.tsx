import React from 'react';
import { InkTerminalBox } from 'ink-web';
import { InteractiveShell } from '../components/InteractiveShell';

export const App: React.FC = () => {
  return (
    <div style={{
      maxWidth: '1200px',
      // margin: '40px auto',
      // padding: '20px'
    }}>
      {/* <h1>Demo CLI - ink-web Interactive Terminal</h1>

      <div style={{
        background: '#e3f2fd',
        padding: '15px',
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <p>
          <strong>🎉 ink-web Interactive Terminal!</strong>
        </p>
        <p>
          Type commands directly in the terminal below. The same Ink components that run in the terminal
          are now running in your browser thanks to ink-web.
        </p>
        <p>
          <strong>Try:</strong> <code>greet Alice</code>, <code>info</code>, <code>help</code>
        </p>
      </div> */}

      <div
        id="cli-terminal"
        style={{
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

      {/* <div style={{
        marginTop: '40px',
        padding: '15px',
        background: '#f0f9ff',
        borderRadius: '5px'
      }}>
        <h3>How it works</h3>
        <p>
          The <code>InkTerminalBox</code> component from ink-web provides a browser-based terminal.
          Our Ink components (<code>Greeter</code>, <code>Info</code>, etc.) render inside it
          using the same code that runs in the actual terminal!
        </p>
        <p className="mt-2">
          This is possible because Vite aliases <code>ink</code> to <code>ink-web</code> for browser builds.
        </p>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#fff3cd',
        borderRadius: '5px'
      }}>
        <h3>Terminal CLI</h3>
        <p>The same components also work in the actual terminal:</p>
        <pre style={{
          background: '#f4f4f4',
          padding: '10px',
          borderRadius: '5px',
          overflow: 'auto'
        }}>
          {`node dist/cli.js greet Alice
node dist/cli.js greet --interactive
node dist/cli.js info
node dist/cli.js --help`}
        </pre>
      </div> */}
    </div>
  );
};
