export interface TestSection {
  id: string;
  name: string;
  duration: number; // in minutes
  questions: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface BandScore {
  listening?: number;
  reading?: number;
  writing?: number;
  speaking?: number;
  overall?: number;
}

export interface TestTimer {
  total: number;
  remaining: number;
  section: number;
}

export class TestUtils {
  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  static calculateProgress(currentSection: string): number {
    const sections = ['listening', 'reading', 'writing', 'speaking'];
    const currentIndex = sections.indexOf(currentSection);
    return currentIndex >= 0 ? ((currentIndex + 1) / sections.length) * 100 : 0;
  }

  static getSectionDuration(section: string): number {
    const durations = {
      listening: 30,
      reading: 60,
      writing: 60,
      speaking: 14
    };
    return durations[section as keyof typeof durations] || 0;
  }

  static validateWordCount(text: string, minWords: number): { 
    isValid: boolean; 
    currentCount: number; 
    needed: number 
  } {
    const currentCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    return {
      isValid: currentCount >= minWords,
      currentCount,
      needed: Math.max(0, minWords - currentCount)
    };
  }

  static calculateOverallBand(scores: BandScore): number {
    const { listening = 0, reading = 0, writing = 0, speaking = 0 } = scores;
    const average = (listening + reading + writing + speaking) / 4;
    
    // IELTS rounding rules
    const decimal = average % 1;
    if (decimal >= 0.75) {
      return Math.ceil(average);
    } else if (decimal >= 0.25) {
      return Math.floor(average) + 0.5;
    } else {
      return Math.floor(average);
    }
  }

  static getBandDescriptor(band: number): string {
    const descriptors = {
      9: 'Expert User',
      8.5: 'Very Good User', 
      8: 'Very Good User',
      7.5: 'Good User',
      7: 'Good User',
      6.5: 'Competent User',
      6: 'Competent User',
      5.5: 'Modest User',
      5: 'Modest User',
      4.5: 'Limited User',
      4: 'Limited User',
      3.5: 'Extremely Limited User',
      3: 'Extremely Limited User',
      2.5: 'Intermittent User',
      2: 'Intermittent User',
      1: 'Non User',
      0: 'Did not attempt'
    };
    
    return descriptors[band as keyof typeof descriptors] || 'Unknown';
  }

  static getNextSection(currentSection: string): string | null {
    const sections = ['listening', 'reading', 'writing', 'speaking'];
    const currentIndex = sections.indexOf(currentSection);
    return currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;
  }

  static getPreviousSection(currentSection: string): string | null {
    const sections = ['listening', 'reading', 'writing', 'speaking'];
    const currentIndex = sections.indexOf(currentSection);
    return currentIndex > 0 ? sections[currentIndex - 1] : null;
  }

  static isTestComplete(session: any): boolean {
    return session?.status === 'completed' || 
           (session?.listeningBand && session?.readingBand && 
            session?.writingBand && session?.speakingBand);
  }

  static calculateTimeRemaining(startTime: Date, totalMinutes: number): number {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const total = totalMinutes * 60;
    return Math.max(0, total - elapsed);
  }

  static normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  static compareAnswers(userAnswer: string, correctAnswer: string): boolean {
    const normalizedUser = this.normalizeAnswer(userAnswer);
    const normalizedCorrect = this.normalizeAnswer(correctAnswer);
    
    // Exact match
    if (normalizedUser === normalizedCorrect) return true;
    
    // Handle common variations
    const variations = [
      // Numbers
      (ans: string) => ans.replace(/\b(\d+)\b/g, (match) => {
        const num = parseInt(match);
        return !isNaN(num) ? this.numberToWords(num) : match;
      }),
      
      // Common synonyms
      (ans: string) => ans
        .replace(/\b(big|large|huge)\b/g, 'large')
        .replace(/\b(small|little|tiny)\b/g, 'small')
        .replace(/\b(happy|glad|pleased)\b/g, 'happy')
    ];

    for (const variation of variations) {
      if (variation(normalizedUser) === variation(normalizedCorrect)) {
        return true;
      }
    }

    return false;
  }

  private static numberToWords(num: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num === 0) return 'zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    
    return num.toString();
  }

  static generateSessionSummary(session: any): {
    duration: string;
    sectionsCompleted: number;
    totalQuestions: number;
    averageAccuracy: number;
  } {
    const startTime = new Date(session.startTime);
    const endTime = session.endTime ? new Date(session.endTime) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    return {
      duration: `${Math.floor(duration / 60)}h ${duration % 60}m`,
      sectionsCompleted: [session.listeningBand, session.readingBand, session.writingBand, session.speakingBand]
        .filter(band => band !== null && band !== undefined).length,
      totalQuestions: 80, // 40 listening + 40 reading
      averageAccuracy: 0.85 // This would be calculated from actual answers
    };
  }
}
