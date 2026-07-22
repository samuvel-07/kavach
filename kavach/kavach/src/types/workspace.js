/**
 * @typedef {"Open" | "Investigation" | "Chargesheet" | "Closed"} CaseStatus
 * @typedef {"Low" | "Medium" | "High" | "Critical"} CasePriority
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} date
 * @property {string} event
 * @property {string} [details]
 */

/**
 * @typedef {Object} Evidence
 * @property {string} type - e.g. "Knife", "CCTV", "Fingerprints", "DNA"
 * @property {string} status - e.g. "Collected", "Uploaded", "Matched"
 * @property {string} [detail] - e.g. "Forensic Complete", "4 Files", "98%"
 */

/**
 * @typedef {Object} Accused
 * @property {string} name
 * @property {number} age
 * @property {string} alias
 * @property {string} gang
 * @property {boolean} repeatOffender
 * @property {number} cases
 * @property {string} risk - e.g. "High", "Medium"
 * @property {string} status - e.g. "Arrested", "Absconding"
 */

/**
 * @typedef {Object} RelatedCase
 * @property {string} id
 * @property {number} confidence
 * @property {string[]} reasons
 */

/**
 * @typedef {Object} OfficerNote
 * @property {string} officer
 * @property {string} note
 * @property {string} timestamp
 */

/**
 * @typedef {Object} InvestigationWorkspace
 * @property {string} caseId
 * @property {string} crimeNumber
 * @property {string} firNumber
 * @property {string} policeStation
 * @property {string} district
 * @property {string} crimeType
 * @property {CaseStatus} status
 * @property {CasePriority} priority
 * @property {string} officer
 * @property {string} firDate
 * @property {Accused[]} accused
 * @property {any[]} victims
 * @property {Evidence[]} evidence
 * @property {any[]} vehicles
 * @property {any[]} phones
 * @property {any[]} locations
 * @property {any[]} documents
 * @property {TimelineEvent[]} timeline
 * @property {RelatedCase[]} relatedCases
 * @property {OfficerNote[]} notes
 */

export {};
