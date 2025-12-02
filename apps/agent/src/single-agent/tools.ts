/**
 * Frontend Tool Schemas for the Single Agent
 *
 * These tool schemas define what the frontend should implement.
 * The agent will call these tools, and CopilotKit will route them to
 * the frontend actions defined via useFrontendTool().
 *
 * Backend tools are also defined here and will be executed server-side.
 */

import { z } from "zod";

// Tool: Ingest PDF file
export const IngestPdfSchema = z.object({
  pdfUrl: z.string().describe("URL or path to the PDF file to ingest"),
});

// Tool: Present learning plan for approval
export const PresentLearningPlanSchema = z.object({
  objectives: z
    .array(
      z.object({
        topic: z.string(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      })
    )
    .describe("Array of learning objectives with topics and difficulty levels"),
  message: z
    .string()
    .describe("Message to display to the user explaining the learning plan"),
});

// Tool: Render MCQ widget
export const RenderMCQSchema = z.object({
  question: z.string().describe("The MCQ question text"),
  choices: z
    .array(z.string())
    .describe("Array of answer choices (typically 4 options)"),
  objectiveTopic: z
    .string()
    .describe("The learning objective topic this MCQ relates to"),
  mcqIndex: z
    .number()
    .describe("Index of this MCQ within the current objective"),
});

// Tool: Provide visual feedback (green/red highlights)
export const ProvideFeedbackSchema = z.object({
  isCorrect: z.boolean().describe("Whether the user's answer was correct"),
  correctAnswer: z.string().describe("The correct answer text"),
  userAnswer: z.string().describe("The answer the user selected"),
  explanation: z
    .string()
    .describe("Explanation of why the answer is correct or incorrect"),
  visualFeedback: z
    .enum(["green", "red"])
    .describe("Visual feedback color: green for correct, red for incorrect"),
});

// Tool: Show hint to user
export const ShowHintSchema = z.object({
  hint: z.string().describe("A helpful hint without giving away the answer"),
  question: z.string().describe("The question the hint relates to"),
});

// Tool: Show explanation
export const ShowExplanationSchema = z.object({
  explanation: z
    .string()
    .describe("Detailed explanation of the correct answer"),
  question: z.string().describe("The question being explained"),
});

// Tool: Summarize results and provide study tips
export const SummarizeResultsSchema = z.object({
  performance: z
    .object({
      totalQuestions: z.number(),
      correctAnswers: z.number(),
      incorrectAnswers: z.number(),
      accuracy: z.number(),
    })
    .describe("Overall performance statistics"),
  studyTips: z
    .array(z.string())
    .describe("Personalized study tips based on performance"),
  summary: z
    .string()
    .describe("Summary of what was learned and areas for improvement"),
});

// ============================================================================
// BACKEND TOOLS
// ============================================================================

// Note: PDF ingestion is handled via interrupt in ingestPdfNode
// Backend tools can be added here for other server-side operations

// Export array of backend tools (empty for now, can add other tools as needed)
export const backendTools: any[] = [];
