import { useState } from 'react';
import { buildArchestraUrl, getUserRole } from '../utils/archestraUrl';

interface ArchestraChatProps {
  farmerId: string;
  farmerName: string;
}

export function ArchestraChat({ farmerId, farmerName }: ArchestraChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const userRole = getUserRole();
  const archestraUrl = buildArchestraUrl(farmerId, userRole);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-all hover:scale-110 z-50"
        title="Open AgriBot Chat"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-white p-4 rounded-t-2xl flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">AgriBot Assistant</h3>
          <p className="text-xs text-green-100">Hi {farmerName} — Powered by Archestra AI</p>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-white hover:bg-green-700 rounded-lg p-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Archestra Chat iframe */}
      <iframe
        key={`archestra-widget-${farmerId}-${userRole || 'default'}`}
        src={archestraUrl}
        title="AgriBot Chat"
        className="flex-1 w-full border-none rounded-b-2xl"
        allow="microphone"
      />
    </div>
  );
}
