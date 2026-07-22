/**
 * @typedef {"pattern" | "warning" | "recommendation" | "hotspot" | "repeat_offender"} InsightType
 */

/**
 * @typedef {"low" | "medium" | "high"} InsightSeverity
 */

/**
 * @typedef {Object} IntelligenceInsight
 * @property {string} id - Unique identifier for the insight
 * @property {string} title - Short title for the insight card
 * @property {string} description - Detailed description or metric
 * @property {InsightType} type - The category of the insight
 * @property {number} confidence - AI confidence percentage (0-100)
 * @property {InsightSeverity} severity - Visual severity level
 * @property {string} icon - Emoji or icon class to display
 * @property {Record<string, unknown>} [metadata] - Optional extra data
 */

export {};
