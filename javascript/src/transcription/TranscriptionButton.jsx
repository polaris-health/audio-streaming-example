import useAudioStreamer from '../hooks/useAudioStreamer';
import useAudio from '../hooks/useAudio';

function TranscriptionButton() {

  const { startStreaming, stopStreaming, recording, processing } = useAudioStreamer();
  const { volumeOk } = useAudio();

  async function onFact(value) {
    console.log("Fact: ", value);
  }

  async function onTranscript(value) {
    console.log("Transcript: ", value);
  }

  async function onGenerate() {
    console.log("Note generation requested");
  }


  async function onFinish() {
    // Handle logic after transcription is finished.
    console.log("Finished");
  }

  const startRecording = async () => {
    try {
      await startStreaming(onTranscript, onFact, onGenerate, onFinish);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const stopRecording = async (abort) => {
    await stopStreaming(abort);
  };

  const handleClick = async (e) => {
    if (recording) {
      await stopRecording(false);
    } else if (!processing) {
      await startRecording();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
      >
        {processing ? (
            "Finishing..."
            ) : recording ? (
                volumeOk ? (
                  "Stop Recording"
                ) : (
                  "Volume not OK"
                )
            ) : 
            "Start Recording"
        }
      </button>
    </>
  );
}

export default TranscriptionButton;
