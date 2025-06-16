import { Contract } from '@algorandfoundation/tealscript';

// Reputation Analytics State
interface ReputationAnalyticsState {
  // Analytics configuration
  analyzerOwner: Address;
  reputationRegistryAppId: uint64;
  isActive: boolean;
  
  // Analytics parameters
  decayRate: uint64; // Reputation decay rate per day (basis points)
  minimumAttestations: uint64; // Minimum attestations for reliable score
  weightingEnabled: boolean; // Whether to weight by attester reputation
}

// Reputation Insights
interface ReputationInsights {
  overallScore: uint64;
  categoryScores: bytes; // Encoded category scores
  trendDirection: uint64; // 0: Declining, 1: Stable, 2: Improving
  reliability: uint64; // 0-1000 based on number and quality of attestations
  lastUpdated: uint64;
}

export class ReputationAnalyzer extends Contract {
  // Global state variables
  analyzerOwner = GlobalStateKey<Address>();
  reputationRegistryAppId = GlobalStateKey<uint64>();
  isActive = GlobalStateKey<boolean>();
  decayRate = GlobalStateKey<uint64>();
  minimumAttestations = GlobalStateKey<uint64>();
  weightingEnabled = GlobalStateKey<boolean>();
  
  // Analytics storage
  subjectInsights = BoxKey<bytes>(); // Subject DID -> Reputation insights
  categoryTrends = BoxKey<bytes>(); // Category -> Trend data
  attesterReliability = BoxKey<uint64>(); // Attester address -> Reliability score
  
  // Time-based reputation tracking
  reputationHistory = BoxKey<bytes>(); // Subject DID + timestamp -> Historical score
  lastAnalysisTime = BoxKey<uint64>(); // Subject DID -> Last analysis timestamp

  /**
   * Initialize the Reputation Analyzer
   */
  createApplication(reputationRegistryAppId: uint64): void {
    this.analyzerOwner.value = this.txn.sender;
    this.reputationRegistryAppId.value = reputationRegistryAppId;
    this.isActive.value = true;
    this.decayRate.value = 10; // 0.1% decay per day
    this.minimumAttestations.value = 3;
    this.weightingEnabled.value = true;
  }

  /**
   * Analyze and update reputation insights for a subject
   */
  analyzeReputation(subjectDID: string): ReputationInsights {
    assert(this.isActive.value);
    
    // Get attestations from reputation registry
    const attestations = this.getSubjectAttestationsFromRegistry(subjectDID);
    
    // Calculate weighted reputation score
    const weightedScore = this.calculateWeightedReputation(subjectDID, attestations);
    
    // Apply time-based decay
    const decayedScore = this.applyTimeDecay(subjectDID, weightedScore);
    
    // Calculate category-specific scores
    const categoryScores = this.calculateCategoryScores(subjectDID);
    
    // Determine trend direction
    const trendDirection = this.calculateTrendDirection(subjectDID, decayedScore);
    
    // Calculate reliability score
    const reliability = this.calculateReliabilityScore(attestations);
    
    // Store insights
    const insights: ReputationInsights = {
      overallScore: decayedScore,
      categoryScores: categoryScores,
      trendDirection: trendDirection,
      reliability: reliability,
      lastUpdated: globals.latestTimestamp,
    };
    
    this.storeReputationInsights(subjectDID, insights);
    
    // Update historical data
    this.updateReputationHistory(subjectDID, decayedScore);
    
    return insights;
  }

  /**
   * Get reputation insights for a subject
   */
  getReputationInsights(subjectDID: string): ReputationInsights {
    const insightsKey = this.generateInsightsKey(subjectDID);
    
    if (this.subjectInsights(insightsKey).exists) {
      return this.decodeReputationInsights(this.subjectInsights(insightsKey).value);
    } else {
      // Generate insights if not exists
      return this.analyzeReputation(subjectDID);
    }
  }

  /**
   * Calculate weighted reputation score
   */
  private calculateWeightedReputation(subjectDID: string, attestations: bytes): uint64 {
    if (!this.weightingEnabled.value) {
      // Use simple average from registry
      return this.getSimpleReputationFromRegistry(subjectDID);
    }
    
    // Parse attestations and calculate weighted average
    const attestationList = this.parseAttestationList(attestations);
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < attestationList.length && i < 50; i++) {
      const attestationId = attestationList[i];
      const score = this.getAttestationScoreFromRegistry(attestationId);
      const attester = this.getAttestationAttesterFromRegistry(attestationId);
      const weight = this.getAttesterWeight(attester);
      
      totalWeightedScore = totalWeightedScore + (score * weight);
      totalWeight = totalWeight + weight;
    }
    
