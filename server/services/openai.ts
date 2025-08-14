
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
  private model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  private checkApiKey(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }

  private handleError(error: any): AIResponse {
    console.error('Gemini AI Error:', error);
    
    // Check if it's a quota exceeded error
    if (error.status === 429) {
      return {
        success: false,
        error: 'API quota exceeded. Please wait a moment and try again.',
        rawResponse: error
      };
    }
    
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
      // Convert audio buffer to base64 for Gemini processing
      const base64Audio = audioBuffer.toString('base64');
      
      // Use Gemini to analyze the audio and provide transcription
      const prompt = `Please transcribe this audio file. Provide an accurate, word-for-word transcription of all speech in the audio. Include speaker identification if multiple speakers are present. Format as natural dialogue or monologue as appropriate.`;

      const result = await this.model.generateContent({
        contents: [{
          role: "user", 
          parts: [
            { text: prompt },
            { 
              inlineData: {
                mimeType: "audio/mpeg", // Adjust based on actual audio format
                data: base64Audio
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.1, // Low temperature for accuracy
        },
      });

      const response = await result.response;
      const transcribedText = response.text() || "Could not transcribe audio";

      console.log("Audio transcription result:", transcribedText.substring(0, 200) + "...");

      return {
        success: true,
        data: {
          text: transcribedText,
          duration: Math.floor(audioBuffer.length / 16000) // Rough estimate
        },
        rawResponse: response
      };
    } catch (error) {
      console.error("Audio transcription error:", error);
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

  async generateListeningContent(): Promise<AIResponse<{ sections: Array<{ title: string; transcript: string; questions: any[]; audioUrl?: string }> }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    try {
      const prompt = `Generate a complete IELTS Listening test with exactly 4 sections, 40 questions total (10 questions per section). Each section should have:

      Section 1: Everyday conversation (social survival) - 2 speakers
      Section 2: Monologue in everyday context (social survival) - 1 speaker  
      Section 3: Academic conversation - up to 4 speakers
      Section 4: Academic lecture or monologue - 1 speaker

      Each section needs:
      1. Realistic transcript (3-4 minutes of natural spoken content)
      2. 10 questions using IELTS question types: multiple choice, form completion, note completion, table completion, labelling diagrams/maps, classification, matching, sentence completion
      3. Progressive difficulty from Section 1 (easiest) to Section 4 (hardest)

      Return JSON format:
      {
        "sections": [
          {
            "sectionNumber": 1,
            "title": "Section 1 - Everyday Conversation", 
            "instructions": "You will hear a conversation between...",
            "transcript": "Speaker 1: Good morning, I'd like to make a reservation...",
            "questions": [
              {
                "_id": "q1",
                "questionType": "multiple_choice",
                "content": {
                  "question": "What does the caller want to do?",
                  "options": ["Make a reservation", "Cancel a booking", "Complain about service", "Get directions"]
                },
                "correctAnswers": ["Make a reservation"],
                "orderIndex": 1
              },
              {
                "_id": "q2", 
                "questionType": "fill_blank",
                "content": {
                  "question": "The booking is for _______ people."
                },
                "correctAnswers": ["two", "2"],
                "orderIndex": 2
              }
            ]
          }
        ]
      }

      Make it authentic IELTS Academic level content with natural speech patterns, realistic scenarios, and proper British/International English.`;

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8000,
          temperature: 0.8,
        },
      });

      const response = await result.response;
      let responseText = response.text() || '{}';
      
      // Clean any markdown code block wrappers
      responseText = responseText.replace(/```json\s*|\s*```/g, '').trim();
      
      console.log("AI Generated Listening Content:", responseText.substring(0, 500) + "...");
      const content = JSON.parse(responseText);

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
