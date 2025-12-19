import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { PlayCircle, Target, BookOpen, Award, Lock, CheckCircle, XCircle, ChevronRight, AlertCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';

// Training course password (in production, this would be managed securely)
const TRAINING_PASSWORD = 'QC2024';

interface Module {
  id: number;
  title: string;
  description: string;
  duration: string;
  videoUrl?: string;
  content: string[];
  quiz?: QuizQuestion[];
  completed: boolean;
  unlocked: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const initialModules: Module[] = [
  {
    id: 1,
    title: 'Introduction to QC at E8 Productions',
    description: 'Learn the fundamentals of quality control and your role in the production workflow',
    duration: '12 min',
    completed: false,
    unlocked: true,
    content: [
      'Welcome to E8 Productions Quality Control Team',
      'Understanding the FIFO (First In, First Out) workflow system',
      'Your responsibilities as a QC Reviewer',
      'How QC fits into the overall production pipeline',
      'Communication protocols and feedback best practices'
    ],
    quiz: [
      {
        id: 1,
        question: 'What does FIFO stand for in the QC workflow?',
        options: ['First In, First Out', 'Fast In, Fast Out', 'File In, File Out', 'Final Input, Final Output'],
        correctAnswer: 0,
        explanation: 'FIFO means First In, First Out - tasks are reviewed in the order they were submitted to ensure fairness.'
      },
      {
        id: 2,
        question: 'After QC approval, where can tasks be routed to?',
        options: ['Only to Client', 'Only to Scheduler', 'Editor, Client, or Scheduler', 'Only back to Editor'],
        correctAnswer: 2,
        explanation: 'Approved tasks can be routed to Client Review, Scheduler, or back to Editor for revisions depending on the workflow.'
      }
    ]
  },
  {
    id: 2,
    title: 'Video Quality Standards',
    description: 'Master the technical and creative aspects of video review',
    duration: '18 min',
    completed: false,
    unlocked: false,
    content: [
      'Technical specifications: Resolution, frame rate, bitrate',
      'Audio quality assessment: Levels, mixing, clarity',
      'Color grading and brand compliance',
      'Identifying common video issues',
      'When to approve vs. request revisions'
    ],
    quiz: [
      {
        id: 1,
        question: 'What is the minimum resolution standard for video content?',
        options: ['720p', '1080p', '1440p', '4K'],
        correctAnswer: 1,
        explanation: '1920x1080 (1080p) is the minimum resolution standard for video deliverables.'
      },
      {
        id: 2,
        question: 'What is the target audio level range for voice-over?',
        options: ['-12dB to -6dB', '-6dB to -3dB', '-3dB to 0dB', '-18dB to -12dB'],
        correctAnswer: 1,
        explanation: 'Voice-over should peak between -6dB and -3dB for optimal clarity without distortion.'
      }
    ]
  },
  {
    id: 3,
    title: 'Design Asset Review',
    description: 'Learn to evaluate graphics, layouts, and brand compliance',
    duration: '15 min',
    completed: false,
    unlocked: false,
    content: [
      'E8 Productions design system and 8px grid',
      'Brand color palette and typography standards',
      'Design file formats and specifications',
      'Common design issues and how to identify them',
      'Providing actionable design feedback'
    ],
    quiz: [
      {
        id: 1,
        question: 'What is the base grid system used at E8 Productions?',
        options: ['4px grid', '8px grid', '10px grid', '12px grid'],
        correctAnswer: 1,
        explanation: 'E8 Productions uses an 8px base grid system for all designs to ensure consistency and alignment.'
      },
      {
        id: 2,
        question: 'What is the minimum resolution for print graphics?',
        options: ['72 dpi', '150 dpi', '300 dpi', '600 dpi'],
        correctAnswer: 2,
        explanation: '300 dpi is the minimum resolution for print graphics to ensure quality reproduction.'
      }
    ]
  },
  {
    id: 4,
    title: 'Effective Feedback & Communication',
    description: 'Master the art of providing clear, actionable feedback',
    duration: '10 min',
    completed: false,
    unlocked: false,
    content: [
      'How to write specific, actionable feedback',
      'Using timestamps for video feedback',
      'Tone and professionalism in revision requests',
      'Distinguishing between critical and minor issues',
      'Feedback templates and best practices'
    ],
    quiz: [
      {
        id: 1,
        question: 'What makes feedback actionable?',
        options: [
          'Using general terms like "fix this"',
          'Being specific about what needs to change and why',
          'Only mentioning what\'s wrong',
          'Focusing on personal preferences'
        ],
        correctAnswer: 1,
        explanation: 'Actionable feedback is specific, explains what needs to change, provides context, and ideally offers guidance on how to fix it.'
      }
    ]
  },
  {
    id: 5,
    title: 'QC Tools & Workflow Systems',
    description: 'Navigate the E8 Productions QC portal and tools effectively',
    duration: '14 min',
    completed: false,
    unlocked: false,
    content: [
      'Using the QC Review Queue interface',
      'File upload and Google Drive integration',
      'Video review player with timestamped notes',
      'Approval workflows and routing logic',
      'Tracking metrics and performance'
    ],
    quiz: [
      {
        id: 1,
        question: 'How are tasks ordered in the QC Review Queue?',
        options: [
          'By priority level only',
          'By submission time (oldest first)',
          'Randomly assigned',
          'By project size'
        ],
        correctAnswer: 1,
        explanation: 'The QC Review Queue uses FIFO ordering - tasks are sorted by submission time with the oldest tasks appearing first.'
      }
    ]
  }
];

const finalQuiz: QuizQuestion[] = [
  {
    id: 1,
    question: 'What is your primary responsibility as a QC Reviewer?',
    options: [
      'To create new content',
      'To ensure all deliverables meet quality standards before client delivery',
      'To manage project timelines',
      'To handle client communications'
    ],
    correctAnswer: 1,
    explanation: 'QC Reviewers ensure all content meets E8 Productions quality standards before moving forward in the workflow.'
  },
  {
    id: 2,
    question: 'When should you REJECT a submission?',
    options: [
      'When it has any imperfection',
      'When it doesn\'t match your personal taste',
      'When it has critical issues that violate brand standards or technical requirements',
      'Never - always approve to keep workflow moving'
    ],
    correctAnswer: 2,
    explanation: 'Reject submissions only when there are critical issues that violate brand standards, technical requirements, or deliverable specifications.'
  },
  {
    id: 3,
    question: 'What must you provide when rejecting a submission?',
    options: [
      'Nothing - just click reject',
      'Clear, specific, actionable feedback',
      'Your personal opinions',
      'A complete redesign'
    ],
    correctAnswer: 1,
    explanation: 'When rejecting, always provide clear, specific, and actionable feedback so the editor knows exactly what to fix.'
  },
  {
    id: 4,
    question: 'What happens to an approved task with "Client Review Required"?',
    options: [
      'It goes directly to the Scheduler',
      'It returns to the Editor',
      'It is automatically sent to the Client for approval',
      'It is archived'
    ],
    correctAnswer: 2,
    explanation: 'Tasks marked for client review are automatically routed to the client after QC approval.'
  },
  {
    id: 5,
    question: 'What is the minimum video resolution standard?',
    options: ['720p', '1080p', '1440p', '4K'],
    correctAnswer: 1,
    explanation: '1920x1080 (1080p) is the minimum resolution standard for all video deliverables.'
  }
];

export function QCTrainingPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  const [showModuleQuiz, setShowModuleQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showFinalQuiz, setShowFinalQuiz] = useState(false);
  const [finalQuizAnswers, setFinalQuizAnswers] = useState<{ [key: number]: number }>({});
  const [finalQuizSubmitted, setFinalQuizSubmitted] = useState(false);
  const [certified, setCertified] = useState(false);

  const handlePasswordSubmit = () => {
    if (passwordInput === TRAINING_PASSWORD) {
      setIsUnlocked(true);
      toast('✅ Access Granted', { description: 'Welcome to QC Training!' });
    } else {
      toast('❌ Incorrect Password', { description: 'Please check with your manager for the training password.' });
    }
  };

  const handleModuleComplete = (moduleId: number) => {
    setModules(prev => prev.map(m => {
      if (m.id === moduleId) {
        return { ...m, completed: true };
      }
      // Unlock next module
      if (m.id === moduleId + 1) {
        return { ...m, unlocked: true };
      }
      return m;
    }));
    setCurrentModuleId(null);
    setShowModuleQuiz(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    toast('✅ Module Completed', { description: 'Great job! Next module unlocked.' });
  };

  const handleStartModule = (moduleId: number) => {
    setCurrentModuleId(moduleId);
  };

  const handleFinishModuleContent = () => {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (currentModule?.quiz && currentModule.quiz.length > 0) {
      setShowModuleQuiz(true);
    } else {
      handleModuleComplete(currentModuleId!);
    }
  };

  const handleSubmitModuleQuiz = () => {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (!currentModule?.quiz) return;

    const allAnswered = currentModule.quiz.every(q => quizAnswers[q.id] !== undefined);
    if (!allAnswered) {
      toast('⚠️ Incomplete Quiz', { description: 'Please answer all questions.' });
      return;
    }

    setQuizSubmitted(true);
    const correctCount = currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length;
    const passed = correctCount >= currentModule.quiz.length * 0.7; // 70% passing

    if (passed) {
      setTimeout(() => handleModuleComplete(currentModuleId!), 2000);
    }
  };

  const handleStartFinalQuiz = () => {
    setShowFinalQuiz(true);
  };

  const handleSubmitFinalQuiz = () => {
    const allAnswered = finalQuiz.every(q => finalQuizAnswers[q.id] !== undefined);
    if (!allAnswered) {
      toast('⚠️ Incomplete Quiz', { description: 'Please answer all questions.' });
      return;
    }

    setFinalQuizSubmitted(true);
    const correctCount = finalQuiz.filter(q => finalQuizAnswers[q.id] === q.correctAnswer).length;
    const passed = correctCount >= finalQuiz.length * 0.8; // 80% passing for certification

    if (passed) {
      setCertified(true);
      toast('🎉 Congratulations!', { description: 'You are now a Certified QC Reviewer!' });
    } else {
      toast('📚 Keep Learning', { description: 'Review the training materials and try again.' });
    }
  };

  const completedCount = modules.filter(m => m.completed).length;
  const allModulesCompleted = completedCount === modules.length;
  const progressPercentage = (completedCount / modules.length) * 100;

  // Password Gate
  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Training & Certification</h1>
          <p className="text-muted-foreground mt-2">
            Complete the comprehensive QC training course to become certified
          </p>
        </div>

        <Card className="max-w-md mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle>Training Access Required</CardTitle>
            <CardDescription>
              Enter the training password provided by your manager to begin the QC certification course
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Training Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            <Button onClick={handlePasswordSubmit} className="w-full">
              <Lock className="h-4 w-4 mr-2" />
              Unlock Training
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Contact your manager if you don't have the password
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Module View
  if (currentModuleId !== null) {
    const currentModule = modules.find(m => m.id === currentModuleId);
    if (!currentModule) return null;

    if (showModuleQuiz && currentModule.quiz) {
      return (
        <div className="space-y-6">
          <div>
            <Button variant="ghost" onClick={() => { setShowModuleQuiz(false); setQuizSubmitted(false); setQuizAnswers({}); }}>
              ← Back to Module
            </Button>
            <h1 className="mt-4">Module {currentModule.id} Quiz</h1>
            <p className="text-muted-foreground mt-2">
              Answer all questions correctly to complete this module (70% required to pass)
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {currentModule.quiz.map((question, idx) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-3">{question.question}</h4>
                      <RadioGroup
                        value={quizAnswers[question.id]?.toString()}
                        onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [question.id]: parseInt(value) }))}
                        disabled={quizSubmitted}
                      >
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <RadioGroupItem value={optIdx.toString()} id={`q${question.id}-opt${optIdx}`} />
                            <Label
                              htmlFor={`q${question.id}-opt${optIdx}`}
                              className={`flex-1 cursor-pointer ${
                                quizSubmitted
                                  ? optIdx === question.correctAnswer
                                    ? 'text-green-600 font-medium'
                                    : quizAnswers[question.id] === optIdx
                                    ? 'text-red-600'
                                    : ''
                                  : ''
                              }`}
                            >
                              {option}
                              {quizSubmitted && optIdx === question.correctAnswer && (
                                <CheckCircle className="inline h-4 w-4 ml-2 text-green-600" />
                              )}
                              {quizSubmitted && quizAnswers[question.id] === optIdx && optIdx !== question.correctAnswer && (
                                <XCircle className="inline h-4 w-4 ml-2 text-red-600" />
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {quizSubmitted && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-900">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < currentModule.quiz.length - 1 && <Separator />}
                </div>
              ))}

              {!quizSubmitted && (
                <Button onClick={handleSubmitModuleQuiz} className="w-full" size="lg">
                  Submit Quiz
                </Button>
              )}

              {quizSubmitted && (
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                    currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length >= currentModule.quiz.length * 0.7
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length >= currentModule.quiz.length * 0.7 ? (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Passed! ({currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length}/{currentModule.quiz.length} correct)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5" />
                        <span>Not Passed ({currentModule.quiz.filter(q => quizAnswers[q.id] === q.correctAnswer).length}/{currentModule.quiz.length} correct) - Review and try again</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setCurrentModuleId(null)}>
            ← Back to Course Overview
          </Button>
          <h1 className="mt-4">Module {currentModule.id}: {currentModule.title}</h1>
          <p className="text-muted-foreground mt-2">{currentModule.description}</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-200 rounded-lg flex items-center justify-center">
              <PlayCircle className="h-16 w-16 text-blue-600" />
            </div>

            <div>
              <h3 className="font-medium mb-3">Learning Objectives</h3>
              <ul className="space-y-2">
                {currentModule.content.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Duration: {currentModule.duration}
              </div>
              <Button onClick={handleFinishModuleContent} size="lg">
                {currentModule.quiz && currentModule.quiz.length > 0 ? 'Take Quiz' : 'Complete Module'}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Final Quiz View
  if (showFinalQuiz) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => { setShowFinalQuiz(false); setFinalQuizSubmitted(false); setFinalQuizAnswers({}); }}>
            ← Back to Course
          </Button>
          <h1 className="mt-4">Final Certification Exam</h1>
          <p className="text-muted-foreground mt-2">
            Answer all questions correctly to earn your QC Reviewer Certification (80% required to pass)
          </p>
        </div>

        {certified ? (
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300">
            <CardContent className="p-8 text-center">
              <Trophy className="h-20 w-20 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-2xl font-medium text-yellow-900 mb-2">Congratulations!</h2>
              <p className="text-yellow-800 mb-4">You are now a Certified QC Reviewer at E8 Productions</p>
              <Badge className="bg-yellow-600 text-white px-4 py-2 text-base">
                <Award className="h-4 w-4 mr-2 inline" />
                Certified QC Reviewer
              </Badge>
              <div className="mt-6">
                <Button onClick={() => setShowFinalQuiz(false)}>
                  Return to Training Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-6">
              {finalQuiz.map((question, idx) => (
                <div key={question.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-3">{question.question}</h4>
                      <RadioGroup
                        value={finalQuizAnswers[question.id]?.toString()}
                        onValueChange={(value) => setFinalQuizAnswers(prev => ({ ...prev, [question.id]: parseInt(value) }))}
                        disabled={finalQuizSubmitted}
                      >
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <RadioGroupItem value={optIdx.toString()} id={`final-q${question.id}-opt${optIdx}`} />
                            <Label
                              htmlFor={`final-q${question.id}-opt${optIdx}`}
                              className={`flex-1 cursor-pointer ${
                                finalQuizSubmitted
                                  ? optIdx === question.correctAnswer
                                    ? 'text-green-600 font-medium'
                                    : finalQuizAnswers[question.id] === optIdx
                                    ? 'text-red-600'
                                    : ''
                                  : ''
                              }`}
                            >
                              {option}
                              {finalQuizSubmitted && optIdx === question.correctAnswer && (
                                <CheckCircle className="inline h-4 w-4 ml-2 text-green-600" />
                              )}
                              {finalQuizSubmitted && finalQuizAnswers[question.id] === optIdx && optIdx !== question.correctAnswer && (
                                <XCircle className="inline h-4 w-4 ml-2 text-red-600" />
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {finalQuizSubmitted && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-900">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < finalQuiz.length - 1 && <Separator />}
                </div>
              ))}

              {!finalQuizSubmitted && (
                <Button onClick={handleSubmitFinalQuiz} className="w-full" size="lg">
                  Submit Final Exam
                </Button>
              )}

              {finalQuizSubmitted && !certified && (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <span>Score: {finalQuiz.filter(q => finalQuizAnswers[q.id] === q.correctAnswer).length}/{finalQuiz.length} - Review materials and retake</span>
                  </div>
                  <Button onClick={() => { setFinalQuizSubmitted(false); setFinalQuizAnswers({}); }}>
                    Retake Exam
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Course Overview
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Training & Certification</h1>
        <p className="text-muted-foreground mt-2">
          Complete all modules and pass the final exam to become a Certified QC Reviewer
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Course Progress</h3>
              <p className="text-sm text-muted-foreground">{completedCount} of {modules.length} modules completed</p>
            </div>
            {certified && (
              <Badge className="bg-yellow-600 text-white">
                <Award className="h-3 w-3 mr-1" />
                Certified
              </Badge>
            )}
          </div>
          <Progress value={progressPercentage} className="h-3 mb-2" />
          <p className="text-xs text-muted-foreground">{Math.round(progressPercentage)}% Complete</p>
        </CardContent>
      </Card>

      {/* Training Modules */}
      <Card>
        <CardHeader>
          <CardTitle>Training Modules</CardTitle>
          <CardDescription>Complete each module in order to unlock the next one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.map((module) => (
            <div
              key={module.id}
              className={`p-4 border rounded-lg ${
                module.completed
                  ? 'bg-green-50 border-green-200'
                  : module.unlocked
                  ? 'bg-white hover:bg-accent/50 cursor-pointer'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
              onClick={() => module.unlocked && !module.completed && handleStartModule(module.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  module.completed
                    ? 'bg-green-600 text-white'
                    : module.unlocked
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500'
                }`}>
                  {module.completed ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : module.unlocked ? (
                    <PlayCircle className="h-6 w-6" />
                  ) : (
                    <Lock className="h-6 w-6" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">Module {module.id}: {module.title}</h4>
                    {module.completed && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Completed
                      </Badge>
                    )}
                    {!module.unlocked && (
                      <Badge variant="secondary">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>⏱️ {module.duration}</span>
                    {module.quiz && <span>📝 {module.quiz.length} quiz questions</span>}
                  </div>
                </div>

                {module.unlocked && !module.completed && (
                  <Button onClick={() => handleStartModule(module.id)}>
                    Start Module
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Final Exam */}
      {allModulesCompleted && (
        <Card className={certified ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300' : 'border-2 border-primary'}>
          <CardHeader>
            <div className="flex items-center gap-3">
              {certified ? (
                <Trophy className="h-8 w-8 text-yellow-600" />
              ) : (
                <Target className="h-8 w-8 text-primary" />
              )}
              <div>
                <CardTitle>{certified ? 'Certification Complete!' : 'Final Certification Exam'}</CardTitle>
                <CardDescription>
                  {certified
                    ? 'You have successfully completed the Training & Certification'
                    : 'Complete the final exam to earn your QC Reviewer Certification (80% required to pass)'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {certified ? (
              <div className="text-center py-6">
                <Award className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
                <h3 className="font-medium text-yellow-900 mb-2">Certified QC Reviewer</h3>
                <p className="text-sm text-yellow-800 mb-4">E8 Productions Quality Control Team</p>
                <Badge className="bg-yellow-600 text-white px-4 py-2">
                  Certification Earned: {new Date().toLocaleDateString()}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1">📋 {finalQuiz.length} Questions</p>
                  <p className="text-sm text-muted-foreground">Passing Score: 80%</p>
                </div>
                <Button onClick={handleStartFinalQuiz} size="lg">
                  <Target className="h-4 w-4 mr-2" />
                  Take Final Exam
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Training Requirements</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Complete all {modules.length} training modules in sequence</li>
                <li>• Pass each module quiz with 70% or higher</li>
                <li>• Complete the final certification exam with 80% or higher</li>
                <li>• Once certified, you'll have full access to all training materials</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
