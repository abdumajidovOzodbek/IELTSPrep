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
        let questionTypes: string[] = [];

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

Return JSON format:
{
  "sectionTitle": "Appropriate title for ${sectionDescription}",
  "instructions": "Listen to the ${sectionNum === 1 ? 'conversation' : sectionNum === 2 || sectionNum === 4 ? 'talk' : 'discussion'} and answer Questions ${(sectionNum-1)*10 + 1}-${sectionNum*10}. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.",
  "questions": [
    {
      "questionType": "${questionTypes[0]}",
      "question": "Question based on specific transcript content",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"], // only for multiple_choice
      "correctAnswer": "Exact word/phrase from transcript",
      "orderIndex": 1
    }
    // Continue for all 10 questions, ensuring each tests different transcript content
  ]
}`;
        console.log("Generating AI content for section", sectionNum);
        const aiResponse = await openaiService.generateText(contentGenerationPrompt);
        if (!aiResponse.success) {
          console.error("AI content generation failed:", aiResponse.error);
          throw new Error(`AI content generation failed: ${aiResponse.error}`);
        }

        let generatedContent;
        try {
          console.log("AI Response:", aiResponse.data?.text?.substring(0, 500));

          // Clean the AI response - remove markdown code blocks if present
          let cleanedResponse = aiResponse.data!.text;
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/\s*```\s*$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/\s*```\s*$/, '');
          }

          generatedContent = JSON.parse(cleanedResponse);
          sectionTitle = generatedContent.sectionTitle;
          instructions = generatedContent.instructions;
          questions = generatedContent.questions;
          console.log("Generated questions count:", questions?.length || 0);
        } catch (parseError) {
          console.error("Failed to parse AI generated content:", parseError);
          console.error("Raw AI response:", aiResponse.data?.text);
          throw new Error("Failed to parse AI generated content.");
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
              options: qData.options,
              formContext: qData.formContext // Include form context for form_completion questions
            },
            correctAnswers: Array.isArray(qData.correctAnswer) ?
            qData.correctAnswer.map((ans: any) => typeof ans === 'object' ? JSON.stringify(ans) : String(ans)) :
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
      const isTestComplete = sectionNumbers.size === 4;

      await storage.updateListeningTest(testId, {
        sections: existingSections.map(s => s._id!),
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

  // Modified: Get questions with random structured test selection
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
      } else if (section === "reading") {
        // Get a random complete reading test
        console.log("Looking for active reading tests...");
        const randomTest = await storage.getRandomReadingTest();
        console.log("Found reading test:", randomTest ? randomTest.title : "none");

        if (!randomTest) {
          // Fallback to AI generated content if no tests available
          console.log("No reading tests found, using AI generation fallback");
          const result = await openaiService.generateReadingContent();

          if (!result.success) {
            return res.status(404).json({ error: "No reading tests available and AI generation failed" });
          }

          return res.json({
            testId: "ai-generated",
            testTitle: "AI Generated Reading Test",
            passages: result.data!.passages
          });
        }

        // Get all passages for this test
        const passages = await storage.getTestPassages(randomTest._id!.toString());
        console.log("Found passages:", passages.length);
        passages.forEach(p => {
          console.log("Passage:", p.passageNumber, "ID:", p._id?.toString(), "Title:", p.title);
        });

        // Get questions for each passage
        const passagesWithData = await Promise.all(
          passages.map(async (passage) => {
            console.log("Fetching questions for passage ID:", passage._id!.toString());
            const questions = await storage.getQuestionsByPassage(passage._id!.toString());
            console.log("Found questions for passage:", questions.length);

            return {
              passageNumber: passage.passageNumber,
              title: passage.title,
              passage: passage.passage,
              instructions: passage.instructions,
              questions: questions.map(q => ({
                ...q,
                passageNumber: passage.passageNumber
              }))
            };
          })
        );

        res.json({
          testId: randomTest._id,
          testTitle: randomTest.title,
          passages: passagesWithData
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
      console.error("Answer submission error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Alternative endpoint for backward compatibility
  app.post("/api/test/submit-answer", async (req, res) => {
    try {
      console.log("Received answer submission:", JSON.stringify(req.body, null, 2));
      const answerData = insertTestAnswerSchema.parse(req.body);
      const answer = await storage.createTestAnswer(answerData);
      console.log("Answer saved successfully:", answer._id);
      res.json(answer);
    } catch (error: any) {
      console.error("Answer submission error:", error);
      console.error("Request body:", req.body);
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

  // Generate AI listening content
  app.post("/api/ai/listening/generate", async (req, res) => {
    try {
      console.log("Generating AI listening content...");

      const result = await openaiService.generateListeningContent();

      if (!result.success) {
        console.warn("AI generation failed, using fallback:", result.error);

        // Return a structured response indicating fallback mode
        return res.status(503).json({
          success: false,
          fallback: true,
          message: "AI service temporarily unavailable. Using pre-defined test content.",
          error: result.error
        });
      }

      console.log("AI listening content generated successfully");
      res.json({
        success: true,
        ...result.data
      });
    } catch (error: any) {
      console.error("Error generating listening content:", error);

      // Fallback response for any unexpected errors
      res.json({
        success: false,
        fallback: true,
        message: "AI service unavailable. Using pre-defined test content.",
        error: "Failed to generate listening content"
      });
    }
  });

  // Create new reading test
  app.post("/api/admin/reading-tests", async (req, res) => {
    try {
      const testData = {
        ...req.body,
        createdBy: "admin",
        passages: [],
        section: "reading",
        testType: req.body.testType || "academic"
      };

      const test = await storage.createReadingTest(testData);
      res.json({
        message: "Reading test created successfully",
        test
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create complete reading test with 3 passages and AI-generated questions
  app.post("/api/admin/reading-tests/bulk", aiRateLimit, async (req, res) => {
    try {
      const { passages, ...testData } = req.body;

      if (!passages || passages.length !== 3) {
        return res.status(400).json({ error: "Exactly 3 passages are required" });
      }

      // Validate each passage
      for (let i = 0; i < 3; i++) {
        const passage = passages[i];
        if (!passage.title || !passage.content) {
          return res.status(400).json({ error: `Passage ${i + 1} is missing title or content` });
        }
        if (passage.content.length < 300) {
          return res.status(400).json({ error: `Passage ${i + 1} is too short (minimum 300 characters)` });
        }
      }

      // Create the reading test
      const test = await storage.createReadingTest({
        ...testData,
        createdBy: "admin",
        passages: [],
        testType: testData.testType || "academic"
      });

      const savedPassages = [];
      let totalQuestions = 0;

      // Process each passage and generate questions
      for (let passageIndex = 0; passageIndex < 3; passageIndex++) {
        const passageData = passages[passageIndex];
        const passageNum = passageIndex + 1;

        // Define question types and difficulty for each passage
        let questionTypes: string[] = [];
        let passageDescription: string = "";

        switch(passageNum) {
          case 1:
            questionTypes = ["multiple_choice", "multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank", "multiple_choice", "fill_blank"];
            passageDescription = "Passage 1 - General interest topic with moderate difficulty, focusing on main ideas and supporting details";
            break;
          case 2:
            questionTypes = ["matching", "matching", "matching", "fill_blank", "fill_blank", "short_answer", "short_answer", "multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "matching", "short_answer"];
            passageDescription = "Passage 2 - Work/education topic with increased complexity, testing detailed comprehension and inference";
            break;
          case 3:
            questionTypes = ["multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "fill_blank", "multiple_choice", "matching", "matching", "short_answer", "short_answer", "multiple_choice", "fill_blank", "fill_blank", "multiple_choice"];
            passageDescription = "Passage 3 - Academic/scientific topic with highest difficulty, testing complex reasoning and synthesis";
            break;
        }

        const contentGenerationPrompt = `You are an expert IELTS Academic reading test developer. Create exactly ${questionTypes.length} authentic IELTS questions for ${passageDescription}.

