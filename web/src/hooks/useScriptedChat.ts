import type { MockScenario, ConversationTurn, HintLevel } from '../types';
import { newId } from '../lib/ids';
import { useCallback, useMemo, useState } from 'react';

type Msg = ConversationTurn;

export function useScriptedChat(scenario: MockScenario | undefined, level: HintLevel) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);

  const reset = useCallback(() => {
    if (!scenario?.turns.length) return;
    const first = scenario.turns[0];
    setTurnIndex(0);
    setHintIndex(0);
    setMessages([
      {
        id: newId(),
        speaker: scenario.aiRole,
        role: 'ai',
        text: first.ai,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [scenario]);

  const currentTurn = useMemo(() => {
    if (!scenario?.turns.length) return null;
    return scenario.turns[turnIndex % scenario.turns.length];
  }, [scenario, turnIndex]);

  const currentHintText = useMemo(() => {
    if (!currentTurn) return '';
    const hints = currentTurn.hints[level];
    return hints[hintIndex % hints.length] ?? '';
  }, [currentTurn, level, hintIndex]);

  const sendUser = useCallback(
    (text: string, inputMode: 'typed' | 'speech', hintShown?: string) => {
      const clean = text.trim();
      if (!clean || !scenario?.turns.length || !currentTurn) return;

      const userTurn: Msg = {
        id: newId(),
        speaker: scenario.userRole,
        role: 'user',
        text: clean,
        inputMode,
        hintShown,
        createdAt: new Date().toISOString(),
      };

      const nextIndex = turnIndex + 1;
      const nextTurn = scenario.turns[nextIndex % scenario.turns.length];

      const aiTurn: Msg = {
        id: newId(),
        speaker: scenario.aiRole,
        role: 'ai',
        text: nextTurn.ai,
        createdAt: new Date().toISOString(),
      };

      setMessages((m) => [...m, userTurn, aiTurn]);
      setTurnIndex(nextIndex);
      setHintIndex(0);
      return { userTurn, aiTurn };
    },
    [scenario, currentTurn, turnIndex],
  );

  const cycleHint = useCallback(() => {
    setHintIndex((i) => i + 1);
  }, []);

  const applyBeginnerHintToComposer = useCallback(() => {
    if (!currentTurn) return '';
    const hints = currentTurn.hints.beginner;
    return hints[hintIndex % hints.length] ?? '';
  }, [currentTurn, hintIndex]);

  return {
    messages,
    turnIndex,
    hintIndex,
    currentTurn,
    currentHintText,
    reset,
    sendUser,
    cycleHint,
    setHintIndex,
    applyBeginnerHintToComposer,
    setMessages,
  };
}
