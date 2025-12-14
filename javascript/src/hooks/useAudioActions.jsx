import { useContext } from 'react';

// auth provider
import { AudioActionsContext } from '../contexts/AudioContext';

// ==============================|| AUDIO ACTIONS HOOK ||============================== //

const useAudioActions = () => {
  const context = useContext(AudioActionsContext);

  if (!context) throw new Error('context must be used inside provider');

  return context;
};

export default useAudioActions;
