export type PlanningInput = {
  weddingDate: string;
  estimatedBudget: number;
  estimatedGuestCount: number;
  weddingType: string;
  priorities: string[];
  bookedCategories: string[];
};

export type PlanningTaskRecommendation = {
  key: string;
  title: string;
  category: string;
  priorityLevel: number;
};

export type PlanningAction = {
  title: string;
  detail: string;
  taskKey?: string;
};

export type PlanningTaskState = PlanningTaskRecommendation & {
  id?: string;
  completed: boolean;
};

const SIMPLE_CATEGORY_BY_ESTIMATOR_CATEGORY: Record<string, string> = {
  'Wedding Licenses': 'Planning',
  'Church & Officiating Minister': 'Planning',
  'Marriage Preparation': 'Planning',
  'Wedding Venue': 'Venue',
  'Wedding Planner / Planning Team': 'Planning',
  Caterer: 'Catering',
  'Cake Artist & Baker': 'Catering',
  'Décor, Tents, Chairs, Tables': 'Décor',
  Rings: 'Attire',
  'Bridal Gown, Accessories, Preparation': 'Attire',
  "Groom's Attire & Accessories, Preparation": 'Attire',
  'Master of Ceremonies': 'Entertainment',
  'DJ (or Band) and Sound': 'Entertainment',
  Photographer: 'Photography',
  Cinematographer: 'Photography',
  'Photo Shoot Venue': 'Venue',
  Transport: 'Transport',
  Invitations: 'Décor',
  "Bride's Make-up Artist": 'Beauty',
  "Bride's Hair Stylist": 'Beauty',
  Honeymoon: 'Contingency',
};

export function toSimplePlanningCategory(category: string) {
  return SIMPLE_CATEGORY_BY_ESTIMATOR_CATEGORY[category] ?? category;
}

const BASE_CATEGORY_WEIGHTS: Array<[string, number]> = [
  ['Venue', 0.22],
  ['Catering', 0.24],
  ['Photography', 0.1],
  ['Attire', 0.09],
  ['Décor', 0.08],
  ['Entertainment', 0.06],
  ['Planning', 0.05],
  ['Transport', 0.04],
  ['Beauty', 0.03],
  ['Contingency', 0.09],
];

const PRIORITY_CATEGORIES: Record<string, string[]> = {
  food: ['Catering'],
  photos: ['Photography'],
  family: ['Venue', 'Catering'],
  style: ['Décor', 'Attire', 'Beauty'],
  music: ['Entertainment'],
  guests: ['Venue', 'Catering'],
};

const TASK_TEMPLATES: Array<Omit<PlanningTaskRecommendation, 'priorityLevel'>> = [
  { key: 'guest-list-first-draft', title: 'Make your first guest list', category: 'Guests' },
  { key: 'venue-short-list', title: 'Choose three venues to compare', category: 'Venue' },
  { key: 'catering-quotes', title: 'Ask three caterers for prices', category: 'Catering' },
  { key: 'photography-coverage', title: 'Choose the photos you want covered', category: 'Photography' },
  { key: 'ceremony-reception-flow', title: 'Write a simple wedding-day order', category: 'Timeline' },
  { key: 'wedding-style', title: 'Choose your wedding look and colours', category: 'Décor' },
  { key: 'attire-appointments', title: 'Plan the first attire appointments', category: 'Attire' },
  { key: 'music-entertainment', title: 'Choose the music and entertainment style', category: 'Entertainment' },
  { key: 'vendor-comparison', title: 'Make one simple vendor comparison', category: 'Vendors' },
  { key: 'budget-review', title: 'Review the starting budget together', category: 'Budget' },
];

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function isTaskCoveredByBooking(category: string, booked: Set<string>) {
  const normalizedCategory = category.toLowerCase();
  if (booked.has(normalizedCategory)) return true;
  if (normalizedCategory === 'vendors') return false;
  if (normalizedCategory === 'timeline' || normalizedCategory === 'budget' || normalizedCategory === 'guests') return false;
  return [...booked].some((bookedCategory) => (
    bookedCategory.includes(normalizedCategory) || normalizedCategory.includes(bookedCategory)
  ));
}

function taskDetail(task: Pick<PlanningTaskRecommendation, 'category'>) {
  const category = task.category.toLowerCase();
  if (category === 'guests') return 'A first guest list makes venue and food estimates much easier.';
  if (category === 'budget') return 'Check that the amounts feel realistic before speaking with vendors.';
  return `Start here so your ${category} decisions are easier to make.`;
}

export function buildNextActions(
  tasks: PlanningTaskState[],
  bookedCategories: string[],
): { primaryNextAction: PlanningAction; secondaryActions: PlanningAction[] } {
  const booked = normalizedSet(bookedCategories);
  const relevantTasks = tasks
    .filter((task) => !task.completed && !isTaskCoveredByBooking(task.category, booked))
    .sort((left, right) => left.priorityLevel - right.priorityLevel);
  const actions = relevantTasks.slice(0, 4).map((task) => ({
    title: task.title,
    detail: taskDetail(task),
    taskKey: task.key,
  }));

  return {
    primaryNextAction: actions[0] ?? {
      title: 'Review your plan together',
      detail: 'Your first steps are complete. Check the budget and decide what comes next.',
    },
    secondaryActions: actions.slice(1, 4),
  };
}

export function buildPlanningRecommendations(input: PlanningInput) {
  const budget = Math.max(0, Number.isFinite(input.estimatedBudget) ? input.estimatedBudget : 0);
  const priorities = normalizedSet(input.priorities);
  const adjustedWeights = BASE_CATEGORY_WEIGHTS.map(([name, weight]) => {
    const isPriorityCategory = [...priorities].some((priority) => (
      PRIORITY_CATEGORIES[priority]?.includes(name)
    ));
    const guestAdjustment = input.estimatedGuestCount >= 250 && (name === 'Catering' || name === 'Venue') ? 1.08 : 1;
    return [name, weight * (isPriorityCategory ? 1.12 : 1) * guestAdjustment] as const;
  });
  const totalWeight = adjustedWeights.reduce((total, [, weight]) => total + weight, 0);
  const budgetRows = adjustedWeights.map(([name, weight], index) => {
    const normalizedWeight = totalWeight ? weight / totalWeight : 0;
    const allocated = index === adjustedWeights.length - 1
      ? budget
        - adjustedWeights.slice(0, -1).reduce((total, [, priorWeight]) => (
          total + Math.round((budget * priorWeight) / totalWeight)
        ), 0)
      : Math.round(budget * normalizedWeight);
    return {
      name,
      allocated: Math.max(0, allocated),
      suggestedPercentage: Math.round(normalizedWeight * 1000) / 10,
    };
  });

  const booked = normalizedSet(input.bookedCategories);
  const tasks: PlanningTaskState[] = TASK_TEMPLATES
    .filter((task) => !isTaskCoveredByBooking(task.category, booked))
    .slice(0, 10)
    .map((task, index) => ({
      ...task,
      priorityLevel: Math.min(4, Math.floor(index / 3) + 1),
      completed: false,
    }));
  const actions = buildNextActions(tasks, input.bookedCategories);

  return {
    budgetRows,
    tasks,
    ...actions,
  };
}
