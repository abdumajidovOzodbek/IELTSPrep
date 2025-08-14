import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("student"), // student, admin, examiner
  createdAt: timestamp("created_at").defaultNow(),
});

// Test sessions
export const testSessions = pgTable("test_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  testType: text("test_type").notNull(), // academic, general
  status: text("status").notNull().default("in_progress"), // in_progress, completed, paused
  currentSection: text("current_section").default("listening"), // listening, reading, writing, speaking
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  timeRemaining: integer("time_remaining"), // in seconds
  overallBand: real("overall_band"),
  listeningBand: real("listening_band"),
  readingBand: real("reading_band"),
  writingBand: real("writing_band"),
  speakingBand: real("speaking_band"),
});

// Test questions
export const testQuestions = pgTable("test_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  section: text("section").notNull(), // listening, reading, writing, speaking
  questionType: text("question_type").notNull(), // multiple_choice, fill_blank, essay, etc.
  content: jsonb("content").notNull(), // question data
  correctAnswers: jsonb("correct_answers"), // for objective questions
  orderIndex: integer("order_index").notNull(),
  audioUrl: text("audio_url"), // for listening questions
  passage: text("passage"), // for reading questions
  isActive: boolean("is_active").default(true),
});

// Student answers
export const testAnswers = pgTable("test_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  questionId: varchar("question_id").notNull(),
  answer: jsonb("answer").notNull(),
  isCorrect: boolean("is_correct"),
  score: real("score"),
  timeSpent: integer("time_spent"), // in seconds
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// AI evaluations
export const aiEvaluations = pgTable("ai_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  section: text("section").notNull(), // writing, speaking
  criteria: jsonb("criteria").notNull(), // detailed scoring criteria
  feedback: text("feedback").notNull(),
  bandScore: real("band_score").notNull(),
  aiProvider: text("ai_provider").default("openai"),
  rawResponse: jsonb("raw_response"),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

// Audio recordings (for speaking)
export const audioRecordings = pgTable("audio_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  section: text("section").notNull(),
  audioUrl: text("audio_url").notNull(),
  transcript: text("transcript"),
  duration: integer("duration"), // in seconds
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTestSessionSchema = createInsertSchema(testSessions).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const insertTestQuestionSchema = createInsertSchema(testQuestions).omit({
  id: true,
});

export const insertTestAnswerSchema = createInsertSchema(testAnswers).omit({
  id: true,
  submittedAt: true,
});

export const insertAiEvaluationSchema = createInsertSchema(aiEvaluations).omit({
  id: true,
  evaluatedAt: true,
});

export const insertAudioRecordingSchema = createInsertSchema(audioRecordings).omit({
  id: true,
  recordedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TestSession = typeof testSessions.$inferSelect;
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;

export type TestQuestion = typeof testQuestions.$inferSelect;
export type InsertTestQuestion = z.infer<typeof insertTestQuestionSchema>;

export type TestAnswer = typeof testAnswers.$inferSelect;
export type InsertTestAnswer = z.infer<typeof insertTestAnswerSchema>;

export type AiEvaluation = typeof aiEvaluations.$inferSelect;
export type InsertAiEvaluation = z.infer<typeof insertAiEvaluationSchema>;

export type AudioRecording = typeof audioRecordings.$inferSelect;
export type InsertAudioRecording = z.infer<typeof insertAudioRecordingSchema>;

// Enums for validation
export const TestSectionEnum = z.enum(["listening", "reading", "writing", "speaking"]);
export const TestStatusEnum = z.enum(["in_progress", "completed", "paused"]);
export const QuestionTypeEnum = z.enum(["multiple_choice", "fill_blank", "short_answer", "essay", "speaking_task"]);
