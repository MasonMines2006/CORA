import { useEffect, useState } from 'react';
import { getLearningDashboard, LearningRecommendation } from '../../API/Index';
import StudentStudyTools from './StudentStudyTools';

interface StudentReviewProps {
  conceptId?: string;
}

const StudentReview: React.FC<StudentReviewProps> = ({ conceptId }) => {
  const [recommendation, setRecommendation] = useState<LearningRecommendation | null>(null);
  const [loading, setLoading] = useState(!conceptId);

  useEffect(() => {
    if (conceptId) {
      return;
    }
    let active = true;
    getLearningDashboard()
      .then((dashboard) => {
        if (active) {
          setRecommendation(dashboard.recommended);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [conceptId]);

  if (loading) {
    return (
      <div
        className='mx-auto mt-16 h-96 w-full max-w-3xl animate-pulse rounded-2xl bg-white'
        aria-label='Loading review'
      />
    );
  }

  const activeConceptId = conceptId || recommendation?.concept.id;
  const activeConceptName = recommendation?.concept.name || 'Course';
  if (!activeConceptId) {
    return (
      <div className='mx-auto max-w-xl px-6 py-20 text-center text-slate-500'>
        Complete a lesson to create your first review cards.
      </div>
    );
  }

  return (
    <div className='mx-auto w-full max-w-5xl px-5 py-10 pb-28 sm:px-8 lg:pb-12'>
      <StudentStudyTools conceptId={activeConceptId} conceptName={activeConceptName} mode='cards' />
    </div>
  );
};

export default StudentReview;
