import React, { useMemo, useState } from 'react';
import { InspectionData } from '../types';

interface AnalyticsDashboardProps {
    historyList: InspectionData[];
    isLoading: boolean;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ historyList, isLoading }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
    
    const metrics = useMemo(() => {
        if (!historyList.length) return null;

        const total = historyList.length;
        const criticalCount = historyList.filter(h => Number(h.rate) <= 2).length;
        const warningCount = historyList.filter(h => Number(h.rate) === 3).length;
        const goodCount = historyList.filter(h => Number(h.rate) >= 4).length;
        
        const passRateNum = (goodCount / total) * 100;
        const passRate = passRateNum.toFixed(1);
        
        const truckFailures: Record<string, number> = {};
        const driverScores: Record<string, number> = {};
        
        // Systemic Risk Categorization Logic
        const risks = {
            'Mechanical & Braking': 0,
            'Tyres & Wheels': 0,
            'Documentation & PPE': 0,
            'Electrical & Lights': 0,
            'Visibility & Body': 0,
            'Fluid Leaks & Environmental': 0
        };

        historyList.forEach(h => {
            const rate = Number(h.rate);
            
            // 1. Failure tracking
            if (rate <= 3) {
                truckFailures[h.truckNo] = (truckFailures[h.truckNo] || 0) + 1;
            }
            
            // 2. Deep Dive: Systemic Risk Parsing
            Object.entries(h).forEach(([key, val]) => {
                if (val === 'Bad' || val === 'Needs Attention') {
                    const k = key.toLowerCase();
                    if (k.includes('brake') || k.includes('mech') || k.includes('fifth') || k.includes('landing')) 
                        risks['Mechanical & Braking']++;
                    else if (k.includes('tyre') || k.includes('wheel') || k.includes('nut')) 
                        risks['Tyres & Wheels']++;
                    else if (k.includes('road') || k.includes('doc') || k.includes('suit') || k.includes('gear') || k.includes('ppe') || k.includes('manual')) 
                        risks['Documentation & PPE']++;
                    else if (k.includes('light') || k.includes('lamp') || k.includes('indica') || k.includes('horn') || k.includes('elec') || k.includes('ignit')) 
                        risks['Electrical & Lights']++;
                    else if (k.includes('wind') || k.includes('mirror') || k.includes('screen') || k.includes('cab') || k.includes('body')) 
                        risks['Visibility & Body']++;
                    else if (k.includes('leak') || k.includes('spill') || k.includes('fluid') || k.includes('oil')) 
                        risks['Fluid Leaks & Environmental']++;
                }
            });

            // 3. Leaderboard Scoring
            if (h.driverName) {
                const score = rate === 5 ? 10 : rate === 4 ? 5 : rate === 3 ? -5 : -20;
                driverScores[h.driverName] = (driverScores[h.driverName] || 0) + score;
            }
        });

        const totalFaults = Object.values(risks).reduce((a, b) => a + b, 0);
        const sortedRisks = Object.entries(risks)
            .map(([label, count]) => ({ 
                label, 
                count, 
                pct: totalFaults > 0 ? (count / totalFaults) * 100 : 0 
            }))
            .sort((a, b) => b.count - a.count);

        const leaderboard = Object.entries(driverScores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        // 5. Condition Distribution
        const conditionDistribution = [
            { label: 'Exemplary (5/5)', count: historyList.filter(h => Number(h.rate) === 5).length, color: 'bg-emerald-600' },
            { label: 'Good (4/5)', count: historyList.filter(h => Number(h.rate) === 4).length, color: 'bg-emerald-400' },
            { label: 'Serviceable (3/5)', count: warningCount, color: 'bg-amber-400' },
            { label: 'Immediate Action (1-2/5)', count: criticalCount, color: 'bg-rose-500' },
        ];

        return { 
            total, criticalCount, warningCount, goodCount, passRate, passRateNum, 
            sortedRisks, leaderboard, conditionDistribution, totalFaults 
        };
    }, [historyList]);

    const handleGenerateSummary = () => {
        if (!metrics) return;
        setIsGenerating(true);
        setTimeout(() => {
            const pRate = metrics.passRateNum;
            const topRisk = metrics.sortedRisks[0];
            
            let healthStatus = "";
            if (pRate >= 90) healthStatus = "The fleet is operating at peak safety compliance.";
            else if (pRate >= 75) healthStatus = "Overall fleet health is stable, though minor maintenance trends are emerging.";
            else healthStatus = "CRITICAL: The fleet safety rating has fallen below acceptable thresholds.";

            const riskText = topRisk && topRisk.count > 0 
                ? `The systemic analysis identifies '${topRisk.label}' as the primary source of safety downgrades, accounting for ${topRisk.pct.toFixed(0)}% of all recorded faults.`
                : "No significant systemic failure patterns detected.";

            const summary = `EXECUTIVE BRIEFING:
${healthStatus} Out of ${metrics.total} audits, ${metrics.goodCount} were satisfactory.

SYSTEMIC ANALYSIS:
${riskText}

STRATEGY:
1. Prioritize preventative maintenance on ${topRisk?.label || 'critical systems'}.
2. Reinforce compliance standards for underperforming domains.
3. Review driver pre-trip inspection diligence for high-frequency fault areas.`;

            setAnalysisSummary(summary);
            setIsGenerating(false);
        }, 600);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Fleet Intelligence...</p>
            </div>
        );
    }

    if (!metrics) return (
        <div className="py-24 text-center">
            <p className="text-slate-400 font-medium text-sm italic">Insufficient data to generate analytics report.</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn font-sans pb-24 px-4 md:px-0">
            <div className="flex justify-between items-end px-2">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Fleet Insights</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Safety & Risk Intelligence</p>
                </div>
                <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Analytics Engine v3.0</span>
                </div>
            </div>

            {/* 1. KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Audits</p>
                    <h3 className="text-4xl font-black text-slate-900">{metrics.total}</h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Pass Rate</p>
                    <h3 className="text-4xl font-black text-emerald-600">{metrics.passRate}%</h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Warnings</p>
                    <h3 className="text-4xl font-black text-amber-600">{metrics.warningCount}</h3>
                </div>
                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 shadow-sm">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Grounded</p>
                    <h3 className="text-4xl font-black text-rose-600">{metrics.criticalCount}</h3>
                </div>
            </div>

            {/* 2. Safety Leaderboard Module */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="max-w-md text-center md:text-left">
                        <h4 className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em] mb-4">Safety Excellence Leaderboard</h4>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">Recognizing outstanding safety standards. Points are aggregated from deterministic vehicle health scores.</p>
                    </div>

                    <div className="flex items-end gap-2 sm:gap-6 pt-10">
                        {/* 2nd Place */}
                        {metrics.leaderboard[1] && (
                            <div className="flex flex-col items-center group">
                                <div className="w-12 h-12 bg-slate-400/20 rounded-full border border-slate-400/30 flex items-center justify-center font-black text-slate-300 mb-2 group-hover:scale-110 transition-transform">2</div>
                                <div className="w-20 sm:w-28 h-20 sm:h-24 bg-gradient-to-t from-slate-400/20 to-slate-400/40 rounded-t-2xl border-x border-t border-slate-400/20 p-4 text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase truncate">{metrics.leaderboard[1][0]}</p>
                                    <p className="text-xs font-black text-white mt-1">{metrics.leaderboard[1][1]} pts</p>
                                </div>
                            </div>
                        )}
                        {/* 1st Place */}
                        {metrics.leaderboard[0] && (
                            <div className="flex flex-col items-center group">
                                <div className="w-16 h-16 bg-amber-500/20 rounded-full border border-amber-500/40 flex items-center justify-center font-black text-amber-400 mb-2 shadow-[0_0_20px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform">1</div>
                                <div className="w-24 sm:w-32 h-28 sm:h-36 bg-gradient-to-t from-amber-500/20 to-amber-500/40 rounded-t-2xl border-x border-t border-amber-500/30 p-4 text-center">
                                    <p className="text-[10px] font-black text-amber-300 uppercase truncate">{metrics.leaderboard[0][0]}</p>
                                    <p className="text-lg font-black text-white mt-1">{metrics.leaderboard[0][1]} pts</p>
                                    <div className="mt-3 flex justify-center"><svg className="w-4 h-4 text-amber-400 animate-bounce" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg></div>
                                </div>
                            </div>
                        )}
                        {/* 3rd Place */}
                        {metrics.leaderboard[2] && (
                            <div className="flex flex-col items-center group">
                                <div className="w-12 h-12 bg-orange-800/20 rounded-full border border-orange-800/30 flex items-center justify-center font-black text-orange-400 mb-2 group-hover:scale-110 transition-transform">3</div>
                                <div className="w-20 sm:w-28 h-16 sm:h-20 bg-gradient-to-t from-orange-800/20 to-orange-800/40 rounded-t-2xl border-x border-t border-orange-800/20 p-4 text-center">
                                    <p className="text-[8px] font-black text-orange-300 uppercase truncate">{metrics.leaderboard[2][0]}</p>
                                    <p className="text-xs font-black text-white mt-1">{metrics.leaderboard[2][1]} pts</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Distribution and Systemic Risk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Risk Distribution Card */}
                <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        Asset Condition Profile
                    </h4>
                    <div className="space-y-6">
                        {metrics.conditionDistribution.map((row, idx) => {
                            const pct = ((row.count / metrics.total) * 100).toFixed(0);
                            return (
                                <div key={idx} className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-tighter">
                                        <span>{row.label}</span>
                                        <span className="text-slate-900">{row.count} Units ({pct}%)</span>
                                    </div>
                                    <div className="h-3 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                                        <div className={`h-full ${row.color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* NEW FEATURE: Systemic Risk Profile */}
                <div className="bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Systemic Risk Profile</h4>
                        <span className="text-[8px] font-black bg-white/10 px-2 py-1 rounded text-slate-400 uppercase tracking-widest">Fault Frequency</span>
                    </div>
                    
                    <div className="flex-1 space-y-6 relative z-10 overflow-y-auto pr-2 scrollbar-hide">
                        {metrics.totalFaults > 0 ? (
                            metrics.sortedRisks.map((risk, idx) => (
                                <div key={idx} className="space-y-2 group">
                                    <div className="flex justify-between items-end">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white transition-colors">{risk.label}</p>
                                        <p className="text-[10px] font-bold text-indigo-400">{risk.count} Faults</p>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000 ease-out" 
                                            style={{ width: `${risk.pct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-40 flex items-center justify-center">
                                <p className="text-slate-500 italic text-sm text-center px-6">No systemic safety failures identified in active registry.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-6 border-t border-white/5 pt-4">Root-Cause Intelligence Hub v3.0 (Pattern Logic)</p>
                </div>
            </div>

            {/* 4. Executive Briefing Area */}
            <div className="space-y-6">
                <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h4 className="font-black text-lg uppercase tracking-tight leading-none">Management Briefing</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cross-Fleet Logic Aggregator</p>
                    </div>
                    <button 
                        onClick={handleGenerateSummary}
                        disabled={isGenerating}
                        className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:bg-slate-200"
                    >
                        {isGenerating ? 'Analyzing Patterns...' : 'Generate Executive Brief'}
                    </button>
                </div>

                {analysisSummary && (
                    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl animate-fadeIn">
                        <div className="prose prose-slate max-w-none">
                            <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed text-sm">
                                {analysisSummary}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;