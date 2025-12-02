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
import { useMemo, useState } from "react";
import type { AgentState } from "../../../../../agent/src/single-agent/state";

export function CopilotKit() {
  const chat = useCopilotChat();
  const agentState = useCoAgent<AgentState>({
    name: "single-agent",
  });

  // Derive UI state from agent state
  const state = agentState.state;

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

  const learningPlan = state.learningPlan;
  const planApproved = state.planApproved;
  const currentMcq = state.currentMcq;
  const userAnswer = state.userAnswer;
  const answerSubmitted = state.answerSubmitted;
  const learningSession = state.learningSession;

  // Derive learning plan state from agent state
  const learningPlanState = useMemo(() => {
    if (!learningPlan) return null;
    return {
      objectives: learningPlan.map((obj) => ({
        topic: obj.topic,
        difficulty: obj.difficulty,
      })),
      message: "", // Will be set by tool call
      approved: planApproved,
    };
  }, [learningPlan, planApproved]);

  // Derive summary state from learning session
  const summaryState = useMemo(() => {
    if (!learningSession?.performance) return null;
    const { performance } = learningSession;
    const accuracy =
      performance.totalQuestions > 0
        ? (performance.correctAnswers / performance.totalQuestions) * 100
        : 0;
    return {
      performance: {
        ...performance,
        accuracy,
      },
      studyTips: [], // Will be populated by tool call
      summary: "", // Will be populated by tool call
    };
  }, [learningSession]);

  // Minimal local state for UI-only concerns (hints, explanations, feedback)
  // These are set by tool calls but not stored in agent state
  const [uiFeedback, setUiFeedback] = useState<{
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string;
    explanation: string;
    visualFeedback: "green" | "red";
  } | null>(null);
  const [uiHint, setUiHint] = useState<{
    hint: string;
    question: string;
  } | null>(null);
  const [uiExplanation, setUiExplanation] = useState<{
    explanation: string;
    question: string;
  } | null>(null);
  const [planMessage, setPlanMessage] = useState<string>("");
  const [studyTips, setStudyTips] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState<string>("");
  //   const initializedRef = useRef(false);

  //   // Initialize chat on mount (only once)
  //   useEffect(() => {
  //     if (!initializedRef.current && !agentState.state.messages?.length) {
  //       initializedRef.current = true;
  //       chat.appendMessage(
  //         new TextMessage({
  //           role: MessageRole.System,
  //           content:
  //             "Hi! I'm your learning assistant. Please upload a PDF to get started.",
  //         })
  //       );
  //     }
  //     // eslint-disable-next-line react-hooks/exhaustive-deps
  //   }, []); // Only run on mount

  // ============================================================================
  // FRONTEND TOOLS - These are called by the agent
  // ============================================================================

  // Tool: Ingest PDF file
  useFrontendTool({
    name: "ingest_pdf",
    description: "Ingest a PDF file for processing",
    parameters: [
      {
        name: "pdfUrl",
        type: "string",
        description: "URL or path to the PDF file to ingest",
        required: true,
      },
    ],
    handler: async ({ pdfUrl: url }: { pdfUrl: string }) => {
      // The agent will handle the actual PDF processing via state
      return { success: true, message: `PDF ingested: ${url}` };
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
      setPlanMessage(args.message);
      return {
        success: true,
        message: "Learning plan presented to user",
      };
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
    handler: async () => {
      // Clear previous feedback/hints when new question is shown
      setUiFeedback(null);
      setUiHint(null);
      setUiExplanation(null);
      return {
        success: true,
        message: "MCQ rendered",
      };
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
      setUiFeedback({
        isCorrect: args.isCorrect,
        correctAnswer: args.correctAnswer,
        userAnswer: args.userAnswer,
        explanation: args.explanation,
        visualFeedback: args.visualFeedback as "green" | "red",
      });
      return {
        success: true,
        message: "Feedback provided",
      };
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
      setUiHint({ hint, question });
      return {
        success: true,
        message: "Hint displayed",
      };
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
      setUiExplanation({ explanation, question });
      return {
        success: true,
        message: "Explanation displayed",
      };
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
      setStudyTips(args.studyTips);
      setSummaryText(args.summary);
      return {
        success: true,
        message: "Results summarized",
      };
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleMCQSubmit = (selectedAnswer: string) => {
    if (!currentMcq || !selectedAnswer) return;
    // Send user's answer to the agent via chat
    chat.appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `I selected: ${selectedAnswer}`,
      })
    );
  };

  const handleMCQSelect = (selectedAnswer: string) => {
    chat.appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: `I selected: ${selectedAnswer}`,
      })
    );
  };

  const handleLearningPlanApproval = (approved: boolean) => {
    agentState.setState({
      ...state,
      planApproved: approved,
    });
    chat.appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: approved
          ? "Yes, I approve the learning plan."
          : "No, I'd like to revise the plan.",
      })
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-row gap-4 h-screen">
      {/* Left Panel: Learning Plan & Progress */}
      <div className="flex-1 overflow-y-auto p-4 border-r">
        <h2 className="text-2xl font-bold mb-4">Learning Assistant</h2>

        {/* <pre className="text-xs">
          {JSON.stringify(
            {
              ...state,
              copilotkit: { ...state.copilotkit, actions: undefined },
            },
            null,
            2
          )}
        </pre> */}

        {/* Learning Plan Approval */}
        {learningPlanState && planApproved === null && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-semibold mb-2">Learning Plan</h3>
            {planMessage && <p className="mb-4">{planMessage}</p>}
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Objectives:</h4>
              <ul className="list-disc list-inside space-y-1">
                {learningPlanState.objectives.map((obj, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{obj.topic}</span> (
                    <span className="text-sm text-gray-600">
                      {obj.difficulty}
                    </span>
                    )
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLearningPlanApproval(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleLearningPlanApproval(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Revise
              </button>
            </div>
          </div>
        )}

        {/* Learning Plan Progress */}
        {learningPlan && planApproved && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Learning Progress</h3>
            <ul className="space-y-2">
              {learningPlan.map((objective, idx) => (
                <li
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded ${
                    objective.completed ? "bg-green-100" : "bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={objective.completed}
                    readOnly
                    className="cursor-default"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{objective.topic}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      ({objective.difficulty})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* MCQ Widget */}
        {currentMcq && (
          <div className="mb-6 p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Question</h3>
            <p className="mb-4 font-medium">{currentMcq.question}</p>

            <div className="space-y-2 mb-4">
              {currentMcq.choices.map((choice, idx) => (
                <label
                  key={idx}
                  className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                    userAnswer === choice
                      ? "bg-blue-100 border-blue-500"
                      : "hover:bg-gray-50"
                  } ${
                    uiFeedback && uiFeedback.userAnswer === choice
                      ? uiFeedback.visualFeedback === "green"
                        ? "bg-green-200 border-green-500"
                        : "bg-red-200 border-red-500"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="mcq-choice"
                    value={choice}
                    checked={userAnswer === choice}
                    onChange={(e) => handleMCQSelect(e.target.value)}
                    disabled={answerSubmitted}
                    className="mr-3"
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </div>

            {!answerSubmitted && userAnswer && (
              <button
                onClick={() => handleMCQSubmit(userAnswer)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Answer
              </button>
            )}

            {/* Feedback */}
            {uiFeedback && (
              <div
                className={`mt-4 p-3 rounded-md ${
                  uiFeedback.visualFeedback === "green"
                    ? "bg-green-100 border border-green-300"
                    : "bg-red-100 border border-red-300"
                }`}
              >
                <p className="font-semibold mb-2">
                  {uiFeedback.isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                </p>
                <p className="text-sm">{uiFeedback.explanation}</p>
              </div>
            )}

            {/* Hint */}
            {uiHint && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                <p className="font-semibold mb-2">💡 Hint</p>
                <p className="text-sm">{uiHint.hint}</p>
              </div>
            )}

            {/* Explanation */}
            {uiExplanation && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-md">
                <p className="font-semibold mb-2">📚 Explanation</p>
                <p className="text-sm">{uiExplanation.explanation}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {summaryState && (
          <div className="mb-6 p-4 border rounded-lg bg-purple-50">
            <h3 className="text-lg font-semibold mb-2">Session Summary</h3>
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Performance:</h4>
              <ul className="text-sm space-y-1">
                <li>
                  Total Questions: {summaryState.performance.totalQuestions}
                </li>
                <li>
                  Correct: {summaryState.performance.correctAnswers} |
                  Incorrect: {summaryState.performance.incorrectAnswers}
                </li>
                <li>
                  Accuracy: {summaryState.performance.accuracy.toFixed(1)}%
                </li>
              </ul>
            </div>
            {summaryText && (
              <div className="mb-4">
                <p className="text-sm">{summaryText}</p>
              </div>
            )}
            {studyTips.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Study Tips:</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {studyTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Panel: Chat */}
      <div className="flex-1">
        <CopilotChat
          labels={{
            title: "Learning Assistant",
            initial:
              "Hi! I'm your learning assistant. Upload a PDF to get started, and I'll help you learn through interactive quizzes!",
          }}
        />
      </div>
    </div>
  );
}
