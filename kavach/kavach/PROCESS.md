# KAVACH: Crime Intelligence Assistant for Karnataka State Police

## 1. What is Kavach?
KAVACH is an advanced, AI-driven crime intelligence platform designed specifically for the Karnataka State Police. It acts as an interactive assistant that allows police investigators to query complex FIR (First Information Report) databases using everyday natural language (English or Kannada), bypassing the need for complex SQL or database administration knowledge.

## 2. The Core Use Case
Historically, extracting insights from sprawling crime databases requires technical personnel to write custom SQL queries. This creates a bottleneck during active investigations where speed is critical. 
**KAVACH solves this** by empowering investigating officers (IOs) and supervisors to instantly ask questions like:
- *"Show me all chain snatching cases in Mysuru from last month."*
- *"Who are the repeat offenders for heinous crimes in Bengaluru City?"*
- *"Which officer has filed the most chargesheets this year?"*

The system immediately translates these questions into actionable data, network graphs, and map visualizations.

## 3. The Process: How It Works

Kavach operates on a sophisticated pipeline that bridges natural language and structured databases using Large Language Models (LLMs).

### Step 1: User Input
The investigator types a question into the Kavach Chat interface. The system supports multi-turn conversations (English and Kannada), meaning it remembers context from previous questions.

### Step 2: Natural Language to SQL Translation (NL→SQL)
The backend (Node.js/Express running on Zoho Catalyst) receives the question and sends it to the **Zoho QuickML GLM Model**.
The model is prompted with a strict set of rules and database schemas to translate the user's question into **ZCQL** (Zoho Catalyst Query Language). 

### Step 3: Secure Execution & Self-Correction
The backend validates the generated ZCQL to ensure it only performs safe `SELECT` operations and complies with strict system guardrails. 
If the query fails (e.g., due to a syntax error), the system utilizes a **Self-Correction Loop**, automatically feeding the error back to the LLM to fix the query and try again seamlessly without user intervention.

### Step 4: Answer Synthesis
Once the data rows are retrieved from the Catalyst Datastore, the results are sent *back* to the LLM. 
The LLM acts as a data analyst, reading the raw JSON rows and synthesizing a concise, factual, and direct answer for the investigator (e.g., *"There are 15 chain snatching cases in Mysuru. Key Crime numbers include..."*).

### Step 5: Rich UI Presentation
The frontend (React) receives the synthesized text answer, the raw data rows, and the evidence (Case IDs/Crime Numbers). It presents this to the user in a highly interactive format.

## 4. Key Features & Modules

- **Conversational Chat Interface:** The primary interaction method. Officers can chat naturally, and the system cites its sources by linking directly to Case IDs.
- **Criminal Network Graphing:** Automatically maps out criminal syndicates and repeat offenders. It visually connects accused individuals based on shared case numbers, highlighting high-risk offenders and allowing officers to toggle isolated repeat offenders.
- **Geospatial Map View:** Plots crime coordinates on a map to identify hotspots and spatial patterns across districts.
- **Analytics Dashboard:** Provides aggregated statistics (crimes by month, by district, by status) for supervisory oversight.
- **Automated PDF Export:** Allows investigators to compile their chat history, SQL evidence, and findings into an official "Intelligence Report" PDF for offline sharing and court presentations.

## 5. Development Roadmap

### Phase 1
├── **Intelligence Layer**
│   ├── AI Insight Cards
│   ├── Investigation Summary
│   ├── Suggested Follow-up Queries
│   └── Confidence Score

### Phase 2
├── **Investigation Workspace**
│   ├── Timeline
│   ├── Evidence Explorer
│   ├── Related Cases
│   ├── Notes
│   └── Case Comparison

### Phase 3
├── **Intelligence Engine**
│   ├── Pattern Detection
│   ├── Repeat Offender Alerts
│   ├── Crime Prediction
│   └── Smart Recommendations

### Phase 4
├── **Enterprise**
│   ├── Role Based Access
│   ├── Audit
│   ├── Report Builder
│   ├── Notification Center
│   └── Mobile Support
