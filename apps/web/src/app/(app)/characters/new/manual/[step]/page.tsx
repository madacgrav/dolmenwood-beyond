import { notFound } from 'next/navigation';
import { ManualStep1AbilityScores } from '@/components/wizard/steps/ManualStep1AbilityScores';
import { Step2Kindred } from '@/components/wizard/steps/Step2Kindred';
import { Step3Class } from '@/components/wizard/steps/Step3Class';
import { Step4AbilityAdjust } from '@/components/wizard/steps/Step4AbilityAdjust';
import { Step5Modifiers } from '@/components/wizard/steps/Step5Modifiers';
import { Step6Traits } from '@/components/wizard/steps/Step6Traits';
import { ManualStep7HP } from '@/components/wizard/steps/ManualStep7HP';
import { Step8Equipment } from '@/components/wizard/steps/Step8Equipment';
import { Step9AC } from '@/components/wizard/steps/Step9AC';
import { Step10Speed } from '@/components/wizard/steps/Step10Speed';
import { Step11Alignment } from '@/components/wizard/steps/Step11Alignment';
import { Step12LevelXP } from '@/components/wizard/steps/Step12LevelXP';
import { Step13Details } from '@/components/wizard/steps/Step13Details';

const BASE = '/characters/new/manual';

export default async function ManualStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepStr } = await params;
  const step = parseInt(stepStr, 10);

  if (isNaN(step) || step < 1 || step > 13) {
    notFound();
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
    case 8:
      return <Step8Equipment basePath={BASE} />;
    case 9:
      return <Step9AC basePath={BASE} />;
    case 10:
      return <Step10Speed basePath={BASE} />;
    case 11:
      return <Step11Alignment basePath={BASE} />;
    case 12:
      return <Step12LevelXP basePath={BASE} />;
    case 13:
      return <Step13Details basePath={BASE} />;
    default:
      notFound();
  }
}
