/**
 * wasmWrapper.ts
 * Generates a self-contained index.html that loads and runs a raw .wasm file
 * in the browser using the WebAssembly JavaScript API.
 *
 * The wrapper:
 *  - Fetches game.wasm (served from MinIO)
 *  - Instantiates it via WebAssembly.instantiateStreaming
 *  - Calls the exported `_start` or `main` function if present
 *  - Renders a canvas for games that draw to memory
 *  - Shows a loading spinner with progress
 */
export function generateWasmWrapper(
    title: string,
    wasmUrl: string,
): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    canvas { border: 1px solid #333; }
    #status {
      margin-top: 16px;
      font-size: 14px;
      color: #888;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #333;
      border-top-color: #6c63ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner" id="spinner"></div>
  <canvas id="canvas" width="800" height="600"></canvas>
  <div id="status">Loading ${escapeHtml(title)}...</div>
  <script>
    (async () => {
      const status = document.getElementById('status');
      const spinner = document.getElementById('spinner');
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');

      const memory = new WebAssembly.Memory({ initial: 256, maximum: 1024 });
      const importObject = {
        env: {
          memory,
          canvas_width: () => canvas.width,
          canvas_height: () => canvas.height,
          // Minimal WASI-subset polyfill
          abort: (msg, file, line, col) => {
            console.error(\`Abort: \${msg} at \${file}:\${line}:\${col}\`);
          },
        },
        wasi_snapshot_preview1: {
          fd_write: () => 0,
          proc_exit: (code) => { console.log('Exit:', code); },
          environ_get: () => 0,
          environ_sizes_get: () => 0,
        },
      };

      try {
        const response = await fetch('${wasmUrl}');
        if (!response.ok) throw new Error(\`Failed to load WASM: \${response.status}\`);

        const { instance } = await WebAssembly.instantiateStreaming(response, importObject);
        spinner.style.display = 'none';
        status.textContent = '';

        // Try common entry points
        const exp = instance.exports;
        if (typeof exp._start === 'function') exp._start();
        else if (typeof exp.main === 'function') exp.main();
        else if (typeof exp.run === 'function') exp.run();
        else {
          status.textContent = 'WASM loaded (no auto-start entry found).';
        }
      } catch (err) {
        spinner.style.display = 'none';
        status.textContent = 'Failed to load game. See console.';
        console.error(err);
      }
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
