import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { geminiService as openaiService } from "./services/openai";
import { ScoringService } from "./lib/scoring";
import { rawScoreToBand, calculateOverallBand } from "./lib/band-mapping";
import {
  insertTestSessionSchema,
  insertTestAnswerSchema,
  insertAiEvaluationSchema,
  insertAudioRecordingSchema,
  insertAudioFileSchema,
  insertTestQuestionSchema,
  insertListeningTestSchema,
  insertListeningSectionSchema,
  TestSectionEnum
} from "@shared/schema";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";

// Rate limiting for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many AI requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload configuration for audio files
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/audio';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Regular multer for other uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded audio files
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for audio files
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    next();
  });
  app.use('/uploads', express.static('uploads'));

  // Create new listening test
  app.post("/api/admin/listening-tests", async (req, res) => {
    try {
      const testData = insertListeningTestSchema.parse({
        ...req.body,
        createdBy: "admin",
        sections: []
      });

      const test = await storage.createListeningTest(testData);
      res.json({
        message: "Listening test created successfully",
        test
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all listening tests
  app.get("/api/admin/listening-tests", async (req, res) => {
    try {
      const tests = await storage.getAllListeningTests();
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload audio for specific test and section
  app.post("/api/admin/listening-tests/:testId/sections/:sectionNumber/audio", audioUpload.single("audio"), async (req, res) => {
    try {
      const { testId, sectionNumber } = req.params;
      const { generateContent = true } = req.body; // Default to AI content generation

      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const test = await storage.getListeningTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Listening test not found" });
      }

      const sectionNum = parseInt(sectionNumber);
      if (sectionNum < 1 || sectionNum > 4) {
        return res.status(400).json({ error: "Section number must be between 1 and 4" });
      }

      const audioFileData = insertAudioFileSchema.parse({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        sectionNumber: sectionNum,
        testId: new ObjectId(testId),
        uploadedBy: req.body.uploadedBy || "admin"
      });

      const audioFile = await storage.createAudioFile(audioFileData);

      let sectionTitle = req.body.sectionTitle || `Section ${sectionNum}`;
      let instructions = req.body.instructions || `Listen to the audio and answer the questions for Section ${sectionNum}`;
      let questions = [];

      // Always generate content when uploading audio files
      if (req.file) {
        // Read audio file and transcribe
        const audioFilePath = req.file.path;
        const audioBuffer = fs.readFileSync(audioFilePath);

        const transcriptionResult = await openaiService.transcribeAudio(audioBuffer);
        if (!transcriptionResult.success) {
          throw new Error(`Transcription failed: ${transcriptionResult.error}`);
        }
        const transcript = transcriptionResult.data?.text || "";

        // Generate section title and instructions with appropriate difficulty
        let sectionDescription = "";
        let questionTypes = [];

        switch(sectionNum) {
          case 1:
            sectionDescription = "Section 1 - Social/Everyday Context (2 speakers, telephone conversation, form completion, basic information)";
            questionTypes = ["multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank"];
            break;
          case 2:
            sectionDescription = "Section 2 - Social Context (1 speaker, monologue about local facilities, services, events)";
            questionTypes = ["multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank"];
            break;
          case 3:
            sectionDescription = "Section 3 - Educational/Training Context (2-4 speakers, academic discussion, seminar, tutorial)";
            questionTypes = ["multiple_choice", "multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice"];
            break;
          case 4:
            sectionDescription = "Section 4 - Academic Context (1 speaker, academic lecture, complex topic)";
            questionTypes = ["fill_blank", "fill_blank", "fill_blank", "multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "multiple_choice", "fill_blank", "fill_blank"];
            break;
        }

        // Try AI generation with retry and fallback to manual questions
        let generatedContent = null;
        const maxRetries = 2;
        let retryCount = 0;

        while (retryCount < maxRetries && !generatedContent) {
          try {
            const contentGenerationPrompt = `You are an expert IELTS test developer. Carefully analyze this audio transcript to create exactly 10 authentic IELTS listening questions for ${sectionDescription}.

TRANSCRIPT ANALYSIS REQUIRED:
"${transcript}"

CRITICAL INSTRUCTIONS:
1. Read the transcript carefully and identify key information: names, numbers, dates, places, actions, opinions, reasons, processes
2. Generate EXACTLY 10 questions that test different aspects mentioned in the transcript
3. Each question MUST be answerable from the transcript content
4. Use the specified question types in order: ${questionTypes.join(", ")}

QUESTION DIFFICULTY PROGRESSION:
- Questions 1-3: Direct factual information (clearly stated details)
- Questions 4-7: Moderate difficulty (require careful listening, may involve paraphrasing)
- Questions 8-10: Challenging (inference, detailed understanding, multiple details)

QUESTION TYPE SPECIFICATIONS:
- multiple_choice: Create 4 realistic options with ONLY ONE correct answer from transcript
- fill_blank: Use words/phrases/numbers that are clearly spoken in the audio

ANSWER REQUIREMENTS:
- All answers must be directly extractable from the transcript
- For fill_blank: Use exact words/numbers from transcript (max 3 words)
- For multiple_choice: Correct option must match transcript information exactly

Return ONLY valid JSON:
{
  "sectionTitle": "Appropriate title for ${sectionDescription}",
  "instructions": "Listen to the ${sectionNum === 1 ? 'conversation' : sectionNum === 2 || sectionNum === 4 ? 'talk' : 'discussion'} and answer Questions ${(sectionNum-1)*10 + 1}-${sectionNum*10}. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.",
  "questions": [
    {
      "questionType": "${questionTypes[0]}",
      "question": "Question based on specific transcript content",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "Exact word/phrase from transcript",
      "orderIndex": 1
    }
  ]
}`;

            console.log(`Generating AI content for section ${sectionNum} (attempt ${retryCount + 1})`);
            const aiResponse = await openaiService.generateText(contentGenerationPrompt, {
              maxTokens: 3000,
              temperature: 0.7
            });

            if (aiResponse.success && aiResponse.data?.text) {
              let cleanedResponse = aiResponse.data.text.trim();
              
              // Remove markdown code blocks
              if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/\s*```\s*$/, '');
              } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/\s*```\s*$/, '');
              }

              if (cleanedResponse) {
                generatedContent = JSON.parse(cleanedResponse);
                sectionTitle = generatedContent.sectionTitle;
                instructions = generatedContent.instructions;
                questions = generatedContent.questions;
                console.log("Generated questions count:", questions?.length || 0);
                break;
              }
            }
          } catch (error) {
            console.error(`AI generation attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            
            if (retryCount < maxRetries) {
              console.log(`Retrying in 3 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }

        // Fallback to manual questions if AI fails
        if (!generatedContent || !questions || questions.length === 0) {
          console.log("AI generation failed, using fallback questions for section", sectionNum);
          
          questions = Array.from({ length: 10 }, (_, i) => ({
            questionType: questionTypes[i] || "fill_blank",
            question: questionTypes[i] === "multiple_choice" 
              ? `What is mentioned at ${i + 1} in the audio?`
              : `Complete: The speaker mentions _______ (Question ${i + 1})`,
            options: questionTypes[i] === "multiple_choice" 
              ? ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"]
              : undefined,
            correctAnswer: questionTypes[i] === "multiple_choice" ? "A) First option" : "answer",
            orderIndex: i + 1
          }));
        }
      }


      // Create section with generated or provided content
      const sectionData = insertListeningSectionSchema.parse({
        testId: new ObjectId(testId),
        sectionNumber: sectionNum,
        title: sectionTitle,
        instructions: instructions,
        audioFileId: audioFile._id!,
        questions: []
      });

      const section = await storage.createListeningSection(sectionData);

      // Save generated questions
      const savedQuestions = [];
      console.log("Processing questions for saving:", questions.length);
      for (const qData of questions) {
        try {
          console.log("Saving question:", qData.question?.substring(0, 100));
          const questionSchema = insertTestQuestionSchema.parse({
            section: "listening",
            questionType: qData.questionType,
            content: {
              question: qData.question,
              options: qData.options
            },
            correctAnswers: Array.isArray(qData.correctAnswer) ?
            qData.correctAnswer.map(ans => typeof ans === 'object' ? JSON.stringify(ans) : String(ans)) :
            [typeof qData.correctAnswer === 'object' ? JSON.stringify(qData.correctAnswer) : String(qData.correctAnswer)],
            orderIndex: qData.orderIndex,
            audioFileId: audioFile._id!,
            generatedBy: "ai"
          });
          const savedQuestion = await storage.createTestQuestion(questionSchema);
          savedQuestions.push(savedQuestion);
          console.log("Successfully saved question ID:", savedQuestion._id);
        } catch (error) {
          console.error("Error saving question:", error);
        }
      }

      // Update section with generated questions
      console.log("Updating section with", savedQuestions.length, "questions");
      const updateResult = await storage.updateListeningSection(section._id!.toString(), {
        questions: savedQuestions.map(q => q._id!)
      });
      console.log("Section updated:", updateResult ? "success" : "failed");

      // Update test with section reference and mark as active if all 4 sections are complete
      const existingSections = await storage.getTestSections(testId);
      console.log("Existing sections count:", existingSections.length, "Current section:", sectionNum);

      // Check if we have all 4 unique sections (1, 2, 3, 4)
      const sectionNumbers = new Set(existingSections.map(s => s.sectionNumber));
      sectionNumbers.add(sectionNum); // Add current section
      const isTestComplete = sectionNumbers.size === 4;

      await storage.updateListeningTest(testId, {
        sections: [...existingSections.map(s => s._id!), section._id!],
        status: isTestComplete ? "active" : "draft"
      });

      console.log("Section numbers:", Array.from(sectionNumbers), "Test marked as:", isTestComplete ? "active" : "draft");

      res.json({
        message: "Audio uploaded and content generated successfully for section",
        audioFile: {
          id: audioFile._id,
          filename: audioFile.filename,
          originalName: audioFile.originalName,
          sectionNumber: audioFile.sectionNumber
        },
        section: {
          ...section,
          questions: savedQuestions
        },
        testComplete: existingSections.length === 4
      });
    } catch (error: any) {
      console.error("Section audio upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update listening test
  app.patch("/api/admin/listening-tests/:testId", async (req, res) => {
    try {
      const { testId } = req.params;
      const updateData = req.body;

      console.log("PATCH request received for test", testId, "with data:", updateData);
      const updated = await storage.updateListeningTest(testId, updateData);

      if (updated) {
        const updatedTest = await storage.getListeningTest(testId);
        console.log("Test updated successfully:", updatedTest?.status);
        res.setHeader('Content-Type', 'application/json');
        return res.json(updatedTest);
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: "Test not found" });
      }
    } catch (error: any) {
      console.error("Error updating test:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: error.message });
    }
  });

  // Get test sections with audio files
  app.get("/api/admin/listening-tests/:testId/sections", async (req, res) => {
    try {
      const { testId } = req.params;
      const sections = await storage.getTestSections(testId);

      // Get audio files for each section
      const sectionsWithAudio = await Promise.all(
        sections.map(async (section) => {
          const audioFile = await storage.getAudioFile(section.audioFileId.toString());
          return {
            ...section,
            audioFile
          };
        })
      );

      res.json(sectionsWithAudio);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Audio Upload Endpoints (keeping for backwards compatibility)
  app.post("/api/admin/audio/upload", audioUpload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const audioFileData = insertAudioFileSchema.parse({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.body.uploadedBy || "admin"
      });

      const audioFile = await storage.createAudioFile(audioFileData);

      res.json({
        message: "Audio file uploaded successfully",
        audioFile: {
          id: audioFile._id,
          filename: audioFile.filename,
          originalName: audioFile.originalName,
          size: audioFile.size,
          uploadedAt: audioFile.uploadedAt
        }
      });
    } catch (error: any) {
      console.error("Audio upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/audio/list", async (req, res) => {
    try {
      const audioFiles = await storage.getAllAudioFiles();
      res.json(audioFiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate questions for uploaded audio using AI (this endpoint might be redundant now if generation happens on upload)
  app.post("/api/admin/audio/:audioId/generate-questions", aiRateLimit, async (req, res) => {
    try {
      const { audioId } = req.params;
      const audioFile = await storage.getAudioFile(audioId);

      if (!audioFile) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      // First, get transcript if not already available
      let transcript = audioFile.transcript;
      if (!transcript) {
        // This part assumes transcription is done separately or via the upload endpoint
        // For now, we'll ask admin to provide it or use a placeholder if generation is not triggered
        transcript = req.body.transcript || "Please provide transcript for better question generation";
      }

      // Generate questions using AI
      const questionsPrompt = `Based on this audio transcript, generate 5 IELTS listening questions of different types (multiple choice, fill-in-the-blank, short answer). Make them appropriate for IELTS Academic level.

Transcript: "${transcript}"

Return a JSON array with this format:
[
  {
    "questionType": "multiple_choice",
    "question": "What is the speaker's main point?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correctAnswer": "B",
    "orderIndex": 1
  },
  {
    "questionType": "fill_blank",
    "question": "The speaker mentions that the project will take _______ weeks to complete.",
    "correctAnswer": "six",
    "orderIndex": 2
  }
]`;

      const aiResponse = await openaiService.generateText(questionsPrompt);

      if (!aiResponse.success) {
        return res.status(500).json({ error: aiResponse.error });
      }

      let generatedQuestions;
      try {
        generatedQuestions = JSON.parse(aiResponse.data!.text);
      } catch (parseError) {
        return res.status(500).json({ error: "Failed to parse AI-generated questions" });
      }

      // Save questions to database
      const savedQuestions = [];
      for (const questionData of generatedQuestions) {
        const question = insertTestQuestionSchema.parse({
          section: "listening",
          questionType: questionData.questionType,
          content: {
            question: questionData.question,
            options: questionData.options || undefined
          },
          correctAnswers: [questionData.correctAnswer],
          orderIndex: questionData.orderIndex,
          audioFileId: new ObjectId(audioId),
          generatedBy: "ai"
        });

        const savedQuestion = await storage.createTestQuestion(question);
        savedQuestions.push(savedQuestion);
      }

      res.json({
        message: `Generated ${savedQuestions.length} questions successfully`,
        questions: savedQuestions
      });
    } catch (error: any) {
      console.error("Question generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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

  // Modified: Get listening questions with random structured test selection
  app.get("/api/questions/:section", async (req, res) => {
    try {
      const section = TestSectionEnum.parse(req.params.section);

      if (section === "listening") {
        // Get a random complete listening test
        console.log("Looking for active listening tests...");
        const randomTest = await storage.getRandomListeningTest();
        console.log("Found test:", randomTest ? randomTest.title : "none");
        if (!randomTest) {
          // Debug: Check if there are any tests at all
          const allTests = await storage.getAllListeningTests();
          console.log("All tests:", allTests.map(t => ({ title: t.title, status: t.status })));
          return res.status(404).json({ error: "No complete listening tests available" });
        }

        // Get all sections for this test
        const sections = await storage.getTestSections(randomTest._id!.toString());

        // Get questions and audio for each section
        const sectionsWithData = await Promise.all(
          sections.map(async (section) => {
            const audioFile = await storage.getAudioFile(section.audioFileId.toString());
            const questions = await storage.getQuestionsByAudioFile(section.audioFileId.toString());

            return {
              sectionNumber: section.sectionNumber,
              title: section.title,
              instructions: section.instructions,
              audioUrl: audioFile ? `/uploads/audio/${audioFile.filename}` : null,
              audioInfo: audioFile ? {
                id: audioFile._id,
                originalName: audioFile.originalName,
                duration: audioFile.duration
              } : null,
              questions: questions.map(q => ({
                ...q,
                sectionNumber: section.sectionNumber
              }))
            };
          })
        );

        res.json({
          testId: randomTest._id,
          testTitle: randomTest.title,
          sections: sectionsWithData
        });
      } else {
        const questions = await storage.getTestQuestions(section);
        res.json(questions);
      }
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
        questions.some(q => q._id!.toString() === a.questionId)
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

  // AI endpoints (keeping existing implementation)
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
        aiProvider: "gemini",
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
        aiProvider: "gemini",
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

  // Additional AI endpoints (transcribe, generate content, etc.)
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
      const audioFiles = await storage.getAllAudioFiles();

      const stats = {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        averageBand: completedSessions.reduce((acc, s) => acc + (s.overallBand || 0), 0) / completedSessions.length || 0,
        aiEvaluations: completedSessions.length * 2, // Writing + Speaking
        audioFiles: audioFiles.length,
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

  const httpServer = createServer(app);
  return httpServer;
}