/**
 * Mock service to generate realistic Investigation Workspace data.
 */

/**
 * Fetch case workspace data.
 * @param {string} caseId
 * @returns {Promise<import('../types/workspace').InvestigationWorkspace>}
 */
export async function fetchWorkspaceData(caseId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Create some pseudo-random variations based on caseId
      const charCodeSum = caseId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const randIdx = charCodeSum % 3;

      const mockAccused = [
        [
          { name: "Rafiq Pasha", age: 28, alias: "Rafa", gang: "Bawariya Gang", repeatOffender: true, cases: 7, risk: "High", status: "Absconding" }
        ],
        [
          { name: "Sunil Kumar", age: 34, alias: "Suni", gang: "None", repeatOffender: false, cases: 1, risk: "Low", status: "Arrested" },
          { name: "Prakash M", age: 31, alias: "Pakki", gang: "None", repeatOffender: true, cases: 3, risk: "Medium", status: "Arrested" }
        ],
        [
          { name: "Unknown", age: null, alias: "None", gang: "Unknown", repeatOffender: false, cases: 0, risk: "Unknown", status: "Wanted" }
        ]
      ];

      const mockCrimeTypes = ["Robbery / Chain Snatching", "NDPS Trafficking", "Attempt to Murder"];
      const mockPriorities = ["High", "Medium", "Critical"];
      const mockOfficers = ["Inspector Kumar", "DSP Ravi", "Inspector Sharma"];

      resolve({
        caseId: caseId,
        crimeNumber: caseId,
        firNumber: `${caseId}/2025`,
        policeStation: "KR Puram PS",
        district: "Bengaluru City",
        crimeType: mockCrimeTypes[randIdx],
        status: "Investigation",
        priority: mockPriorities[randIdx],
        officer: mockOfficers[randIdx],
        firDate: "2025-01-14",
        accused: mockAccused[randIdx],
        victims: [],
        evidence: [
          { type: "Knife", status: "Collected", detail: "Forensic Complete" },
          { type: "CCTV", status: "Uploaded", detail: "4 Files" },
          { type: "Fingerprints", status: "Matched", detail: "98%" },
          { type: "DNA", status: "Pending", detail: "" }
        ],
        vehicles: [
          { registration: "KA03MX4421", type: "Honda Activa", relatedCases: 6 }
        ],
        phones: [],
        locations: [],
        documents: [],
        timeline: [
          { date: "Jan 14", event: "FIR Registered" },
          { date: "Jan 15", event: "Victim Statement" },
          { date: "Jan 16", event: "CCTV Uploaded" },
          { date: "Jan 18", event: "Accused Arrested" },
          { date: "Jan 22", event: "Chargesheet Filed", details: "Pending Trial" }
        ],
        relatedCases: [
          { id: "2344", confidence: 92, reasons: ["Same Bike", "Same Phone", "Same Area"] },
          { id: "1552", confidence: 87, reasons: ["Same Accused"] },
          { id: "8733", confidence: 82, reasons: ["Same MO"] }
        ],
        notes: [
          { officer: "DSP Ravi", note: "Need CCTV near KR Puram", timestamp: "2025-01-15 14:30" },
          { officer: "Inspector Kumar", note: "Vehicle traced", timestamp: "2025-01-16 09:15" }
        ]
      });
    }, 800); // simulate network
  });
}
