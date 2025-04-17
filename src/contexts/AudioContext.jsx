import {
  createContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
  useMemo,
} from 'react';

// Register WAV encoder
import { register } from 'extendable-media-recorder';
import { connect } from 'extendable-media-recorder-wav-encoder';


try {
  await register(await connect());
} catch (e) {
  console.log(e);
}
// Initial state for the reducer
const initialState = {
  devices: [],
  mainDevice: null,
  volumeOk: true,
  currentVolume: 0,
  isRecording: false,
  micUnavailable: false,
};

// Reducer function to update the state
function userReducer(state, action) {
  return { ...state, ...action };
}

// Create separate contexts for state and actions
const AudioStateContext = createContext(null);
const AudioActionsContext = createContext(null);

export async function askForPermission(){
  if (navigator.permissions.query({name: 'microphone'}).state != "granted"){
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    stream.getTracks().forEach((track) => track.stop());
  }
}

export const AudioContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // References and constants
  const measuredVolumes = useRef([]);
  const volumeOkRef = useRef(true);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);
  const VOLUME_CHECK_INTERVAL = 100;
  const VOLUME_THRESHOLD = 0.01;
  const VOLUME_THRESHOLD_TIMEOUT_INITIAL = 1000; // Initial quick check for low volume.
  const VOLUME_THRESHOLD_TIMEOUT = 4000; // After the initial check, we should allow for some silence.
  const volumeThresholdTimeout = useRef(VOLUME_THRESHOLD_TIMEOUT_INITIAL);

  // Memoized function to fetch audio input devices
  const fetchDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter((device) => device.kind === 'audioinput');
      dispatch({ devices: audioInputDevices });

      const mainDeviceId = localStorage.getItem('mainDeviceId');
      let mainDevice = null;

      if (mainDeviceId) {
        mainDevice = audioInputDevices.find((device) => device.deviceId === mainDeviceId);
      }

      if (mainDevice) {
        dispatch({ mainDevice });
      } else if (audioInputDevices.length > 0) {
        dispatch({ mainDevice: audioInputDevices[0] });
      }
    } catch (err) {
      console.error('Error fetching devices: ', err);
    }
  }, [dispatch]);

  // Helper function to set the main device for later use.
  const setMainDevice = useCallback(
    (device) => {
      dispatch({ mainDevice: device });
      localStorage.setItem('mainDeviceId', device.deviceId);
    },
    [dispatch]
  );

  // Helper function to get user media safely.
  const getUserMediaSafely = useCallback(
    async (constraints) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        dispatch({ micUnavailable: false });
        return stream;
      } catch (e) {
        if (e.name === 'OverconstrainedError' || e.name === 'NotFoundError') {
          console.error('No audio input device found');
          dispatch({ micUnavailable: true });
        } else {
          throw e;
        }
      }
    },
    [dispatch]
  );

  // Helper function to request microphone access from the user.
  const getMicAccess = useCallback(async () => {
    (await getUserMediaSafely({ audio: true , video: false })).getTracks().forEach((track) => track.stop());
    fetchDevices();
  }, [getUserMediaSafely, fetchDevices]);

  // Helper function to get the audio stream and start volume monitoring.
  const getAudioStream = useCallback(async () => {
    const { mainDevice } = state;
    let stream = null;

    if (mainDevice) {
      stream = await getUserMediaSafely({
        audio: { deviceId: { exact: mainDevice.deviceId } },
        video: false,
      });
    } else {
      stream = await getUserMediaSafely({ audio: true, video: false });
      fetchDevices();
    }

    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    streamRef.current = stream;

    console.log('Using audio device: ', stream.getAudioTracks()[0].label);

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    function getPeakLevel() {
      analyser.getByteTimeDomainData(dataArray);
      const peakLevel = dataArray.reduce((max, current) => Math.max(max, Math.abs(current - 127)), 0) / 128;
      return peakLevel;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const level = getPeakLevel();
      dispatch({ currentVolume: level });
      measuredVolumes.current.push(level);

      if (level >= VOLUME_THRESHOLD && !volumeOkRef.current) {
        dispatch({ volumeOk: true });
        volumeThresholdTimeout.current = VOLUME_THRESHOLD_TIMEOUT;
        volumeOkRef.current = true;
      }

      if (
        measuredVolumes.current.length >=
        volumeThresholdTimeout.current / VOLUME_CHECK_INTERVAL
      ) {
        const maxVolume = measuredVolumes.current.reduce(
          (max, current) => Math.max(max, current),
          0
        );
        if (maxVolume < VOLUME_THRESHOLD) {
          dispatch({ volumeOk: false });
          volumeOkRef.current = false;
        }
        measuredVolumes.current = [];
      } else if (audioTrack.muted) {
        dispatch({ volumeOk: false });
        volumeOkRef.current = false;
      }
    }, VOLUME_CHECK_INTERVAL);

    dispatch({ isRecording: true });

    return stream;
  }, [state.mainDevice, getUserMediaSafely, fetchDevices, dispatch]);

  // Make sure we have access to the microphone when the component mounts.
  useEffect(() => {
    askForPermission();
    getMicAccess();
  }, [getMicAccess, askForPermission]);

  // Memoized function to close the audio stream and stop volume monitoring
  const closeAudioStream = useCallback(async () => {
    streamRef.current?.getTracks()?.forEach((track) => track?.stop());
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    dispatch({ volumeOk: true, currentVolume: 0 });
    measuredVolumes.current = [];
    volumeThresholdTimeout.current = VOLUME_THRESHOLD_TIMEOUT_INITIAL;
    volumeOkRef.current = true;
    dispatch({ isRecording: false });
  }, [dispatch]);

  // Effect to fetch devices and set up device change listener on mount
  useEffect(() => {
    fetchDevices();

    navigator.mediaDevices.ondevicechange = fetchDevices;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchDevices]);

  // Memoized actions object to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      setMainDevice,
      getMicAccess,
      getAudioStream,
      closeAudioStream,
    }),
    [setMainDevice, getMicAccess, getAudioStream, closeAudioStream]
  );

  return (
    <AudioStateContext.Provider value={state}>
      <AudioActionsContext.Provider value={actions}>
        {children}
      </AudioActionsContext.Provider>
    </AudioStateContext.Provider>
  );
};

// Export the contexts and provider
export { AudioStateContext, AudioActionsContext };
