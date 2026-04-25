import { useState, useEffect, useCallback, useRef } from 'react'

interface ISpeechRecognitionResult {
  readonly isFinal: boolean
  [index: number]: { transcript: string }
}

interface ISpeechRecognitionEvent {
  readonly resultIndex: number
  readonly results: { [index: number]: ISpeechRecognitionResult; length: number }
}

interface ISpeechRecognitionErrorEvent {
  readonly error: string
}

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => ISpeechRecognition
  webkitSpeechRecognition?: new () => ISpeechRecognition
}

export interface UseSpeechToTextProps {
  onFinalTranscript?: (text: string) => void
  onInterimTranscript?: (text: string) => void
  onStateChange?: (isListening: boolean) => void
}

export function useSpeechToText({
  onFinalTranscript,
  onInterimTranscript,
  onStateChange
}: UseSpeechToTextProps = {}) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const onInterimTranscriptRef = useRef(onInterimTranscript)
  const onStateChangeRef = useRef(onStateChange)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
    onInterimTranscriptRef.current = onInterimTranscript
    onStateChangeRef.current = onStateChange
  }, [onFinalTranscript, onInterimTranscript, onStateChange])

  useEffect(() => {
    onStateChangeRef.current?.(isListening)
  }, [isListening])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as WindowWithSpeech
      const SpeechRecognitionAPI = win.SpeechRecognition ?? win.webkitSpeechRecognition
      if (!SpeechRecognitionAPI) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSupported(false)
        return
      }

      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let final = ''
        let interim = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript
          } else {
            interim += event.results[i][0].transcript
          }
        }

        if (final && onFinalTranscriptRef.current) {
          onFinalTranscriptRef.current(final)
        }
        if (onInterimTranscriptRef.current) {
          onInterimTranscriptRef.current(interim)
        }
      }

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setError(event.error)

        if (event.error === 'not-allowed') {
          setPermissionDenied(true)
        }

        // 'no-speech' is often thrown if silence is detected, we don't necessarily want to hard-stop the UI
        if (event.error !== 'no-speech') {
          setIsListening(false)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    setError(null)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.error('Failed to start speech recognition', err)
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  return {
    isListening,
    error,
    isSupported,
    permissionDenied,
    startListening,
    stopListening
  }
}
