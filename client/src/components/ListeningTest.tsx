import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AudioPlayer } from '@/components/AudioPlayer';

interface Question {
  _id: string;
  questionType: string;
  content: {
    question: string;
    options?: string[];
    wordLimit?: string;
    selectMultiple?: number;
  };
  correctAnswers: string[];
  orderIndex: number;
}

interface Section {
  sectionNumber: number;
  title: string;
  instructions: string;
  transcript: string;
  questions: Question[];
  audioUrl?: string;
}

interface ListeningTestProps {
  sections: Section[];
  onAnswerChange: (questionId: string, answer: string) => void;
  answers: Record<string, string>;
}

export function ListeningTest({ sections, onAnswerChange, answers }: ListeningTestProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const section = sections[currentSection];
  if (!section) return null;

  const renderQuestion = (question: Question, globalIndex: number) => {
    const isAnswered = !!answers[question._id];

    // Form completion questions (Section 1: 1-5)
    if (question.questionType === 'form_completion') {
      return (
        <div key={question._id} className="mb-4">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-700 min-w-[30px]">{globalIndex}</span>
            <div className="flex-1">
              <Input
                value={answers[question._id] || ''}
                onChange={(e) => onAnswerChange(question._id, e.target.value)}
                placeholder="Your answer"
                className={`max-w-xs ${isAnswered ? 'border-green-500' : ''}`}
              />
            </div>
          </div>
          {question.content.wordLimit && (
            <p className="text-xs text-red-600 mt-1 ml-12">
              {question.content.wordLimit}
            </p>
          )}
        </div>
      );
    }

    // Multiple choice questions
    if (question.questionType === 'multiple_choice') {
      const isMultiSelect = question.content.selectMultiple && question.content.selectMultiple > 1;
      
      return (
        <div key={question._id} className="mb-6">
          <div className="mb-3">
            <span className="font-medium text-slate-700">{globalIndex}</span>
            <span className="ml-2">{question.content.question}</span>
          </div>
          
          <div className="ml-6 space-y-2">
            {question.content.options?.map((option, index) => {
              const letter = String.fromCharCode(65 + index); // A, B, C, D
              const isSelected = isMultiSelect 
                ? (answers[question._id] || '').includes(letter)
                : answers[question._id] === letter;
              
              return (
                <label key={index} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type={isMultiSelect ? "checkbox" : "radio"}
                    name={`question-${question._id}`}
                    value={letter}
                    checked={isSelected}
                    onChange={(e) => {
                      if (isMultiSelect) {
                        const current = answers[question._id] || '';
                        const letters = current.split('').filter(l => l !== letter);
                        if (e.target.checked) {
                          letters.push(letter);
                        }
                        onAnswerChange(question._id, letters.sort().join(''));
                      } else {
                        onAnswerChange(question._id, letter);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">{letter}</span>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          
          {isMultiSelect && (
            <p className="text-xs text-red-600 mt-2 ml-6">
              Choose {question.content.selectMultiple} letters
            </p>
          )}
        </div>
      );
    }

    // Sentence completion and other fill-in types
    return (
      <div key={question._id} className="mb-4">
        <div className="flex items-start gap-3">
          <span className="font-medium text-slate-700 min-w-[30px] mt-1">{globalIndex}</span>
          <div className="flex-1">
            <div className="text-slate-800 mb-2">
              {question.content.question.includes('_______') ? (
                <span dangerouslySetInnerHTML={{
                  __html: question.content.question.replace(
                    '_______',
                    `<input 
                      type="text" 
                      value="${answers[question._id] || ''}"
                      class="border-b-2 border-slate-400 bg-transparent px-2 py-1 min-w-[120px] focus:border-blue-500 focus:outline-none ${isAnswered ? 'border-green-500' : ''}"
                      placeholder="..."
                    />`
                  )
                }} />
              ) : (
                <>
                  <span>{question.content.question}</span>
                  <Input
                    value={answers[question._id] || ''}
                    onChange={(e) => onAnswerChange(question._id, e.target.value)}
                    placeholder="Your answer"
                    className={`max-w-xs mt-2 ${isAnswered ? 'border-green-500' : ''}`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
        {question.content.wordLimit && (
          <p className="text-xs text-red-600 mt-1 ml-12">
            {question.content.wordLimit}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Section Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">
            {section.title}
          </h1>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">30:00</div>
            <div className="text-sm text-slate-600">Time remaining</div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex gap-2 mb-4">
          {sections.map((_, index) => (
            <Button
              key={index}
              variant={index === currentSection ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentSection(index)}
            >
              Section {index + 1}
            </Button>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm font-medium">
            {section.instructions}
          </p>
        </div>
      </div>

      {/* Audio Player */}
      {section.audioUrl && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Audio Player</h3>
          <AudioPlayer
            audioUrl={section.audioUrl}
            isPlaying={isAudioPlaying}
            onPlayStateChange={setIsAudioPlaying}
            allowSeeking={true}
          />
        </div>
      )}

      {/* Questions */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-xl font-semibold text-slate-900 mb-6">
          Questions {(currentSection * 10) + 1}-{(currentSection * 10) + section.questions.length}
        </h3>

        <div className="space-y-4">
          {section.questions.map((question, index) => 
            renderQuestion(question, (currentSection * 10) + index + 1)
          )}
        </div>

        {/* Progress */}
        <div className="mt-8 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Section {currentSection + 1} Progress: {
                section.questions.filter(q => answers[q._id]).length
              } of {section.questions.length} answered
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                disabled={currentSection === 0}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
                disabled={currentSection === sections.length - 1}
                size="sm"
              >
                {currentSection === sections.length - 1 ? "Review" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}