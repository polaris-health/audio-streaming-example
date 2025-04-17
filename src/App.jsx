import './App.css'
import { AudioContextProvider } from './contexts/AudioContext'
import { AudioStreamerContextProvider } from './contexts/AudioStreamerContext'
import useAudio from './hooks/useAudio'
import TranscriptionButton from './transcription/TranscriptionButton'

function App() {

  return (
    <AudioContextProvider>
      <AudioStreamerContextProvider>
        <TranscriptionButton />
      </AudioStreamerContextProvider>
    </AudioContextProvider>
  )
}

export default App
