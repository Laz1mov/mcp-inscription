# MCP-Inscription Server: Project Architecture Overview

## Introduction

MCP-Inscription is a specialized server implementation that enables AI models and agents to interact with the Bitcoin blockchain through the Model Context Protocol (MCP). This server focuses on Bitcoin Ordinals detection, providing a standardized interface for Large Language Models (LLMs) to access and utilize blockchain data.

## Key Capabilities

- **Ordinal Inscription Detection**: Identifies and extracts content from Ordinal inscriptions embedded in transaction witness data.
- **Multiple Server Modes**: Supports both STDIO (JSON-RPC) and SSE (HTTP Server-Sent Events) transport mechanisms.
- **Robust Caching**: Implements efficient caching strategies to minimize redundant API calls and decoding operations.
- **Error Handling**: Comprehensive error management with specific Bitcoin error types.

## System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│               MCP-Inscription Server                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐         ┌───────────────────────────┐    │
│  │    Entry Point  │         │    Transport Servers      │    │
│  │   (index.ts)    │────────▶│                           │    │
│  └─────────────────┘         │  ┌─────────┐  ┌─────────┐ │    │
│                              │  │  STDIO  │  │   SSE   │ │    │
│                              │  └────┬────┘  └────┬────┘ │    │
│                              └──────┬─────────────┬──────┘    │
│                                     │             │           │
│  ┌─────────────────┐                │             │           │
│  │  Configuration  │                │             │           │
│(mcp_inscription_types.ts)◀──────────┴─────────────┘           │
│  └────────┬────────┘                │                         │
│           │              ┌──────────▼─────────────┐           │
│           │              │                        │           │
│           └─────────────▶│  BaseOrdinalsServer    │           │
│                          │    (servers/base.ts)   │           │
│                          └──────────┬─────────────┘           │
│                                     │                         │
│                                     │                         │
│                          ┌──────────▼─────────────┐           │
│                          │                        │           │
│                          │    OrdinalsClient      │           │
│                          │  (ordinals_client.ts)  │           │
│                          └──────────┬─────────────┘           │
│                                     │                         │
│                                     │                         │
│                          ┌──────────▼─────────────┐           │
│                          │                        │           │
│                          │    External APIs       │           │
│                          │ (Blockstream, Bitcoin) │           │
│                          └────────────────────────┘           │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                         Utility Modules                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────────┐     │
│  │   Cache     │  │   Logger   │  │  Error Handlers     │     │
│  │(utils/cache)│ │(utils/logger)│ │(utils/error_handlers)│    │
│  └─────────────┘  └────────────┘  └─────────────────────┘     │
│                                                               │
│  ┌─────────────────┐  ┌───────────────────┐                   │
│  │   JSON Utils    │  │     Version       │                   │
│  │(utils/json_utils)│ │  (utils/version)  │                   │
│  └─────────────────┘  └───────────────────┘                   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Component Details

### Core Components

1. **Entry Point (index.ts)**
   - Main entry point for the application
   - Handles configuration loading and server initialization
   - Provides factory-like functionality to create the appropriate server type

2. **Type Definitions (ord_mcp_types.ts)**
   - Comprehensive type definitions for the entire application
   - Zod schemas for validation of inputs/outputs
   - Error types and codes
   - Interface definitions for Bitcoin entities

3. **Server Base Class (servers/base.ts)**
   - Abstract base implementation providing core functionality
   - Tool registration and handling
   - Shared error management
   - Standard MCP server capabilities

4. **Transport Implementations**
   - **STDIO Server (servers/stdio.ts)**: JSON-RPC style communication over standard I/O
   - **SSE Server (servers/sse.ts)**: HTTP server with Server-Sent Events for web-based clients

5. **Ordinals Client (ordinals_client.ts)**
   - Core business logic for Bitcoin interactions
   - Transaction fetching and decoding
   - Ordinal inscription detection in witness data

### Utility Modules

1. **Cache (utils/cache.ts)**
   - Simple time-based caching mechanism
   - Prevents redundant API calls and decoding operations

2. **Error Handlers (utils/error_handlers.ts)**
   - Standardized error handling
   - Conversion of external errors to BitcoinError types

3. **Logger (utils/logger.js)**
   - Structured logging using Pino
   - Multiple log levels for debugging

4. **JSON Utilities (utils/json_utils.js)**
   - Safe JSON serialization
   - Handling of BigInt values for JSON compatibility

5. **Version Management (utils/version.js)**
   - Server version tracking and reporting

### External Dependencies

1. **@modelcontextprotocol/sdk**: Core MCP server implementation
2. **bitcoinjs-lib**: Bitcoin transaction parsing and manipulation
3. **node-fetch**: API requests to Blockstream
4. **zod**: Schema validation
5. **pino**: Structured logging

## Data Flow

1. **Client Request**: An LLM or agent makes a request through the MCP interface.
2. **Server Handling**: The appropriate server (STDIO or SSE) receives the request.
3. **Tool Processing**: BaseOrdinalsServer identifies the requested tool and validates parameters.
4. **Blockchain Interaction**: OrdinalsClient fetches data from Blockstream API.
5. **Specialized Decoding**:
   - For Ordinals: Witness data is analyzed for inscription content
6. **Result Processing**: Data is formatted appropriately (hex, base64, etc.)
7. **Response**: Structured data is returned to the client through the MCP protocol

## Key Design Patterns

1. **Factory Pattern**: Used in index.ts to create the appropriate server type.
2. **Strategy Pattern**: Different transport mechanisms (STDIO vs SSE) implement the same interface.
3. **Template Method Pattern**: BaseOrdinalsServer defines the skeleton of operations.
4. **Decorator Pattern**: Error handling decorates core functionality.
5. **Singleton**: Logger and Version utilities follow singleton-like patterns.
6. **Cache Pattern**: Implemented for transaction data to optimize performance.

## Testing Strategy

Tests are located in `src/__tests__/` and focus on:

1. **Unit Testing**: Core functionality in isolation
2. **Integration Testing**: End-to-end tests with real blockchain data
3. **Mock Testing**: Using Jest mocks for external services

## Conclusion

The MCP-Inscription server is designed with a focus on modularity, type safety, and clear separation of concerns. Its architecture allows for easy extension to support additional blockchain protocols and transport mechanisms. The system employs efficient caching and robust error handling to provide reliable service for AI models interacting with Bitcoin data. 