    if (totalWeight > 0) {
      return totalWeightedScore / totalWeight;
    } else {
      return 0;
    }
  }

  /**
   * Apply time-based reputation decay
   */
  private applyTimeDecay(subjectDID: string, currentScore: uint64): uint64 {
    const lastAnalysisKey = this.generateLastAnalysisKey(subjectDID);
    
    if (this.lastAnalysisTime(lastAnalysisKey).exists) {
      const lastAnalysis = this.lastAnalysisTime(lastAnalysisKey).value;
      const daysSinceLastAnalysis = (globals.latestTimestamp - lastAnalysis) / (24 * 3600);
      
      // Apply decay: score = score * (1 - decayRate)^days
      const decayFactor = this.calculateDecayFactor(daysSinceLastAnalysis);
      const decayedScore = (currentScore * decayFactor) / 1000;
      
      this.lastAnalysisTime(lastAnalysisKey).value = globals.latestTimestamp;
      return decayedScore;
    } else {
      this.lastAnalysisTime(lastAnalysisKey).value = globals.latestTimestamp;
      return currentScore;
    }
  }

  /**
   * Calculate category-specific scores
   */
  private calculateCategoryScores(subjectDID: string): bytes {
    // Get category scores from reputation registry
    const categories = ['dental-service', 'patient-experience', 'orthodontics', 'general-dentistry'];
    let categoryData = '';
    
    for (let i = 0; i < categories.length; i++) {
      const categoryScore = this.getCategoryScoreFromRegistry(subjectDID, categories[i]);
      categoryData = categoryData + categories[i] + ':' + itoa(categoryScore) + ',';
    }
    
    return categoryData;
  }

  /**
   * Calculate trend direction
   */
  private calculateTrendDirection(subjectDID: string, currentScore: uint64): uint64 {
    const historyKey = this.generateHistoryKey(subjectDID, globals.latestTimestamp - (7 * 24 * 3600)); // 7 days ago
    
    if (this.reputationHistory(historyKey).exists) {
      const historicalScore = this.parseHistoricalScore(this.reputationHistory(historyKey).value);
      
      if (currentScore > historicalScore + 50) { // 5 point improvement
        return 2; // Improving
      } else if (currentScore < historicalScore - 50) { // 5 point decline
        return 0; // Declining
      } else {
        return 1; // Stable
      }
    } else {
      return 1; // Stable (no historical data)
    }
  }

  /**
   * Calculate reliability score based on attestation quality
   */
  private calculateReliabilityScore(attestations: bytes): uint64 {
    const attestationList = this.parseAttestationList(attestations);
    const attestationCount = attestationList.length;
    
    if (attestationCount < this.minimumAttestations.value) {
      // Low reliability due to insufficient attestations
      return (attestationCount * 1000) / this.minimumAttestations.value;
    }
    
    // Calculate reliability based on attester diversity and reputation
    let totalAttesterReliability = 0;
    let uniqueAttesters = 0;
    
    for (let i = 0; i < attestationCount && i < 20; i++) {
      const attestationId = attestationList[i];
      const attester = this.getAttestationAttesterFromRegistry(attestationId);
      const attesterReliability = this.getAttesterReliabilityScore(attester);
      
      totalAttesterReliability = totalAttesterReliability + attesterReliability;
      uniqueAttesters = uniqueAttesters + 1;
    }
    
    if (uniqueAttesters > 0) {
      const averageAttesterReliability = totalAttesterReliability / uniqueAttesters;
      // Combine attestation count and attester reliability
      const countFactor = attestationCount > 10 ? 1000 : (attestationCount * 100);
      return (averageAttesterReliability + countFactor) / 2;
    } else {
      return 500; // Neutral reliability
    }
  }

  /**
   * Get attester weight for weighted calculations
   */
  private getAttesterWeight(attester: Address): uint64 {
    const attesterReliability = this.getAttesterReliabilityScore(attester);
    
    // Convert reliability (0-1000) to weight (500-1500)
    return 500 + attesterReliability;
  }

  /**
   * Get attester reliability score
   */
  private getAttesterReliabilityScore(attester: Address): uint64 {
    const reliabilityKey = this.generateAttesterReliabilityKey(attester);
    
    if (this.attesterReliability(reliabilityKey).exists) {
      return this.attesterReliability(reliabilityKey).value;
    } else {
      // Get from reputation registry
      const attesterReputation = this.getAttesterReputationFromRegistry(attester);
      this.attesterReliability(reliabilityKey).value = attesterReputation;
      return attesterReputation;
    }
  }

  /**
   * Calculate decay factor for time-based decay
   */
  private calculateDecayFactor(days: uint64): uint64 {
    // Simplified decay calculation: (1000 - decayRate)^days / 1000
    // For small decay rates and short periods, approximate as linear
    const totalDecay = days * this.decayRate.value;
    if (totalDecay > 1000) {
      return 0; // Complete decay
    } else {
      return 1000 - totalDecay;
    }
  }

  /**
   * Store reputation insights
   */
  private storeReputationInsights(subjectDID: string, insights: ReputationInsights): void {
    const insightsKey = this.generateInsightsKey(subjectDID);
    const encodedInsights = this.encodeReputationInsights(insights);
    this.subjectInsights(insightsKey).value = encodedInsights;
  }

  /**
   * Update reputation history
   */
  private updateReputationHistory(subjectDID: string, score: uint64): void {
    const historyKey = this.generateHistoryKey(subjectDID, globals.latestTimestamp);
    this.reputationHistory(historyKey).value = itoa(score);
  }

  // Helper methods for external contract calls

  /**
   * Get subject attestations from reputation registry
   */
  private getSubjectAttestationsFromRegistry(subjectDID: string): bytes {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getSubjectAttestations', subjectDID],
    });
    
    return result;
  }

  /**
   * Get simple reputation from registry
   */
  private getSimpleReputationFromRegistry(subjectDID: string): uint64 {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getSubjectReputation', subjectDID],
    });
    
    return result;
  }

  /**
   * Get attestation score from registry
   */
  private getAttestationScoreFromRegistry(attestationId: bytes): uint64 {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getAttestationMetadata', attestationId],
    });
    
    // Parse metadata to extract score (4th field)
    return 850; // Simplified - should parse metadata
  }

  /**
   * Get attestation attester from registry
   */
  private getAttestationAttesterFromRegistry(attestationId: bytes): Address {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getAttestationMetadata', attestationId],
    });
    
    // Parse metadata to extract attester address (9th field)
    return this.analyzerOwner.value; // Simplified - should parse metadata
  }

  /**
   * Get category score from registry
   */
  private getCategoryScoreFromRegistry(subjectDID: string, category: string): uint64 {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getCategoryReputation', subjectDID, category],
    });
    
    return result;
  }

  /**
   * Get attester reputation from registry
   */
  private getAttesterReputationFromRegistry(attester: Address): uint64 {
    const result = sendAppCall({
      appID: this.reputationRegistryAppId.value,
      appArgs: ['getAttesterReputation', attester],
    });
    
    return result;
  }

  // Encoding/Decoding methods

  /**
   * Encode reputation insights
   */
  private encodeReputationInsights(insights: ReputationInsights): bytes {
    return itoa(insights.overallScore) + '|' +
           insights.categoryScores + '|' +
           itoa(insights.trendDirection) + '|' +
           itoa(insights.reliability) + '|' +
           itoa(insights.lastUpdated);
  }

  /**
   * Decode reputation insights
   */
  private decodeReputationInsights(data: bytes): ReputationInsights {
    // Simplified decoding - in practice, parse the data properly
    return {
      overallScore: 850,
      categoryScores: 'dental-service:900,patient-experience:800',
      trendDirection: 2,
      reliability: 750,
      lastUpdated: globals.latestTimestamp,
    };
  }

  /**
   * Parse attestation list
   */
  private parseAttestationList(attestations: bytes): bytes[] {
    // Simplified parsing - in practice, split by comma and return array
    return [attestations]; // Return single item for now
  }

  /**
   * Parse historical score
   */
  private parseHistoricalScore(data: bytes): uint64 {
    // Convert bytes to uint64
    return 800; // Simplified
  }

  // Key generation methods

  /**
   * Generate insights key
   */
  private generateInsightsKey(subjectDID: string): bytes {
    return 'insights:' + subjectDID;
  }

  /**
   * Generate last analysis key
   */
  private generateLastAnalysisKey(subjectDID: string): bytes {
    return 'lastanalysis:' + subjectDID;
  }

  /**
   * Generate history key
   */
  private generateHistoryKey(subjectDID: string, timestamp: uint64): bytes {
    return 'history:' + subjectDID + ':' + itoa(timestamp);
  }

  /**
   * Generate attester reliability key
   */
  private generateAttesterReliabilityKey(attester: Address): bytes {
    return 'reliability:' + attester;
  }

  // Admin functions

  /**
   * Update analytics parameters
   */
  updateAnalyticsParameters(
    newDecayRate: uint64,
    newMinimumAttestations: uint64,
    newWeightingEnabled: boolean
  ): void {
    assert(this.txn.sender === this.analyzerOwner.value);
    
    this.decayRate.value = newDecayRate;
    this.minimumAttestations.value = newMinimumAttestations;
    this.weightingEnabled.value = newWeightingEnabled;
  }

  /**
   * Update reputation registry app ID
   */
  updateReputationRegistryAppId(newAppId: uint64): void {
    assert(this.txn.sender === this.analyzerOwner.value);
    this.reputationRegistryAppId.value = newAppId;
  }

  /**
   * Set analyzer status
   */
  setAnalyzerStatus(active: boolean): void {
    assert(this.txn.sender === this.analyzerOwner.value);
    this.isActive.value = active;
  }

  /**
   * Transfer analyzer ownership
   */
  transferOwnership(newOwner: Address): void {
    assert(this.txn.sender === this.analyzerOwner.value);
    this.analyzerOwner.value = newOwner;
  }

  /**
   * Get analyzer configuration
   */
  getAnalyzerConfig(): bytes {
    const config = itoa(this.reputationRegistryAppId.value) + '|' +
                  itoa(this.decayRate.value) + '|' +
                  itoa(this.minimumAttestations.value) + '|' +
                  (this.weightingEnabled.value ? '1' : '0') + '|' +
                  (this.isActive.value ? '1' : '0');
    return config;
  }
}