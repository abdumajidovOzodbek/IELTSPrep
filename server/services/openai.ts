
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "");

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: any;
}

export interface WritingEvaluationResult {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
  overallWritingBand: number;
  justifications: {
    taskAchievement: string;
    coherenceCohesion: string;
    lexicalResource: string;
    grammaticalRange: string;
  };
  improvementTips: string[];
}

export interface SpeakingEvaluationResult {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRange: number;
  pronunciation: number;
  overallSpeakingBand: number;
  justifications: {
    fluencyCoherence: string;
    lexicalResource: string;
    grammaticalRange: string;
    pronunciation: string;
  };
  improvementTips: string[];
}

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  private checkApiKey(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }

  private handleError(error: any): AIResponse {
    console.error('Gemini AI Error:', error);
    return {
      success: false,
      error: error.message || 'AI service unavailable',
      rawResponse: error
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<AIResponse<{ text: string }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
        },
      });

      const response = await result.response;
      return {
        success: true,
        data: { text: response.text() || '' },
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async evaluateWriting(prompt: string, candidateText: string): Promise<AIResponse<WritingEvaluationResult>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const evaluationPrompt = `You are an IELTS-certified examiner. Score the writing sample using the IELTS band descriptors. Provide numeric band (0.0 - 9.0) for each: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. For each criterion, give a 1–2 sentence justification and a short list of 3 improvement suggestions. Finally provide the recommended overall writing band (rounded to nearest 0.5) and exact scoring breakdown in JSON.

Writing prompt: "${prompt}"

Candidate text: "${candidateText}"

Output JSON only with fields:
{
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammaticalRange": number,
  "overallWritingBand": number,
  "justifications": {
    "taskAchievement": "...",
    "coherenceCohesion": "...",
    "lexicalResource": "...",
    "grammaticalRange": "..."
  },
  "improvementTips": ["tip1","tip2","tip3"]
}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const jsonResult = JSON.parse(response.text() || '{}');
      
      return {
        success: true,
        data: jsonResult,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async evaluateSpeaking(transcript: string, audioFeatures?: any): Promise<AIResponse<SpeakingEvaluationResult>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const evaluationPrompt = `You are an experienced IELTS speaking examiner. Evaluate the candidate's spoken response (transcript and audio characteristics) by scoring: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation. For each criterion return a number (0.0–9.0), a short justification, and 3 short tips for improvement. Return JSON only.

Transcript: "${transcript}"
${audioFeatures ? `Audio features: ${JSON.stringify(audioFeatures)}` : ''}

Output JSON only with fields:
{
  "fluencyCoherence": number,
  "lexicalResource": number,
  "grammaticalRange": number,
  "pronunciation": number,
  "overallSpeakingBand": number,
  "justifications": {
    "fluencyCoherence": "...",
    "lexicalResource": "...",
    "grammaticalRange": "...",
    "pronunciation": "..."
  },
  "improvementTips": ["tip1","tip2","tip3"]
}`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const jsonResult = JSON.parse(response.text() || '{}');
      
      return {
        success: true,
        data: jsonResult,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<AIResponse<{ text: string; duration?: number }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    try {
      // Note: Gemini doesn't directly support audio transcription like Whisper
      // For now, we'll return a placeholder response
      // In production, you'd use Google Speech-to-Text API or another service
      return {
        success: true,
        data: {
          text: "Audio transcription feature requires Google Speech-to-Text API integration",
          duration: 0
        },
        rawResponse: null
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateListeningAnswers(transcript: string, questions: any[]): Promise<AIResponse<any[]>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const prompt = `You are an expert IELTS test item analyst. Given the following transcript of listening audio and the question list, extract concise answers suitable for auto-grading (for short answer and multiple choice). Return an array of {questionId, canonicalAnswer, answerType, notes}.

Transcript: "${transcript}"
Questions: ${JSON.stringify(questions)}

Return JSON array only.`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const jsonResult = JSON.parse(response.text() || '[]');
      
      return {
        success: true,
        data: jsonResult,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateSpeakingPrompt(context: { part: number; topic?: string; lastResponse?: string }): Promise<AIResponse<{ prompt: string; variations?: string[] }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const prompt = `You are an IELTS speaking examiner in part ${context.part}. Based on the conversation context, produce a natural follow-up question or prompt to keep the conversation flowing. Keep questions short and in examiner style. Provide two candidate-level variations: easier and harder.

Context: ${JSON.stringify(context)}

Return JSON with: { "prompt": "main question", "variations": ["easier", "harder"] }`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const response = await result.response;
      const jsonResult = JSON.parse(response.text() || '{}');
      
      return {
        success: true,
        data: jsonResult,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateAudio(text: string, voice: string = "alloy"): Promise<AIResponse<{ audioUrl: string; duration: number }>> {
    // Gemini doesn't support text-to-speech directly
    // You'd need to integrate with Google Text-to-Speech API or another TTS service
    return {
      success: false,
      error: 'Audio generation requires Google Text-to-Speech API integration'
    };
  }

  async generateListeningContent(): Promise<AIResponse<{ sections: Array<{ title: string; transcript: string; questions: any[] }> }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    try {
      const prompt = `Generate complete IELTS Listening test content with 3 sections. Each section should have:
      1. A realistic conversation or monologue transcript (2-3 minutes of spoken content)
      2. 3-4 multiple choice questions based on the audio
      3. Appropriate difficulty progression from section 1 to 3

      Format as JSON with this structure:
      {
        "sections": [
          {
            "title": "Section 1 - Everyday Conversation",
            "transcript": "Full transcript of conversation between Sarah and hotel receptionist discussing room booking...",
            "questions": [
              {
                "id": "q1",
                "question": "What is the main purpose of the call?",
                "options": ["A) To book a hotel", "B) To cancel a reservation", "C) To make a complaint", "D) To ask for directions"],
                "correct": "A"
              }
            ]
          }
        ]
      }

      Make the content realistic, engaging, and appropriate for IELTS Academic level. Include natural speech patterns and realistic scenarios.`;

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 3000,
          temperature: 0.7,
        },
      });

      const response = await result.response;
      const content = JSON.parse(response.text() || '{}');

      return {
        success: true,
        data: content,
        rawResponse: response
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }
}

export const geminiService = new GeminiService();
// Keep the openaiService export for backward compatibility
export const openaiService = geminiService;
