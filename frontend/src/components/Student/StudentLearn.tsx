const topics = [
  {
    title: 'Reactor Criticality',
    description: 'Understand the conditions for a self-sustaining chain reaction in the PULSTAR core.',
    prompt: 'Explain how the PULSTAR reactor achieves and maintains criticality',
  },
  {
    title: 'Neutron Moderation',
    description: 'How light water slows neutrons to thermal energies to sustain fission.',
    prompt: 'How does neutron moderation work in the PULSTAR reactor?',
  },
  {
    title: 'Safety Systems',
    description: 'Control rods, SCRAM mechanisms, and passive safety features.',
    prompt: 'What safety systems are used in the PULSTAR reactor?',
  },
  {
    title: 'Reactor Core Components',
    description: 'Fuel elements, control rods, reflectors, and the reactor vessel.',
    prompt: 'Summarize the main components of the PULSTAR reactor core',
  },
  {
    title: 'Thermal Hydraulics',
    description: 'Heat generation, coolant flow, and temperature limits in the core.',
    prompt: 'Describe the thermal hydraulic behavior of the PULSTAR reactor during normal operation',
  },
  {
    title: 'Radiation Shielding',
    description: 'Biological shielding design and dose considerations for operators.',
    prompt: 'How is radiation shielding designed for the PULSTAR reactor facility?',
  },
];

interface StudentLearnProps {
  onNavigateToChat: (prompt?: string) => void;
}

const StudentLearn: React.FC<StudentLearnProps> = ({ onNavigateToChat }) => {
  return (
    <div className='mx-auto max-w-3xl space-y-8 px-6 py-8'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight text-slate-900'>Study topics</h2>
        <p className='mt-2 text-sm text-slate-500'>Click any topic to open it in the chat with a preloaded question.</p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {topics.map((topic) => (
          <button
            key={topic.title}
            onClick={() => onNavigateToChat(topic.prompt)}
            className='group rounded-xl border border-slate-100 bg-white p-5 text-left transition-all hover:border-red-200 hover:shadow-sm'
          >
            <h3 className='text-sm font-semibold text-slate-900 group-hover:text-red-600'>{topic.title}</h3>
            <p className='mt-1.5 text-xs leading-relaxed text-slate-500'>{topic.description}</p>
            <span className='mt-3 inline-block text-xs font-medium text-red-500 opacity-0 transition-opacity group-hover:opacity-100'>
              Ask in chat →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StudentLearn;
