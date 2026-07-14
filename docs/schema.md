# KSP Police FIR Database — Schema Grounding Document

> Source: Karnataka Police Department ER Diagram (Datathon 2026 dataset).
> This file is the single source of truth for all NL→SQL generation, data
> generation, and API code. Reference it in every Antigravity task.

## Critical business rules

### CrimeNo format (18 digits)
`[1-digit CaseCategoryCode][4-digit DistrictID][4-digit PoliceStationID][4-digit Year][5-digit RunningSerial]`

- A separate running serial is maintained **per police station, per case category, per year**.
- Category codes: `1` = FIR, `3` = UDR, `4` = PAR, `8` = Zero FIR.
- Examples: FIR `104430006202600001`, UDR `304430006202600001`,
  Zero FIR `804430006202600001`, PAR `404430006202600001`.

### CaseNo format (9 digits)
`YYYY` + 5-digit running serial — i.e. the **last 9 digits of CrimeNo**.
Unique per police station, per case category, per year. Example: `202600001`.

### ChargesheetDetails.cstype (final report type)
`A` = Chargesheet, `B` = False Case, `C` = Undetected.

### Gender codes
`M` / `F` / `T` (stored as lookup GenderID in most tables; Accused.GenderID noted as M/F/T).

### Accused.PersonID
Sorting label within a case: `A1`, `A2`, `A3`, …

## Tables

### CaseMaster (core FIR table)
| Column | Type | Key | Notes |
|---|---|---|---|
| CaseMasterID | INT | PK | Unique FIR/case id |
| CrimeNo | VARCHAR | | 18-digit structured (see rules) |
| CaseNo | VARCHAR | | Last 9 digits of CrimeNo |
| CrimeRegisteredDate | DATE | | FIR registration date |
| PolicePersonID | INT | FK → Employee.EmployeeID | Registering officer |
| PoliceStationID | INT | FK → Unit.UnitID | Registering station |
| CaseCategoryID | INT | FK → CaseCategory.CaseCategoryID | FIR/UDR/PAR/Zero FIR |
| GravityOffenceID | INT | FK → GravityOffence.GravityOffenceID | Heinous / Non-Heinous |
| CrimeMajorHeadID | INT | FK → CrimeHead.CrimeHeadID | Major head |
| CrimeMinorHeadID | INT | FK → CrimeSubHead.CrimeSubHeadID | Sub-head |
| CaseStatusID | INT | FK → CaseStatusMaster.CaseStatusID | Current status |
| CourtID | INT | FK → Court.CourtID | Trial court |
| IncidentFromDate | DATETIME | | Incident start |
| IncidentToDate | DATETIME | | Incident end |
| InfoReceivedPSDate | DATETIME | | When PS was informed |
| latitude | DECIMAL | | Incident GPS lat |
| longitude | DECIMAL | | Incident GPS lon |
| BriefFacts | NVARCHAR(MAX) | | Case summary text |

### ComplainantDetails
ComplainantID (PK), CaseMasterID (FK→CaseMaster), ComplainantName, AgeYear,
OccupationID (FK→OccupationMaster), ReligionID (FK→ReligionMaster),
CasteID (FK→CasteMaster.caste_master_id), GenderID.

### Victim
VictimMasterID (PK), CaseMasterID (FK→CaseMaster), VictimName, AgeYear,
GenderID (M/F/T), VictimPolice (1 if victim is police, else 0).

### Accused
AccusedMasterID (PK), CaseMasterID (FK→CaseMaster), AccusedName, AgeYear,
GenderID (M/F/T), PersonID (A1, A2, ...).

### ArrestSurrender
ArrestSurrenderID (PK), CaseMasterID (FK→CaseMaster),
ArrestSurrenderTypeID (lookup: arrest vs surrender), ArrestSurrenderDate,
ArrestSurrenderStateId (FK→State), ArrestSurrenderDistrictId (FK→District),
PoliceStationID (FK→Unit), IOID (FK→Employee — investigating officer),
CourtID (FK→Court), AccusedMasterID (FK→Accused),
IsAccused (BIT), IsComplainantAccused (BIT).

### ActSectionAssociation (junction: case ↔ legal sections)
CaseMasterID (FK→CaseMaster), ActID (FK→Act.ActCode),
SectionID (FK→Section.SectionCode), ActOrderID, SectionOrderID.

### Act
ActCode (PK, VARCHAR e.g. 'BNS', 'NDPS'), ActDescription, ShortName, Active (BIT).

### Section
ActCode (FK→Act), SectionCode (e.g. '302', '307'), SectionDescription, Active.

