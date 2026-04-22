'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiMic, FiMicOff } from 'react-icons/fi'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import {
  generateInterviewFeedback,
  getInterviewQuestions,
  saveInterviewAnswer,
  type InterviewQuestionWithProgress,
} from '@/actions/interviewPrep'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'

export default function InterviewPrepPage() {
  const [questions, setQuestions] = useState<InterviewQuestionWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null)
  const [coachingForQuestionId, setCoachingForQuestionId] = useState<string | null>(null)
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<
    Record<
      string,
      {
        score: number
        summary: string
        strengths: string[]
        improvements: string[]
        followUpQuestions: string[]
        provider: string
      }
    >
  >({})

  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null)
  const [interimText, setInterimText] = useState('')

  const handleFinalTranscript = useCallback((text: string) => {
    if (!recordingQuestionId) return
    setDraftAnswers((prev) => {
      const current = prev[recordingQuestionId] || ''
      const newText = current + (current.endsWith(' ') || current === '' ? '' : ' ') + text
      return {
        ...prev,
        [recordingQuestionId]: newText,
      }
    })
  }, [recordingQuestionId])

  const handleInterimTranscript = useCallback((text: string) => {
    setInterimText(text)
  }, [])

  const {
    isListening,
    isSupported,
    permissionDenied,
    startListening,
    stopListening,
  } = useSpeechToText({
    onFinalTranscript: handleFinalTranscript,
    onInterimTranscript: handleInterimTranscript,
  })

  const toggleRecording = (qId: string) => {
    if (isListening && recordingQuestionId === qId) {
      stopListening()
      setRecordingQuestionId(null)
      setInterimText('')
    } else {
      if (isListening) stopListening()
      setRecordingQuestionId(qId)
      setInterimText('')
      startListening()
    }
  }

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getInterviewQuestions()
        setQuestions(data)
        setDraftAnswers(
          data.reduce<Record<string, string>>((acc, question) => {
            acc[question.id] = question.progress?.user_answer || ''
            return acc
          }, {})
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interview questions')
      } finally {
        setLoading(false)
      }
    }

    void loadQuestions()
  }, [])

  const filtered = useMemo(() => {
    return questions.filter((question) => {
      const matchesSearch =
        !search.trim() ||
        question.question.toLowerCase().includes(search.toLowerCase()) ||
        question.category.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !category || question.category === category
      const matchesDifficulty = !difficulty || question.difficulty === difficulty
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [questions, search, category, difficulty])

  const stats = useMemo(() => {
    const completed = questions.filter((item) => item.progress?.is_completed).length
    const total = questions.length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    return { completed, total, percent }
  }, [questions])

  async function handleSave(questionId: string, isCompleted: boolean) {
    setSavingQuestionId(questionId)
    try {
      const answer = draftAnswers[questionId] || ''
      const updated = await saveInterviewAnswer(questionId, {
        userAnswer: answer,
        isCompleted,
      })

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === questionId
            ? {
                ...question,
                progress: {
                  user_answer: updated.user_answer,
                  is_completed: updated.is_completed,
                  updated_at: updated.updated_at,
                },
              }
            : question
        )
      )

      toast.success(isCompleted ? 'Answer saved and marked complete' : 'Answer saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save answer')
    } finally {
      setSavingQuestionId(null)
    }
  }

  async function handleGenerateFeedback(questionId: string) {
    const answer = (draftAnswers[questionId] || '').trim()
    if (!answer) {
      toast.error('Write an answer before requesting AI feedback')
      return
    }

    setCoachingForQuestionId(questionId)
    try {
      const feedback = await generateInterviewFeedback({
        questionId,
        userAnswer: answer,
      })

      setFeedbackByQuestion((prev) => ({
        ...prev,
        [questionId]: {
          score: feedback.score,
          summary: feedback.summary,
          strengths: feedback.strengths,
          improvements: feedback.improvements,
          followUpQuestions: feedback.followUpQuestions,
          provider: feedback.provider,
        },
      }))

      toast.success('AI feedback generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate feedback')
    } finally {
      setCoachingForQuestionId(null)
    }
  }

  const categories = Array.from(new Set(questions.map((item) => item.category))).sort()

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Interview Prep"
        description="Practice questions and get AI coaching feedback"
      />

      <Card className="animate-slide-up">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Progress: <span className="font-semibold text-slate-900">{stats.completed}/{stats.total}</span>{' '}
                completed ({stats.percent}%)
              </p>
              <Badge variant={stats.percent >= 75 ? 'emerald' : stats.percent >= 50 ? 'amber' : 'blue'}>
                Completion {stats.percent}%
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-teal-500 transition-all"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Input
          placeholder="Search questions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !category
                  ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/25'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200/80'
              }`}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  category === item
                    ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/25'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200/80'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <Select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-44"
          >
            <option value="">All difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6 text-slate-600">Loading interview questions...</CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {!loading && filtered.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-slate-600">No questions match your filters.</CardContent>
          </Card>
        )}

        {filtered.map((q) => (
          <Card key={q.id} className="animate-slide-up">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="teal">{q.category}</Badge>
                  <Badge variant="amber">{q.difficulty}</Badge>
                  {q.progress?.is_completed && (
                    <Badge variant="emerald">Completed</Badge>
                  )}
                </div>
                <p className="font-medium text-slate-900">{q.question}</p>

                <div className="relative">
                  <textarea
                    value={(draftAnswers[q.id] || '') + (recordingQuestionId === q.id && interimText ? (draftAnswers[q.id] ? ' ' : '') + interimText : '')}
                    onChange={(e) =>
                      setDraftAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    placeholder="Write your practice answer or use the microphone to speak..."
                    className={`w-full min-h-24 rounded-lg border px-4 py-3 text-sm transition-colors ${recordingQuestionId === q.id ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200'}`}
                  />
                  {recordingQuestionId === q.id && (
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                      </span>
                      <span className="text-xs font-medium text-rose-500 animate-pulse">Listening...</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSave(q.id, false)}
                      disabled={savingQuestionId === q.id}
                    >
                      {savingQuestionId === q.id ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleSave(q.id, true)}
                      disabled={savingQuestionId === q.id}
                    >
                      Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleGenerateFeedback(q.id)}
                      disabled={coachingForQuestionId === q.id}
                    >
                      {coachingForQuestionId === q.id ? 'Coaching...' : 'Get AI Feedback'}
                    </Button>
                  </div>

                  {isSupported && (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        variant={recordingQuestionId === q.id ? 'destructive' : 'outline'}
                        size="sm"
                        className="gap-2"
                        onClick={() => toggleRecording(q.id)}
                        disabled={permissionDenied}
                      >
                        {recordingQuestionId === q.id ? (
                          <>
                            <FiMicOff className="h-4 w-4" /> Stop Recording
                          </>
                        ) : (
                          <>
                            <FiMic className="h-4 w-4" /> Record Answer
                          </>
                        )}
                      </Button>
                      {permissionDenied && (
                        <span className="text-[10px] text-rose-500 font-medium">
                          Microphone blocked. Click the lock icon in your address bar to allow.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {feedbackByQuestion[q.id] && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={feedbackByQuestion[q.id].score >= 75 ? 'emerald' : feedbackByQuestion[q.id].score >= 55 ? 'amber' : 'rose'}>
                        Score: {feedbackByQuestion[q.id].score}/100
                      </Badge>
                      <span className="text-xs text-slate-500">via {feedbackByQuestion[q.id].provider}</span>
                    </div>

                    <p className="text-slate-700">{feedbackByQuestion[q.id].summary}</p>

                    {feedbackByQuestion[q.id].strengths.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800">Strengths</p>
                        <ul className="list-disc pl-5 text-slate-700">
                          {feedbackByQuestion[q.id].strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {feedbackByQuestion[q.id].improvements.length > 0 && (
                      <div>
                        <p className="font-medium text-slate-800">Improvements</p>
                        <ul className="list-disc pl-5 text-slate-700">
                          {feedbackByQuestion[q.id].improvements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