PASSAGE TO ANALYZE:
Title: "${passageData.title}"
Content: "${passageData.content}"

PASSAGE ${passageNum} REQUIREMENTS:
${passageNum === 1 ? `
- General interest topic with moderate difficulty
- Question types: multiple choice, true/false/not given, fill in blanks
- Test main ideas, supporting details, and vocabulary in context
- Questions should be clearly answerable from the passage
` : passageNum === 2 ? `
- Work or education-related topic with increased complexity
- Question types: matching information, summary completion, short answer questions
- Focus on detailed comprehension, inference, and connecting information
- Test ability to locate specific information and understand relationships
` : `
- Academic/scientific topic with highest difficulty
- Question types: multiple choice, yes/no/not given, matching features, completion tasks
- Test complex reasoning, synthesis, and academic vocabulary
- Require deep understanding of complex concepts and relationships
`}

CRITICAL INSTRUCTIONS:
1. Analyze the passage carefully to identify key information, main ideas, supporting details, and relationships
2. Generate exactly ${questionTypes.length} questions using these types in order: ${questionTypes.join(", ")}
3. Each question MUST be answerable from the passage content
4. Use authentic IELTS Academic question formats and language
5. Questions should progress from easier to more challenging within the passage
6. Ensure variety in what aspects of the passage are tested

QUESTION TYPE SPECIFICATIONS:
- multiple_choice: Create 4 realistic options (A, B, C, D) with only ONE correct answer from passage
- fill_blank: Use exact words/phrases from passage (maximum 3 words per blank)
- short_answer: Require specific information from passage (maximum 3 words)
- matching: Match headings, information, or features to appropriate sections/paragraphs

