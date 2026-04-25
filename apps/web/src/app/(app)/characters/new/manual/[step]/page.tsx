import { notFound } from 'next/navigation';
import { ManualStep1AbilityScores } from '@/components/wizard/steps/ManualStep1AbilityScores';
import { Step2Kindred } from '@/components/wizard/steps/Step2Kindred';
import { Step3Class } from '@/components/wizard/steps/Step3Class';
import { Step4AbilityAdjust } from '@/components/wizard/steps/Step4AbilityAdjust';
import { Step5Modifiers } from '@/components/wizard/steps/Step5Modifiers';
import { Step6Traits } from '@/components/wizard/steps/Step6Traits';
import { ManualStep7HP } from '@/components/wizard/steps/ManualStep7HP';

const BASE = '/characters/new/manual';

const STEP_TITLES: Record<number, string> = {
  1: 'Ability Scores',
  2: 'Choose Kindred',
  3: 'Choose Class',
  4: 'Adjust Scores',
  5: 'Modifiers',
  6: 'Traits & Features',
  7: 'Hit Points',
  8: 'Equipment',
  9: 'Armour Class',
  10: 'Speed',
  11: 'Choose Alignment',
  12: 'Level & XP',
  13: 'Name & Details',
};

export default async function ManualStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepStr } = await params;
  const step = parseInt(stepStr, 10);

  if (isNaN(step) || step < 1 || step > 13) {
    notFound();
  }

  if (step > 7) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        <p>Step {step}: {STEP_TITLES[step]} — coming soon</p>
        {step < 13 ? (
          <a href={`${BASE}/${step + 1}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Skip to next step →
          </a>
        ) : (
          <a href={`${BASE}/complete`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Finish →
          </a>
        )}
      </div>
    );
  }

  switch (step) {
    case 1:
      return <ManualStep1AbilityScores />;
    case 2:
      return <Step2Kindred basePath={BASE} />;
    case 3:
      return <Step3Class basePath={BASE} />;
    case 4:
      return <Step4AbilityAdjust basePath={BASE} />;
    case 5:
      return <Step5Modifiers basePath={BASE} />;
    case 6:
      return <Step6Traits basePath={BASE} />;
    case 7:
      return <ManualStep7HP />;
    default:
      notFound();
  }
}
