import { MongoClient, Db, ObjectId } from "mongodb";
import {
  type User, type InsertUser,
  type TestSession, type InsertTestSession,
  type AudioFile, type InsertAudioFile,
  type TestQuestion, type InsertTestQuestion,
  type TestAnswer, type InsertTestAnswer,
  type AiEvaluation, type InsertAiEvaluation,
  type AudioRecording, type InsertAudioRecording,
  type ListeningTest, type InsertListeningTest,
  type ListeningSection, type InsertListeningSection
} from "@shared/schema";

// Define new types for Reading Tests and Passages if they are not already defined in @shared/schema
// For now, assuming they are not, and will use 'any' or define placeholder types.
// In a real scenario, these should be properly defined in the schema.
type ReadingTest = any;
type InsertReadingTest = any;
type ReadingPassage = any;
type InsertReadingPassage = any;

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

  // Audio Files
  createAudioFile(audioFile: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: string): Promise<AudioFile | undefined>;
  getAllAudioFiles(): Promise<AudioFile[]>;
  getRandomAudioFile(): Promise<AudioFile | undefined>;
  getAudioFilesByTest(testId: string): Promise<AudioFile[]>;

  // Test Questions
  createTestQuestion(question: InsertTestQuestion): Promise<TestQuestion>;
  getTestQuestions(section: string): Promise<TestQuestion[]>;
  getTestQuestion(id: string): Promise<TestQuestion | undefined>;
  updateTestQuestion(id: string, updates: Partial<TestQuestion>): Promise<TestQuestion | undefined>;
  getQuestionsByAudioFile(audioFileId: string): Promise<TestQuestion[]>;

  // Test Answers
  createTestAnswer(answer: InsertTestAnswer): Promise<TestAnswer>;
  getSessionAnswers(sessionId: string): Promise<TestAnswer[]>;
  getQuestionAnswer(sessionId: string, questionId: string): Promise<TestAnswer | undefined>;

  // AI Evaluations
  createAiEvaluation(evaluation: InsertAiEvaluation): Promise<AiEvaluation>;
  getSessionEvaluations(sessionId: string): Promise<AiEvaluation[]>;
  getEvaluationsForSession(sessionId: string, section?: string): Promise<AiEvaluation[]>; // Added method

  // Audio Recordings
  createAudioRecording(recording: InsertAudioRecording): Promise<AudioRecording>;
  getSessionRecordings(sessionId: string): Promise<AudioRecording[]>;

  // Listening Tests
  createListeningTest(data: InsertListeningTest): Promise<ListeningTest>;
  getListeningTest(id: string): Promise<ListeningTest | undefined>;
  getAllListeningTests(): Promise<ListeningTest[]>;
  updateListeningTest(id: string, updates: Partial<ListeningTest>): Promise<ListeningTest | undefined>;
  getRandomListeningTest(): Promise<ListeningTest | undefined>;

  // Listening Sections
  createListeningSection(data: InsertListeningSection): Promise<ListeningSection>;
  getListeningSection(id: string): Promise<ListeningSection | undefined>;
  getTestSections(testId: string): Promise<ListeningSection[]>;
  updateListeningSection(id: string, updates: Partial<ListeningSection>): Promise<ListeningSection | undefined>;

  // Reading Tests (New Methods)
  createReadingTest(data: InsertReadingTest): Promise<ReadingTest>;
  getReadingTest(id: string): Promise<ReadingTest | undefined>;
  getAllReadingTests(): Promise<ReadingTest[]>;
  updateReadingTest(id: string, updates: Partial<ReadingTest>): Promise<ReadingTest | undefined>;
  getRandomReadingTest(): Promise<ReadingTest | undefined>;

  // Reading Passages (New Methods)
  createReadingPassage(data: InsertReadingPassage): Promise<ReadingPassage>;
  getTestPassages(testId: string): Promise<ReadingPassage[]>;
  updateReadingPassage(id: string, updates: Partial<ReadingPassage>): Promise<ReadingPassage | undefined>;
  getQuestionsByPassage(passageId: string): Promise<TestQuestion[]>;
}

