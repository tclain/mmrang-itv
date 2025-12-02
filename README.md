# Memorang Interview

This repo contains my submission for the Full Stack AI Mini Test.

The repo showcase an autonomous reAct teaching agent as well:

- synchronized state agent <-> UI
- langgraph elegant computation graphs
- how tools can be leveraged to blend user actions and agentic workflows

## Project Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend application
│   └── agent/        # LangGraph agent
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Prerequisites

- **Important** Node.js 20.16.0+ or 22+
- [pnpm](https://pnpm.io/installation) 9.15.0 or later
- OpenAI API Key (for the LangGraph agent)

## Getting Started

1. Install all dependencies (this installs everything for both apps):

```bash
pnpm install
```

2. Set up your OpenAI API key:

```bash
cd apps/agent
echo "OPENAI_API_KEY=your-openai-api-key-here" > .env
```

3. Start the development servers:

```bash
pnpm dev
```

This will start both the Next.js app (on port 3000) and the LangGraph agent (on port 8123) using Turborepo.

## Note

In `/apps/agent/src/agent-interrupt.ts` there is the first version that I worked on which showcase a more rigid workflows based on interruption.

In the end a single agent felt better as it combined natural segues and tool calls and allowed the user to naturally converse with the agent at key points.