Return JSON format:
{
  "instructions": "Read the passage and answer Questions ${(passageNum-1)*13 + 1}-${passageNum*13 + (passageNum === 3 ? 1 : 0)}. Choose the correct letter A, B, C, or D for multiple choice questions. Write NO MORE THAN THREE WORDS for fill-in-the-blank questions.",
  "questions": [
    {
      "questionType": "${questionTypes[0]}",
      "question": "Clear question based on specific passage content",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "Exact answer from passage",
      "orderIndex": 1,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

QUALITY CHECKLIST:
- Each question tests different parts of the passage
- Questions range from factual recall to inference and analysis
- All answers can be clearly found in or deduced from the passage
- Question difficulty appropriate for passage position in test
- Language matches authentic IELTS Academic style`;

        console.log(`Generating AI content for reading passage ${passageNum}`);
        const aiResponse = await openaiService.generateText(contentGenerationPrompt, {
          maxTokens: 3000,
          temperature: 0.3, // Lower temperature for more consistent IELTS questions
          maxRetries: 5 // More retries for bulk operation
        });

        if (!aiResponse.success) {
          console.error(`AI content generation failed for passage ${passageNum}:`, aiResponse.error);
          throw new Error(`AI content generation failed for passage ${passageNum}: ${aiResponse.error}`);
        }

        let generatedContent;
        try {
          // Extract the text from the response structure
          let responseText = aiResponse.data?.text || aiResponse.data || "";

          // Remove markdown code blocks if present
          if (typeof responseText === 'string') {
            responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonText = jsonMatch ? jsonMatch[0] : responseText;

            generatedContent = JSON.parse(jsonText);
          } else {
            generatedContent = responseText; // Assume it's already parsed
          }

          // Validate that we have the required fields
          if (!generatedContent.questions || !Array.isArray(generatedContent.questions)) {
            throw new Error("AI response missing questions array");
          }

        } catch (parseError) {
          console.error(`Failed to parse AI response for passage ${passageNum}:`, parseError);
          console.error(`Raw response:`, aiResponse.data);

          // Create fallback questions as a last resort
          console.log(`Creating fallback questions for passage ${passageNum}`);
          generatedContent = {
            instructions: `Read the passage and answer Questions ${(passageNum-1)*13 + 1}-${passageNum*13}. Choose the correct letter A, B, C, or D for multiple choice questions.`,
            questions: questionTypes.map((type, index) => ({
              questionType: type,
              question: `[AI Error] Please manually create question ${index + 1} of type ${type} based on the passage content.`,
              options: type === 'multiple_choice' ? ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'] : undefined,
              correctAnswer: 'Manual review required',
              orderIndex: index + 1,
              explanation: 'This question needs manual review due to AI parsing error.'
            }))
          };

          console.log(`Created ${generatedContent.questions.length} fallback questions for passage ${passageNum}`);
        }

        // Create the passage
        const savedPassage = await storage.createReadingPassage({
          testId: test._id!,
          passageNumber: passageNum,
          title: passageData.title,
          passage: passageData.content,
          instructions: generatedContent.instructions || `Read the passage and answer Questions ${(passageNum-1)*13 + 1}-${passageNum*13 + (passageNum === 3 ? 1 : 0)}.`,
          questions: []
        });

        // Save generated questions
        const savedQuestions = [];
        const questions = generatedContent.questions || [];

        for (const qData of questions) {
          try {
            console.log(`Saving question for passage ${passageNum}:`, qData.question?.substring(0, 100));
            const questionSchema = insertTestQuestionSchema.parse({
              section: "reading" as const,
              questionType: qData.questionType,
              content: {
                question: qData.question,
                options: qData.options
              },
              correctAnswers: Array.isArray(qData.correctAnswer) ?
                qData.correctAnswer.map((ans: any) => String(ans)) :
                [String(qData.correctAnswer)],
              orderIndex: qData.orderIndex + (passageNum - 1) * 13, // Global question numbering
              passageId: savedPassage._id!,
              generatedBy: "ai" as const,
              isActive: true
            });
            const savedQuestion = await storage.createTestQuestion(questionSchema);
            savedQuestions.push(savedQuestion);
            console.log(`Successfully saved question ID: ${savedQuestion._id}`);
          } catch (error) {
            console.error(`Error saving question for passage ${passageNum}:`, error);
          }
        }

        // Update passage with questions
        await storage.updateReadingPassage(savedPassage._id!.toString(), {
          questions: savedQuestions.map(q => q._id!)
        });

        savedPassages.push({
          ...savedPassage,
          questions: savedQuestions
        });

        totalQuestions += savedQuestions.length;
      }

      // Mark test as active since all 3 passages are complete
      await storage.updateReadingTest(test._id!.toString(), {
        passages: savedPassages.map(p => p._id!),
        status: "active"
      });

      console.log(`Complete reading test created with ${totalQuestions} questions across 3 passages`);

      res.json({
        message: "Complete reading test created successfully",
        test: {
          ...test,
          passages: savedPassages
        },
        totalQuestions,
        testComplete: true
      });
    } catch (error: any) {
      console.error("Bulk reading test creation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all reading tests
  app.get("/api/admin/reading-tests", async (req, res) => {
    try {
      const tests = await storage.getAllReadingTests();
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload passage content and generate questions
  app.post("/api/admin/reading-tests/:testId/passages/:passageNumber", async (req, res) => {
    try {
      const { testId, passageNumber } = req.params;
      const { title, passage, instructions } = req.body;

      if (!passage || !title) {
        return res.status(400).json({ error: "Title and passage content are required" });
      }

      const test = await storage.getReadingTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Reading test not found" });
      }

      const passageNum = parseInt(passageNumber);
      if (passageNum < 1 || passageNum > 3) {
        return res.status(400).json({ error: "Passage number must be between 1 and 3" });
      }

      // Generate questions using AI based on passage content
      const contentGenerationPrompt = `You are an expert IELTS reading test developer. Create exactly 13-14 authentic IELTS Academic reading questions for Passage ${passageNum}.

PASSAGE TO ANALYZE:
Title: "${title}"
Content: "${passage}"

PASSAGE ${passageNum} REQUIREMENTS:
${passageNum === 1 ? `
- General interest topic with moderate difficulty
- Mix of question types: multiple choice (4 options), true/false/not given, matching headings, sentence completion
- Questions should test main ideas, supporting details, and vocabulary in context
` : passageNum === 2 ? `
- Work or education-related topic with increased complexity
- Question types: matching information, summary completion with word bank, short answer questions
- Focus on detailed comprehension and inference skills
` : `
- Academic/scientific topic with highest difficulty
- Question types: multiple choice, yes/no/not given, matching features, diagram/flowchart completion
- Test complex reasoning, synthesis, and academic vocabulary
`}

CRITICAL INSTRUCTIONS:
1. Analyze the passage carefully to identify key information, main ideas, supporting details
2. Generate exactly ${passageNum === 1 ? '13' : passageNum === 2 ? '13' : '14'} questions
3. Each question MUST be answerable from the passage content
4. Use authentic IELTS question formats and language
5. Questions should progress from easier to more challenging

QUESTION TYPES TO INCLUDE:
- Multiple Choice: 4 options (A, B, C, D) with only ONE correct answer
- True/False/Not Given: Clear statements that can be verified from the passage
- Fill in the blank: Use exact words from passage (max 3 words)
- Matching: Match information, headings, or features appropriately

Return JSON format:
{
  "passageTitle": "${title}",
  "instructions": "Questions ${(passageNum-1)*13 + 1}-${passageNum*13}. Read Passage ${passageNum} and answer the questions below.",
  "questions": [
    {
      "questionType": "multiple_choice",
      "question": "According to the passage, the main cause of...",
      "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
      "correctAnswer": "A",
      "orderIndex": 1
    },
    {
      "questionType": "true_false",
      "question": "The author suggests that modern technology has decreased workplace productivity.",
      "correctAnswer": "FALSE",
      "orderIndex": 2
    },
    {
      "questionType": "fill_blank",
      "question": "The research showed that _______ was the most significant factor.",
      "correctAnswer": "employee satisfaction",
      "orderIndex": 3
    }
  ]
}

Ensure all questions test different aspects of the passage and maintain IELTS Academic standards.`;

      console.log(`Generating AI questions for passage ${passageNum}`);
      const aiResponse = await openaiService.generateText(contentGenerationPrompt);
      if (!aiResponse.success) {
        console.error("AI question generation failed:", aiResponse.error);
        throw new Error(`AI question generation failed: ${aiResponse.error}`);
      }

      let generatedContent;
      try {
        console.log("AI Response:", aiResponse.data?.text?.substring(0, 500));
        let cleanedResponse = aiResponse.data!.text;
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/\s*```\s*$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/\s*```\s*$/, '');
        }

        generatedContent = JSON.parse(cleanedResponse);
        console.log("Generated questions count:", generatedContent.questions?.length || 0);
      } catch (parseError) {
        console.error("Failed to parse AI generated content:", parseError);
        console.error("Raw AI response:", aiResponse.data?.text);
        throw new Error("Failed to parse AI generated content.");
      }

      // Save passage and questions to database
      const passageData = {
        testId: new ObjectId(testId),
        passageNumber: passageNum,
        title: title,
        passage: passage,
        instructions: instructions || generatedContent.instructions,
        questions: []
      };

      const savedPassage = await storage.createReadingPassage(passageData);

      // Save generated questions
      const savedQuestions = [];
      const questions = generatedContent.questions || [];

      for (const qData of questions) {
        try {
          console.log("Saving question:", qData.question?.substring(0, 100));
          const questionSchema = insertTestQuestionSchema.parse({
            section: "reading" as const,
            questionType: qData.questionType,
            content: {
              question: qData.question,
              options: qData.options
            },
            correctAnswers: Array.isArray(qData.correctAnswer) ?
              qData.correctAnswer.map((ans: any) => String(ans)) :
              [String(qData.correctAnswer)],
            orderIndex: qData.orderIndex,
            passage: savedPassage._id!.toString(),
            generatedBy: "ai" as const,
            isActive: true
          });
          const savedQuestion = await storage.createTestQuestion(questionSchema);
          savedQuestions.push(savedQuestion);
          console.log("Successfully saved question ID:", savedQuestion._id);
        } catch (error) {
          console.error("Error saving question:", error);
        }
      }

      // Update passage with questions
      await storage.updateReadingPassage(savedPassage._id!.toString(), {
        questions: savedQuestions.map(q => q._id!)
      });

      // Update test with passage reference and mark as active if all 3 passages are complete
      const existingPassages = await storage.getTestPassages(testId);
      console.log("Existing passages count:", existingPassages.length, "Current passage:", passageNum);

      const passageNumbers = new Set(existingPassages.map(p => p.passageNumber));
      const isTestComplete = passageNumbers.size === 3;

      await storage.updateReadingTest(testId, {
        passages: existingPassages.map(p => p._id!),
        status: isTestComplete ? "active" : "draft"
      });

      console.log("Passage numbers:", Array.from(passageNumbers), "Test marked as:", isTestComplete ? "active" : "draft");

      res.json({
        message: "Passage uploaded and questions generated successfully",
        passage: {
          ...savedPassage,
          questions: savedQuestions
        },
        testComplete: existingPassages.length === 3
      });
    } catch (error: any) {
      console.error("Passage upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get test passages
  app.get("/api/admin/reading-tests/:testId/passages", async (req, res) => {
    try {
      const { testId } = req.params;
      const passages = await storage.getTestPassages(testId);
      res.json(passages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update reading test
  app.patch("/api/admin/reading-tests/:testId", async (req, res) => {
    try {
      const { testId } = req.params;
      const updateData = req.body;

      console.log("PATCH request received for reading test", testId, "with data:", updateData);
      const updated = await storage.updateReadingTest(testId, updateData);

      if (updated) {
        const updatedTest = await storage.getReadingTest(testId);
        console.log("Reading test updated successfully:", updatedTest?.status);
        res.json(updatedTest);
      } else {
        res.status(404).json({ error: "Reading test not found" });
      }
    } catch (error: any) {
      console.error("Error updating reading test:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate AI reading content
  app.post("/api/ai/reading/generate", async (req, res) => {
    try {
      console.log("Generating AI reading content...");

      const result = await openaiService.generateReadingContent();

      if (!result.success) {
        console.error("AI reading generation failed:", result.error);
        return res.status(500).json({ error: result.error });
      }

      console.log("AI reading content generated successfully");
      res.json(result.data);
    } catch (error: any) {
      console.error("Error generating reading content:", error);
      res.status(500).json({ error: "Failed to generate reading content" });
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

  // Calculate and update session scores based on actual answers
  app.post("/api/sessions/:sessionId/calculate-scores", async (req, res) => {
    try {
      const { sessionId } = req.params;
      console.log("Calculating scores for session:", sessionId);

      // Get all answers for this session
      const answers = await storage.getSessionAnswers(sessionId);
      console.log("Found answers:", answers.length);

      // Debug: Show a few sample answers
      if (answers.length > 0) {
        console.log("Sample answers:", answers.slice(0, 3).map(a => ({
          section: a.section,
          questionId: a.questionId,
          answer: typeof a.answer === 'string' ? a.answer.substring(0, 50) : a.answer,
          hasAnswer: !!a.answer
        })));
      }

      // Continue processing even if no answers (for debugging)
      if (answers.length === 0) {
        console.log("No answers found, but continuing to check database...");
        
        // Try to get answers directly from database for debugging
        const directAnswers = await storage.db.collection("testAnswers").find({ sessionId }).toArray();
        console.log("Direct database query found:", directAnswers.length, "answers");
        
        if (directAnswers.length === 0) {
          return res.status(400).json({ error: "No answers found for this session" });
        }
      }

      // Group answers by section
      const answersBySection = answers.reduce((acc, answer) => {
        const section = answer.section || 'unknown';
        if (!acc[section]) acc[section] = [];
        acc[section].push(answer);
        return acc;
      }, {} as Record<string, any[]>);

      console.log("Answers by section:", Object.keys(answersBySection).map(k => `${k}: ${answersBySection[k].length}`));

      // Calculate scores for each section using proper IELTS band mapping
      const sectionScores: any = {};

      for (const [section, sectionAnswers] of Object.entries(answersBySection)) {
        console.log(`Evaluating ${section} section with ${sectionAnswers.length} total answers`);

        let band = 0;

        if (section === 'listening' || section === 'reading') {
          try {
            // Get questions for this section - try multiple approaches
            let questions = await storage.getTestQuestions(section as any);
            
            if (questions.length === 0) {
              // Fallback: try to get questions by matching questionIds from answers
              console.log(`No questions found via getTestQuestions, trying direct match for ${section}`);
              const questionIds = sectionAnswers.map(a => a.questionId).filter(Boolean);
              console.log("Question IDs from answers:", questionIds.slice(0, 5));
              
              if (questionIds.length > 0) {
                try {
                  const directQuestions = await storage.db.collection("testQuestions").find({
                    _id: { $in: questionIds.map(id => typeof id === 'string' ? new ObjectId(id) : id) }
                  }).toArray();
                  questions = directQuestions.map(q => ({ ...q, _id: q._id } as TestQuestion));
                  console.log(`Found ${questions.length} questions via direct match`);
                } catch (err) {
                  console.error("Error with direct question lookup:", err);
                }
              }
            }

            console.log(`Found ${questions.length} questions for ${section}`);

            if (questions.length > 0) {
              // Use proper scoring service
              const result = ScoringService.scoreObjectiveAnswers(sectionAnswers, questions);
              // Use band mapping from band-mapping.ts
              band = rawScoreToBand(result.rawScore, section as 'listening' | 'reading');
              
              // Store the actual results for the response
              sectionScores[`${section}Correct`] = result.correctAnswers;
              sectionScores[`${section}Total`] = result.totalQuestions;
              
              console.log(`${section}: ${result.correctAnswers}/${result.totalQuestions} correct, raw score: ${result.rawScore}, band: ${band}`);
            } else {
              // More sophisticated fallback based on answer content quality
              const nonEmptyAnswers = sectionAnswers.filter(a => {
                const answer = a.answer ? a.answer.toString().trim() : '';
                return answer !== '' && answer.length > 1;
              });

              console.log(`${section}: ${nonEmptyAnswers.length} non-empty answers out of ${sectionAnswers.length}`);

              // Estimate based on completion rate and answer quality
              const completionRate = nonEmptyAnswers.length / Math.max(sectionAnswers.length, 40);
              
              // Conservative estimation for IELTS standards
              let estimatedRawScore = 0;
              if (completionRate >= 0.9) estimatedRawScore = Math.round(completionRate * 35); // High completion
              else if (completionRate >= 0.7) estimatedRawScore = Math.round(completionRate * 30); // Good completion
              else if (completionRate >= 0.5) estimatedRawScore = Math.round(completionRate * 25); // Fair completion
              else estimatedRawScore = Math.round(completionRate * 15); // Poor completion

              band = rawScoreToBand(estimatedRawScore, section as 'listening' | 'reading');
              
              console.log(`${section}: Fallback - completion rate: ${(completionRate * 100).toFixed(1)}%, estimated raw score: ${estimatedRawScore}, band: ${band}`);
            }
          } catch (error) {
            console.error(`Error scoring ${section}:`, error);
            band = 0;
          }

        } else if (section === 'writing' || section === 'speaking') {
          try {
            // Check for AI evaluations first
            const evaluations = await storage.getEvaluationsForSession(sessionId, section);
            if (evaluations && evaluations.length > 0) {
              // Use AI evaluation score
              const avgBand = evaluations.reduce((sum, evaluation) => sum + evaluation.bandScore, 0) / evaluations.length;
              band = Math.round(avgBand * 2) / 2; // Round to nearest 0.5
              console.log(`${section}: Using AI evaluation, band: ${band}`);
            } else {
              // Improved fallback based on IELTS criteria
              const validAnswers = sectionAnswers.filter(a => {
                const answer = a.answer ? a.answer.toString().trim() : '';
                return answer !== '' && answer.length > 10;
              });

              if (validAnswers.length === 0) {
                band = 0;
              } else {
                const totalLength = validAnswers.reduce((sum, a) => {
                  return sum + (a.answer ? a.answer.toString().length : 0);
                }, 0);

                // IELTS-based scoring with stricter criteria
                if (section === 'writing') {
                  // IELTS Writing requires Task 1 (150+ words) + Task 2 (250+ words)
                  if (totalLength < 200) band = 1.0; // Severely under length
                  else if (totalLength < 300) band = 2.5; // Under minimum combined
                  else if (totalLength < 400) band = 4.0; // Meeting basic requirements
                  else if (totalLength < 500) band = 5.0; // Adequate length
                  else if (totalLength < 600) band = 5.5; // Good length
                  else band = 6.0; // Very good length (but content quality unknown)
                } else { // speaking
                  // Speaking needs substantial responses across multiple questions
                  const avgLength = totalLength / validAnswers.length;
                  if (avgLength < 30) band = 1.0; // Very brief responses
                  else if (avgLength < 60) band = 3.0; // Short responses
                  else if (avgLength < 100) band = 4.5; // Adequate responses
                  else if (avgLength < 150) band = 5.5; // Good responses
                  else band = 6.0; // Very good responses
                }

                // Apply stricter completion penalties for IELTS
                const completionRate = validAnswers.length / Math.max(sectionAnswers.length, 1);
                if (completionRate < 0.3) {
                  band = Math.min(band, 1.0); // Severe penalty for very incomplete
                } else if (completionRate < 0.6) {
                  band = Math.min(band, 3.0); // Major penalty for incomplete
                } else if (completionRate < 0.8) {
                  band = Math.min(band, 4.5); // Moderate penalty
                }
              }
              console.log(`${section}: Fallback scoring, total length: ${validAnswers.reduce((sum, a) => sum + (a.answer ? a.answer.toString().length : 0), 0)}, completion: ${((validAnswers.length / Math.max(sectionAnswers.length, 1)) * 100).toFixed(1)}%, band: ${band}`);
            }
          } catch (error) {
            console.error(`Error evaluating ${section}:`, error);
            band = 0;
          }

        } else if (section === 'unknown') {
          // Skip unknown sections
          console.log(`Skipping unknown section with ${sectionAnswers.length} answers`);
          continue;
        }

        // Ensure band is within valid IELTS range
        band = Math.max(0, Math.min(9, band));
        sectionScores[`${section}Band`] = Math.round(band * 2) / 2; // Round to nearest 0.5
      }

      // Calculate overall band using proper IELTS rules
      const validSections = ['listening', 'reading', 'writing', 'speaking'];
      const sectionBands = validSections.map(section => sectionScores[`${section}Band`]).filter(band => band !== undefined && band > 0);

      let overallBand = 0;
      if (sectionBands.length === 4) {
        // Use proper IELTS overall band calculation
        overallBand = calculateOverallBand(
          sectionScores.listeningBand || 0,
          sectionScores.readingBand || 0,
          sectionScores.writingBand || 0,
          sectionScores.speakingBand || 0
        );
      } else if (sectionBands.length > 0) {
        // Partial test - use average with IELTS rounding
        const average = sectionBands.reduce((a, b) => a + b, 0) / sectionBands.length;
        const decimal = average % 1;
        if (decimal >= 0.75) {
          overallBand = Math.ceil(average);
        } else if (decimal >= 0.25) {
          overallBand = Math.floor(average) + 0.5;
        } else {
          overallBand = Math.floor(average);
        }
      }

      sectionScores.overallBand = overallBand;

      console.log("Final calculated scores using IELTS standards:", sectionScores);

      // Update session with calculated scores
      const updatedSession = await storage.updateTestSession(sessionId, sectionScores);

      res.json({
        message: "Scores calculated successfully using IELTS band mapping",
        scores: sectionScores,
        session: updatedSession,
        debug: {
          totalAnswers: answers.length,
          sectionBreakdown: Object.keys(answersBySection).map(k => `${k}: ${answersBySection[k].length}`),
          listeningScore: sectionScores.listeningCorrect !== undefined ? 
            `${sectionScores.listeningCorrect}/${sectionScores.listeningTotal}` : 'Not calculated',
          readingScore: sectionScores.readingCorrect !== undefined ? 
            `${sectionScores.readingCorrect}/${sectionScores.readingTotal}` : 'Not calculated'
        }
      });
    } catch (error: any) {
      console.error("Score calculation error:", error);
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

      const sessionId = req.params.sessionId;

      // Get all answers for this session
      const answers = await storage.getAnswersForSession(sessionId);
      console.log(`Found ${answers.length} total answers for session`);

      // Group answers by section
      const answersBySection = answers.reduce((acc, answer) => {
        const section = answer.section || 'unknown';
        if (!acc[section]) {
          acc[section] = [];
        }
        acc[section].push(answer);
        return acc;
      }, {} as Record<string, any[]>);

      console.log("Answers by section:", Object.keys(answersBySection).map(k => `${k}: ${answersBySection[k].length}`));

      const sectionScores: any = {};

      // Calculate band scores for each section using proper IELTS band mapping
      for (const section of Object.keys(answersBySection)) {
        const sectionAnswers = answersBySection[section];
        console.log(`Evaluating ${section} section with ${sectionAnswers.length} total answers`);

        let band = 0;

        if (section === 'listening' || section === 'reading') {
          try {
            // Get questions for this section to validate answers
            const questions = await storage.getTestQuestions(section as any);
            console.log(`Found ${questions.length} questions for ${section}`);

            if (questions.length > 0) {
              // Use the proper scoring service
              const result = ScoringService.scoreObjectiveAnswers(sectionAnswers, questions);
              // Apply proper IELTS band mapping
              band = rawScoreToBand(result.rawScore, section as 'listening' | 'reading');

              console.log(`${section}: ${result.correctAnswers}/${result.totalQuestions} correct, raw score: ${result.rawScore}, band: ${band}`);
            } else {
              // Fallback if no questions found - estimate based on answer quality
              const validAnswers = sectionAnswers.filter(a => {
                const answer = a.answer ? a.answer.toString().trim() : '';
                return answer !== '' && answer.length > 2;
              });

              // Conservative estimation - percentage of valid answers mapped to raw score
              const estimatedRawScore = Math.round((validAnswers.length / Math.max(sectionAnswers.length, 40)) * 40);
              band = rawScoreToBand(estimatedRawScore, section as 'listening' | 'reading');
              
              console.log(`${section}: Fallback estimation, estimated raw score: ${estimatedRawScore}, band: ${band}`);
            }
          } catch (error) {
            console.error(`Error scoring ${section}:`, error);
            band = 0;
          }
        } else if (section === 'writing' || section === 'speaking') {
          try {
            const evaluations = await storage.getEvaluationsForSession(sessionId, section);
            if (evaluations && evaluations.length > 0) {
              // Use AI evaluation score
              const avgBand = evaluations.reduce((sum, evaluation) => sum + evaluation.bandScore, 0) / evaluations.length;
              band = Math.round(avgBand * 2) / 2; // Round to nearest 0.5
              console.log(`${section}: Using AI evaluation, band: ${band}`);
            } else {
              // Conservative fallback scoring based on IELTS standards
              const validAnswers = sectionAnswers.filter(a => {
                const answer = a.answer ? a.answer.toString().trim() : '';
                return answer !== '' && answer.length > 10;
              });

              if (validAnswers.length === 0) {
                band = 0;
              } else {
                const avgLength = validAnswers.reduce((sum, a) => {
                  return sum + (a.answer ? a.answer.toString().length : 0);
                }, 0) / validAnswers.length;

                // Conservative IELTS-based scoring
                if (section === 'writing') {
                  // IELTS Writing requires minimum 150 words (Task 1) and 250 words (Task 2)
                  if (avgLength < 150) band = 2.0; // Below minimum
                  else if (avgLength < 250) band = 4.0; // Meeting Task 1 only
                  else if (avgLength < 400) band = 5.0; // Basic completion
                  else if (avgLength < 600) band = 6.0; // Good length
                  else band = 6.5; // Excellent length (but content quality unknown)
                } else { // speaking
                  // Speaking responses should be substantial
                  if (avgLength < 50) band = 2.0; // Very brief
                  else if (avgLength < 100) band = 4.0; // Short responses
                  else if (avgLength < 200) band = 5.5; // Adequate detail
                  else if (avgLength < 300) band = 6.0; // Good detail
                  else band = 6.5; // Excellent detail
                }

                // Apply completion penalty
                const completionRate = validAnswers.length / Math.max(sectionAnswers.length, 1);
                if (completionRate < 0.5) {
                  band = Math.min(band, 3.0); // Severe penalty for incomplete responses
                } else if (completionRate < 0.8) {
                  band = Math.min(band, 5.0); // Moderate penalty
                }
              }
              console.log(`${section}: Conservative fallback scoring, band: ${band}`);
            }
          } catch (error) {
            console.error(`Error evaluating ${section}:`, error);
            band = 0;
          }
        } else if (section === 'unknown') {
          // Skip unknown sections
          console.log(`Skipping unknown section with ${sectionAnswers.length} answers`);
          continue;
        }

        sectionScores[`${section}Band`] = Math.max(0, Math.min(9, band)); // Ensure 0-9 range
      }

      // Calculate overall band using proper IELTS calculation rules
      const validSections = ['listening', 'reading', 'writing', 'speaking'];
      const sectionBands = validSections.map(section => sectionScores[`${section}Band`]).filter(band => band !== undefined);

      let overallBand = 0;
      if (sectionBands.length === 4) {
        // Use proper IELTS overall band calculation from band-mapping.ts
        overallBand = calculateOverallBand(
          sectionScores.listeningBand || 0,
          sectionScores.readingBand || 0, 
          sectionScores.writingBand || 0,
          sectionScores.speakingBand || 0
        );
      } else if (sectionBands.length > 0) {
        // Partial completion - use average with proper rounding
        const average = sectionBands.reduce((a, b) => a + b, 0) / sectionBands.length;
        // Apply IELTS rounding rules manually
        const decimal = average % 1;
        if (decimal >= 0.75) {
          overallBand = Math.ceil(average);
        } else if (decimal >= 0.25) {
          overallBand = Math.floor(average) + 0.5;
        } else {
          overallBand = Math.floor(average);
        }
      }

      sectionScores.overallBand = overallBand;

      console.log("Final calculated scores using IELTS band mapping:", sectionScores);

      // Update session with calculated scores
      const updatedSession = await storage.updateTestSession(sessionId, sectionScores);

      res.json({
        message: "Scores calculated successfully using IELTS band mapping",
        scores: sectionScores,
        session: updatedSession
      });
    } catch (error: any) {
      console.error("Score calculation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}