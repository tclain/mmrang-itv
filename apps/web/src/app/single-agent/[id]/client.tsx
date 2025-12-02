"use client";

import FileUpload from "@/components/FileUpload";
import {
  useCoAgent,
  useCopilotChat,
  useFrontendTool,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { MessageRole, TextMessage } from "@copilotkit/runtime-client-gql";
import React from "react";
import type { AgentState } from "../../../../../agent/src/single-agent/state";

export function CopilotKit() {
  const chat = useCopilotChat();
  const agentState = useCoAgent<AgentState>({
    name: "single-agent",
  });

  // Handle LangGraph interrupts
  useLangGraphInterrupt({
    render: (args) => {
      console.log(args.event);
      if (args.event.value === "__interrupt_required_resource_uri") {
        return (
          <>
            <p>Start by uploading the PDF file to ingest</p>
            <FileUpload
              accept=".pdf"
              onUploaded={(data) => {
                args.resolve(data.url);
              }}
            />
          </>
        );
      }
      return "";
    },
  });

  // Tool: Present learning plan for approval
  useFrontendTool({
    name: "present_learning_plan",
    description: "Present the learning plan to the user for approval",
    parameters: [
      {
        name: "objectives",
        type: "object[]",
        description:
          "Array of learning objectives with topics and difficulty levels",
        required: true,
      },
      {
        name: "message",
        type: "string",
        description:
          "Message to display to the user explaining the learning plan",
        required: true,
      },
    ],
    handler: async (args: {
      objectives: Array<{
        topic: string;
        difficulty: "beginner" | "intermediate" | "advanced";
      }>;
      message: string;
    }) => {
      return {
        success: true,
        statusMessage: "Learning plan presented to user",
        objectives: args.objectives,
        message: args.message,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-4 border rounded-lg bg-blue-50 animate-pulse">
            <p className="text-sm text-gray-600">
              Creating your learning plan...
            </p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const objectives = (result.objectives || args.objectives) as Array<{
          topic: string;
          difficulty: "beginner" | "intermediate" | "advanced";
        }>;
        const message = result.message || args.message;
        const difficultyColors = {
          beginner: "bg-green-100 text-green-800",
          intermediate: "bg-yellow-100 text-yellow-800",
          advanced: "bg-red-100 text-red-800",
        };
        return (
          <div className="p-4 border rounded-lg bg-blue-50 mb-4">
            <h3 className="text-lg font-semibold mb-2">📚 Learning Plan</h3>
            {message && <p className="mb-4 text-gray-700">{message}</p>}
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Objectives:</h4>
              <ul className="space-y-2">
                {objectives.map((obj, idx: number) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-white rounded-md"
                  >
                    <span className="font-medium">{obj.topic}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        difficultyColors[obj.difficulty] ||
                        difficultyColors.beginner
                      }`}
                    >
                      {obj.difficulty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  // Tool: Render MCQ widget
  useFrontendTool({
    name: "render_mcq",
    description: "Render a multiple choice question widget",
    parameters: [
      {
        name: "question",
        type: "string",
        description: "The MCQ question text",
        required: true,
      },
      {
        name: "choices",
        type: "string[]",
        description: "Array of answer choices (typically 4 options)",
        required: true,
      },
      {
        name: "objectiveTopic",
        type: "string",
        description: "The learning objective topic this MCQ relates to",
        required: true,
      },
      {
        name: "mcqIndex",
        type: "number",
        description: "Index of this MCQ within the current objective",
        required: true,
      },
    ],
    handler: async (args) => {
      return {
        success: true,
        message: "MCQ rendered",
        question: args.question,
        choices: args.choices,
        objectiveTopic: args.objectiveTopic,
        mcqIndex: args.mcqIndex,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-4 border rounded-lg bg-purple-50 animate-pulse">
            <p className="text-sm text-gray-600">Preparing question...</p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const question = result.question || args.question;
        const choices = result.choices || args.choices;
        const topic = result.objectiveTopic || args.objectiveTopic;
        return (
          <div className="p-4 border rounded-lg bg-purple-50 mb-4">
            <div className="mb-2">
              <span className="text-xs text-gray-500 font-semibold">
                Topic: {topic}
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-4">❓ {question}</h3>
            <div className="space-y-2">
              {choices.map((choice: string, idx: number) => (
                <button
                  onClick={() => handleMCQSelect(choice)}
                  key={idx}
                  className="p-3 bg-white border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="font-medium mr-2">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  // Tool: Provide visual feedback (green/red highlights)
  useFrontendTool({
    name: "provide_feedback",
    description: "Provide visual feedback for user's answer",
    parameters: [
      {
        name: "isCorrect",
        type: "boolean",
        description: "Whether the user's answer was correct",
        required: true,
      },
      {
        name: "correctAnswer",
        type: "string",
        description: "The correct answer text",
        required: true,
      },
      {
        name: "userAnswer",
        type: "string",
        description: "The answer the user selected",
        required: true,
      },
      {
        name: "explanation",
        type: "string",
        description: "Explanation of why the answer is correct or incorrect",
        required: true,
      },
      {
        name: "visualFeedback",
        type: "string",
        description:
          "Visual feedback color: green for correct, red for incorrect",
        required: true,
      },
    ],
    handler: async (args: {
      isCorrect: boolean;
      correctAnswer: string;
      userAnswer: string;
      explanation: string;
      visualFeedback: string;
    }) => {
      return {
        success: true,
        message: "Feedback provided",
        ...args,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-3 border rounded-lg bg-gray-50 animate-pulse">
            <p className="text-sm text-gray-600">Evaluating your answer...</p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const isCorrect = result.isCorrect ?? args.isCorrect;
        const visualFeedback = result.visualFeedback || args.visualFeedback;
        const isGreen = visualFeedback === "green" || isCorrect;
        return (
          <div
            className={`p-4 rounded-lg border-2 mb-4 ${
              isGreen
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {isGreen ? (
                <span className="text-2xl">✅</span>
              ) : (
                <span className="text-2xl">❌</span>
              )}
              <span className="font-semibold text-lg">
                {isCorrect ? "Correct!" : "Incorrect"}
              </span>
            </div>
            {!isCorrect && (
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-medium">Correct answer:</span>{" "}
                {result.correctAnswer || args.correctAnswer}
              </p>
            )}
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  // Tool: Show hint to user
  useFrontendTool({
    name: "show_hint",
    description: "Show a hint to help the user without giving away the answer",
    parameters: [
      {
        name: "hint",
        type: "string",
        description: "A helpful hint without giving away the answer",
        required: true,
      },
      {
        name: "question",
        type: "string",
        description: "The question the hint relates to",
        required: true,
      },
    ],
    handler: async ({ hint, question }: { hint: string; question: string }) => {
      return {
        success: true,
        message: "Hint displayed",
        hint,
        question,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-3 border rounded-lg bg-yellow-50 animate-pulse">
            <p className="text-sm text-gray-600">Generating hint...</p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const hint = result.hint || args.hint;
        return (
          <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-300 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">💡</span>
              <span className="font-semibold">Hint</span>
            </div>
            <p className="text-gray-700">{hint}</p>
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  // Tool: Show explanation
  useFrontendTool({
    name: "show_explanation",
    description: "Show detailed explanation of the correct answer",
    parameters: [
      {
        name: "explanation",
        type: "string",
        description: "Detailed explanation of the correct answer",
        required: true,
      },
      {
        name: "question",
        type: "string",
        description: "The question being explained",
        required: true,
      },
    ],
    handler: async ({
      explanation,
      question,
    }: {
      explanation: string;
      question: string;
    }) => {
      return {
        success: true,
        message: "Explanation displayed",
        explanation,
        question,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-3 border rounded-lg bg-blue-50 animate-pulse">
            <p className="text-sm text-gray-600">Preparing explanation...</p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const explanation = result.explanation || args.explanation;
        return (
          <div className="p-4 border rounded-lg bg-blue-50 border-blue-300 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📚</span>
              <span className="font-semibold">Explanation</span>
            </div>
            <p className="text-gray-700">{explanation}</p>
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  // Tool: Summarize results and provide study tips
  useFrontendTool({
    name: "summarize_results",
    description: "Summarize learning session results and provide study tips",
    parameters: [
      {
        name: "performance",
        type: "object",
        description: "Overall performance statistics",
        required: true,
      },
      {
        name: "studyTips",
        type: "string[]",
        description: "Personalized study tips based on performance",
        required: true,
      },
      {
        name: "summary",
        type: "string",
        description: "Summary of what was learned and areas for improvement",
        required: true,
      },
    ],
    handler: async (args: {
      performance: object;
      studyTips: string[];
      summary: string;
    }) => {
      return {
        success: true,
        message: "Results summarized",
        performance: args.performance,
        studyTips: args.studyTips,
        summary: args.summary,
      };
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return (
          <div className="p-4 border rounded-lg bg-purple-50 animate-pulse">
            <p className="text-sm text-gray-600">Generating your summary...</p>
          </div>
        ) as React.ReactElement;
      }
      if (status === "complete" && result) {
        const performance = (result.performance || args.performance) as {
          totalQuestions: number;
          correctAnswers: number;
          incorrectAnswers: number;
        };
        const studyTips = result.studyTips || args.studyTips;
        const summary = result.summary || args.summary;
        const accuracy =
          performance?.totalQuestions > 0
            ? (
                (performance.correctAnswers / performance.totalQuestions) *
                100
              ).toFixed(1)
            : "0";
        return (
          <div className="p-6 border rounded-lg bg-linear-to-br from-purple-50 to-blue-50 border-purple-300 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎓</span>
              <h3 className="text-xl font-bold">Session Summary</h3>
            </div>
            {performance && (
              <div className="mb-4 p-4 bg-white rounded-lg">
                <h4 className="font-semibold mb-3">Performance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Questions:</span>{" "}
                    <span className="font-semibold">
                      {performance.totalQuestions}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Correct:</span>{" "}
                    <span className="font-semibold text-green-600">
                      {performance.correctAnswers}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Incorrect:</span>{" "}
                    <span className="font-semibold text-red-600">
                      {performance.incorrectAnswers}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Accuracy:</span>{" "}
                    <span className="font-semibold text-blue-600">
                      {accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            )}
            {summary && (
              <div className="mb-4 p-4 bg-white rounded-lg">
                <h4 className="font-semibold mb-2">Summary</h4>
                <p className="text-gray-700">{summary}</p>
              </div>
            )}
            {studyTips && studyTips.length > 0 && (
              <div className="p-4 bg-white rounded-lg">
                <h4 className="font-semibold mb-2">💡 Study Tips</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {studyTips.map((tip: string, idx: number) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) as React.ReactElement;
      }
      return <></>;
    },
  });

  const handleMCQSelect = (selectedAnswer: string) => {
    chat.appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `I selected: ${selectedAnswer}`,
      })
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-row gap-4 h-screen">
      <CopilotChat
        labels={{
          title: "Learning Assistant",
          initial:
            "Hi! I'm your learning assistant. Upload a PDF to get started, and I'll help you learn through interactive quizzes!",
        }}
      />
    </div>
  );
}
