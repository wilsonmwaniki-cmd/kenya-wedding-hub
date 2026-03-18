export interface PersonalBudgetTemplate {
  name: string;
  visibility: 'private';
}

export const personalBudgetTemplates: PersonalBudgetTemplate[] = [
  { name: 'Dowry', visibility: 'private' },
  { name: 'House Rent', visibility: 'private' },
  { name: 'Utilities Setup', visibility: 'private' },
  { name: 'House Shopping', visibility: 'private' },
  { name: 'Pre-Marital Classes', visibility: 'private' },
  { name: 'Honeymoon', visibility: 'private' },
  { name: 'Health Consultation', visibility: 'private' },
  { name: 'Wedding Bands', visibility: 'private' },
  { name: 'Bride Attire & Body Prep', visibility: 'private' },
  { name: 'Groom Attire & Grooming', visibility: 'private' },
];
