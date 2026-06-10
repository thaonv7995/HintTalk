export type TtsVoiceModel = {
  id: string;
  label: string;
  accent: string;
  gender: 'F' | 'M';
  bestFor: string;
};

export const TTS_VOICE_MODELS: TtsVoiceModel[] = [
  { id: 'edge-tts/en-AU-WilliamNeural', label: 'William (English Australia)', accent: 'Australian', gender: 'M', bestFor: 'announcements, travel, calm narration' },
  { id: 'edge-tts/en-AU-NatashaNeural', label: 'Natasha (English Australia)', accent: 'Australian', gender: 'F', bestFor: 'weather, service, friendly updates' },
  { id: 'edge-tts/en-CA-ClaraNeural', label: 'Clara (English Canada)', accent: 'Canadian', gender: 'F', bestFor: 'public service, weather, clear briefings' },
  { id: 'edge-tts/en-CA-LiamNeural', label: 'Liam (English Canada)', accent: 'Canadian', gender: 'M', bestFor: 'radio news, announcements, practical updates' },
  { id: 'edge-tts/en-HK-YanNeural', label: 'Yan (English Hong Kong)', accent: 'Hong Kong', gender: 'F', bestFor: 'travel, transit, service messages' },
  { id: 'edge-tts/en-HK-SamNeural', label: 'Sam (English Hong Kong)', accent: 'Hong Kong', gender: 'M', bestFor: 'airport, city announcements, concise updates' },
  { id: 'edge-tts/en-IN-NeerjaNeural', label: 'Neerja (English India)', accent: 'Indian', gender: 'F', bestFor: 'customer service, workplace, instruction' },
  { id: 'edge-tts/en-IN-PrabhatNeural', label: 'Prabhat (English India)', accent: 'Indian', gender: 'M', bestFor: 'business, public notices, informative reads' },
  { id: 'edge-tts/en-IE-ConnorNeural', label: 'Connor (English Ireland)', accent: 'Irish', gender: 'M', bestFor: 'radio, podcasts, warm narration' },
  { id: 'edge-tts/en-IE-EmilyNeural', label: 'Emily (English Ireland)', accent: 'Irish', gender: 'F', bestFor: 'radio, travel, conversational updates' },
  { id: 'edge-tts/en-NZ-MitchellNeural', label: 'Mitchell (English New Zealand)', accent: 'New Zealand', gender: 'M', bestFor: 'announcements, weather, community updates' },
  { id: 'edge-tts/en-NZ-MollyNeural', label: 'Molly (English New Zealand)', accent: 'New Zealand', gender: 'F', bestFor: 'weather, service, public messages' },
  { id: 'edge-tts/en-NG-AbeoNeural', label: 'Abeo (English Nigeria)', accent: 'Nigerian', gender: 'M', bestFor: 'radio, public notices, energetic briefings' },
  { id: 'edge-tts/en-NG-EzinneNeural', label: 'Ezinne (English Nigeria)', accent: 'Nigerian', gender: 'F', bestFor: 'radio, community, service updates' },
  { id: 'edge-tts/en-PH-JamesNeural', label: 'James (English Philippines)', accent: 'Philippines', gender: 'M', bestFor: 'service, workplace, friendly announcements' },
  { id: 'edge-tts/en-PH-RosaNeural', label: 'Rosa (English Philippines)', accent: 'Philippines', gender: 'F', bestFor: 'customer service, appointment reminders' },
  { id: 'edge-tts/en-SG-LunaNeural', label: 'Luna (English Singapore)', accent: 'Singapore', gender: 'F', bestFor: 'travel, transit, service messages' },
  { id: 'edge-tts/en-SG-WayneNeural', label: 'Wayne (English Singapore)', accent: 'Singapore', gender: 'M', bestFor: 'airport, transit, formal notices' },
  { id: 'edge-tts/en-ZA-LeahNeural', label: 'Leah (English South Africa)', accent: 'South African', gender: 'F', bestFor: 'weather, announcements, clear narration' },
  { id: 'edge-tts/en-ZA-LukeNeural', label: 'Luke (English South Africa)', accent: 'South African', gender: 'M', bestFor: 'radio, public updates, practical notices' },
  { id: 'edge-tts/en-GB-LibbyNeural', label: 'Libby (English UK)', accent: 'British', gender: 'F', bestFor: 'announcements, service, polished narration' },
  { id: 'edge-tts/en-GB-MaisieNeural', label: 'Maisie (English UK)', accent: 'British', gender: 'F', bestFor: 'friendly updates, podcast intros' },
  { id: 'edge-tts/en-GB-RyanNeural', label: 'Ryan (English UK)', accent: 'British', gender: 'M', bestFor: 'news, radio, formal public messages' },
  { id: 'edge-tts/en-GB-SoniaNeural', label: 'Sonia (English UK)', accent: 'British', gender: 'F', bestFor: 'radio, service, workplace summaries' },
  { id: 'edge-tts/en-GB-ThomasNeural', label: 'Thomas (English UK)', accent: 'British', gender: 'M', bestFor: 'announcements, news, measured narration' },
  { id: 'edge-tts/en-US-AnaNeural', label: 'Ana (English US)', accent: 'American', gender: 'F', bestFor: 'short learner-friendly announcements' },
  { id: 'edge-tts/en-US-AriaNeural', label: 'Aria (English US)', accent: 'American', gender: 'F', bestFor: 'general narration, service, news' },
  { id: 'edge-tts/en-US-AvaNeural', label: 'Ava (English US)', accent: 'American', gender: 'F', bestFor: 'workplace, podcast, clear explanations' },
  { id: 'edge-tts/en-US-AndrewNeural', label: 'Andrew (English US)', accent: 'American', gender: 'M', bestFor: 'business, radio, confident briefings' },
  { id: 'edge-tts/en-US-BrianNeural', label: 'Brian (English US)', accent: 'American', gender: 'M', bestFor: 'news, announcements, workplace updates' },
  { id: 'edge-tts/en-US-ChristopherNeural', label: 'Christopher (English US)', accent: 'American', gender: 'M', bestFor: 'public messages, formal narration' },
  { id: 'edge-tts/en-US-EmmaNeural', label: 'Emma (English US)', accent: 'American', gender: 'F', bestFor: 'service, friendly briefings, reminders' },
  { id: 'edge-tts/en-US-EricNeural', label: 'Eric (English US)', accent: 'American', gender: 'M', bestFor: 'podcast, casual radio, updates' },
  { id: 'edge-tts/en-US-GuyNeural', label: 'Guy (English US)', accent: 'American', gender: 'M', bestFor: 'news, sports-like updates, public notices' },
  { id: 'edge-tts/en-US-JennyNeural', label: 'Jenny (English US)', accent: 'American', gender: 'F', bestFor: 'general shadowing, clear everyday speech' },
  { id: 'edge-tts/en-US-MichelleNeural', label: 'Michelle (English US)', accent: 'American', gender: 'F', bestFor: 'announcements, customer service, calm reads' },
  { id: 'edge-tts/en-US-RogerNeural', label: 'Roger (English US)', accent: 'American', gender: 'M', bestFor: 'radio, formal updates, announcements' },
  { id: 'edge-tts/en-US-SteffanNeural', label: 'Steffan (English US)', accent: 'American', gender: 'M', bestFor: 'workplace, podcasts, instruction' },
];

export function ttsVoiceModelPromptOptions(): { id: string; label: string; accent: string; gender: 'F' | 'M'; bestFor: string }[] {
  return TTS_VOICE_MODELS.map((voice) => ({
    id: voice.id,
    label: voice.label,
    accent: voice.accent,
    gender: voice.gender,
    bestFor: voice.bestFor,
  }));
}
