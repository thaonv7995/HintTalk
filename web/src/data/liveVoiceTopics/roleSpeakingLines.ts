/** Labels that read badly in “You speak as …” (self-referential or empty). */
export function liveVoiceUserSpeakingPartNeedsClarification(label: string): boolean {
  const u = label.trim();
  return u.length === 0 || u.toLowerCase() === 'you';
}

export function liveVoiceUserSpeakingLine(label: string): string {
  return liveVoiceUserSpeakingPartNeedsClarification(label)
    ? 'Your speaking part: use a concrete role name (Customer, Friend, Date, Patient, …) — type it in the box above. The word “You” alone is not a role.'
    : `You speak as ${label.trim()}.`;
}

export function liveVoiceAssistantSpeakingLine(label: string): string {
  const a = label.trim();
  return a.length === 0
    ? 'The assistant responds as one clear counter-role (set above or pick a preset).'
    : `The assistant speaks as ${a}.`;
}
