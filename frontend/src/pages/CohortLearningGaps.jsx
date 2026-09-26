import React from 'react';
import CohortLearningGapsPanel from '../components/CohortLearningGapsPanel';

/**
 * CohortLearningGaps Page
 * Dedicated application page for departmental cohort intelligence,
 * multi-tiered academic gap diagnosis (Semester -> Subject -> Unit -> Topic),
 * and faculty remedial intervention packages.
 */
export default function CohortLearningGaps() {
  return (
    <div className="w-full min-h-full">
      <CohortLearningGapsPanel />
    </div>
  );
}
