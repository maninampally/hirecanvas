'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getInterviewQuestions,
  saveInterviewAnswer,
  type InterviewQuestionWithProgress,
} from '@/actions/interviewPrep'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

  const categories = Array.from(new Set(questions.map((item) => item.category))).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Interview Prep</h1>
        <p className="text-slate-600 mt-1">Practice questions and track your answer progress</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Progress: <span className="font-semibold text-slate-900">{stats.completed}/{stats.total}</span>{' '}
                completed ({stats.percent}%)
              </p>
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

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search questions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">All difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
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
          <Card key={q.id}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">{q.category}</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">{q.difficulty}</span>
                  {q.progress?.is_completed && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Completed</span>
                  )}
                </div>
                <p className="font-medium">{q.question}</p>

                <textarea
                  value={draftAnswers[q.id] || ''}
                  onChange={(e) =>
                    setDraftAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  placeholder="Write your practice answer..."
                  className="w-full min-h-24 rounded-lg border border-slate-200 px-4 py-3 text-sm"
                />

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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
