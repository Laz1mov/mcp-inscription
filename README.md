<div align="center">

<a href="https://bitcoin.org/"> <img alt="Bitcoin" src="https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white" height=30></a>
<a href="https://modelcontextprotocol.com/"> <img alt="MCP" src="https://img.shields.io/badge/MCP-000?style=for-the-badge&logo=modelcontextprotocol&logoColor=white" height=30></a>
</div>

# MCP-Inscription Server

<div align="center">
  <h3>
    <a href="https://github.com/Laz1mov/mcp-inscription/">
      Documentation
    </a>
    <span> | </span>
    <a href="https://github.com/Laz1mov/mcp-inscription/#-available-tools">
      Available Tools
    </a>
    <span> | </span>
    <a href="https://modelcontextprotocol.com/">
      MCP Docs
    </a>
    <span> | </span>
    <a href="https://docs.ordinals.com/">
      Ordinals Docs
    </a>
  </h3>
</div>

## Overview

A Model Context Protocol (MCP) server that enables AI models to interact with Ordinals Inscriptions, allowing them to display content from a transaction.

## 💼 Table of Contents

- [MCP-Inscription Server](#mcp-inscription-server)
  - [Overview](#overview)
  - [💼 Table of Contents](#-table-of-contents)
  - [🔧 Features](#-features)
  - [🦆 Goose Integration](#-goose-integration)
    - [Using STDIO (Local Extension)](#using-stdio-local-extension)
      - [Using SSE (Remote Extension)](#using-sse-remote-extension)  
  - [🔑 Claude Desktop Integration](#-claude-desktop-integration)
    - [Testing the Claude Desktop Integration](#testing-the-claude-desktop-integration)
  - [📂 Project Structure](#-project-structure)
  - [📦 Development Setup](#-development-setup)
  - [📦 Available Tools](#-available-tools)
    - [show\_ordinals](#show_ordinals)
  - [🚨 Error Handling](#-error-handling)
  - [🤝 Contributing](#-contributing)
  - [📝 License](#-license)

## 🔧 Features

- **Ordinal Detection**: Automatically detect and parse Bitcoin transaction into ordinals, supporting text-based, images, json and more inscriptions formats.

## 🦆 Goose Integration

Goose is an open-source AI agent framework by Block that supports extensions via the Model Context Protocol. You can integrate the MCP-Inscription server as a Goose extension to allow Goose to interact with Ordinals Inscriptions. Goose supports two modes of integration for MCP servers: running the server as a local process (STDIO) or connecting to it as a remote service via Server-Sent Events (SSE). Below are instructions for both methods:

### Using STDIO (Local Extension)

This method runs the MCP-Inscription server locally as a subprocess of Goose, communicating through standard input/output.

1. **Clone and Build the MCP-Inscription Repository (if you haven't already):**
   ```bash
   git clone https://github.com/Laz1mov/mcp-inscription
   cd mcp-inscription
   npm install
   npm run build
   ```
   Note the full absolute path to the repository, as you'll need it in the next step.

2. **Add a new extension in Goose:** Open Goose's configuration interface. You can do this via the command line by running `goose configure`, or in the Goose Desktop app by going to **Settings > Extensions**. From the menu, choose **"Add Extension."** ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#adding-extensions#:~:text=1))

3. **Choose the extension type – Command-Line Extension:** When prompted for the type of extension, select **Command-Line Extension** (in the CLI menu or UI) so that Goose knows it should launch a local command ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#adding-extensions#:~:text=3,extension%20you%E2%80%99d%20like%20to%20add)) (as opposed to a built-in or remote extension).

4. **Enter the extension details:** Provide a name and command for the MCP-Inscription server:

   - **ID**: `mcp-inscription`
   - **Name:** You can call it "mcp-inscription", or any identifier (this will be how you refer to the extension).
   - **Command:** Specify the full path to the built CLI script. For example:

     ```bash
     node /absolute/path/to/mcp-inscription/build/cli.js
     ```

     Replace `/absolute/path/to/mcp-inscription` with the actual path to where you cloned the repository.
   - You typically do not need to add any arguments beyond the script path (unless your server requires special flags).

5. **Finalize and enable:** Complete the extension addition. Goose will add this new extension to its configuration (usually `~/.config/goose/config.yaml`). Ensure the extension is **enabled** (if using the CLI wizard, it should be enabled by default once added; in the Goose Desktop app, you can check the Extensions list and toggle it on if it isn't already ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#:~:text=%E2%97%87%20%20What%20would%20you,%E2%94%82%20%20%E2%97%BB%20fetch%20%E2%94%94)) ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#:~:text=%E2%94%82%20%20%E2%97%BE%20developer%20%E2%94%82,%E2%97%BB%20fetch%20%E2%94%94))).

6. **Start a Goose session with the new extension:** You can now use the extension in Goose. If you're running Goose via CLI, start a session that includes the extension by running:

   ```bash
   goose session --with-extension "mcp-inscription"
   ```

replacing "ordinals" with whatever name you gave the extension ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#:~:text=Starting%20a%20Session%20with%20Extensions)). (This ensures the session loads the extension. Alternatively, if the extension is enabled globally, Goose Desktop or CLI will automatically have it available in all sessions.)

#### Using SSE (Remote Extension)

This method connects Goose to an already-running MCP server via an HTTP SSE stream. Use this if you want to run the MCP-Inscription server as a standalone service (possibly on another machine or just independently of Goose).

1. **Launch the MCP server as a standalone service:** Run the MCP-Inscription server in SSE mode to listen for connections:

   ```bash
   # Navigate to your mcp-inscription directory
   cd /path/to/mcp-inscription
   
   # If you havent built it yet
   npm install
   npm run build
   
   # Run in SSE mode on port 3000 (default)
   SERVER_MODE=sse node build/cli.js
   
   # Alternatively, specify a different port
   SERVER_MODE=sse PORT=9000 node build/cli.js
   ```

   This will start the server in SSE mode, making it available at `http://localhost:3000` (or your specified port).

2. **Add a new extension in Goose (Remote):** As before, run `goose configure` or use the Goose UI to **Add Extension** ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#adding-extensions#:~:text=1)). This time, choose **Remote Extension** when asked for the type of extension ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#adding-extensions#:~:text=3,extension%20you%E2%80%99d%20like%20to%20add)). This tells Goose that it will connect to an external server via SSE.

3. **Enter the remote extension details:** Give the extension a name (e.g., "ordinals") and provide the server's URL. For the **URL**, enter the base address where the MCP server is running. For instance, if your server is listening on port 9000 on your local machine, you might enter `http://localhost:9000`. Goose will attempt to connect to the MCP server's SSE endpoint at that address. (Goose uses the standard MCP SSE path, which by convention is under the `/mcp/sse` route on the server, you usually just need to supply the host and port, and Goose handles the rest.)

4. **Enable the extension:** After adding the remote extension, ensure it's enabled in Goose's settings (just like in the STDIO case). Only one of the STDIO or SSE extension (with the same tools) needs to be enabled – if you accidentally enable both a local and remote version of the same server, you may want to disable one to avoid confusion.

**Using the MCP-Inscription extension in Goose:** Once the extension is set up (via either method above) and enabled, you can interact with Goose and query ord data through it. In a new Goose chat or session, simply ask questions as you normally would. Goose will recognize when to use the MCP-Inscription tools to fulfill your request. For example:

- _"Show me Ordinals: 0169d12c4edf2026a67e219c10207438a080eb82d8f21860f6784dd66f281389?"_

When you ask these questions, Goose will invoke the MCP-Inscription server's tools and return the answer (e.g., the latest Bitcoin block information). You should see Goose responding with up-to-date information pulled from the Bitcoin blockchain via the MCP-Inscription server.

If Goose does not seem to use the extension (for instance, if it responds that it cannot find the information), make sure the extension is enabled and that the server is running (in SSE mode for remote). You can also run Goose's CLI with verbose logging to see if it attempted to call the extension. Generally, if configured correctly, Goose will automatically discover the MCP-Inscription server's capabilities and use them when relevant.

**Further Resources:** For more details on Goose extensions and the MCP, refer to the official Goose documentation ([Using Extensions | goose](https://block.github.io/goose/docs/getting-started/using-extensions/#adding-extensions#:~:text=MCP%20Server%20Directory)). The docs include a list of built-in and community extensions and explain how MCP servers integrate into Goose. You can also find a directory of available MCP servers and additional configuration tips in the Goose docs and the Model Context Protocol documentation. This can help if you want to explore more extensions or develop your own.

## 🔑 Claude Desktop Integration

To use the MCP-Inscription server with Claude Desktop (Anthropic's desktop app for Claude), follow these steps:

1. **Download and Install Claude Desktop:** Visit the official Claude Desktop downloads page and get the app for your operating system (macOS or Windows) ([Installing Claude for Desktop | Anthropic Help Center](https://support.anthropic.com/en/articles/10065433-installing-claude-for-desktop#:~:text=1,page)). Install the app and ensure you're using the latest version (you can check for updates in the app menu).

2. **Clone and Build the MCP-Inscription Repository:**
   ```bash
   git clone https://github.com/Laz1mov/mcp-inscription
   cd mcp-inscription
   npm install
   npm run build
   ```

3. **Configure Claude Desktop to use the MCP-Inscription Server:** Open the Claude Desktop configuration file (it's created when you first edit settings in Claude Desktop):

   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
     Add an entry for the MCP-Inscription server in this JSON config under the `"mcpServers"` section. For example:

   ```json
   {
     "mcpServers": {
       "mcp-inscription": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-inscription/build/cli.js"]
       }
     }
   }
   ```

   In the snippet above, `"mcp-inscription"` is an identifier for the server (you can name it whatever you want). Replace `/absolute/path/to/mcp-inscription` with the actual full path to where you cloned the repository.

4. **Restart Claude Desktop:** Save the `claude_desktop_config.json` file and then **close and reopen Claude Desktop**. On the next launch, Claude will automatically start the MCP-Inscription server as configured. If Claude Desktop was running, you need to restart it for the changes to take effect.

### Testing the Claude Desktop Integration

Once Claude Desktop is restarted, you can test whether the MCP-Inscription server is working correctly:

- **Verify the response:** Claude should return a detailed answer (e.g. the inscription itself or runes info) without errors. If you get an error message or no useful response, the MCP server might not be connected properly.

- **Check Claude's logs (if needed):** Claude Desktop provides log files that can help debug MCP integrations. If the tool isn't responding, check the log files in:
  - **macOS:** `~/Library/Logs/Claude/`
  - **Windows:** `%APPDATA%\Claude\logs\`  
    Look for `mcp.log` for general MCP connection messages, and a file named `mcp-server-mcp-inscription.log` (or with whatever name you used) for the MCP server's output/errors. These logs will show if the server started up or if there were any errors (such as a wrong path or exceptions in the server). If you see errors, fix the configuration or environment as needed, then restart Claude Desktop and test again.


## 📂 Project Structure

```text
mcp-inscription/
├── src/
│   ├── ordinals_client.ts      # Bitcoin ordinals and runestone utility functions
│   ├── servers/
│   │   ├── index.ts            # Server exports and factory functions
│   │   ├── sse.ts              # Server implementation using SSE transport
│   │   ├── stdio.ts            # Server implementation using STDIO transport
│   │   └── base.ts             # Base server implementation with shared functionality
│   ├── index.ts                # Main entry point
│   ├── cli.ts                  # CLI launcher
│   ├── mcp_inscription_types.ts # Shared types and schemas for the MCP-Inscription server
│   └── utils/
│       ├── logger.ts           # Logger setup
│       ├── cache.ts            # Caching implementation
│       ├── error_handlers.ts   # Error handling utilities
│       ├── json_utils.ts       # JSON processing utilities
│       ├── img_utils.ts        # Image processing and conversion utilities
│       └── version.ts          # Version information
├── .env.example                # Example environment configuration file
├── package.json
├── tsconfig.json
└── README.md
```

## 📦 Available Tools

### show_ordinals

**Description:**  
Decodes Ordinal inscription data from a transaction's witness data.

**Input Schema:**
```json
{
  "txid": "string"
}
```

**Example Input:**
```json
{
  "txid": "0169d12c4edf2026a67e219c10207438a080eb82d8f21860f6784dd66f281389"
}
```

**Output:**  
Returns the decoded inscription content, which may be text, JSON, HTML, or other formats.

## 🚨 Error Handling

The server employs custom error types to handle Bitcoin operations and blockchain queries. Detailed error messages are logged using Pino and included in client responses for easier debugging.

## 🤝 Contributing

Contributions and feature requests are welcome! Feel free to submit pull requests or open issues on GitHub.

## 📝 License

This project is licensed under the [MIT License](LICENSE).
