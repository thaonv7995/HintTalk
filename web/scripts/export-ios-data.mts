/**
 * Exports live-voice topic catalog + shadowing lessons as JSON for the iOS app bundle.
 * Run: npx tsx web/scripts/export-ios-data.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LIVE_VOICE_TOPIC_CATEGORIES } from '../src/data/liveVoiceTopics/categories';
import { SHADOWING_LESSONS } from '../src/data/shadowingLessons';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../ios/HintTalk/Resources');
mkdirSync(outDir, { recursive: true });

const catalog = {
  version: 1,
  categories: LIVE_VOICE_TOPIC_CATEGORIES.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    registerDefault: c.registerDefault ?? 'neutral',
    learnerGuide: c.learnerGuide,
    aiGuide: c.aiGuide,
    topics: c.topics.map((t) => ({
      id: t.id,
      label: t.label,
      subtitle: t.subtitle ?? '',
      situation: t.situation,
      defaultUserRole: t.defaultUserRole ?? '',
      defaultAiRole: t.defaultAiRole ?? '',
      register: t.register ?? '',
      learnerExtras: t.learnerExtras ?? [],
      aiExtras: t.aiExtras ?? [],
    })),
  })),
};

writeFileSync(resolve(outDir, 'topics.json'), JSON.stringify(catalog, null, 2));
writeFileSync(resolve(outDir, 'shadowingLessons.json'), JSON.stringify({ version: 1, lessons: SHADOWING_LESSONS }, null, 2));

console.log(
  `Exported ${catalog.categories.length} categories / ${catalog.categories.reduce((n, c) => n + c.topics.length, 0)} topics, ${SHADOWING_LESSONS.length} shadowing lessons -> ${outDir}`,
);
