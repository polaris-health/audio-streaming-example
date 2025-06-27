import { createContext, useReducer, useRef } from 'react';
import { getSocket } from '../utils/getSocket';
import useAudioActions from '../hooks/useAudioActions';

const initialState = {
    recording: false,
    processing: false,
    reconnecting: false,
    failed: false,
    timeout: false
};
  
function audioStreamerReducer(state, action) {
return {...state, ...action};
}


// ==============================|| AUDIO STREAMER CONTEXT ||============================== //

const AudioStreamerContext = createContext(null);

export const AudioStreamerContextProvider = ({ children }) => {
    const chunkSize = 96_000; // 96 kB / 1 second of audio.
    const maxTranscriptionTime = 90 * 60; // Seconds.
    const sampleRate = 16_000; // 16 kHz sample rate.
    const bytesPerSample = 2; // 16-bit audio.
    const socketReconnectTimeout = 15_000; // Milliseconds.
    const socketConnectionPollingInterval = 1_000; // Milliseconds.
    const closingTimeout = 30_000; // Milliseconds.
    const language = 'nl'; // Output language: nl, fr, de, en.
    const contactId = 'some id'; // Contact identifier. Used for metric aggregation on contact level.
    const difficultWords = []; // Difficult words.
    const context = []; // Context FHIR resources.

    // Must be a whole number.
    const bytesPerMillisecond = sampleRate * bytesPerSample / 1000;

    const [state, dispatch] = useReducer(audioStreamerReducer, initialState);

    const { getAudioStream, closeAudioStream } = useAudioActions();

    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioWorkletNodeRef = useRef(null);
    const socketRef = useRef(null);
    const outQueue = useRef([]);
    const waitQueue = useRef([]);
    const isClosing = useRef(false);
    const isAborting = useRef(false);
    const timeoutRef = useRef(null);
    const socketConnectTimeoutRef = useRef(null);
    const isProcessing = useRef(false);

    const streamingStart = useRef(null);
    const streamingStatus = useRef('success');

    async function restoreConnection({giveAlert = true} = {}) {
        console.log("Connection closed early. Trying to resend unprocessed audio...");
        streamingStatus.current = 'temporary_failure';
        dispatch({ reconnecting: true });

        socketRef.current.sendBuffer = [];

        // Put the unprocessed audio back in front of the send queue.
        outQueue.current = waitQueue.current.concat(outQueue.current);
        waitQueue.current = [];

        // Resend the unprocessed audio and close the connection.
        if (isClosing.current) {
            while (outQueue.current.length > 0) {
                const chunk = outQueue.current.splice(0,chunkSize);
                sendChunk(chunk);
            }
            socketRef.current.emit('close_signal', { });
        }

        // Wait until connection is restored.
        for (let i = 0; i < socketReconnectTimeout/socketConnectionPollingInterval; i++){
            if (socketRef.current.connected){
                console.log("Connection restored.");
                dispatch({ reconnecting: false });
                return;
            }
            await new Promise(r => setTimeout(r, socketConnectionPollingInterval));
        }

        streamingStatus.current = 'permanent_failure';
        if (giveAlert) {
            dispatch({ reconnecting: false, failed: true });
        } else {
            dispatch({ reconnecting: false });
        }

        // Abort.
        stopStreaming(true);
        clearTimeout(timeoutRef.current);

        console.log({status: streamingStatus.current}); // Log the status of the streaming session.
    }

    function onError(error) {
        console.log("Socket error: ", error);
        // Error handling logic belongs here.
    }

    function onConnectError(error) {
        console.log("Connection error: ", error.data);
        // Error handling logic belongs here.
    }

    async function onDisconnect(onFinish) {
        if (!isAborting.current) {
            if (isClosing.current) {
                if (waitQueue.current.length > 0 || outQueue.current.length > 0) {
                    await restoreConnection({giveAlert:false});
                }else{
                    await onFinish();
                    clearTimeout(timeoutRef.current);
                    isClosing.current = false;
                    dispatch({ processing: false });
                    isProcessing.current = false;
                }
            } else {
                await restoreConnection();
            }
        }else{
            isAborting.current = false;
        }
    }

    function onMillisecondsProcessed(content){
        const value = content?.milliseconds;
        // Remove the processed audio from the buffer.
        if (value) {
            const bytesProcessed = value*bytesPerMillisecond;
            if (bytesProcessed > waitQueue.current.length) {
                console.log("Processed more bytes than available in the buffer.", bytesProcessed, waitQueue.current.length);
            }
            waitQueue.current = waitQueue.current.slice(bytesProcessed);
        }
    }

    const startStreaming = async (onTranscript, onFact, onGenerate, onFinish) => {
        streamingStart.current = new Date();
        streamingStatus.current = 'success';

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (socketConnectTimeoutRef.current) {
            clearTimeout(socketConnectTimeoutRef.current);
        }
        audioContextRef.current = null;
        mediaStreamRef.current = null;
        audioWorkletNodeRef.current = null;
        socketRef.current = null;
        timeoutRef.current = null;
        socketConnectTimeoutRef.current = null;
        outQueue.current = [];
        waitQueue.current = [];
        isClosing.current = false;
        isAborting.current = false;
        isProcessing.current = false;
        dispatch({ recording: false, reconnecting: false, processing: false, failed: false, timeout: false });

        // Clear the audio buffer.
        outQueue.current = [];
        waitQueue.current = [];

        // Open a new socket connection.
        socketRef.current = getSocket();

        socketRef.current.emit('config', { 
            output_language: language,
            difficult_words: difficultWords,
            context: context,
            channel_count: 1,
            sample_rate: sampleRate,
            bits_per_sample: bytesPerSample*8,
            tags: [{key: "contact_id", value: contactId}],
        });

        // Attach callbacks to the socket.
        // Custom events.
        socketRef.current.on('error', onError); 
        socketRef.current.on('audio_processed', onMillisecondsProcessed);
        socketRef.current.on('transcript', onTranscript);
        socketRef.current.on('fact', onFact);
        socketRef.current.on('note_generation_requested', onGenerate);

        // Built-in Socket.io events.
        socketRef.current.on('connect_error', onConnectError);
        socketRef.current.on('disconnect', async () => onDisconnect(onFinish));
        socketRef.current.on('connect', () => {
            if(socketConnectTimeoutRef.current){
                clearTimeout(socketConnectTimeoutRef.current)
            }});

        // Connect to the socket.
        await socketRef.current.connect();
        socketConnectTimeoutRef.current = setTimeout(async () => {
            if (!socketRef.current.connected) {
                dispatch({ failed: true });
                await stopStreaming(true);
            }
        }, socketReconnectTimeout);

        // Get the audio track.
        const stream = await getAudioStream();

        // Create an audio context.
        audioContextRef.current = new AudioContext({
            sampleRate: sampleRate,
          });

        // Load the audio worklet
        await audioContextRef.current.audioWorklet.addModule("src/utils/mono-processor.jsx");

        // Create a media stream source from the stream
        mediaStreamRef.current = audioContextRef.current.createMediaStreamSource(stream);

        // Create the AudioWorkletNode
        audioWorkletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'mono-processor');

        // Handle the processed audio data sent from the AudioWorkletProcessor
        audioWorkletNodeRef.current.port.onmessage = async (event) => {
            const duration = new Date() - streamingStart.current;
            if (duration > maxTranscriptionTime * 1000) {
                streamingStatus.current = 'timeout';
                dispatch({ timeout: true });
                await stopStreaming();
                return;
            }
            if (!isProcessing.current) {
                const int16Data = event.data;
                const byteArray = new Uint8Array(int16Data.buffer);
                outQueue.current = outQueue.current.concat(Array.from(byteArray));
                while (socketRef.current.connected && outQueue.current.length > chunkSize) {
                    const chunk = outQueue.current.splice(0,chunkSize);
                    sendChunk(chunk);
                }
            }
        };

        // Connect the nodes
        mediaStreamRef.current.connect(audioWorkletNodeRef.current);
        audioWorkletNodeRef.current.connect(audioContextRef.current.destination);

        dispatch({ recording: true });

    }

    const sendChunk = (chunk) => {
        const roundedChunkLength = Math.floor(chunk.length / bytesPerMillisecond) * bytesPerMillisecond;
        const byteArray = new Uint8Array(chunk.slice(0, roundedChunkLength));
        const base64 = btoa(
            byteArray
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
        socketRef.current.emit('audio', {payload: base64});
        waitQueue.current = waitQueue.current.concat(Array.from(byteArray));
    }

    const stopStreaming = async (abort = false) => {
        // Stop streaming audio.
        await closeAudioStream();
        audioWorkletNodeRef.current?.disconnect();
        mediaStreamRef.current?.disconnect();
        try{
            await audioContextRef.current?.close();
        }catch(e){
            console.log(e);
        }

        audioWorkletNodeRef.current = null;
        mediaStreamRef.current = null;  
        audioContextRef.current = null;

        dispatch({ recording: false });

        if (abort) {
            // Close the socket connection.
            isAborting.current = true;
            socketRef.current?.disconnect();
            socketRef.current?.close();
            dispatch({ processing: false });
            isProcessing.current = false;
        }else{
            dispatch({ processing: true });
            isProcessing.current = true;

            // Send the remaining audio to the socket.
            // If the connection has been lost, we're okay with these packets being lost.
            while (outQueue.current.length > 0) {
                const chunk = outQueue.current.splice(0,chunkSize);
                sendChunk(chunk);
            }
            // Wait for the socket to finish processing the audio.
            socketRef.current?.emit('close_signal', { });
            isClosing.current = true;
            // Set a timeout to close the socket connection.
            timeoutRef.current = setTimeout(async () => {
                console.log("Done waiting for graceful close");
                await stopStreaming(true);
                isClosing.current = false;
            }, closingTimeout);
        }
    }


  return (
    <AudioStreamerContext.Provider
      value={{ ...state, startStreaming: startStreaming, stopStreaming: stopStreaming }}
    >
      {children}
    </AudioStreamerContext.Provider>
  );
};

export default AudioStreamerContext;
