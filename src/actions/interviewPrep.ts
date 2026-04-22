'use server'

import { getInterviewCoaching } from '@/lib/ai/interviewCoach'
import { createClient } from '@/lib/supabase/server'

export type InterviewQuestion = {
  id: string
  category: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  question: string
  sample_answer: string | null
}

export type InterviewQuestionWithProgress = InterviewQuestion & {
  progress: {
    user_answer: string | null
    is_completed: boolean
    updated_at: string | null
  } | null
}

export async function getInterviewQuestions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: questions, error: questionsError } = await supabase
    .from('interview_questions')
    .select('id,category,difficulty,question,sample_answer')
    .order('category', { ascending: true })

  if (questionsError) throw questionsError

  const { data: progressRows, error: progressError } = await supabase
    .from('interview_progress')
    .select('question_id,user_answer,is_completed,updated_at')
    .eq('user_id', user.id)

  if (progressError) throw progressError

  const progressByQuestion = new Map(
    (progressRows || []).map((row) => [
      row.question_id,
      {
        user_answer: row.user_answer,
        is_completed: row.is_completed,
        updated_at: row.updated_at,
      },
    ])
  )

  return (questions || []).map((question) => ({
    ...question,
    progress: progressByQuestion.get(question.id) || null,
  })) as InterviewQuestionWithProgress[]
}

export async function saveInterviewAnswer(
  questionId: string,
  payload: { userAnswer: string; isCompleted: boolean }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('interview_progress')
    .upsert(
      {
        user_id: user.id,
        question_id: questionId,
        user_answer: payload.userAnswer.trim() || null,
        is_completed: payload.isCompleted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_id' }
    )
    .select('question_id,user_answer,is_completed,updated_at')
    .single()

  if (error) throw error
  return data
}

export async function generateInterviewFeedback(payload: {
  questionId: string
  userAnswer: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  if (!payload.userAnswer.trim()) throw new Error('Answer is required')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()

  if (!appUser || (appUser.tier !== 'elite' && appUser.tier !== 'admin')) {
    throw new Error('AI interview coach is available on Elite plan')
  }

  const { data: question, error } = await supabase
    .from('interview_questions')
    .select('question,sample_answer')
    .eq('id', payload.questionId)
    .single<{ question: string; sample_answer: string | null }>()

  if (error || !question) throw new Error('Interview question not found')

  const result = await getInterviewCoaching({
    question: question.question,
    userAnswer: payload.userAnswer,
    sampleAnswer: question.sample_answer,
  })

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'interview_prep',
    tokens_used: Math.max(80, Math.ceil(payload.userAnswer.length / 4)),
    cost_cents: 1,
    status: 'completed',
  })

  return result
}
