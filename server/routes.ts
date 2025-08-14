import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openaiService } from "./services/openai";
import { ScoringService } from "./lib/scoring";
import { rawScoreToBand, calculateOverallBand } from "./lib/band-mapping";
import { 
  insertTestSessionSchema, 
  insertTestAnswerSchema, 
  insertAiEvaluationSchema,
  insertAudioRecordingSchema,
  TestSectionEnum 
} from "@shared/schema";
import rateLimit from "express-rate-limit";
import multer from "multer";

// Rate limiting for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many AI requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Test Sessions
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertTestSessionSchema.parse(req.body);
      const session = await storage.createTestSession(sessionData);
      res.json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getTestSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const updates = req.body;
      const session = await storage.updateTestSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test Questions
  app.get("/api/questions/:section", async (req, res) => {
    try {
      const section = TestSectionEnum.parse(req.params.section);
      const questions = await storage.getTestQuestions(section);
      res.json(questions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Test Answers
  app.post("/api/answers", async (req, res) => {
    try {
      const answerData = insertTestAnswerSchema.parse(req.body);
      const answer = await storage.createTestAnswer(answerData);
      res.json(answer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:sessionId/answers", async (req, res) => {
    try {
      const answers = await storage.getSessionAnswers(req.params.sessionId);
      res.json(answers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scoring endpoints
  app.post("/api/sessions/:sessionId/score/:section", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const section = TestSectionEnum.parse(req.params.section);
      
      const answers = await storage.getSessionAnswers(sessionId);
      const questions = await storage.getTestQuestions(section);
      
      const sectionAnswers = answers.filter(a => 
        questions.some(q => q.id === a.questionId)
      );

      if (section === 'listening' || section === 'reading') {
        const result = ScoringService.scoreObjectiveAnswers(sectionAnswers, questions);
        const band = rawScoreToBand(result.rawScore, section);
        
        // Update session with band score
        const updateField = section === 'listening' ? { listeningBand: band } : { readingBand: band };
        await storage.updateTestSession(sessionId, updateField);
        
        res.json({ ...result, band });
      } else {
        res.status(400).json({ error: "Use AI evaluation endpoints for writing/speaking" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // OpenAI/AI endpoints
  app.get("/api/ai/health", aiRateLimit, async (req, res) => {
    try {
      const healthCheck = await openaiService.generateText("Test connection");
      res.json({ 
        status: healthCheck.success ? "operational" : "error",
        message: healthCheck.error || "AI service is operational" 
      });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  app.post("/api/ai/evaluate/writing", aiRateLimit, async (req, res) => {
    try {
      const { sessionId, questionId, candidateText, prompt } = req.body;
      
      if (!sessionId || !candidateText) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const evaluation = await openaiService.evaluateWriting(prompt || "", candidateText);
      
      if (!evaluation.success) {
        return res.status(500).json({ error: evaluation.error });
      }

      // Store evaluation result
      const evaluationData = insertAiEvaluationSchema.parse({
        sessionId,
        section: "writing",
        criteria: evaluation.data,
        feedback: evaluation.data!.improvementTips.join("; "),
        bandScore: evaluation.data!.overallWritingBand,
        aiProvider: "openai",
        rawResponse: evaluation.rawResponse
      });

      const storedEvaluation = await storage.createAiEvaluation(evaluationData);
      
      // Update session with writing band
      await storage.updateTestSession(sessionId, { 
        writingBand: evaluation.data!.overallWritingBand 
      });

      res.json({
        evaluation: storedEvaluation,
        result: evaluation.data
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/evaluate/speaking", aiRateLimit, async (req, res) => {
    try {
      const { sessionId, transcript, audioFeatures } = req.body;
      
      if (!sessionId || !transcript) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const evaluation = await openaiService.evaluateSpeaking(transcript, audioFeatures);
      
      if (!evaluation.success) {
        return res.status(500).json({ error: evaluation.error });
      }

      // Store evaluation result
      const evaluationData = insertAiEvaluationSchema.parse({
        sessionId,
        section: "speaking",
        criteria: evaluation.data,
        feedback: evaluation.data!.improvementTips.join("; "),
        bandScore: evaluation.data!.overallSpeakingBand,
        aiProvider: "openai",
        rawResponse: evaluation.rawResponse
      });

      const storedEvaluation = await storage.createAiEvaluation(evaluationData);
      
      // Update session with speaking band
      await storage.updateTestSession(sessionId, { 
        speakingBand: evaluation.data!.overallSpeakingBand 
      });

      res.json({
        evaluation: storedEvaluation,
        result: evaluation.data
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/transcribe", aiRateLimit, upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const transcription = await openaiService.transcribeAudio(req.file.buffer);
      
      if (!transcription.success) {
        return res.status(500).json({ error: transcription.error });
      }

      res.json(transcription.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate/listening-answers", aiRateLimit, async (req, res) => {
    try {
      const { transcript, questions } = req.body;
      
      if (!transcript || !questions) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const answers = await openaiService.generateListeningAnswers(transcript, questions);
      
      if (!answers.success) {
        return res.status(500).json({ error: answers.error });
      }

      res.json(answers.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/speaking/prompt", aiRateLimit, async (req, res) => {
    try {
      const context = req.body;
      
      const prompt = await openaiService.generateSpeakingPrompt(context);
      
      if (!prompt.success) {
        return res.status(500).json({ error: prompt.error });
      }

      res.json(prompt.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate AI-powered listening content with audio
  app.post("/api/ai/listening/generate", aiRateLimit, async (req, res) => {
    try {
      // Generate listening content
      const content = await openaiService.generateListeningContent();
      
      if (!content.success) {
        return res.status(500).json({ error: content.error });
      }

      // Generate audio for each section
      const sectionsWithAudio = [];
      
      for (const section of content.data!.sections) {
        const audioResult = await openaiService.generateAudio(section.transcript, "nova");
        
        if (audioResult.success) {
          sectionsWithAudio.push({
            ...section,
            audioUrl: audioResult.data!.audioUrl,
            duration: audioResult.data!.duration
          });
        } else {
          sectionsWithAudio.push({
            ...section,
            audioUrl: null,
            duration: 0
          });
        }
      }

      res.json({ sections: sectionsWithAudio });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate audio for specific text
  app.post("/api/ai/generate-audio", aiRateLimit, async (req, res) => {
    try {
      const { text, voice = "alloy" } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const audioResult = await openaiService.generateAudio(text, voice);
      
      if (!audioResult.success) {
        return res.status(500).json({ error: audioResult.error });
      }

      res.json(audioResult.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Audio recordings
  app.post("/api/recordings", upload.single("audio"), async (req, res) => {
    try {
      const { sessionId, section } = req.body;
      
      if (!req.file || !sessionId || !section) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // In a real implementation, you'd save the audio file to storage (S3, etc.)
      const audioUrl = `/recordings/${Date.now()}-${req.file.originalname}`;
      
      const recordingData = insertAudioRecordingSchema.parse({
        sessionId,
        section,
        audioUrl,
        duration: 0 // Would be extracted from audio metadata
      });

      const recording = await storage.createAudioRecording(recordingData);
      res.json(recording);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get evaluations for a session
  app.get("/api/sessions/:sessionId/evaluations", async (req, res) => {
    try {
      const evaluations = await storage.getSessionEvaluations(req.params.sessionId);
      res.json(evaluations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoints
  app.get("/api/admin/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllTestSessions();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const sessions = await storage.getAllTestSessions();
      const completedSessions = sessions.filter(s => s.status === "completed");
      
      const stats = {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        averageBand: completedSessions.reduce((acc, s) => acc + (s.overallBand || 0), 0) / completedSessions.length || 0,
        aiEvaluations: completedSessions.length * 2, // Writing + Speaking
        systemStatus: "operational"
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate overall band score
  app.post("/api/sessions/:sessionId/calculate-overall", async (req, res) => {
    try {
      const session = await storage.getTestSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.listeningBand && session.readingBand && session.writingBand && session.speakingBand) {
        const overallBand = calculateOverallBand(
          session.listeningBand,
          session.readingBand,
          session.writingBand,
          session.speakingBand
        );

        const updatedSession = await storage.updateTestSession(req.params.sessionId, {
          overallBand,
          status: "completed",
          endTime: new Date()
        });

        res.json(updatedSession);
      } else {
        res.status(400).json({ error: "Not all sections completed" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve static audio files (in production, use a proper CDN)
  app.use('/audio', (req, res) => {
    // Return 404 for audio files since we don't have real audio files in this demo
    res.status(404).json({ error: 'Audio file not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