export class MongoStorage implements IStorage {
  private client: MongoClient;
  private db: Db;

  // These are placeholders for collection references, assuming they would be initialized properly.
  // The original code directly accessed this.db.collection("...")
  // For the sake of applying the change, we'll assume these are meant to be used within methods
  // and the actual MongoDB collection access is done via this.db.collection("...") as in the original.
  // If these were intended to be class properties, they'd need initialization.
  private users: any;
  private testSessions: any;
  private audioFiles: any;
  private questions: any; // Assuming this refers to testQuestions collection
  private answers: any;
  private evaluations: any; // Assuming this refers to aiEvaluations collection
  private recordings: any;
  private listeningTests: any;
  private listeningSections: any;
  private readingTests: any;
  private readingPassages: any;


  constructor() {
    const connectionString = process.env.DATABASE_URL || "mongodb+srv://ozod:1234ozod@cluster0.51dlocb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    this.client = new MongoClient(connectionString);
    this.db = this.client.db("ielts_test_platform");

    // Initializing collection references here as they are used in the added method.
    // This is an assumption based on the presence of `this.questions` and `this.evaluations` in the snippet.
    // In a real scenario, these would be initialized in the constructor after `this.db` is set.
    this.users = this.db.collection("users");
    this.testSessions = this.db.collection("testSessions");
    this.audioFiles = this.db.collection("audioFiles");
    this.questions = this.db.collection("testQuestions");
    this.answers = this.db.collection("testAnswers");
    this.evaluations = this.db.collection("aiEvaluations");
    this.recordings = this.db.collection("audioRecordings");
    this.listeningTests = this.db.collection("listeningTests");
    this.listeningSections = this.db.collection("listeningSections");
    this.readingTests = this.db.collection("reading_tests");
    this.readingPassages = this.db.collection("reading_passages");
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log("Connected to MongoDB");
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  // Helper to get DB connection, though the original code directly uses this.db
  // Keeping it for consistency with the provided change snippet, but note it's redundant if this.db is already initialized.
  private async getConnection(): Promise<Db> {
    if (!this.db) {
      await this.connect(); // Ensure connection if somehow lost or not initialized
    }
    return this.db;
  }


  // Users
  async getUser(id: string): Promise<User | undefined> {
    try {
      const user = await this.db.collection("users").findOne({ _id: new ObjectId(id) });
      return user ? { ...user, _id: user._id } as User : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await this.db.collection("users").findOne({ username });
    return user ? { ...user, _id: user._id } as User : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await this.db.collection("users").findOne({ email });
    return user ? { ...user, _id: user._id } as User : undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user = { ...userData, createdAt: new Date() };
    const result = await this.db.collection("users").insertOne(user);
    return { ...user, _id: result.insertedId } as User;
  }

  // Test Sessions
  async createTestSession(sessionData: InsertTestSession): Promise<TestSession> {
    const session = { ...sessionData, startTime: new Date() };
    const result = await this.db.collection("testSessions").insertOne(session);
    return { ...session, _id: result.insertedId } as TestSession;
  }

  async getTestSession(id: string): Promise<TestSession | undefined> {
    try {
      const session = await this.db.collection("testSessions").findOne({ _id: new ObjectId(id) });
      return session ? { ...session, _id: session._id } as TestSession : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async updateTestSession(id: string, updates: Partial<TestSession>): Promise<TestSession | undefined> {
    try {
      const result = await this.db.collection("testSessions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
      );
      return result ? { ...result, _id: result._id } as TestSession : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getUserTestSessions(userId: string): Promise<TestSession[]> {
    const sessions = await this.db.collection("testSessions").find({ userId }).toArray();
    return sessions.map(session => ({ ...session, _id: session._id } as TestSession));
  }

  async getAllTestSessions(): Promise<TestSession[]> {
    const sessions = await this.db.collection("testSessions").find({}).toArray();
    return sessions.map(session => ({ ...session, _id: session._id } as TestSession));
  }

  // Audio Files
  async createAudioFile(audioFileData: InsertAudioFile): Promise<AudioFile> {
    const audioFile = { ...audioFileData, uploadedAt: new Date() };
    const result = await this.db.collection("audioFiles").insertOne(audioFile);
    return { ...audioFile, _id: result.insertedId } as AudioFile;
  }

  async getAudioFile(id: string): Promise<AudioFile | undefined> {
    try {
      const audioFile = await this.db.collection("audioFiles").findOne({ _id: new ObjectId(id) });
      return audioFile ? { ...audioFile, _id: audioFile._id } as AudioFile : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getAllAudioFiles(): Promise<AudioFile[]> {
    const audioFiles = await this.db.collection("audioFiles").find({ isActive: true }).toArray();
    return audioFiles.map(file => ({ ...file, _id: file._id } as AudioFile));
  }

  async getAudioFilesByTest(testId: string): Promise<AudioFile[]> {
    try {
      const audioFiles = await this.db.collection("audioFiles").find({
        testId: new ObjectId(testId),
        isActive: true
      }).sort({ sectionNumber: 1 }).toArray();
      return audioFiles.map(file => ({ ...file, _id: file._id } as AudioFile));
    } catch (error) {
      return [];
    }
  }


  async getRandomAudioFile(): Promise<AudioFile | undefined> {
    const audioFiles = await this.db.collection("audioFiles").find({ isActive: true }).toArray();
    if (audioFiles.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * audioFiles.length);
    const selectedFile = audioFiles[randomIndex];
    return { ...selectedFile, _id: selectedFile._id } as AudioFile;
  }

  // Test Questions
  async createTestQuestion(questionData: InsertTestQuestion): Promise<TestQuestion> {
    const question = { ...questionData, createdAt: new Date() };
    const result = await this.db.collection("testQuestions").insertOne(question);
    return { ...question, _id: result.insertedId } as TestQuestion;
  }

  async getTestQuestions(section: string): Promise<TestQuestion[]> {
    const questions = await this.db.collection("testQuestions").find({
      section,
      isActive: true
    }).sort({ orderIndex: 1 }).toArray();
    return questions.map(question => ({ ...question, _id: question._id } as TestQuestion));
  }

  async getTestQuestion(id: string): Promise<TestQuestion | undefined> {
    try {
      const question = await this.db.collection("testQuestions").findOne({ _id: new ObjectId(id) });
      return question ? { ...question, _id: question._id } as TestQuestion : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async updateTestQuestion(id: string, updates: Partial<TestQuestion>): Promise<TestQuestion | undefined> {
    try {
      const result = await this.db.collection("testQuestions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: "after" }
      );
      return result ? { ...result, _id: result._id } as TestQuestion : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getQuestionsByAudioFile(audioFileId: string): Promise<TestQuestion[]> {
    try {
      const questions = await this.db.collection("testQuestions").find({
        audioFileId: new ObjectId(audioFileId),
        isActive: true
      }).sort({ orderIndex: 1 }).toArray();
      return questions.map(question => ({ ...question, _id: question._id } as TestQuestion));
    } catch (error) {
      return [];
    }
  }

  // Test Answers
  async createTestAnswer(answerData: InsertTestAnswer): Promise<TestAnswer> {
    const answer = { ...answerData, submittedAt: new Date() };
    const result = await this.db.collection("testAnswers").insertOne(answer);
    return { ...answer, _id: result.insertedId } as TestAnswer;
  }

  async getSessionAnswers(sessionId: string): Promise<TestAnswer[]> {
    const answers = await this.db.collection("testAnswers").find({ sessionId }).toArray();
    return answers.map(answer => ({ ...answer, _id: answer._id } as TestAnswer));
  }

  async getQuestionAnswer(sessionId: string, questionId: string): Promise<TestAnswer | undefined> {
    const answer = await this.db.collection("testAnswers").findOne({ sessionId, questionId });
    return answer ? { ...answer, _id: answer._id } as TestAnswer : undefined;
  }

  // AI Evaluations
  async createAiEvaluation(evaluationData: InsertAiEvaluation): Promise<AiEvaluation> {
    const evaluation = { ...evaluationData, evaluatedAt: new Date() };
    const result = await this.db.collection("aiEvaluations").insertOne(evaluation);
    return { ...evaluation, _id: result.insertedId } as AiEvaluation;
  }

  async getSessionEvaluations(sessionId: string): Promise<AiEvaluation[]> {
    const evaluations = await this.db.collection("aiEvaluations").find({ sessionId }).toArray();
    return evaluations.map(evaluation => ({ ...evaluation, _id: evaluation._id } as AiEvaluation));
  }

  // Added method from changes
  async getEvaluationsForSession(sessionId: string, section?: string): Promise<AiEvaluation[]> {
    try {
      const filter: any = { sessionId };
      if (section) {
        filter.section = section;
      }
      return await this.evaluations.find(filter).toArray();
    } catch (error) {
      console.error("Error getting evaluations for session:", error);
      return [];
    }
  }

  // Audio Recordings
  async createAudioRecording(recordingData: InsertAudioRecording): Promise<AudioRecording> {
    const recording = { ...recordingData, recordedAt: new Date() };
    const result = await this.db.collection("audioRecordings").insertOne(recording);
    return { ...recording, _id: result.insertedId } as AudioRecording;
  }

  async getSessionRecordings(sessionId: string): Promise<AudioRecording[]> {
    const recordings = await this.db.collection("audioRecordings").find({ sessionId }).toArray();
    return recordings.map(recording => ({ ...recording, _id: recording._id } as AudioRecording));
  }

  // Listening Tests
  async createListeningTest(data: InsertListeningTest): Promise<ListeningTest> {
    const result = await this.db.collection('listeningTests').insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...data, _id: result.insertedId, createdAt: new Date(), updatedAt: new Date() };
  }

  async getListeningTest(id: string): Promise<ListeningTest | undefined> {
    try {
      const test = await this.db.collection('listeningTests').findOne({ _id: new ObjectId(id) });
      return test ? { ...test, _id: test._id } as ListeningTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getAllListeningTests(): Promise<ListeningTest[]> {
    const tests = await this.db.collection('listeningTests').find({}).sort({ createdAt: -1 }).toArray();
    return tests.map(test => ({ ...test, _id: test._id } as ListeningTest));
  }

  async updateListeningTest(id: string, updates: Partial<ListeningTest>): Promise<ListeningTest | undefined> {
    try {
      const result = await this.db.collection('listeningTests').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result ? { ...result, _id: result._id } as ListeningTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getRandomListeningTest(): Promise<ListeningTest | undefined> {
    const pipeline = [
      { $match: { status: "active" } },
      { $sample: { size: 1 } }
    ];
    try {
      const result = await this.db.collection('listeningTests').aggregate(pipeline).toArray();
      return result.length > 0 ? { ...result[0], _id: result[0]._id } as ListeningTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Listening Sections
  async createListeningSection(data: InsertListeningSection): Promise<ListeningSection> {
    const result = await this.db.collection('listeningSections').insertOne({
      ...data,
      createdAt: new Date()
    });
    return { ...data, _id: result.insertedId, createdAt: new Date() };
  }

  async getListeningSection(id: string): Promise<ListeningSection | undefined> {
    try {
      const section = await this.db.collection('listeningSections').findOne({ _id: new ObjectId(id) });
      return section ? { ...section, _id: section._id } as ListeningSection : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getTestSections(testId: string): Promise<ListeningSection[]> {
    try {
      const sections = await this.db.collection('listeningSections')
        .find({ testId: new ObjectId(testId) })
        .sort({ sectionNumber: 1 })
        .toArray();
      return sections.map(section => ({ ...section, _id: section._id } as ListeningSection));
    } catch (error) {
      return [];
    }
  }

  async updateListeningSection(id: string, updates: Partial<ListeningSection>): Promise<ListeningSection | undefined> {
    try {
      const result = await this.db.collection('listeningSections').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updates },
        { returnDocument: 'after' }
      );
      return result ? { ...result, _id: result._id } as ListeningSection : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Reading Test methods
  async createReadingTest(testData: InsertReadingTest): Promise<ReadingTest> {
    const result = await this.db.collection('reading_tests').insertOne({
      ...testData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...testData, _id: result.insertedId, createdAt: new Date(), updatedAt: new Date() } as ReadingTest;
  }

  async getAllReadingTests(): Promise<ReadingTest[]> {
    const tests = await this.db.collection('reading_tests').find({}).sort({ createdAt: -1 }).toArray();
    return tests.map(test => ({ ...test, _id: test._id } as ReadingTest));
  }

  async getReadingTest(id: string): Promise<ReadingTest | undefined> {
    try {
      const test = await this.db.collection('reading_tests').findOne({ _id: new ObjectId(id) });
      return test ? { ...test, _id: test._id } as ReadingTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async updateReadingTest(id: string, updates: Partial<ReadingTest>): Promise<ReadingTest | undefined> {
    try {
      const result = await this.db.collection('reading_tests').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result ? { ...result, _id: result._id } as ReadingTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getRandomReadingTest(): Promise<ReadingTest | undefined> {
    const pipeline = [
      { $match: { status: "active" } },
      { $sample: { size: 1 } }
    ];
    try {
      const result = await this.db.collection('reading_tests').aggregate(pipeline).toArray();
      return result.length > 0 ? { ...result[0], _id: result[0]._id } as ReadingTest : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Reading Passage methods
  async createReadingPassage(passageData: InsertReadingPassage): Promise<ReadingPassage> {
    const result = await this.db.collection('reading_passages').insertOne({
      ...passageData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...passageData, _id: result.insertedId, createdAt: new Date(), updatedAt: new Date() } as ReadingPassage;
  }

  async getTestPassages(testId: string): Promise<ReadingPassage[]> {
    try {
      const passages = await this.db.collection('reading_passages')
        .find({ testId: new ObjectId(testId) })
        .sort({ passageNumber: 1 })
        .toArray();
      return passages.map(passage => ({ ...passage, _id: passage._id } as ReadingPassage));
    } catch (error) {
      return [];
    }
  }

  async updateReadingPassage(id: string, updates: Partial<ReadingPassage>): Promise<ReadingPassage | undefined> {
    try {
      const result = await this.db.collection('reading_passages').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result ? { ...result, _id: result._id } as ReadingPassage : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getQuestionsByPassage(passageId: string): Promise<TestQuestion[]> {
    try {
      console.log("Searching for questions with passageId:", passageId);

      // Try both string and ObjectId formats to be safe
      const questions = await this.db.collection('testQuestions')
        .find({ 
          $or: [
            { passageId: new ObjectId(passageId) },
            { passageId: passageId }
          ]
        })
        .sort({ orderIndex: 1 })
        .toArray();

      console.log("Found questions:", questions.length);
      if (questions.length > 0) {
        console.log("First question:", {
          id: questions[0]._id,
          question: questions[0].content?.question?.substring(0, 50),
          passageId: questions[0].passageId
        });
      }

      return questions.map(question => ({ ...question, _id: question._id } as TestQuestion));
    } catch (error) {
      console.error("Error in getQuestionsByPassage:", error);
      return [];
    }
  }
}

// Create and export storage instance
const storage = new MongoStorage();

// Connect to MongoDB on startup
storage.connect().catch(console.error);

export { storage };