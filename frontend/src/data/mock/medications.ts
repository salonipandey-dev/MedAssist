// Scripted medication-information demonstration.
// All medicine, ingredient, allergy and condition names are invented. The notices are written
// into each scenario in advance; nothing here evaluates real medicines or real health data, and
// no notice (or absence of one) is a statement about safety.

export type NoticeCategory =
  | 'Interaction between medicines'
  | 'Allergy conflict'
  | 'Duplicate ingredient'
  | 'Medicine and condition'
  | 'Missing information';

export type NoticeState = 'possible-issue' | 'insufficient-data' | 'no-scripted-notice';

export interface DemoMedicine {
  id: string;
  name: string;
  /** null means the invented product is not in the sample reference list. */
  ingredients: string[] | null;
}

export interface ScriptedNotice {
  id: string;
  category: NoticeCategory;
  state: NoticeState;
  refersTo: string[];
  basis: string;
  explanation: string;
}

export interface MedicationScenario {
  id: string;
  title: string;
  summary: string;
  medicineIds: string[];
  /** 'not-recorded' is different from an empty list (none recorded in the sample). */
  allergies: string[] | 'not-recorded';
  conditions: string[] | 'not-recorded';
  notices: ScriptedNotice[];
}

export const DEMO_MEDICINES: DemoMedicine[] = [
  { id: 'm-01', name: 'Brivanol 250 tablets', ingredients: ['brivanol'] },
  { id: 'm-02', name: 'Coldaway Day Relief', ingredients: ['brivanol', 'fendrazine'] },
  { id: 'm-03', name: 'Sulvaxin capsules', ingredients: ['sulvaxin'] },
  { id: 'm-04', name: 'Teromide tablets', ingredients: ['teromide'] },
  { id: 'm-05', name: 'Calmora syrup', ingredients: null },
  { id: 'm-06', name: 'Pexilene tablets', ingredients: ['pexilene'] },
];

export const FOLLOW_UP_TEXT =
  'Questions about real medicines should be discussed with a pharmacist or doctor. This demonstration does not give advice about taking, changing or stopping any medicine.';

export const MEDICATION_SCENARIOS: MedicationScenario[] = [
  {
    id: 'duplicate',
    title: 'Same ingredient in two products',
    summary: 'Two invented products that both list brivanol.',
    medicineIds: ['m-01', 'm-02'],
    allergies: [],
    conditions: [],
    notices: [
      {
        id: 'n-duplicate',
        category: 'Duplicate ingredient',
        state: 'possible-issue',
        refersTo: ['Brivanol 250 tablets', 'Coldaway Day Relief', 'ingredient: brivanol'],
        basis: 'Scripted example D-1: the same invented ingredient is listed in two products.',
        explanation:
          'Both products in this example list brivanol. A real service would ask a professional to review the combination.',
      },
    ],
  },
  {
    id: 'allergy',
    title: 'Ingredient matches a recorded allergy',
    summary: 'An invented product whose ingredient belongs to the recorded sensitivity group.',
    medicineIds: ['m-03'],
    allergies: ['Sulvaxin-group sensitivity'],
    conditions: [],
    notices: [
      {
        id: 'n-allergy',
        category: 'Allergy conflict',
        state: 'possible-issue',
        refersTo: ['Sulvaxin capsules', 'allergy: Sulvaxin-group sensitivity'],
        basis:
          'Scripted example A-1: the invented ingredient sulvaxin belongs to the recorded invented sensitivity group.',
        explanation:
          'The sample profile records a sensitivity that matches this product’s listed ingredient.',
      },
    ],
  },
  {
    id: 'interaction',
    title: 'Two medicines with a scripted interaction',
    summary: 'A pair that the sample reference lists as an invented interaction example.',
    medicineIds: ['m-04', 'm-06'],
    allergies: [],
    conditions: [],
    notices: [
      {
        id: 'n-interaction',
        category: 'Interaction between medicines',
        state: 'possible-issue',
        refersTo: ['Teromide tablets', 'Pexilene tablets'],
        basis:
          'Scripted example I-1: the sample reference pairs teromide and pexilene as an invented interaction.',
        explanation:
          'This pairing is written into the demonstration to show how a notice could be presented.',
      },
    ],
  },
  {
    id: 'condition',
    title: 'Medicine and a recorded condition',
    summary: 'An invented product listed against an invented condition.',
    medicineIds: ['m-06'],
    allergies: [],
    conditions: ['Condition K'],
    notices: [
      {
        id: 'n-condition',
        category: 'Medicine and condition',
        state: 'possible-issue',
        refersTo: ['Pexilene tablets', 'condition: Condition K'],
        basis:
          'Scripted example C-1: the sample reference lists pexilene against the invented Condition K.',
        explanation:
          'The sample profile records a condition that the reference links to this product.',
      },
    ],
  },
  {
    id: 'incomplete',
    title: 'Incomplete information',
    summary: 'One product is missing from the sample reference and allergies are not recorded.',
    medicineIds: ['m-01', 'm-05'],
    allergies: 'not-recorded',
    conditions: [],
    notices: [
      {
        id: 'n-missing-product',
        category: 'Missing information',
        state: 'insufficient-data',
        refersTo: ['Calmora syrup'],
        basis: 'Calmora syrup is not in the sample reference, so its ingredients are unknown here.',
        explanation:
          'Duplicate-ingredient, allergy and interaction notices cannot be shown for this product.',
      },
      {
        id: 'n-missing-allergy',
        category: 'Missing information',
        state: 'insufficient-data',
        refersTo: ['allergies: not recorded'],
        basis: 'The sample profile does not record allergy information.',
        explanation:
          'Not recorded is different from having no allergies. No allergy notice can be shown.',
      },
    ],
  },
  {
    id: 'none',
    title: 'No scripted notice',
    summary: 'A single product with no notice written for it.',
    medicineIds: ['m-01'],
    allergies: [],
    conditions: [],
    notices: [
      {
        id: 'n-none',
        category: 'Missing information',
        state: 'no-scripted-notice',
        refersTo: ['Brivanol 250 tablets'],
        basis: 'No notice is written for this example.',
        explanation:
          'This does not mean the medicine is safe for anyone. The demonstration covers only a few invented examples.',
      },
    ],
  },
];

export interface ScenarioCoverage {
  medicinesInReference: string[];
  medicinesMissing: string[];
  allergiesRecorded: boolean;
  conditionsRecorded: boolean;
  complete: boolean;
}

/** Describes what information the scripted example contains; it does not assess medicines. */
export function scenarioCoverage(scenario: MedicationScenario): ScenarioCoverage {
  const medicines = scenario.medicineIds.map((id) => DEMO_MEDICINES.find((m) => m.id === id)!);
  const medicinesInReference = medicines.filter((m) => m.ingredients !== null).map((m) => m.name);
  const medicinesMissing = medicines.filter((m) => m.ingredients === null).map((m) => m.name);
  const allergiesRecorded = scenario.allergies !== 'not-recorded';
  const conditionsRecorded = scenario.conditions !== 'not-recorded';
  return {
    medicinesInReference,
    medicinesMissing,
    allergiesRecorded,
    conditionsRecorded,
    complete: medicinesMissing.length === 0 && allergiesRecorded && conditionsRecorded,
  };
}
