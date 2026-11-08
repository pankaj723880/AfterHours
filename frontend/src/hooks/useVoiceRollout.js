import { useState, useEffect } from 'react';
import { voiceControlService } from '../services/voiceControlService';

/**
 * useVoiceRollout
 * 
 * Enforces Voice Control Rollout Permissions:
 * When voiceControlEnabled is ON, but enableVoiceControlForAllUsers is OFF:
 * - ONLY authorized administrators (user?.isAdmin || user?.role === 'admin') can access voice & avatar features.
 * - Regular users / non-admins are blocked.
 * 
 * Formula:
 * const canAccessVoice = voiceConfig.masterEnabled && (voiceConfig.publicRollout || user?.isAdmin);
 */
export function useVoiceRollout(user) {
  const [accessState, setAccessState] = useState(() => voiceControlService.getAccessState());

  useEffect(() => {
    const unsub = voiceControlService.subscribe((state) => {
      setAccessState(state);
    });
    return unsub;
  }, []);

  const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));
  const masterEnabled = Boolean(
    typeof accessState.voiceControlEnabled === 'boolean'
      ? accessState.voiceControlEnabled
      : accessState.enabled
  );
  const publicRollout = Boolean(
    typeof accessState.enableVoiceControlForAllUsers === 'boolean'
      ? accessState.enableVoiceControlForAllUsers
      : accessState.globalRollout
  );

  const canAccessVoice = masterEnabled && (publicRollout || isAdmin);

  return {
    canAccessVoice,
    isVoiceAllowed: canAccessVoice,
    masterEnabled,
    publicRollout,
    isAdmin,
    voiceConfig: {
      masterEnabled,
      publicRollout,
      voiceControlEnabled: masterEnabled,
      enableVoiceControlForAllUsers: publicRollout
    }
  };
}

export default useVoiceRollout;

