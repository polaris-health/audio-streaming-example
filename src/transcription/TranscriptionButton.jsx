import useAudioStreamer from '../hooks/useAudioStreamer';
import useAudio from '../hooks/useAudio';
import { useState } from 'react';
import { generateNote } from '../utils/generateNote';

function TranscriptionButton() {

  const { startStreaming, stopStreaming, recording, processing } = useAudioStreamer();
  const { volumeOk } = useAudio();
  const [transcripts, setTranscripts] = useState([]);
  const [facts, setFacts] = useState([]);
  const [note, setNote] = useState(null);

  async function onFact(value) {
    console.log("Fact: ", value);
    setFacts((prev) => [...prev, value]);
  }

  async function onTranscript(value) {
    console.log("Transcript: ", value);
    setTranscripts((prev) => [...prev, value]);
  }

  async function onGenerate() {
    console.log("Note generation requested");
  }


  async function onFinish() {
    // Handle logic after transcription is finished.
    console.log("Finished");
    setNote(await generateNote({
      transcription: transcripts,
      gender: "female",
      context: "",
      output_language: "nl",
      difficult_words: 
        [
            "Dafalgan",
            "Redomex"
        ],
      medication_list:
        [

        ],
      contact_id: "123456789",
      verbosity: "medium",
      care_elements: 
        [
            {
                "id": "adfsdf",
                "code": 
                    {
                        "icpc2": "L18",
                        "icd10": "M79.0"
                    }
            }
        ]
    }));
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

  /* ------------- Editor change handler ------------------------- */
  const handleTranscriptEdit = e => {
    const value = e.target.value;
    setTranscripts(JSON.parse(value));
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
      <div>
        <div className="mt-4">
          <label htmlFor="transcript-editor" className="block font-semibold mb-1">
            Edit transcript
          </label>
          <textarea
            id="transcript-editor"
            value={JSON.stringify(transcripts)}
            onChange={handleTranscriptEdit}
            rows={6}
            className="w-full p-2 border rounded"
            placeholder="Type or paste transcript text here…"
          />
        </div>
        <h4>Transcript</h4>
        {transcripts.map((transcript, index) => (
          <div key={index}>
            <p>{transcript.content}</p>
          </div>
        ))}
        <h4>Facts</h4>
        {facts.map((fact, index) => (
          <div key={index}>
            <p>{fact.content}</p>
          </div>
        ))}
        <h4>Note</h4>
        {note && (
          <div>
            <h5>Chief complaint</h5>
            {note.chief_complaint?.map((element, index) => (
              <div key={index}>
                <p>{element}</p>
              </div>
            ))}
            <h5>Subjective</h5>
            {note.subjective?.map((element, index) => (
              <div key={index}>
                <p>{element}</p>
              </div>
            ))}
            <h5>Objective</h5>
            {note.objective?.map((element, index) => (
              <div key={index}>
                <p>{element}</p>
              </div>
            ))}
            <h5>Actions</h5>
            {note.actions?.map((element, index) => (
              <div key={index}>
                <p>{element}</p>
              </div>
            ))}
            <h5>Plan</h5>
            {note.plan?.map((element, index) => (
              <div key={index}>
                <p>{element}</p>
              </div>
            ))}
            <h5>Evaluation</h5>
            <p>{JSON.stringify(note.evaluation)}</p>
            <h5>Care element</h5>
            <p>{JSON.stringify(note.care_element)}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default TranscriptionButton;
