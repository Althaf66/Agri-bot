interface PhaseTimelineProps {
  currentPhase: string;
  sownDate: string;
  cropName: string;
}

const PHASES = [
  { key: 'pre_sowing', label: 'Pre-Sowing', icon: '🌱', color: 'gray' },
  { key: 'sowing', label: 'Sowing', icon: '🌾', color: 'yellow' },
  { key: 'growing', label: 'Growing', icon: '🌿', color: 'green' },
  { key: 'pest_watch', label: 'Pest Watch', icon: '🔍', color: 'orange' },
  { key: 'harvest', label: 'Harvest', icon: '✂️', color: 'blue' },
  { key: 'post_harvest', label: 'Post-Harvest', icon: '📦', color: 'purple' },
];

// Typical duration for each phase (in days)
const PHASE_DURATIONS: Record<string, number> = {
  pre_sowing: 7,
  sowing: 7,
  growing: 45,
  pest_watch: 30,
  harvest: 15,
  post_harvest: 10,
};

export function PhaseTimeline({ currentPhase, sownDate, cropName }: PhaseTimelineProps) {
  const currentPhaseIndex = PHASES.findIndex(p => p.key === currentPhase);
  const daysSinceSowing = Math.floor(
    (new Date().getTime() - new Date(sownDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const getPhaseColor = (_phase: typeof PHASES[0], index: number) => {
    if (index < currentPhaseIndex) {
      return 'bg-green-500'; // Completed
    } else if (index === currentPhaseIndex) {
      return 'bg-blue-500'; // Current
    } else {
      return 'bg-gray-300'; // Upcoming
    }
  };

  const getTextColor = (_phase: typeof PHASES[0], index: number) => {
    if (index < currentPhaseIndex) {
      return 'text-green-600'; // Completed
    } else if (index === currentPhaseIndex) {
      return 'text-blue-600 font-semibold'; // Current
    } else {
      return 'text-gray-400'; // Upcoming
    }
  };

  // Calculate progress percentage for current phase
  const currentPhaseDuration = PHASE_DURATIONS[currentPhase] || 30;
  const phaseProgress = Math.min(100, (daysSinceSowing / currentPhaseDuration) * 100);

  // Calculate estimated days until next phase
  const daysUntilNext = Math.max(0, currentPhaseDuration - daysSinceSowing);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Crop Lifecycle: {cropName}
        </h2>
        <div className="text-sm text-gray-600">
          Day {daysSinceSowing} of {currentPhaseDuration}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
            style={{
              width: `${((currentPhaseIndex + phaseProgress / 100) / PHASES.length) * 100}%`,
            }}
          />
        </div>

        {/* Phase Nodes */}
        <div className="flex justify-between relative">
          {PHASES.map((phase, index) => (
            <div key={phase.key} className="flex flex-col items-center" style={{ width: `${100 / PHASES.length}%` }}>
              {/* Node */}
              <div
                className={`w-12 h-12 rounded-full ${getPhaseColor(
                  phase,
                  index
                )} flex items-center justify-center text-2xl z-10 border-4 border-white shadow-md transition-all duration-300 ${
                  index === currentPhaseIndex ? 'scale-110 ring-4 ring-blue-200' : ''
                }`}
              >
                {phase.icon}
              </div>

              {/* Label */}
              <div className={`text-xs mt-2 text-center ${getTextColor(phase, index)}`}>
                {phase.label}
              </div>

              {/* Checkmark for completed phases */}
              {index < currentPhaseIndex && (
                <div className="text-green-600 text-xs mt-1">✓</div>
              )}

              {/* Current indicator */}
              {index === currentPhaseIndex && (
                <div className="text-blue-600 text-xs mt-1 font-semibold">● Current</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progress Details */}
      <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {PHASES[currentPhaseIndex]?.label} Phase Progress
          </span>
          <span className="text-sm font-semibold text-blue-600">
            {Math.round(phaseProgress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${phaseProgress}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-600">
          <span>Started: {new Date(sownDate).toLocaleDateString()}</span>
          {daysUntilNext > 0 ? (
            <span>
              Next Phase in ~{daysUntilNext} day{daysUntilNext !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-orange-600 font-semibold">Ready for next phase!</span>
          )}
        </div>
      </div>

      {/* Phase Priorities */}
      {currentPhaseIndex >= 0 && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            📋 Current Phase Priorities:
          </h3>
          <ul className="text-sm text-gray-700 space-y-1">
            {currentPhase === 'pre_sowing' && (
              <>
                <li>• Land preparation and soil testing</li>
                <li>• Seed selection and treatment</li>
                <li>• Weather monitoring for optimal sowing time</li>
              </>
            )}
            {currentPhase === 'sowing' && (
              <>
                <li>• Proper seed spacing and depth</li>
                <li>• Initial irrigation scheduling</li>
                <li>• <span className="text-red-600 font-semibold">URGENT: Enroll in crop insurance (7-day deadline)</span></li>
              </>
            )}
            {currentPhase === 'growing' && (
              <>
                <li>• Regular irrigation management</li>
                <li>• Fertilizer application as per schedule</li>
                <li>• Monitor for early signs of diseases</li>
              </>
            )}
            {currentPhase === 'pest_watch' && (
              <>
                <li>• <span className="text-orange-600 font-semibold">Daily pest and disease monitoring</span></li>
                <li>• Apply pesticides if infestation detected</li>
                <li>• Check weather for disease-favorable conditions</li>
              </>
            )}
            {currentPhase === 'harvest' && (
              <>
                <li>• Monitor market prices daily</li>
                <li>• Prepare harvesting equipment</li>
                <li>• Check weather for suitable harvesting days</li>
              </>
            )}
            {currentPhase === 'post_harvest' && (
              <>
                <li>• Proper storage to prevent spoilage</li>
                <li>• Find best mandi with highest prices</li>
                <li>• Plan for next crop cycle</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
