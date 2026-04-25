import { notFound, redirect } from 'next/navigation';
import { Step1AbilityScores } from '@/components/wizard/steps/Step1AbilityScores';
import { Step2Kindred } from '@/components/wizard/steps/Step2Kindred';
import { Step3Class } from '@/components/wizard/steps/Step3Class';
import { Step4AbilityAdjust } from '@/components/wizard/steps/Step4AbilityAdjust';
import { Step5Modifiers } from '@/components/wizard/steps/Step5Modifiers';
import { Step6Traits } from '@/components/wizard/steps/Step6Traits';
import { Step7HP } from '@/components/wizard/steps/Step7HP';
import { Step8Equipment } from '@/components/wizard/steps/Step8Equipment';
import { Step9AC } from '@/components/wizard/steps/Step9AC';
import { Step10Speed } from '@/components/wizard/steps/Step10Speed';
import { Step11Alignment } from '@/components/wizard/steps/Step11Alignment';
import { Step12LevelXP } from '@/components/wizard/steps/Step12LevelXP';
import { Step13Details } from '@/components/wizard/steps/Step13Details';

const STEP_TITLES: Record<number, string> = {
  1: 'Roll Ability Scores',
  2: 'Choose Kindred',
  3: 'Choose Class',
  4: 'Adjust Scores',
  5: 'Modifiers',
  6: 'Traits & Features',
  7: 'Roll Hit Points',
  8: 'Roll Equipment',
  9: 'Armour Class',
  10: 'Speed',
  11: 'Choose Alignment',
  12: 'Level & XP',
  13: 'Name & Details',
};

export default async function WizardStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepStr } = await params;
  const step = parseInt(stepStr, 10);

  if (step === 14) {
    redirect('/characters/new/auto/complete');
  }

  if (isNaN(step) || step < 1 || step > 13) {
    notFound();
  }

  const stepComponents: Partial<Record<number, React.ComponentType>> = {
    1: Step1AbilityScores,
    2: Step2Kindred,
    3: Step3Class,
    4: Step4AbilityAdjust,
    5: Step5Modifiers,
    6: Step6Traits,
    7: Step7HP,
    8: Step8Equipment,
    9: Step9AC,
    10: Step10Speed,
    11: Step11Alignment,
    12: Step12LevelXP,
    13: Step13Details,
  };

  const StepComponent = stepComponents[step];

  if (!StepComponent) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        <p>Step {step}: {STEP_TITLES[step]} — coming soon</p>
      </div>
    );
  }

  return <StepComponent />;
}
