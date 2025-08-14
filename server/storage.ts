import { 
  type User, type InsertUser,
  type TestSession, type InsertTestSession,
  type TestQuestion, type InsertTestQuestion,
  type TestAnswer, type InsertTestAnswer,
  type AiEvaluation, type InsertAiEvaluation,
  type AudioRecording, type InsertAudioRecording
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: string): Promise<TestSession | undefined>;
  updateTestSession(id: string, updates: Partial<TestSession>): Promise<TestSession | undefined>;
  getUserTestSessions(userId: string): Promise<TestSession[]>;
  getAllTestSessions(): Promise<TestSession[]>;

  // Test Questions
  createTestQuestion(question: InsertTestQuestion): Promise<TestQuestion>;
  getTestQuestions(section: string): Promise<TestQuestion[]>;
  getTestQuestion(id: string): Promise<TestQuestion | undefined>;
  updateTestQuestion(id: string, updates: Partial<TestQuestion>): Promise<TestQuestion | undefined>;

  // Test Answers
  createTestAnswer(answer: InsertTestAnswer): Promise<TestAnswer>;
  getSessionAnswers(sessionId: string): Promise<TestAnswer[]>;
  getQuestionAnswer(sessionId: string, questionId: string): Promise<TestAnswer | undefined>;

  // AI Evaluations
  createAiEvaluation(evaluation: InsertAiEvaluation): Promise<AiEvaluation>;
  getSessionEvaluations(sessionId: string): Promise<AiEvaluation[]>;

  // Audio Recordings
  createAudioRecording(recording: InsertAudioRecording): Promise<AudioRecording>;
  getSessionRecordings(sessionId: string): Promise<AudioRecording[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private testSessions: Map<string, TestSession> = new Map();
  private testQuestions: Map<string, TestQuestion> = new Map();
  private testAnswers: Map<string, TestAnswer> = new Map();
  private aiEvaluations: Map<string, AiEvaluation> = new Map();
  private audioRecordings: Map<string, AudioRecording> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create sample questions for testing
    const sampleQuestions: InsertTestQuestion[] = [
      {
        section: "listening",
        questionType: "multiple_choice",
        content: {
          question: "What is the student's main reason for visiting the office?",
          options: ["To register for a new course", "To change his timetable", "To get his student ID card"]
        },
        correctAnswers: ["B"],
        orderIndex: 1,
        audioUrl: "/audio/listening-section1.mp3"
      },
      {
        section: "listening",
        questionType: "fill_blank",
        content: {
          question: "The student's surname is ___________"
        },
        correctAnswers: ["Wilson"],
        orderIndex: 2,
        audioUrl: "/audio/listening-section1.mp3"
      },
      {
        section: "reading",
        questionType: "multiple_choice",
        content: {
          question: "According to the passage, what is the main cause of urban heat islands?",
          options: ["Industrial pollution", "Concrete and asphalt surfaces", "Vehicle emissions", "Population density"]
        },
        correctAnswers: ["B"],
        orderIndex: 1,
        passage: "Urban heat islands are metropolitan areas that are significantly warmer than their surrounding rural areas..."
      },
      {
        section: "writing",
        questionType: "essay",
        content: {
          task: "task1",
          prompt: "The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
          minWords: 150,
          timeLimit: 20
        },
        orderIndex: 1
      },
      {
        section: "speaking",
        questionType: "speaking_task",
        content: {
          part: 2,
          topic: "Describe a place you visited that was particularly memorable.",
          bullets: ["where this place was", "when you visited it", "what you did there", "and explain why it was so memorable for you"],
          preparationTime: 60,
          speakingTime: 120
        },
        orderIndex: 1
      }
    ];

    sampleQuestions.forEach(q => {
      const id = randomUUID();
      const question: TestQuestion = { 
        ...q, 
        id, 
        isActive: true,
        correctAnswers: q.correctAnswers || null,
        audioUrl: q.audioUrl || null,
        passage: q.passage || null
      };
      this.testQuestions.set(id, question);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date(),
      role: insertUser.role || 'student'
    };
    this.users.set(id, user);
    return user;
  }

  // Test Sessions
  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const id = randomUUID();
    const session: TestSession = {
      ...insertSession,
      id,
      startTime: new Date(),
      endTime: null,
      overallBand: null,
      listeningBand: null,
      readingBand: null,
      writingBand: null,
      speakingBand: null,
      status: insertSession.status || 'in-progress',
      currentSection: insertSession.currentSection || null,
      timeRemaining: insertSession.timeRemaining || null
    };
    this.testSessions.set(id, session);
    return session;
  }

  async getTestSession(id: string): Promise<TestSession | undefined> {
    return this.testSessions.get(id);
  }

  async updateTestSession(id: string, updates: Partial<TestSession>): Promise<TestSession | undefined> {
    const session = this.testSessions.get(id);
    if (!session) return undefined;
    
    const updated = { ...session, ...updates };
    this.testSessions.set(id, updated);
    return updated;
  }

  async getUserTestSessions(userId: string): Promise<TestSession[]> {
    return Array.from(this.testSessions.values()).filter(session => session.userId === userId);
  }

  async getAllTestSessions(): Promise<TestSession[]> {
    return Array.from(this.testSessions.values());
  }

  // Test Questions
  async createTestQuestion(insertQuestion: InsertTestQuestion): Promise<TestQuestion> {
    const id = randomUUID();
    const question: TestQuestion = { ...insertQuestion, id, isActive: true };
    this.testQuestions.set(id, question);
    return question;
  }

  async getTestQuestions(section: string): Promise<TestQuestion[]> {
    return Array.from(this.testQuestions.values())
      .filter(q => q.section === section && q.isActive)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getTestQuestion(id: string): Promise<TestQuestion | undefined> {
    return this.testQuestions.get(id);
  }

  async updateTestQuestion(id: string, updates: Partial<TestQuestion>): Promise<TestQuestion | undefined> {
    const question = this.testQuestions.get(id);
    if (!question) return undefined;
    
    const updated = { ...question, ...updates };
    this.testQuestions.set(id, updated);
    return updated;
  }

  // Test Answers
  async createTestAnswer(insertAnswer: InsertTestAnswer): Promise<TestAnswer> {
    const id = randomUUID();
    const answer: TestAnswer = { ...insertAnswer, id, submittedAt: new Date() };
    this.testAnswers.set(id, answer);
    return answer;
  }

  async getSessionAnswers(sessionId: string): Promise<TestAnswer[]> {
    return Array.from(this.testAnswers.values()).filter(answer => answer.sessionId === sessionId);
  }

  async getQuestionAnswer(sessionId: string, questionId: string): Promise<TestAnswer | undefined> {
    return Array.from(this.testAnswers.values()).find(
      answer => answer.sessionId === sessionId && answer.questionId === questionId
    );
  }

  // AI Evaluations
  async createAiEvaluation(insertEvaluation: InsertAiEvaluation): Promise<AiEvaluation> {
    const id = randomUUID();
    const evaluation: AiEvaluation = { ...insertEvaluation, id, evaluatedAt: new Date() };
    this.aiEvaluations.set(id, evaluation);
    return evaluation;
  }

  async getSessionEvaluations(sessionId: string): Promise<AiEvaluation[]> {
    return Array.from(this.aiEvaluations.values()).filter(evaluation => evaluation.sessionId === sessionId);
  }

  // Audio Recordings
  async createAudioRecording(insertRecording: InsertAudioRecording): Promise<AudioRecording> {
    const id = randomUUID();
    const recording: AudioRecording = { ...insertRecording, id, recordedAt: new Date() };
    this.audioRecordings.set(id, recording);
    return recording;
  }

  async getSessionRecordings(sessionId: string): Promise<AudioRecording[]> {
    return Array.from(this.audioRecordings.values()).filter(recording => recording.sessionId === sessionId);
  }
}

export const storage = new MemStorage();
