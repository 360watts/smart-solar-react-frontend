#!/usr/bin/env npx tsx
/**
 * Smart Solar Frontend Agent
 * An AI-powered assistant for this React + TypeScript codebase.
 *
 * Usage:
 *   npx tsx agent.ts "What does the Dashboard component do?"
 *   npx tsx agent.ts "Find all components that use the AuthContext"
 *   npx tsx agent.ts "Review the SiteDetail component for bugs"
 *
 * Or interactive mode (no prompt arg):
 *   npx tsx agent.ts
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";

const SYSTEM_PROMPT = `You are an expert frontend developer assistant for the Smart Solar React dashboard — a web admin interface for the 360Watts smart solar monitoring platform.

Tech stack: React 18 + TypeScript, React Router v6, Radix UI + shadcn/ui, Recharts, Framer Motion, TailwindCSS, Vite, socket.io-client.

Project layout:
- src/components/   — One file per page/feature
- src/contexts/     — AuthContext (JWT), NavigationContext, ThemeContext, ToastContext
- src/hooks/        — Custom React hooks
- src/services/     — API call functions (maps to Django endpoints)
- src/types/        — TypeScript interfaces
- src/lib/          — Utility helpers
- src/ui/           — shadcn/ui component overrides

Key conventions:
- Do NOT hard-code colors — use Tailwind tokens or CSS variables
- Dark mode via ThemeContext + Tailwind (html.dark-mode selector)
- JWT auth in AuthContext; access token in memory, refresh in localStorage
- All API calls through src/services/ with base URL from VITE_API_BASE_URL
- Native <select> elements are being migrated to Radix UI primitives (see CLAUDE.md)

Help with: reading code, finding bugs, explaining architecture, suggesting improvements, writing new features, refactoring.`;

async function runAgent(prompt: string): Promise<void> {
  console.log(`\n🤖 Agent: ${prompt}\n${"─".repeat(60)}`);

  for await (const message of query({
    prompt,
    options: {
      cwd: process.cwd(),
      allowedTools: ["Read", "Glob", "Grep"],
      systemPrompt: SYSTEM_PROMPT,
      maxTurns: 20,
    },
  })) {
    if ("result" in message) {
      console.log("\n" + message.result);
    }
  }
}

async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Smart Solar Frontend Agent — type "exit" to quit\n');

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === "exit") {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      try {
        await runAgent(trimmed);
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Main
const prompt = process.argv.slice(2).join(" ").trim();

if (prompt) {
  runAgent(prompt).catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  interactiveMode().catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
