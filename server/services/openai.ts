import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR 
});

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

export class OpenAIService {
  private checkApiKey(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
  }

  private handleError(error: any): AIResponse {
    console.error('OpenAI API Error:', error);
    return {
      success: false,
      error: error.message || 'AI service unavailable',
      rawResponse: error
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<AIResponse<{ text: string }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
      });

      return {
        success: true,
        data: { text: response.choices[0].message.content || '' },
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async evaluateWriting(prompt: string, candidateText: string): Promise<AIResponse<WritingEvaluationResult>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: evaluationPrompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        success: true,
        data: result,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async evaluateSpeaking(transcript: string, audioFeatures?: any): Promise<AIResponse<SpeakingEvaluationResult>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: evaluationPrompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        success: true,
        data: result,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<AIResponse<{ text: string; duration?: number }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      // Note: In a real implementation, you'd need to handle the audio buffer properly
      // For now, we'll return a placeholder response
      const transcription = await openai.audio.transcriptions.create({
        file: audioBuffer as any, // This would need proper file handling
        model: "whisper-1",
      });

      return {
        success: true,
        data: {
          text: transcription.text,
          duration: 0 // Would be extracted from audio metadata
        },
        rawResponse: transcription
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateListeningAnswers(transcript: string, questions: any[]): Promise<AIResponse<any[]>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const prompt = `You are an expert IELTS test item analyst. Given the following transcript of listening audio and the question list, extract concise answers suitable for auto-grading (for short answer and multiple choice). Return an array of {questionId, canonicalAnswer, answerType, notes}.

Transcript: "${transcript}"
Questions: ${JSON.stringify(questions)}

Return JSON array only.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      
      return {
        success: true,
        data: result,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async generateSpeakingPrompt(context: { part: number; topic?: string; lastResponse?: string }): Promise<AIResponse<{ prompt: string; variations?: string[] }>> {
    if (!this.checkApiKey()) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const prompt = `You are an IELTS speaking examiner in part ${context.part}. Based on the conversation context, produce a natural follow-up question or prompt to keep the conversation flowing. Keep questions short and in examiner style. Provide two candidate-level variations: easier and harder.

Context: ${JSON.stringify(context)}

Return JSON with: { "prompt": "main question", "variations": ["easier", "harder"] }`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        success: true,
        data: result,
        rawResponse: response
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const openaiService = new OpenAIService();
