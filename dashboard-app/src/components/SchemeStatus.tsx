interface SchemeStatusProps {
  farmer: {
    id: string;
    land_acres: number;
    income_category: string;
    bank_account: boolean;
    aadhaar_linked: boolean;
  };
  cropPhase: string;
}

interface Scheme {
  name: string;
  shortName: string;
  icon: string;
  status: 'enrolled' | 'eligible' | 'not_eligible' | 'action_required';
  details: {
    description: string;
    benefit: string;
    eligibility?: string;
    action?: string;
    deadline?: string;
    payment?: {
      amount: string;
      frequency: string;
      lastPayment?: string;
      nextPayment?: string;
      totalReceived?: string;
    };
  };
}

export function SchemeStatus({ farmer, cropPhase }: SchemeStatusProps) {
  // Check eligibility for various schemes
  const isPmKisanEligible = farmer.bank_account && farmer.aadhaar_linked && farmer.land_acres <= 5;
  const isCropInsuranceEligible = (cropPhase === 'sowing' || cropPhase === 'growing');
  const isKccEligible = farmer.bank_account && farmer.aadhaar_linked;

  const schemes: Scheme[] = [
    {
      name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      shortName: 'PM-KISAN',
      icon: '💰',
      status: isPmKisanEligible ? 'enrolled' : 'not_eligible',
      details: {
        description: 'Direct income support of ₹6,000 per year in three installments',
        benefit: '₹6,000 per year (₹2,000 per installment)',
        ...(isPmKisanEligible ? {
          payment: {
            amount: '₹2,000',
            frequency: 'Every 4 months',
            lastPayment: 'January 2026',
            nextPayment: 'May 2026',
            totalReceived: '₹4,000 (2 installments)'
          }
        } : {
          eligibility: 'Requires: Bank account, Aadhaar linked, Land ownership ≤5 acres',
        })
      }
    },
    {
      name: 'PM Fasal Bima Yojana (Crop Insurance)',
      shortName: 'Crop Insurance',
      icon: '🛡️',
      status: isCropInsuranceEligible ? 'action_required' : 'not_eligible',
      details: {
        description: 'Comprehensive crop insurance scheme covering yield losses',
        benefit: 'Up to 100% compensation for crop losses due to natural calamities',
        ...(isCropInsuranceEligible ? {
          action: 'Enroll within 7 days of sowing to get subsidized premium',
          deadline: '7 days after sowing date',
          eligibility: 'Premium: 2% of sum insured for Kharif crops, 1.5% for Rabi crops',
        } : {
          eligibility: 'Available only during sowing and early growing phase',
        })
      }
    },
    {
      name: 'Kisan Credit Card (KCC)',
      shortName: 'KCC',
      icon: '💳',
      status: isKccEligible ? 'eligible' : 'not_eligible',
      details: {
        description: 'Short-term credit for agricultural needs with subsidized interest',
        benefit: 'Credit up to ₹3 lakh at 7% interest (4% with prompt repayment)',
        ...(isKccEligible ? {
          action: 'Visit nearest bank branch with land documents and Aadhaar',
          eligibility: 'No collateral required for loans up to ₹1.6 lakh',
        } : {
          eligibility: 'Requires: Bank account and Aadhaar linked',
        })
      }
    },
    {
      name: 'Soil Health Card Scheme',
      shortName: 'Soil Health',
      icon: '🌱',
      status: 'eligible',
      details: {
        description: 'Free soil testing and nutrient recommendations',
        benefit: 'Get customized fertilizer recommendations based on soil health',
        action: 'Contact agriculture office or visit krishi.kar.nic.in for soil testing',
        eligibility: 'Free for all farmers every 2 years',
      }
    },
    {
      name: 'PM Kisan Maan Dhan Yojana (Pension)',
      shortName: 'Pension',
      icon: '👴',
      status: 'eligible',
      details: {
        description: 'Old age pension scheme for small and marginal farmers',
        benefit: 'Monthly pension of ₹3,000 after age 60',
        action: 'Contribute ₹55-200/month based on age. Enroll before age 40.',
        eligibility: 'For farmers aged 18-40 with landholding up to 2 hectares',
      }
    },
  ];

  const getStatusColor = (status: Scheme['status']) => {
    switch (status) {
      case 'enrolled':
        return 'from-green-50 to-green-100 border-green-300';
      case 'eligible':
        return 'from-blue-50 to-blue-100 border-blue-300';
      case 'action_required':
        return 'from-orange-50 to-orange-100 border-orange-300';
      case 'not_eligible':
        return 'from-gray-50 to-gray-100 border-gray-300';
    }
  };

  const getStatusBadge = (status: Scheme['status']) => {
    switch (status) {
      case 'enrolled':
        return { text: '✓ Enrolled', color: 'bg-green-500 text-white' };
      case 'eligible':
        return { text: 'Eligible', color: 'bg-blue-500 text-white' };
      case 'action_required':
        return { text: '! Action Required', color: 'bg-orange-500 text-white' };
      case 'not_eligible':
        return { text: 'Not Eligible', color: 'bg-gray-400 text-white' };
    }
  };

  const enrolledCount = schemes.filter(s => s.status === 'enrolled').length;
  const eligibleCount = schemes.filter(s => s.status === 'eligible').length;
  const actionRequiredCount = schemes.filter(s => s.status === 'action_required').length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            🏛️ Government Schemes Status
          </h2>
          <p className="text-sm text-gray-600">
            Your eligibility and enrollment status
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Farmer ID</div>
          <div className="font-semibold text-gray-900">{farmer.id}</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">{enrolledCount}</div>
          <div className="text-xs text-green-700">Enrolled</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{eligibleCount}</div>
          <div className="text-xs text-blue-700">Eligible</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{actionRequiredCount}</div>
          <div className="text-xs text-orange-700">Action Needed</div>
        </div>
      </div>

      {/* Schemes List */}
      <div className="space-y-4">
        {schemes.map((scheme, index) => {
          const badge = getStatusBadge(scheme.status);

          return (
            <div
              key={index}
              className={`p-4 bg-gradient-to-r ${getStatusColor(scheme.status)} border-2 rounded-lg transition-all hover:shadow-md`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-start space-x-3">
                  <div className="text-3xl">{scheme.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{scheme.shortName}</h3>
                    <p className="text-xs text-gray-600">{scheme.name}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                  {badge.text}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-2">{scheme.details.description}</p>

              <div className="text-sm">
                <div className="flex items-start space-x-2 mb-2">
                  <span className="text-green-600 font-semibold">💵 Benefit:</span>
                  <span className="text-gray-800">{scheme.details.benefit}</span>
                </div>

                {scheme.details.payment && (
                  <div className="mt-3 p-3 bg-white bg-opacity-50 rounded border border-green-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-semibold text-gray-900 ml-2">{scheme.details.payment.amount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Frequency:</span>
                        <span className="font-semibold text-gray-900 ml-2">{scheme.details.payment.frequency}</span>
                      </div>
                      {scheme.details.payment.lastPayment && (
                        <div>
                          <span className="text-gray-600">Last Payment:</span>
                          <span className="font-semibold text-gray-900 ml-2">{scheme.details.payment.lastPayment}</span>
                        </div>
                      )}
                      {scheme.details.payment.nextPayment && (
                        <div>
                          <span className="text-gray-600">Next Payment:</span>
                          <span className="font-semibold text-green-600 ml-2">{scheme.details.payment.nextPayment}</span>
                        </div>
                      )}
                    </div>
                    {scheme.details.payment.totalReceived && (
                      <div className="mt-2 pt-2 border-t border-green-200 text-xs">
                        <span className="text-gray-600">Total Received:</span>
                        <span className="font-bold text-green-600 ml-2">{scheme.details.payment.totalReceived}</span>
                      </div>
                    )}
                  </div>
                )}

                {scheme.details.action && (
                  <div className="mt-2 flex items-start space-x-2">
                    <span className="text-orange-600 font-semibold">📋 Action:</span>
                    <span className="text-gray-800">{scheme.details.action}</span>
                  </div>
                )}

                {scheme.details.deadline && (
                  <div className="mt-2 flex items-start space-x-2">
                    <span className="text-red-600 font-semibold">⏰ Deadline:</span>
                    <span className="text-gray-800">{scheme.details.deadline}</span>
                  </div>
                )}

                {scheme.details.eligibility && (
                  <div className="mt-2 flex items-start space-x-2">
                    <span className="text-blue-600 font-semibold">ℹ️ Details:</span>
                    <span className="text-gray-700 text-xs">{scheme.details.eligibility}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg">
        <div className="text-sm font-semibold text-purple-800 mb-2">
          📞 Need Help with Schemes?
        </div>
        <div className="text-sm text-purple-900 space-y-1">
          <p>• Visit your nearest Agriculture Office</p>
          <p>• Call PM-KISAN Helpline: <span className="font-semibold">155261 / 011-24300606</span></p>
          <p>• Portal: <a href="https://pmkisan.gov.in" target="_blank" rel="noopener noreferrer" className="underline">pmkisan.gov.in</a></p>
          <p>• Crop Insurance: <a href="https://pmfby.gov.in" target="_blank" rel="noopener noreferrer" className="underline">pmfby.gov.in</a></p>
        </div>
      </div>
    </div>
  );
}
