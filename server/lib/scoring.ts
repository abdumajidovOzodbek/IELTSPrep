import { TestAnswer, TestQuestion, AiEvaluation } from "@shared/schema";

export interface ScoringResult {
  totalQuestions: number;
  correctAnswers: number;
  rawScore: number;
  band: number;
  accuracy: number;
}

export class ScoringService {
  /**
   * Score objective questions (Listening/Reading)
   */
  static scoreObjectiveAnswers(answers: TestAnswer[], questions: TestQuestion[]): ScoringResult {
    let correctAnswers = 0;
    const totalQuestions = questions.length;

    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question || !question.correctAnswers) return;

      const userAnswer = this.normalizeAnswer(answer.answer as string);
      const correctAnswersList = question.correctAnswers as string[];
      
      const isCorrect = correctAnswersList.some(correct => 
        this.compareAnswers(userAnswer, this.normalizeAnswer(correct))
      );

      if (isCorrect) {
        correctAnswers++;
      }
    });

    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return {
      totalQuestions,
      correctAnswers,
      rawScore: correctAnswers,
      band: 0, // Will be calculated using band mapping
      accuracy
    };
  }

  /**
   * Normalize answer for comparison (remove extra spaces, convert to lowercase, etc.)
   */
  private static normalizeAnswer(answer: string): string {
    if (typeof answer !== 'string') return '';
    
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, ''); // Remove punctuation
  }

  /**
   * Compare two normalized answers with tolerance for common variations
   */
  private static compareAnswers(userAnswer: string, correctAnswer: string): boolean {
    if (userAnswer === correctAnswer) return true;

    // Check if user answer contains the correct answer or vice versa
    if (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
      return true;
    }

    // Handle number variations
    const userNum = parseInt(userAnswer);
    const correctNum = parseInt(correctAnswer);
    if (!isNaN(userNum) && !isNaN(correctNum) && userNum === correctNum) {
      return true;
    }

    // Handle common spelling variations and synonyms
    const synonymMap: Record<string, string[]> = {
      'big': ['large', 'huge', 'enormous', 'massive'],
      'small': ['little', 'tiny', 'minute', 'petite'],
      'happy': ['glad', 'pleased', 'joyful', 'delighted'],
      'sad': ['unhappy', 'sorrowful', 'miserable', 'depressed'],
      'good': ['excellent', 'great', 'wonderful', 'fine'],
      'bad': ['terrible', 'awful', 'horrible', 'poor'],
      'quick': ['fast', 'rapid', 'swift', 'speedy'],
      'slow': ['sluggish', 'gradual', 'leisurely'],
    };

    // Check synonyms
    for (const [base, synonyms] of Object.entries(synonymMap)) {
      if ((userAnswer === base && synonyms.includes(correctAnswer)) ||
          (correctAnswer === base && synonyms.includes(userAnswer)) ||
          (synonyms.includes(userAnswer) && synonyms.includes(correctAnswer))) {
        return true;
      }
    }

    // Handle common IELTS answer patterns
    // Remove articles and prepositions for comparison
    const cleanUser = userAnswer.replace(/\b(a|an|the|in|on|at|of|for|with|by)\b/g, '').trim();
    const cleanCorrect = correctAnswer.replace(/\b(a|an|the|in|on|at|of|for|with|by)\b/g, '').trim();
    
    if (cleanUser === cleanCorrect) {
      return true;
    }

    // Check partial matches for multi-word answers
    const userWords = userAnswer.split(/\s+/);
    const correctWords = correctAnswer.split(/\s+/);
    
    if (userWords.length > 1 || correctWords.length > 1) {
      // If user answer contains all words from correct answer (in any order)
      const userWordsSet = new Set(userWords);
      const correctWordsSet = new Set(correctWords);
      
      if (correctWords.every(word => userWordsSet.has(word))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert number to words (basic implementation)
   */
  private static numberToWords(num: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num === 0) return 'zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    
    // Handle hundreds if needed
    return num.toString(); // Fallback for complex numbers
  }

  /**
   * Calculate writing/speaking band score from AI evaluation
   */
  static calculateSubjectiveBand(evaluation: AiEvaluation): number {
    const criteria = evaluation.criteria as any;
    
    if (evaluation.section === 'writing') {
      return (
        criteria.taskAchievement +
        criteria.coherenceCohesion +
        criteria.lexicalResource +
        criteria.grammaticalRange
      ) / 4;
    } else if (evaluation.section === 'speaking') {
      return (
        criteria.fluencyCoherence +
        criteria.lexicalResource +
        criteria.grammaticalRange +
        criteria.pronunciation
      ) / 4;
    }
    
    return evaluation.bandScore;
  }

  /**
   * Validate answer format for different question types
   */
  static validateAnswerFormat(answer: any, questionType: string): boolean {
    switch (questionType) {
      case 'multiple_choice':
        return typeof answer === 'string' && /^[A-D]$/i.test(answer);
      
      case 'fill_blank':
      case 'short_answer':
        return typeof answer === 'string' && answer.trim().length > 0;
      
      case 'essay':
        return typeof answer === 'string' && answer.trim().split(/\s+/).length >= 150;
      
      default:
        return true;
    }
  }
}
