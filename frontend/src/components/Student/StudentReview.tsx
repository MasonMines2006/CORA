import { useEffect, useState } from 'react';
import { getLearningDashboard, LearningDashboard } from '../../API/Index';
import StudentStudyTools from './StudentStudyTools';

interface StudentReviewProps {
  conceptId?: string;
}

const StudentReview: React.FC<StudentReviewProps> = ({ conceptId }) => {
  const [dashboard, setDashboard] = useState<LearningDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // The dashboard is loaded even when a concept is already chosen, because it is
  // what carries the concept's NAME. Skipping it when conceptId was set is why
  // opening Review on a concept you had just been studying was titled
  // "Course review".
  useEffect(() => {
    let active = true;
    getLearningDashboard()
      .then((result) => {
        if (active) {
          setDashboard(result);
        }
      })
      .catch(() => {
        // A failed lookup only costs the heading its name; the cards below fetch
        // their own content and report their own errors.
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className='mx-auto mt-16 h-96 w-full max-w-3xl animate-pulse rounded-2xl bg-white'
        aria-label='Loading review'
      />
    );
  }

  const recommendation = dashboard?.recommended;
  const activeConceptId = conceptId || recommendation?.concept.id;
  if (!activeConceptId) {
    return (
      <div className='mx-auto max-w-xl px-6 py-16 text-center text-slate-500'>
        Complete a lesson to create your first review cards.
      </div>
    );
  }

  // Never borrow the recommended concept's name for a different concept. In this
  // graph a concept's id is its extracted name, so the id is a truthful last
  // resort for one ranked below the dashboard's cut-off.
  const namedConcept = dashboard?.concepts.find((item) => item.concept.id === activeConceptId);
  const activeConceptName = namedConcept?.concept.name || activeConceptId;

  return (
    <div className='mx-auto w-full max-w-5xl px-5 py-10 pb-28 sm:px-8 lg:pb-12'>
      <StudentStudyTools conceptId={activeConceptId} conceptName={activeConceptName} mode='cards' />
    </div>
  );
};

export default StudentReview;
