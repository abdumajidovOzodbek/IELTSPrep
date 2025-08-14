import { z } from "zod";
import { ObjectId } from "mongodb";

// User schema
export const userSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["student", "admin", "examiner"]).default("student"),
  createdAt: z.date().default(() => new Date()),
});

// Test session schema
export const testSessionSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: z.string(),
  testType: z.enum(["academic", "general"]),
  status: z.enum(["in_progress", "completed", "paused"]).default("in_progress"),
  currentSection: z.enum(["listening", "reading", "writing", "speaking"]).default("listening"),
  startTime: z.date().default(() => new Date()),
  endTime: z.date().optional(),
  timeRemaining: z.number().optional(),
  overallBand: z.number().optional(),
  listeningBand: z.number().optional(),
  readingBand: z.number().optional(),
  writingBand: z.number().optional(),
  speakingBand: z.number().optional(),
});

// Listening Test Structure Schema
export const listeningTestSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  title: z.string(),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  sections: z.array(z.instanceof(ObjectId)),
  createdBy: z.string(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertListeningTestSchema = listeningTestSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// Listening Section Schema
export const listeningSectionSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  testId: z.instanceof(ObjectId),
  sectionNumber: z.number().min(1).max(4),
  title: z.string(),
  instructions: z.string(),
  audioFileId: z.instanceof(ObjectId),
  questions: z.array(z.instanceof(ObjectId)),
  duration: z.number().default(600), // 10 minutes default
  createdAt: z.date().default(() => new Date())
});

export const insertListeningSectionSchema = listeningSectionSchema.omit({ _id: true, createdAt: true });

// Audio Files Schema (for admin uploads)
export const audioFileSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  duration: z.number().optional(),
  transcript: z.string().optional(),
  sectionNumber: z.number().min(1).max(4).optional(),
  testId: z.instanceof(ObjectId).optional(),
  uploadedBy: z.string(),
  uploadedAt: z.date().default(() => new Date())
});

export const insertAudioFileSchema = audioFileSchema.omit({ _id: true, uploadedAt: true });

// Test question schema
export const testQuestionSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  section: z.enum(["listening", "reading", "writing", "speaking"]),
  questionType: z.enum(["multiple_choice", "fill_blank", "short_answer", "essay", "speaking_task"]),
  content: z.record(z.any()),
  correctAnswers: z.array(z.string()).optional(),
  orderIndex: z.number(),
  audioFileId: z.instanceof(ObjectId).optional(), // Reference to audio file
  passage: z.string().optional(),
  isActive: z.boolean().default(true),
  generatedBy: z.enum(["admin", "ai"]).default("admin"),
  createdAt: z.date().default(() => new Date()),
});

// Test answer schema
export const testAnswerSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  sessionId: z.string(),
  questionId: z.string(),
  answer: z.record(z.any()),
  isCorrect: z.boolean().optional(),
  score: z.number().optional(),
  timeSpent: z.number().optional(),
  submittedAt: z.date().default(() => new Date()),
});

// AI evaluation schema
export const aiEvaluationSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  sessionId: z.string(),
  section: z.enum(["writing", "speaking"]),
  criteria: z.record(z.any()),
  feedback: z.string(),
  bandScore: z.number(),
  aiProvider: z.string().default("gemini"),
  rawResponse: z.record(z.any()).optional(),
  evaluatedAt: z.date().default(() => new Date()),
});

// Audio recording schema
export const audioRecordingSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  sessionId: z.string(),
  section: z.string(),
  audioUrl: z.string(),
  transcript: z.string().optional(),
  duration: z.number().optional(),
  recordedAt: z.date().default(() => new Date()),
});

// Insert schemas (for validation before DB insert)
export const insertUserSchema = userSchema.omit({ _id: true, createdAt: true });
export const insertTestSessionSchema = testSessionSchema.omit({ _id: true, startTime: true });
export const insertTestQuestionSchema = testQuestionSchema.omit({ _id: true, createdAt: true });
export const insertTestAnswerSchema = testAnswerSchema.omit({ _id: true, submittedAt: true });
export const insertAiEvaluationSchema = aiEvaluationSchema.omit({ _id: true, evaluatedAt: true });
export const insertAudioRecordingSchema = audioRecordingSchema.omit({ _id: true, recordedAt: true });

// TypeScript types
export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TestSession = z.infer<typeof testSessionSchema>;
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;

export type AudioFile = z.infer<typeof audioFileSchema>;
export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type ListeningTest = z.infer<typeof listeningTestSchema>;
export type InsertListeningTest = z.infer<typeof insertListeningTestSchema>;
export type ListeningSection = z.infer<typeof listeningSectionSchema>;
export type InsertListeningSection = z.infer<typeof insertListeningSectionSchema>;

export type TestQuestion = z.infer<typeof testQuestionSchema>;
export type InsertTestQuestion = z.infer<typeof insertTestQuestionSchema>;

export type TestAnswer = z.infer<typeof testAnswerSchema>;
export type InsertTestAnswer = z.infer<typeof insertTestAnswerSchema>;

export type AiEvaluation = z.infer<typeof aiEvaluationSchema>;
export type InsertAiEvaluation = z.infer<typeof insertAiEvaluationSchema>;

export type AudioRecording = z.infer<typeof audioRecordingSchema>;
export type InsertAudioRecording = z.infer<typeof insertAudioRecordingSchema>;

// Enums for validation
export const TestSectionEnum = z.enum(["listening", "reading", "writing", "speaking"]);
export const TestStatusEnum = z.enum(["in_progress", "completed", "paused"]);
export const QuestionTypeEnum = z.enum(["multiple_choice", "fill_blank", "short_answer", "essay", "speaking_task"]);