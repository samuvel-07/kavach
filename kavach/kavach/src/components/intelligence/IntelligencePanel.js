import React from 'react';
import InsightCard from './InsightCard';
import RecommendationCard from './RecommendationCard';
import '../../intelligence.css';

export default function IntelligencePanel({ msg }) {
  const insights = msg?.insights || [];

  if (insights.length === 0) {
    return null; // Don't show if no insights
  }

  const standardInsights = insights.filter(i => i.type !== 'recommendation');
  const recommendations = insights.filter(i => i.type === 'recommendation');

  return (
    <div className="intel-panel">
      <div className="intel-panel-header">
        <span className="intel-sparkle">✨</span>
        <span className="intel-panel-title">AI Intelligence</span>
      </div>
      
      <div className="intel-panel-body">
        {standardInsights.map((insight, i) => (
          <InsightCard key={insight.id || i} insight={insight} />
        ))}
        
        {recommendations.map((insight, i) => (
          <RecommendationCard key={insight.id || i} insight={insight} />
        ))}
      </div>
    </div>
  );
}
