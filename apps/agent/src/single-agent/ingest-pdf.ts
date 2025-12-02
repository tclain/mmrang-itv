/**
 * PDF Ingestion Node with Interrupt Pattern
 * Uses interrupt to get PDF file path, then parses and stores content
 */

import { Command, interrupt } from "@langchain/langgraph";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";
import type { AgentState } from "./state";

/**
 * Ingest PDF node that uses interrupt to get file path from frontend
 * If PDF content already exists, skip to agent
 * Otherwise, interrupt to get file path, parse PDF, and update state
 */
export async function ingestPdfNode(state: AgentState) {
  // If PDF content already exists, skip ingestion and go to agent
  if (state.pdfContent) {
    return new Command({
      goto: "agent",
    });
  }

  // Interrupt to get the PDF file path/URI from frontend
  const contentUri = interrupt("__interrupt_required_resource_uri");

  // If no URI provided, stay in ingestPdf node
  if (!contentUri) {
    return new Command({
      goto: "ingestPdf",
    });
  }

  try {
    // Resolve the file path
    // contentUri should be relative to process.cwd() or absolute path
    const resolvedPath = join(process.cwd(), contentUri);

    // Parse PDF using PDFParse
    const readContent = new PDFParse({
      data: readFileSync(resolvedPath),
      CanvasFactory,
    });

    // Extract text from all pages
    const content = (await readContent.getText()).pages
      .map((page) => page.text)
      .join("\n");

    // Update state with PDF content and URL, then route to agent
    return new Command({
      goto: "agent",
      update: {
        pdfUrl: contentUri,
        pdfContent: content,
      },
    });
  } catch (error) {
    // If parsing fails, route to agent with error message (agent can handle it)
    return new Command({
      goto: "agent",
      update: {
        pdfUrl: contentUri,
        pdfContent: `Error parsing PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
    });
  }
}
