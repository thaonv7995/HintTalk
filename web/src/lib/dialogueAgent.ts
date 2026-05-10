import { fetchChatCompletion, type ChatMsg } from './chatCompletion';
import type { ConversationTurn, MockScenario, StoredSettings } from '../types';

function buildSystemPrompt(scenario: MockScenario): string {
  return [
    'You are HintTalk roleplay AI.',
    `Scenario: ${scenario.title}`,
    `Your role: ${scenario.aiRole}`,
    `Learner role: ${scenario.userRole}`,
    `Goal: ${scenario.goal}`,
    scenario.prompt ? `Task prompt: ${scenario.prompt}` : '',
    'Rules:',
    '- Speak English only.',
    '- Sound human and conversational: vary length; often a couple of sentences; acknowledge specifics before moving on.',
    '- Do not make every turn a bare exam-style question — mix reactions, comments, and questions.',
    '- Stay in character.',
    '- Do not grade, score, or correct the learner.',
    '- Keep the scene coherent while letting the chat breathe.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function fetchNextAiLine(
  settings: StoredSettings,
  scenario: MockScenario,
  turns: ConversationTurn[],
): Promise<string> {
  const messages: ChatMsg[] = [{ role: 'system', content: buildSystemPrompt(scenario) }];

  for (const t of turns) {
    if (t.role === 'ai') messages.push({ role: 'assistant', content: t.text });
    else messages.push({ role: 'user', content: t.text });
  }

  messages.push({
    role: 'user',
    content: 'Reply with your next line(s) in character only — natural dialogue, no preamble.',
  });

  return fetchChatCompletion(settings, messages, 0.55);
}