### CrimeHead
CrimeHeadID (PK), CrimeGroupName (e.g. 'Crimes Against Body'), Active.

### CrimeSubHead
CrimeSubHeadID (PK), CrimeHeadID (FK→CrimeHead), CrimeHeadName
(e.g. 'Murder', 'Robbery'), SeqID.

### CrimeHeadActSection (junction: crime head ↔ act/section)
CrimeHeadID (FK→CrimeHead), ActCode (FK→Act), SectionCode.

### Lookup masters
- **CaseCategory**: CaseCategoryID (PK), LookupValue (FIR, UDR, PAR, Zero FIR)
- **GravityOffence**: GravityOffenceID (PK), LookupValue (Heinous, Non-Heinous)
- **CaseStatusMaster**: CaseStatusID (PK), CaseStatusName (Under Investigation, Charge Sheeted, Closed, ...)
- **OccupationMaster**: OccupationID (PK), OccupationName
- **ReligionMaster**: ReligionID (PK), ReligionName
- **CasteMaster**: caste_master_id (PK), caste_master_name
  ⚠ Note the snake_case PK name — only table that differs in convention.

### Geography & org structure
- **State**: StateID (PK), StateName, NationalityID, Active
- **District**: DistrictID (PK), DistrictName, StateID (FK→State), Active
- **Court**: CourtID (PK), CourtName, DistrictID (FK→District), StateID (FK→State), Active
- **UnitType**: UnitTypeID (PK), UnitTypeName (Police Station, Circle Office...), CityDistState, Hierarchy, Active
- **Unit** (police stations & offices): UnitID (PK), UnitName, TypeID (FK→UnitType),
  ParentUnit (self-ref → Unit.UnitID), NationalityID, StateID (FK), DistrictID (FK), Active
- **Rank**: RankID (PK), RankName (Constable, Inspector, DSP...), Hierarchy (lower = higher rank), Active
- **Designation**: DesignationID (PK), DesignationName (Investigating Officer, SHO...), Active, SortOrder

### Employee (police personnel)
EmployeeID (PK), DistrictID (FK→District), UnitID (FK→Unit), RankID (FK→Rank),
DesignationID (FK→Designation), KGID (Karnataka Govt ID), FirstName,
EmployeeDOB, GenderID, BloodGroupID, PhysicallyChallenged (BIT), AppointmentDate.

### ChargesheetDetails
CSID (PK), CaseMasterID (FK→CaseMaster), csdate (DATETIME),
cstype (CHAR: A/B/C — see rules), PolicePersonID (FK→Employee).

## Key relationships (cardinality)

- CaseMaster 1—N Victim, Accused, ArrestSurrender, ComplainantDetails, ActSectionAssociation
- CaseMaster N—1 CaseCategory, GravityOffence, CrimeHead (major), CrimeSubHead (minor), CaseStatusMaster, Court, Employee (registering officer)
- Accused N—1 CaseMaster; ArrestSurrender N—1 Accused (via AccusedMasterID)
- Act 1—N Section; Act 1—N CrimeHeadActSection; CrimeHead 1—N CrimeSubHead
- District N—1 State; Court N—1 District; Unit N—1 District/State/UnitType; Unit self-references ParentUnit
- Employee N—1 District, Unit, Rank, Designation

## Common join paths for NL→SQL

- "Cases in <district>": CaseMaster → Unit (PoliceStationID=UnitID) → District
- "Repeat offenders": Accused GROUP BY AccusedName (or name+age) HAVING COUNT(DISTINCT CaseMasterID) > 1
- "Co-accused network": Accused a1 JOIN Accused a2 ON a1.CaseMasterID = a2.CaseMasterID AND a1.AccusedMasterID <> a2.AccusedMasterID
- "Chargesheeted cases": CaseMaster JOIN ChargesheetDetails ON ... WHERE cstype='A'
- "Sections invoked": CaseMaster → ActSectionAssociation → Act/Section
- "Crime type": CaseMaster → CrimeHead (major) / CrimeSubHead (minor)
- "Officer workload": CaseMaster GROUP BY PolicePersonID → Employee

## SQL generation guardrails (enforce in code)

1. SELECT-only. Reject INSERT/UPDATE/DELETE/DROP/ALTER.
2. Whitelist table names to the list above.
3. Always append LIMIT (max 200 rows) unless aggregate query.
4. Never SELECT or filter on ReligionID/CasteID for risk-scoring or
   profiling features (bias safeguard). These fields may be aggregated only
   for the sociological-insight dashboards with explicit disclaimers.
