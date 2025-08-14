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

    // Handle common variations
    const variations = [
      // Number formats
      (ans: string) => ans.replace(/\b(\d+)\b/g, (match) => {
        const num = parseInt(match);
        if (!isNaN(num)) {
          return [num.toString(), this.numberToWords(num)].join('|');
        }
        return match;
      }),
      
      // Common synonyms (basic set)
      (ans: string) => ans
        .replace(/\b(big|large|huge)\b/g, 'big|large|huge')
        .replace(/\b(small|little|tiny)\b/g, 'small|little|tiny')
        .replace(/\b(happy|glad|pleased)\b/g, 'happy|glad|pleased'),
    ];

    // Try variations
    for (const variation of variations) {
      const variedUser = variation(userAnswer);
      const variedCorrect = variation(correctAnswer);
      
      if (variedUser.includes(variedCorrect) || variedCorrect.includes(variedUser)) {
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
