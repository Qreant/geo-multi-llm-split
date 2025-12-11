import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import StepIndicator from './StepIndicator';
import BrandMarketsStep from './steps/BrandMarketsStep';
import DiscoveryLoading from './steps/DiscoveryLoading';
import CategoriesStep from './steps/CategoriesStep';
import CompetitorsStep from './steps/CompetitorsStep';
import ReputationPromptsStep from './steps/ReputationPromptsStep';
import CategoryPromptsStep from './steps/CategoryPromptsStep';
import ReviewStep from './steps/ReviewStep';

const STEPS = [
  { id: 'brand-markets', label: 'Brand & Markets' },
  { id: 'categories', label: 'Categories' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'reputation-prompts', label: 'Reputation' },
  { id: 'category-prompts', label: 'Category' },
  { id: 'review', label: 'Review' }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState({ current: 0, total: 0, message: '' });

  // Configuration state
  const [config, setConfig] = useState({
    entity: '',
    markets: [], // Start empty - user must add at least one market
    categoryFamilies: [],
    competitors: {}, // { [categoryId]: { [marketCode]: ['competitor1', 'competitor2'] } }
    reputationQuestions: {}, // { [marketCode]: [...questions] }
    categoryDetectionQuestions: {}, // { [marketCode]: [...questions] } - CAT_Q1-Q3 questions
    categoryQuestions: {} // { [marketCode]: { [categoryId]: { visibility, competitive } } }
  });

  // Error state
  const [error, setError] = useState(null);

  // Step 1 -> Discovery -> Step 2
  const handleBrandMarketsComplete = useCallback(async (entity, markets) => {
    setConfig(prev => ({ ...prev, entity, markets }));
    setIsDiscovering(true);
    setError(null);

    try {
      setDiscoveryProgress({ current: 0, total: markets.length + 1, message: 'Starting category discovery...' });

      const response = await api.post('/api/analysis/discover-categories', {
        entity,
        markets: markets.map(m => ({
          country: m.country,
          language: m.language,
          code: m.code,
          isPrimary: m.isPrimary
        }))
      });

      setDiscoveryProgress({ current: markets.length + 1, total: markets.length + 1, message: 'Discovery complete!' });

      // Build competitors map from suggested_competitors
      const suggestedCompetitors = {};
      response.data.category_families.forEach(cf => {
        if (cf.suggested_competitors) {
          suggestedCompetitors[cf.id] = cf.suggested_competitors;
        }
      });

      // Update config with discovered categories and pre-populated competitors
      setConfig(prev => ({
        ...prev,
        categoryFamilies: response.data.category_families.map(cf => ({
          ...cf,
          isSelected: true // Default all to selected
        })),
        competitors: suggestedCompetitors // Pre-populate from discovery
      }));

      // Move to categories step
      setTimeout(() => {
        setIsDiscovering(false);
        setCurrentStep(1);
      }, 500);

    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.response?.data?.error || err.message);
      setIsDiscovering(false);
    }
  }, []);

  // Step 2 -> Step 3
  const handleCategoriesComplete = useCallback((categoryFamilies) => {
    setConfig(prev => ({ ...prev, categoryFamilies }));
    setCurrentStep(2);
  }, []);

  // Step 3 -> Step 4
  const handleCompetitorsComplete = useCallback((competitors) => {
    setConfig(prev => ({ ...prev, competitors }));
    setCurrentStep(3);
  }, []);

  // Step 4 -> Step 5 (Reputation -> Category Prompts)
  const handleReputationPromptsComplete = useCallback(({ reputationQuestions, categoryDetectionQuestions }) => {
    setConfig(prev => ({ ...prev, reputationQuestions, categoryDetectionQuestions }));
    setCurrentStep(4);
  }, []);

  // Step 5 -> Step 6 (Category Prompts -> Review)
  const handleCategoryPromptsComplete = useCallback((categoryQuestions) => {
    setConfig(prev => ({ ...prev, categoryQuestions }));
    setCurrentStep(5);
  }, []);

  // Launch analysis
  const handleLaunchAnalysis = useCallback(async () => {
    try {
      setError(null);

      // Build the analysis request
      const selectedCategories = config.categoryFamilies.filter(cf => cf.isSelected);
      const selectedCategoryIds = new Set(selectedCategories.map(cf => cf.id));

      // Filter competitors to only include selected categories (to avoid FK constraint errors)
      const filteredCompetitors = {};
      Object.entries(config.competitors).forEach(([categoryId, marketCompetitors]) => {
        if (selectedCategoryIds.has(categoryId)) {
          filteredCompetitors[categoryId] = marketCompetitors;
        }
      });

      // Filter categoryQuestions to only include selected categories
      const filteredCategoryQuestions = {};
      Object.entries(config.categoryQuestions).forEach(([marketCode, marketQuestions]) => {
        filteredCategoryQuestions[marketCode] = {};
        Object.entries(marketQuestions || {}).forEach(([categoryId, questions]) => {
          if (selectedCategoryIds.has(categoryId)) {
            filteredCategoryQuestions[marketCode][categoryId] = questions;
          }
        });
      });

      const requestPayload = {
        entity: config.entity,
        markets: config.markets,
        categoryFamilies: selectedCategories,
        competitors: filteredCompetitors,
        reputationQuestions: config.reputationQuestions,
        categoryDetectionQuestions: config.categoryDetectionQuestions,
        categoryQuestions: filteredCategoryQuestions
      };

      console.log('Starting analysis with config:', requestPayload);

      const response = await api.post('/api/analysis/start-multi-market', requestPayload);

      navigate(`/report/${response.data.reportId}`);
    } catch (err) {
      console.error('Failed to start analysis:', err);
      setError(err.response?.data?.error || err.message);
    }
  }, [config, navigate]);

  // Navigation helpers
  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepIndex) => {
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep]);

  // Render discovery loading state
  if (isDiscovering) {
    return (
      <div className="max-w-3xl mx-auto">
        <DiscoveryLoading
          entity={config.entity}
          markets={config.markets}
          progress={discoveryProgress}
          error={error}
          onRetry={() => handleBrandMarketsComplete(config.entity, config.markets)}
          onCancel={() => {
            setIsDiscovering(false);
            setCurrentStep(0);
          }}
        />
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <BrandMarketsStep
            entity={config.entity}
            markets={config.markets}
            onComplete={handleBrandMarketsComplete}
          />
        );
      case 1:
        return (
          <CategoriesStep
            entity={config.entity}
            markets={config.markets}
            categoryFamilies={config.categoryFamilies}
            onComplete={handleCategoriesComplete}
            onBack={goBack}
          />
        );
      case 2:
        return (
          <CompetitorsStep
            entity={config.entity}
            markets={config.markets}
            categoryFamilies={config.categoryFamilies.filter(cf => cf.isSelected)}
            competitors={config.competitors}
            onComplete={handleCompetitorsComplete}
            onBack={goBack}
          />
        );
      case 3:
        return (
          <ReputationPromptsStep
            entity={config.entity}
            markets={config.markets}
            reputationQuestions={config.reputationQuestions}
            categoryDetectionQuestions={config.categoryDetectionQuestions}
            onComplete={handleReputationPromptsComplete}
            onBack={goBack}
          />
        );
      case 4:
        return (
          <CategoryPromptsStep
            entity={config.entity}
            markets={config.markets}
            categoryFamilies={config.categoryFamilies.filter(cf => cf.isSelected)}
            competitors={config.competitors}
            categoryQuestions={config.categoryQuestions}
            onComplete={handleCategoryPromptsComplete}
            onBack={goBack}
          />
        );
      case 5:
        return (
          <ReviewStep
            config={config}
            onLaunch={handleLaunchAnalysis}
            onBack={goBack}
            onEditStep={goToStep}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#212121] mb-2">Create New Analysis</h1>
        <p className="text-sm text-[#757575]">
          Configure your multi-market brand analysis
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={goToStep}
      />

      {/* Error Display */}
      {error && !isDiscovering && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Step Content */}
      {renderStep()}
    </div>
  );
}
