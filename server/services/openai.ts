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

    if (!audioBuffer) {
      return { success: false, error: 'No audio buffer provided' };
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
      const prompt = `Generate a complete IELTS Listening test with exactly 4 sections, 40 questions total (10 questions per section). Follow the authentic IELTS format:

      Section 1: Everyday conversation (social survival) - 2 speakers
      - Form completion (Questions 1-5): Complete form with NO MORE THAN THREE WORDS AND/OR A NUMBER
      - Multiple choice (Questions 6-7): Choose correct letters
      - Sentence completion (Questions 8-10): Fill blanks with NO MORE THAN THREE WORDS

      Section 2: Monologue in everyday context - 1 speaker
      - Note completion (Questions 11-20): Complete notes with NO MORE THAN THREE WORDS AND/OR A NUMBER

      Section 3: Academic conversation - up to 4 speakers
      - Sentence completion (Questions 21-24): NO MORE THAN THREE WORDS AND/OR A NUMBER
      - Chart completion (Questions 25-27): ONE WORD AND/OR A NUMBER
      - Multiple choice (Questions 28-30): Choose THREE correct letters

      Section 4: Academic lecture - 1 speaker
      - Multiple choice (Questions 31-40): Choose correct letter A, B, C or D

      Return JSON format with authentic IELTS question structures:
      {
        "sections": [
          {
            "sectionNumber": 1,
            "title": "Section 1",
            "instructions": "You will hear a conversation between a student and a housing officer. First you have some time to look at questions 1 to 5.",
            "transcript": "Housing Officer: Good morning, how can I help you?\\nStudent: I'd like to apply for accommodation...",
            "questions": [
              {
                "_id": "q1",
                "questionType": "form_completion",
                "content": {
                  "question": "First name: _______",
                  "wordLimit": "NO MORE THAN THREE WORDS AND/OR A NUMBER"
                },
                "correctAnswers": ["answer"],
                "orderIndex": 1
              },
              {
                "_id": "q6",
                "questionType": "multiple_choice",
                "content": {
                  "question": "Which TWO things does the student prefer?",
                  "options": ["A quiet environment", "B shared facilities", "C private bathroom", "D cooking facilities"],
                  "selectMultiple": 2
                },
                "correctAnswers": ["A", "C"],
                "orderIndex": 6
              }
            ]
          }
        ]
      }

      Make authentic IELTS content with realistic scenarios, proper British English, and exact IELTS question formats.`;

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

      // This function is intended to generate the full listening test,
      // so we will iterate through each section and generate its questions.
      const generatedSections = await Promise.all(content.sections.map(async (section: any) => {
        let sectionNum = section.sectionNumber;
        let sectionDescription = "";
        let questionTypes: string[] = [];

        switch(sectionNum) {
          case 1:
            sectionDescription = "Section 1 - Social/Everyday Context (2 speakers, telephone conversation, form completion, basic information)";
            questionTypes = ["form_completion", "form_completion", "form_completion", "form_completion", "form_completion", "multiple_choice", "multiple_choice", "fill_blank", "fill_blank", "fill_blank"];
            break;
          case 2:
            sectionDescription = "Section 2 - Monologue in everyday context (1 speaker, information about a place or event)";
            questionTypes = ["fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank"];
            break;
          case 3:
            sectionDescription = "Section 3 - Academic conversation (2-4 speakers, discussion about a study topic)";
            questionTypes = ["fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "multiple_choice", "multiple_choice", "multiple_choice"];
            break;
          case 4:
            sectionDescription = "Section 4 - Academic lecture (1 speaker, lecture on a scientific or academic topic)";
            questionTypes = ["fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank", "fill_blank"];
            break;
          default:
            sectionDescription = "Unknown Section";
            questionTypes = Array(10).fill("fill_blank");
        }

        const contentGenerationPrompt = `You are an expert IELTS test developer. Carefully analyze this audio transcript to create exactly 10 authentic IELTS listening questions for ${sectionDescription}.

TRANSCRIPT ANALYSIS REQUIRED:
"${section.transcript}"

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
- form_completion: Create realistic form fields as they appear in IELTS Section 1. Use contexts like: application forms, booking forms, registration forms, membership forms, etc. Format each as "Field Label: _______" 
- multiple_choice: Create 4 realistic options with ONLY ONE correct answer from transcript
- fill_blank: Use words/phrases/numbers that are clearly spoken in the audio

FORM COMPLETION CONTEXTS (Section 1):
- Personal information forms (name, address, phone, email, age, occupation)
- Booking/reservation forms (dates, times, numbers of people, special requirements)
- Application forms (course enrollment, membership, job applications)
- Registration forms (events, services, programs)

ANSWER REQUIREMENTS:
- All answers must be directly extractable from the transcript
- For form_completion: Use exact words/numbers from transcript, create realistic form labels like "First name:", "Telephone number:", "Date of birth:", etc.
- For fill_blank: Use exact words/numbers from transcript (max 3 words)
- For multiple_choice: Correct option must match transcript information exactly

Return JSON format:
{
  "sectionTitle": "Appropriate title for ${sectionDescription}",
  "instructions": "Listen to the ${sectionNum === 1 ? 'conversation' : sectionNum === 2 || sectionNum === 4 ? 'talk' : 'discussion'} and answer Questions ${(sectionNum-1)*10 + 1}-${sectionNum*10}. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.",
  "formTitle": "Application Form", // for form_completion sections
  "questions": [
    {
      "questionType": "${questionTypes[0]}",
      "question": "First name: _______", // for form_completion, use realistic form field labels
      "correctAnswer": "Exact word/phrase from transcript",
      "orderIndex": 1,
      "formContext": { // required for form_completion
        "formTitle": "Course Application Form",
        "fieldLabel": "First name",
        "fieldType": "text"
      }
    }
    // Continue for all 10 questions, ensuring each tests different transcript content
  ]
}`;

        const questionGenerationResult = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: contentGenerationPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 4000, // Increased tokens for more complex JSON output
            temperature: 0.7,
          },
        });

        const questionResponse = await questionGenerationResult.response;
        let questionResponseText = questionResponse.text() || '{}';
        questionResponseText = questionResponseText.replace(/```json\s*|\s*```/g, '').trim();

        const generatedQuestions = JSON.parse(questionResponseText);

        // Update the section with generated questions and adjust instructions for form completion
        let updatedInstructions = generatedQuestions.instructions;
        if (questionTypes.includes("form_completion") && sectionNum === 1) {
          updatedInstructions = "Complete the form below. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.";
        }

        return {
          ...section, // Keep original section details like transcript
          title: generatedQuestions.sectionTitle || section.title,
          instructions: updatedInstructions,
          questions: generatedQuestions.questions.map((q: any, index: number) => {
            // Ensure questionType is correctly set from questionTypes array
            const finalQuestionType = questionTypes[index] || q.questionType; // Fallback to AI's type if needed

            // Add formContext for form_completion questions
            if (finalQuestionType === "form_completion") {
              return {
                ...q,
                questionType: finalQuestionType,
                question: `${generatedQuestions.formTitle || "Form Field"}: _______`, // Default label if not explicitly set
                formContext: {
                  formTitle: generatedQuestions.formTitle || "Generic Form",
                  fieldLabel: q.question.split(':')[0] || "Form Field", // Extract label from question if present
                  fieldType: "text" // Default type, can be inferred or set later
                },
                // Use correctAnswer directly if provided, otherwise assume it's in the question string
                correctAnswer: q.correctAnswer || q.question.split(': ')[1]?.replace(' _______', '').trim() || 'N/A',
              };
            } else {
              // For other question types, ensure correct structure
              return {
                ...q,
                questionType: finalQuestionType,
                correctAnswer: q.correctAnswer || 'N/A', // Ensure correctAnswer exists
                orderIndex: index + 1 // Ensure orderIndex is sequential
              };
            }
          }),
          audioUrl: section.audioUrl // Preserve original audioUrl if present
        };
      }));

      return {
        success: true,
        data: { sections: generatedSections },
        rawResponse: response // Original response from the initial prompt
      };
    } catch (error: any) {
      console.error("Error in generateListeningContent:", error);
      return this.handleError(error);
    }
  }
}

export const geminiService = new GeminiService();
// Keep the openaiService export for backward compatibility
export const openaiService = geminiService;