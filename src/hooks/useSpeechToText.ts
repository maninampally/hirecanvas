import { useState, useEffect, useCallback, useRef } from 'react'

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
  
  const recognitionRef = useRef<any>(null)

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
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        setIsSupported(false)
        return
      }
      
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
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

      recognition.onerror = (event: any) => {
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
