import type { LiveVoiceTopicPreset } from '../types';

export const TOPIC_PRESETS_FOOD_HOSPITALITY = [
  {
    id: 'cafe',
    label: 'Café — order & customize',
    situation:
      'Busy neighbourhood café: you queue politely, order a drink (hot/iced, size, milk type, sugar level), maybe a pastry. Ask what’s popular or seasonal, clarify price if needed, say dine-in or takeaway, and exchange small talk about the weather or how busy it is. Stay natural — corrections (“actually decaf please”) are welcome.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Barista',
  },
  {
    id: 'restaurant',
    label: 'Restaurant — full service',
    situation:
      'Sit-down restaurant at dinner: greet the host, sit, study the menu, ask how spicy or large portions are, mention allergies or vegetarian needs, order courses, ask for the bill and splitting/tipping customs for this city. React if something is wrong (cold food, wrong dish) politely but clearly.',
    defaultUserRole: 'Diner',
    defaultAiRole: 'Server',
  },
  {
    id: 'complaint_restaurant',
    label: 'Restaurant — polite complaint',
    situation:
      'You finished most of the meal but something went wrong (long wait, wrong dish, billing error). Stay calm, explain facts, ask for a fair fix (redo dish, remove charge). The staff should apologize and offer options; you negotiate briefly without shouting.',
    defaultUserRole: 'Diner',
    defaultAiRole: 'Manager',
  },
  {
    id: 'delivery_food',
    label: 'Delivery — wrong or late order',
    situation:
      'Food delivery app: order arrived late, wrong items, or spilled. You message/call support tone: describe order ID, what’s missing, what you want (refund partial redelivery). Stay firm but polite.',
    defaultUserRole: 'Customer',
    defaultAiRole: 'Delivery support',
  },
] satisfies readonly LiveVoiceTopicPreset[];
