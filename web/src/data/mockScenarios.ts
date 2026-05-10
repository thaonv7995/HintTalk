import type { MockScenario } from '../types';

const H = (
  beginner: string[],
  intermediate: string[],
  advanced: string[],
) => ({ beginner, intermediate, advanced });

export const mockScenarios: MockScenario[] = [
  {
    id: 'free_voice',
    practiceType: 'conversation',
    sessionKind: 'chat',
    title: 'Open conversation',
    category: 'Live voice',
    aiRole: 'Partner',
    userRole: 'Learner',
    goal: 'Practice spoken English on any topic through role-play.',
    phraseBank: [],
    turns: [
      {
        ai: 'Hi! Tell me what topic or role-play you want — I will follow your lead.',
        hints: H(
          ['I want to practice small talk about movies.', "Let's say you're interviewing me for a job."],
          ['practice · topic · small talk · movies · interviews · daily life', 'role-play · you play · I play · scenario · situation'],
          ['topic', 'pick roles'],
        ),
      },
    ],
  },
  {
    id: 'cafe',
    practiceType: 'conversation',
    sessionKind: 'chat',
    title: 'Coffee shop order',
    category: 'Cafe',
    aiRole: 'Barista',
    userRole: 'Customer',
    goal: 'Order a drink politely',
    phraseBank: ["I'd like...", 'Could I get...?', 'For here, please.', "That's all, thank you."],
    turns: [
      {
        ai: 'Good morning! What would you like to order?',
        hints: H(
          ["I'd like a latte, please.", 'Could I get an iced coffee, please?'],
          ["I'd like · please · latte · iced coffee · cappuccino · Could I get"],
          ['order drink / polite', 'ask for item'],
        ),
      },
      {
        ai: 'Sure. What size would you like?',
        hints: H(
          ['A medium, please.', 'Small is fine, thank you.'],
          ['small · medium · large · size · fine · thank you'],
          ['choose size', 'small / medium / large'],
        ),
      },
      {
        ai: 'Would you like anything else with that?',
        hints: H(
          ["No, that's all. Thank you.", 'Yes, a croissant, please.'],
          ["that's all · thank you · No thanks · Yes · croissant · anything else"],
          ['decline politely', 'add one item'],
        ),
      },
      {
        ai: 'Great. Your total is five dollars.',
        hints: H(
          ['Here you go. Thank you.', 'Can I pay by card?'],
          ['Here you go · thank you · pay · card · cash · receipt'],
          ['pay / thank', 'ask payment method'],
        ),
      },
    ],
  },
  {
    id: 'hotel',
    practiceType: 'conversation',
    sessionKind: 'chat',
    title: 'Hotel check-in',
    category: 'Travel',
    aiRole: 'Receptionist',
    userRole: 'Guest',
    goal: 'Check in and ask about the room',
    phraseBank: [
      'I have a reservation.',
      'Could you check my booking?',
      'What time is breakfast?',
      'Could I have the Wi-Fi password?',
    ],
    turns: [
      {
        ai: 'Welcome to Lakeside Hotel. How can I help you?',
        hints: H(
          ['Hi, I have a reservation under Nguyen.', "Hello, I'd like to check in, please."],
          ['reservation · under my name · check in · booking · hello'],
          ['check in / reservation name', 'state booking'],
        ),
      },
      {
        ai: 'May I see your passport or ID, please?',
        hints: H(
          ['Sure. Here it is.', 'Yes, one moment please.'],
          ['Sure · Here it is · one moment · passport · ID'],
          ['give ID', 'ask for a moment'],
        ),
      },
      {
        ai: "You're in room 512. Breakfast is from 7 to 10.",
        hints: H(
          ['Thank you. Could I have the Wi-Fi password?', 'Great. Where is the elevator?'],
          ['Wi-Fi · password · elevator · where is · Could I have'],
          ['ask Wi-Fi', 'ask location'],
        ),
      },
    ],
  },
  {
    id: 'interview',
    practiceType: 'conversation',
    sessionKind: 'chat',
    title: 'Job interview',
    category: 'Work',
    aiRole: 'Interviewer',
    userRole: 'Candidate',
    goal: 'Answer common interview questions',
    phraseBank: [
      'I have experience in...',
      'One strength is...',
      'I learned how to...',
      "I'm interested in this role because...",
    ],
    turns: [
      {
        ai: 'Thanks for coming in today. Could you tell me about yourself?',
        hints: H(
          ["I'm a software developer. I enjoy building useful products.", "I'm a student. I'm learning English and technology."],
          ['background · role · experience · enjoy · because · student · developer'],
          ['background / role / interest', 'short intro'],
        ),
      },
      {
        ai: 'What is one of your strengths?',
        hints: H(
          ['One of my strengths is problem solving.', "I'm good at learning new things quickly."],
          ['strength · problem solving · good at · learning · example · skill'],
          ['strength + example', 'skill / reason'],
        ),
      },
      {
        ai: 'Why are you interested in this role?',
        hints: H(
          ["I'm interested because I want to grow and contribute to the team.", 'This role matches my skills and goals.'],
          ['interested · grow · contribute · team · skills · goals · fit'],
          ['motivation / fit', 'skills + goals'],
        ),
      },
    ],
  },
  {
    id: 'doctor',
    practiceType: 'conversation',
    sessionKind: 'chat',
    title: 'Doctor appointment',
    category: 'Health',
    aiRole: 'Doctor',
    userRole: 'Patient',
    goal: 'Explain symptoms clearly',
    phraseBank: ["I've had a headache...", 'It started three days ago.', 'It hurts when I...', 'Could you recommend...'],
    turns: [
      {
        ai: 'What brings you in today?',
        hints: H(
          ["I've had a sore throat since Monday.", "I've had trouble sleeping this week."],
          ['sore throat · since Monday · trouble sleeping · symptom · how long'],
          ['symptom / duration', 'problem area'],
        ),
      },
      {
        ai: 'How severe is the pain from 1 to 10?',
        hints: H(["I'd say it's about a 6.", "It's mild but annoying."], ["I'd say · about · mild · sharp · pain scale · severity"], ['give number', 'describe intensity']),
      },
      {
        ai: 'Any allergies to medication?',
        hints: H(["No, I don't have any.", "Yes, I'm allergic to penicillin."], ['No allergies · allergic to · penicillin · medication'], ['no allergies', 'name allergy']),
      },
    ],
  },
  /* TOEIC Speaking — scripted chat practice */
  {
    id: 'toeic-speak-read',
    practiceType: 'toeic',
    sessionKind: 'chat',
    title: 'Read a text aloud',
    category: 'TOEIC Speaking',
    aiRole: 'Proctor',
    userRole: 'Test taker',
    goal: 'Practice clear pacing and intonation',
    phraseBank: ['First sentence.', 'Second sentence.', 'Thank you.'],
    toeicSection: 'speaking',
    toeicTaskType: 'read_aloud',
    questionRange: 'Q1-2',
    prompt: 'Read the following announcement aloud with clear pronunciation.',
    promptVi: 'Đọc thông báo sau đây to và phát âm rõ ràng.',
    planSteps: [
      { step: '1', title: 'Pace', hint: 'Speak steadily; pause at commas.' },
      { step: '2', title: 'Stress', hint: 'Stress content words lightly.' },
      { step: '3', title: 'Ending', hint: 'Finish with a calm tone.' },
    ],
    turns: [
      {
        ai: 'Please read this text aloud: "The cafe opens at seven on weekdays and closes at nine at night."',
        hints: H(
          ['The cafe opens at seven on weekdays and closes at nine at night.'],
          ['opens · weekdays · closes · seven · nine · times · read clearly'],
          ['read clearly', 'numbers / times'],
        ),
      },
      {
        ai: 'Good. Now read: "Please finish your drink before boarding the train."',
        hints: H(
          ['Please finish your drink before boarding the train.'],
          ['finish · drink · boarding · train · before'],
          ['boarding', 'finish before'],
        ),
      },
    ],
  },
  {
    id: 'toeic-speak-picture',
    practiceType: 'toeic',
    sessionKind: 'chat',
    title: 'Describe a picture',
    category: 'TOEIC Speaking',
    aiRole: 'Examiner',
    userRole: 'Test taker',
    goal: 'Describe foreground, people, and actions',
    phraseBank: ['In the foreground...', 'In the background...', 'They are ...ing', 'It looks like...'],
    toeicSection: 'speaking',
    toeicTaskType: 'describe_picture',
    questionRange: 'Q3-4',
    prompt: 'Describe what you see in the picture.',
    promptVi: 'Mô tả những gì bạn thấy trong tranh.',
    planSteps: [
      { step: '1', title: 'Scene', hint: 'Where are they?' },
      { step: '2', title: 'People', hint: 'Who is doing what?' },
      { step: '3', title: 'Detail', hint: 'One extra observation.' },
    ],
    turns: [
      {
        ai: 'Look at the picture: two people are talking at a reception desk in an office lobby.',
        hints: H(
          ['In the foreground, two people are talking at a reception desk.', 'On the left, a woman is handing a document to a man.'],
          ['foreground · reception · talking · handing · document · on the left'],
          ['foreground / reception', 'action verbs'],
        ),
      },
      {
        ai: 'Add one detail about the background.',
        hints: H(
          ['In the background, there are elevators and a large window.', 'Behind them, I see plants near the wall.'],
          ['background · elevators · window · plants · behind them'],
          ['background objects', 'location phrases'],
        ),
      },
    ],
  },
  {
    id: 'toeic-speak-opinion',
    practiceType: 'toeic',
    sessionKind: 'chat',
    title: 'Express an opinion',
    category: 'TOEIC Speaking',
    aiRole: 'Examiner',
    userRole: 'Test taker',
    goal: 'Opinion, reason, example',
    phraseBank: ['I agree that...', 'One reason is...', 'For example...', 'That is why...'],
    toeicSection: 'speaking',
    toeicTaskType: 'express_opinion',
    questionRange: 'Q11',
    prompt: 'Do you agree or disagree that employees should work from home more often?',
    promptVi: 'Bạn đồng ý hay không đồng ý rằng nhân viên nên làm việc tại nhà thường xuyên hơn?',
    planSteps: [
      { step: '1', title: 'Opinion', hint: 'I agree that...' },
      { step: '2', title: 'Reason', hint: 'because it helps...' },
      { step: '3', title: 'Example', hint: 'For example...' },
    ],
    turns: [
      {
        ai: 'Do you agree or disagree that employees should work from home more often?',
        hints: H(
          ['I agree because working from home can save commuting time.', 'I disagree because teamwork is easier in the office.'],
          ['I agree · I disagree · commuting · teamwork · flexibility · productivity'],
          ['pick side', 'reason clause'],
        ),
      },
      {
        ai: 'Good. Can you give one example from your daily routine?',
        hints: H(
          ['For example, I can start work earlier and avoid traffic.', 'For instance, I save about one hour each day.'],
          ['For example · routine · earlier · traffic · save time · detail'],
          ['For example', 'concrete detail'],
        ),
      },
    ],
  },
  {
    id: 'toeic-speak-questions',
    practiceType: 'toeic',
    sessionKind: 'chat',
    title: 'Respond to questions',
    category: 'TOEIC Speaking',
    aiRole: 'Examiner',
    userRole: 'Test taker',
    goal: 'Answer clearly then add one detail',
    phraseBank: ['Yes, I think...', 'Because...', 'For example...', "I'm not sure, but..."],
    toeicSection: 'speaking',
    toeicTaskType: 'respond_to_questions',
    questionRange: 'Q5-7',
    prompt: 'Listen and respond to everyday questions with a direct answer plus one short detail.',
    promptVi:
      'Nghe và trả lời các câu hỏi đời thường bằng một câu trả lời trực tiếp kèm một chi tiết ngắn.',
    planSteps: [
      { step: '1', title: 'Answer', hint: 'Yes / No / Short reply' },
      { step: '2', title: 'Detail', hint: 'One extra piece of info' },
      { step: '3', title: 'Close', hint: 'Natural tone' },
    ],
    turns: [
      {
        ai: 'What do you usually do on Sunday mornings?',
        hints: H(
          ['I usually read at home on Sunday mornings.', 'On Sundays I often go for a walk in the park.'],
          ['usually · Sunday mornings · often · walk · read · at home'],
          ['activity / frequency', 'weekend routine'],
        ),
      },
      {
        ai: 'Where would you like to travel next and why?',
        hints: H(
          ['I would like to visit Japan because I enjoy good food and trains.', "I'd love to see Canada because my cousin lives there."],
          ['visit · Japan · Canada · because · food · family · destination'],
          ['destination', 'reason'],
        ),
      },
    ],
  },
  {
    id: 'toeic-speak-provided',
    practiceType: 'toeic',
    sessionKind: 'chat',
    title: 'Use provided information',
    category: 'TOEIC Speaking',
    aiRole: 'Examiner',
    userRole: 'Test taker',
    goal: 'Use facts from the notice accurately',
    phraseBank: ['According to the notice...', 'It says that...', 'The event starts at...', 'Registration is...'],
    toeicSection: 'speaking',
    toeicTaskType: 'provided_information',
    questionRange: 'Q8-10',
    prompt:
      'Community library summer schedule: Tuesday–Friday 10 a.m.–6 p.m.; Saturday 9 a.m.–4 p.m.; closed Sundays. Free storytelling for kids every Wednesday at 3 p.m.',
    promptVi:
      'Lịch thư viện cộng đồng mùa hè: thứ Ba–thứ Sáu 10 giờ sáng–6 giờ chiều; thứ Bảy 9 giờ sáng–4 giờ chiều; chủ nhật đóng cửa. Kể chuyện miễn phí cho trẻ mỗi thứ Tư lúc 15 giờ.',
    planSteps: [
      { step: '1', title: 'Scan', hint: 'Pick days or times from notice' },
      { step: '2', title: 'Answer', hint: 'Match question to fact' },
      { step: '3', title: 'Say source', hint: 'According to…' },
    ],
    turns: [
      {
        ai: 'According to the notice, when is the library open on Saturdays?',
        hints: H(
          ['It is open from nine a.m. to four p.m. on Saturdays.', 'On Saturdays it opens at nine and closes at four.'],
          ['nine · four · Saturday · a.m. · p.m. · open · closed'],
          ['hours', 'Saturday'],
        ),
      },
      {
        ai: 'What special activity is offered for children, and when?',
        hints: H(
          ['Free storytelling for kids is offered every Wednesday at three p.m.', 'There is storytelling for children on Wednesdays at three.'],
          ['storytelling · Wednesday · three p.m. · kids · children · free'],
          ['storytelling', 'time/day'],
        ),
      },
    ],
  },
  /* TOEIC Writing — document sheet */
  {
    id: 'toeic-write-picture',
    practiceType: 'toeic',
    sessionKind: 'document',
    title: 'Picture sentence',
    category: 'TOEIC Writing',
    aiRole: 'Evaluator',
    userRole: 'Test taker',
    goal: 'One accurate sentence using required words',
    phraseBank: ['The woman is ...', 'Both ... are ...', 'There is ...'],
    toeicSection: 'writing',
    toeicTaskType: 'picture_sentence',
    questionRange: 'Q1-5',
    prompt:
      'Write one sentence about the picture using BOTH words: negotiate · contract. The office workers are discussing papers at a table.',
    promptVi:
      'Viết một câu về tranh, phải dùng cả hai từ: negotiate · contract. Hai nhân viên văn phòng đang thảo luận giấy tờ tại bàn.',
    docHints: [
      'Include both required words naturally.',
      'Mention who is doing what.',
      'Keep it to one sentence.',
    ],
    defaultDraft: '',
    turns: [],
  },
  {
    id: 'toeic-write-email',
    practiceType: 'toeic',
    sessionKind: 'document',
    title: 'Respond to a request',
    category: 'TOEIC Writing',
    aiRole: 'Evaluator',
    userRole: 'Test taker',
    goal: 'Polite email with purpose and closing',
    phraseBank: ['Dear Mr. Lee,', 'I am sorry, but...', 'Would Thursday at 3 p.m. work?', 'Thank you for understanding.'],
    toeicSection: 'writing',
    toeicTaskType: 'respond_to_request',
    questionRange: 'Q6-7',
    prompt:
      'You received an email asking to reschedule a meeting. Write a polite reply suggesting one new time.',
    promptVi:
      'Bạn nhận được email yêu cầu đổi lịch họp. Viết một email trả lời lịch sự, đề xuất một thời gian mới cụ thể.',
    docHints: [
      'Opening + purpose in the first lines.',
      'Give one exact alternative time.',
      'Close politely.',
    ],
    defaultDraft:
      'Dear Mr. Lee,\n\nI am sorry, but I need to reschedule our meeting because I have another appointment.\n\nWould Thursday at 3 p.m. work for you?\n\nThank you for understanding.\n\nBest regards,',
    turns: [],
  },
  {
    id: 'toeic-write-essay',
    practiceType: 'toeic',
    sessionKind: 'document',
    title: 'Opinion essay',
    category: 'TOEIC Writing',
    aiRole: 'Evaluator',
    userRole: 'Test taker',
    goal: 'Thesis, reasons, examples, conclusion',
    phraseBank: ['In my opinion,...', 'First,...', 'Second,...', 'In conclusion,...'],
    toeicSection: 'writing',
    toeicTaskType: 'opinion_essay',
    questionRange: 'Q8',
    prompt: 'Do you think companies should offer four-day work weeks? Explain your opinion with reasons and examples.',
    promptVi:
      'Bạn có nghĩ các công ty nên áp dụng tuần làm việc bốn ngày không? Giải thích ý kiến kèm lý do và ví dụ.',
    planSteps: [
      { step: '1', title: 'Thesis', hint: 'State yes/no clearly.' },
      { step: '2', title: 'Reason 1', hint: 'Productivity or wellbeing.' },
      { step: '3', title: 'Example', hint: 'Short realistic example.' },
      { step: '4', title: 'Close', hint: 'Summarize your stance.' },
    ],
    docHints: ['Introduction with clear thesis.', 'Two short body paragraphs.', 'One sentence conclusion.'],
    defaultDraft: '',
    turns: [],
  },
];

export function getScenarioById(id: string): MockScenario | undefined {
  return mockScenarios.find((s) => s.id === id);
}
