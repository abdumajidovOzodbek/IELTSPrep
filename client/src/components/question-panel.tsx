import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Circle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  content: any;
  questionType: string;
  correctAnswers?: string[];
  orderIndex: number;
}

interface QuestionPanelProps {
  questions: Question[];
  currentQuestion: number;
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, answer: any) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  showPassageRef?: boolean;
}

export default function QuestionPanel({
  questions,
  currentQuestion,
  answers,
  onAnswerChange,
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
  showPassageRef = false
}: QuestionPanelProps) {
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(currentQuestion);

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No questions available</p>
        </div>
      </div>
    );
  }

  const question = questions[selectedQuestionIndex] || questions[0];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const renderQuestion = (question: Question) => {
    const questionId = question.id;
    const currentAnswer = answers[questionId];
    const isAnswered = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';

    switch (question.questionType) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            <RadioGroup 
              value={currentAnswer || ''} 
              onValueChange={(value) => onAnswerChange(questionId, value)}
            >
              {question.content.options?.map((option: string, index: number) => {
                const optionKey = String.fromCharCode(65 + index); // A, B, C, D
                return (
                  <div key={optionKey} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <RadioGroupItem value={optionKey} id={`${questionId}-${optionKey}`} />
                    <Label 
                      htmlFor={`${questionId}-${optionKey}`} 
                      className="flex-1 cursor-pointer text-slate-900"
                    >
                      <span className="font-medium text-primary mr-2">{optionKey}.</span>
                      {option}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );

      case 'fill_blank':
        return (
          <div className="space-y-3">
            <div className="text-slate-900 leading-relaxed">
              {question.content.question && (
                <p dangerouslySetInnerHTML={{ 
                  __html: question.content.question.replace(
                    /___+/g, 
                    `<span class="inline-block border-b-2 border-slate-300 min-w-[120px] mx-1 px-2">
                      <input type="text" class="bg-transparent border-none outline-none w-full font-medium text-primary" 
                             placeholder="Your answer..." 
                             value="${currentAnswer || ''}"
                             onchange="this.dispatchEvent(new CustomEvent('answer-change', {detail: {questionId: '${questionId}', answer: this.value}}))" />
                    </span>`
                  )
                }} />
              )}
            </div>
            <Input
              type="text"
              placeholder="Type your answer here..."
              value={currentAnswer || ''}
              onChange={(e) => onAnswerChange(questionId, e.target.value)}
              className="mt-3"
            />
            <p className="text-sm text-slate-600">Note: Spelling must be correct</p>
          </div>
        );

      case 'short_answer':
        return (
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Enter your answer..."
              value={currentAnswer || ''}
              onChange={(e) => onAnswerChange(questionId, e.target.value)}
              className="w-full"
            />
            <p className="text-sm text-slate-600">
              Write NO MORE THAN THREE WORDS
            </p>
          </div>
        );

      case 'essay':
        return (
          <div className="space-y-3">
            <Textarea
              placeholder="Write your essay here..."
              value={currentAnswer || ''}
              onChange={(e) => onAnswerChange(questionId, e.target.value)}
              className="min-h-[300px] resize-none"
            />
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                Word count: {currentAnswer ? currentAnswer.trim().split(/\s+/).filter((w: string) => w.length > 0).length : 0}
              </span>
              <span className="text-slate-500">Minimum: 150 words</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-slate-600">Unsupported question type: {question.questionType}</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Progress Header */}
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Questions {questions[0]?.orderIndex || 1}-{questions[questions.length - 1]?.orderIndex || questions.length}
          </h3>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {answeredCount}/{questions.length} answered
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Progress</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Question Navigation */}
      {questions.length > 1 && (
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center space-x-2 overflow-x-auto">
            <span className="text-sm text-slate-600 whitespace-nowrap">Questions:</span>
            <div className="flex space-x-1">
              {questions.map((q, index) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
                const isCurrent = index === selectedQuestionIndex;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestionIndex(index)}
                    className={cn(
                      "w-8 h-8 rounded text-sm font-medium border-2 transition-colors",
                      isCurrent && "border-primary bg-primary text-white",
                      !isCurrent && isAnswered && "border-green-300 bg-green-50 text-green-700",
                      !isCurrent && !isAnswered && "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {q.orderIndex || index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Question Content */}
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {question.orderIndex || selectedQuestionIndex + 1}
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-slate-900 font-medium mb-3">
                    {question.content.question}
                  </p>
                  
                  {showPassageRef && (
                    <p className="text-sm text-slate-600 mb-4">
                      Refer to the passage on the left to answer this question.
                    </p>
                  )}
                </div>
                
                {renderQuestion(question)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-slate-200 p-6">
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600">
              Question {selectedQuestionIndex + 1} of {questions.length}
            </span>
            
            <Button
              onClick={onNext}
              disabled={!canGoNext}
              className="flex items-center"
            >
              {canGoNext ? 'Next' : 'Complete Section'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
