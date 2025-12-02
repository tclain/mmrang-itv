/**
 * State definitions for the Single Agent
 */

import { Annotation } from "@langchain/langgraph";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

// ============================================================================
// TYPES
// ============================================================================

export type LearningObjective = {
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  completed: boolean;
  mcqCount: number;
  currentMcqIndex: number;
};

export type MCQ = {
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation?: string;
};

export type LearningSession = {
  objectives: LearningObjective[];
  currentObjectiveIndex: number;
  completedMcqs: MCQ[];
  performance: {
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
  };
};

export type AgentPhase =
  | "setup"
  | "planning"
  | "approval"
  | "learning"
  | "quiz"
  | "feedback"
  | "summary";

// ============================================================================
// STATE ANNOTATION
// ============================================================================

export const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec, // Includes messages and frontend tools
  // PDF processing
  pdfUrl: Annotation<string | null>,
  pdfContent: Annotation<string | null>,
  // Learning plan
  learningPlan: Annotation<LearningObjective[] | null>,
  planApproved: Annotation<boolean | null>,
  // Learning session
  learningSession: Annotation<LearningSession | null>,
  // Current state tracking
  currentPhase: Annotation<AgentPhase>,
  // Current MCQ being processed
  currentMcq: Annotation<MCQ | null>,
  userAnswer: Annotation<string | null>,
  answerSubmitted: Annotation<boolean>,
});

export type AgentState = typeof AgentStateAnnotation.State;

