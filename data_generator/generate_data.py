"""
KSP Datathon 2026 — Synthetic FIR Data Generator
=================================================
Generates realistic Karnataka Police FIR data matching the official ER schema,
with three deliberately planted patterns for the demo:

  P1. A 5-person co-accused ring operating across Bengaluru City + Ramanagara
      (appears in ~14 vehicle-theft/robbery FIRs) -> network graph "wow" moment.
  P2. A seasonal chain-snatching spike every Oct-Dec               -> trend chart.
  P3. A dense burglary hotspot cluster around Hubballi old city    -> heatmap.

Usage:
    python generate_data.py --firs 50000 --out ./output
No external dependencies (pure stdlib) so it runs anywhere.
Outputs one CSV per table, ready for Catalyst Data Store bulk import.
"""

import argparse
import csv
import os
import random
from datetime import datetime, timedelta

random.seed(42)  # reproducible demo data

# ---------------------------------------------------------------- name pools
FIRST_M = ["Ravi", "Suresh", "Manjunath", "Prakash", "Kiran", "Santosh", "Vinay",
           "Harish", "Nagaraj", "Girish", "Mahesh", "Umesh", "Lokesh", "Raghavendra",
           "Shivakumar", "Basavaraj", "Chandrashekar", "Venkatesh", "Anand", "Deepak",
           "Imran", "Abdul", "Salman", "Peter", "Joseph", "Arun", "Karthik", "Naveen"]
FIRST_F = ["Lakshmi", "Savitha", "Rekha", "Manjula", "Geetha", "Sunitha", "Asha",
           "Shobha", "Padma", "Kavitha", "Roopa", "Vani", "Meena", "Bhagya",
           "Ayesha", "Fathima", "Mary", "Divya", "Pooja", "Shruthi"]
LAST = ["Gowda", "Reddy", "Kumar", "Rao", "Shetty", "Hegde", "Naik", "Patil",
        "Kulkarni", "Desai", "Murthy", "Acharya", "Swamy", "Poojary", "Khan",
        "Sheikh", "D'Souza", "Fernandes", ""]

def person_name(gender=None):
    g = gender or random.choice("MF")
    first = random.choice(FIRST_M if g == "M" else FIRST_F)
    last = random.choice(LAST)
    return (f"{first} {last}".strip(), g)

# ------------------------------------------------------- Karnataka geography
# (DistrictID, Name, approx center lat, lon)
DISTRICTS = [
    (1, "Bengaluru City", 12.9716, 77.5946), (2, "Bengaluru Rural", 13.2846, 77.6070),
    (3, "Ramanagara", 12.7223, 77.2810), (4, "Mysuru City", 12.2958, 76.6394),
    (5, "Mysuru District", 12.3052, 76.6552), (6, "Mandya", 12.5218, 76.8951),
    (7, "Hassan", 13.0068, 76.0996), (8, "Tumakuru", 13.3392, 77.1140),
    (9, "Kolar", 13.1360, 78.1290), (10, "Chikkaballapura", 13.4355, 77.7315),
    (11, "Shivamogga", 13.9299, 75.5681), (12, "Davanagere", 14.4644, 75.9218),
    (13, "Chitradurga", 14.2251, 76.3980), (14, "Ballari", 15.1394, 76.9214),
    (15, "Vijayanagara", 15.2689, 76.3909), (16, "Koppal", 15.3459, 76.1548),
    (17, "Raichur", 16.2076, 77.3463), (18, "Kalaburagi", 17.3297, 76.8343),
    (19, "Bidar", 17.9104, 77.5199), (20, "Yadgir", 16.7625, 77.1376),
    (21, "Vijayapura", 16.8302, 75.7100), (22, "Bagalkote", 16.1817, 75.6958),
    (23, "Belagavi", 15.8497, 74.4977), (24, "Dharwad", 15.4589, 75.0078),
    (25, "Hubballi City", 15.3647, 75.1240), (26, "Gadag", 15.4290, 75.6300),
    (27, "Haveri", 14.7936, 75.4045), (28, "Uttara Kannada", 14.7937, 74.6869),
    (29, "Udupi", 13.3409, 74.7421), (30, "Dakshina Kannada", 12.8703, 74.8806),
    (31, "Kodagu", 12.4218, 75.7400),
]
STATE_ID = 1  # Karnataka

PS_PER_DISTRICT = 4  # keep small enough to be readable in demos

# ------------------------------------------------------------- crime taxonomy
CRIME_HEADS = [
    (1, "Crimes Against Body"), (2, "Crimes Against Property"),
    (3, "Crimes Against Women"), (4, "Economic Offences"),
    (5, "Cyber Crimes"), (6, "Narcotics"), (7, "Public Order"),
]
# (SubHeadID, HeadID, Name, weight, gravity 1=Heinous 2=Non-Heinous)
CRIME_SUBHEADS = [
    (1, 1, "Murder", 2, 1), (2, 1, "Attempt to Murder", 2, 1),
    (3, 1, "Grievous Hurt", 5, 2), (4, 1, "Simple Hurt", 8, 2),
    (5, 2, "Robbery", 5, 1), (6, 2, "Dacoity", 1, 1),
    (7, 2, "House Burglary", 8, 2), (8, 2, "Theft", 14, 2),
    (9, 2, "Vehicle Theft", 10, 2), (10, 2, "Chain Snatching", 5, 2),
    (11, 3, "Cruelty by Husband", 4, 2), (12, 3, "Molestation", 3, 1),
    (13, 4, "Cheating", 9, 2), (14, 4, "Criminal Breach of Trust", 3, 2),
    (15, 5, "Online Financial Fraud", 8, 2), (16, 5, "Identity Theft", 3, 2),
    (17, 6, "NDPS Possession", 4, 2), (18, 6, "NDPS Trafficking", 2, 1),
    (19, 7, "Rioting", 2, 2), (20, 7, "Unlawful Assembly", 2, 2),
]
# (ActCode, Description, ShortName)
ACTS = [
    ("BNS", "Bharatiya Nyaya Sanhita, 2023", "BNS"),
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act, 1985", "NDPS Act"),
    ("ITACT", "Information Technology Act, 2000", "IT Act"),
    ("KPACT", "Karnataka Police Act, 1963", "KP Act"),
]
SECTIONS = [  # (ActCode, SectionCode, Description)
    ("BNS", "103", "Murder"), ("BNS", "109", "Attempt to murder"),
    ("BNS", "117", "Grievous hurt"), ("BNS", "115", "Voluntarily causing hurt"),
    ("BNS", "309", "Robbery"), ("BNS", "310", "Dacoity"),
    ("BNS", "331", "House-breaking"), ("BNS", "303", "Theft"),
    ("BNS", "304", "Snatching"), ("BNS", "85", "Cruelty by husband"),
    ("BNS", "74", "Assault on woman"), ("BNS", "318", "Cheating"),
    ("BNS", "316", "Criminal breach of trust"), ("BNS", "191", "Rioting"),
    ("BNS", "189", "Unlawful assembly"),
    ("NDPS", "20", "Possession of cannabis"), ("NDPS", "21", "Trafficking"),
    ("ITACT", "66C", "Identity theft"), ("ITACT", "66D", "Cheating by personation"),
    ("KPACT", "92", "Public nuisance"),
]
# subhead -> list of (act, section)
SUBHEAD_SECTIONS = {
    1: [("BNS", "103")], 2: [("BNS", "109")], 3: [("BNS", "117")],
    4: [("BNS", "115")], 5: [("BNS", "309")], 6: [("BNS", "310")],
    7: [("BNS", "331"), ("BNS", "303")], 8: [("BNS", "303")],
    9: [("BNS", "303")], 10: [("BNS", "304")], 11: [("BNS", "85")],
    12: [("BNS", "74")], 13: [("BNS", "318")], 14: [("BNS", "316")],
    15: [("ITACT", "66D"), ("BNS", "318")], 16: [("ITACT", "66C")],
    17: [("NDPS", "20")], 18: [("NDPS", "21")],
    19: [("BNS", "191")], 20: [("BNS", "189")],
}

CASE_CATEGORIES = [(1, "FIR", "1"), (2, "UDR", "3"), (3, "PAR", "4"), (4, "Zero FIR", "8")]
CASE_STATUSES = [(1, "Under Investigation"), (2, "Charge Sheeted"),
                 (3, "Closed - False Case"), (4, "Closed - Undetected"), (5, "Trial")]
OCCUPATIONS = [(i + 1, n) for i, n in enumerate(
    ["Farmer", "Government Employee", "Private Employee", "Business", "Student",
     "Homemaker", "Driver", "Daily Wage Worker", "Retired", "Unemployed"])]
RELIGIONS = [(i + 1, n) for i, n in enumerate(["Hindu", "Muslim", "Christian", "Jain", "Sikh", "Others"])]
CASTES = [(i + 1, n) for i, n in enumerate(["General", "OBC", "SC", "ST", "Not Stated"])]
RANKS = [(1, "DGP", 1), (2, "SP", 3), (3, "DSP", 4), (4, "Inspector", 5),
         (5, "Sub-Inspector", 6), (6, "Head Constable", 7), (7, "Constable", 8)]
DESIGNATIONS = [(1, "SHO", 1), (2, "Investigating Officer", 2), (3, "Station Writer", 3), (4, "Beat Officer", 4)]

BRIEF_TEMPLATES = {
    "default": "Complainant {c} reported an incident of {crime} at the stated location. {a} was named as accused. Investigation taken up by jurisdictional police.",
    9: "Complainant {c} reported that his/her two-wheeler parked near {loc} was stolen between the incident hours. {crime} case registered. Accused {a} identified through CCTV footage.",
    10: "Complainant {c} stated that unknown persons on a motorcycle snatched her gold chain near {loc} and fled. Case of {crime} registered against {a}.",
    7: "Complainant {c} reported house break-in at {loc} during night hours; gold ornaments and cash stolen. {crime} case registered. Accused {a} under investigation.",
    15: "Complainant {c} reported losing money to an online scam; amount debited via fraudulent links. {crime} registered. Cyber cell tracing accused {a}.",
}

# ------------------------------------------------------------ planted pattern
RING = [  # P1: the co-accused ring (fixed identities)
    ("Chandru Nayaka", 31, "M"), ("Rafiq Pasha", 28, "M"),
    ("Somashekar Bhovi", 34, "M"), ("Manja Urs", 26, "M"), ("Ilyas Sheikh", 29, "M"),
]
RING_DISTRICTS = [1, 3]           # Bengaluru City + Ramanagara
RING_SUBHEADS = [9, 5]            # Vehicle Theft, Robbery
RING_CASES = 14
HOTSPOT_CENTER = (15.3620, 75.1300)   # P3: Hubballi old city
HOTSPOT_DISTRICT = 25
HOTSPOT_CASES = 120


def rand_date(start, end):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def jitter(lat, lon, spread=0.15):
    return (round(lat + random.uniform(-spread, spread), 6),
            round(lon + random.uniform(-spread, spread), 6))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--firs", type=int, default=50000)
    ap.add_argument("--out", default="./output")
    ap.add_argument("--years", default="2023,2024,2025,2026")
    args = ap.parse_args()
    years = [int(y) for y in args.years.split(",")]
    os.makedirs(args.out, exist_ok=True)

    # ---------------- master tables ----------------
    states = [[STATE_ID, "Karnataka", 1, 1]]
    districts = [[d, name, STATE_ID, 1] for d, name, _, _ in DISTRICTS]
    unit_types = [[1, "Police Station", "City", 3, 1], [2, "Circle Office", "District", 2, 1]]

    units, courts = [], []
    unit_id = 0
    dist_units = {}
    for d, dname, _, _ in DISTRICTS:
        dist_units[d] = []
        for i in range(PS_PER_DISTRICT):
            unit_id += 1
            units.append([unit_id, f"{dname} PS-{i+1}", 1, 0, 1, STATE_ID, d, 1])
            dist_units[d].append(unit_id)
        courts.append([d, f"{dname} District Court", d, STATE_ID, 1])

    employees = []
    emp_id = 0
    unit_emps = {}
    for u in units:
        uid, _, _, _, _, _, did, _ = u
        unit_emps[uid] = []
        for _ in range(random.randint(6, 10)):
            emp_id += 1
            name, g = person_name("M" if random.random() < 0.8 else "F")
            dob = rand_date(datetime(1970, 1, 1), datetime(1998, 12, 31))
            appt = dob + timedelta(days=random.randint(22 * 365, 30 * 365))
            employees.append([emp_id, did, uid, random.choice([4, 5, 5, 6, 6, 7])[0] if False else random.choice([4, 5, 5, 6, 6, 7]),
                              random.choice([1, 2, 2, 3, 4]), f"KGID{100000+emp_id}", name.split()[0],
                              dob.date(), 1 if g == "M" else 2, random.randint(1, 8),
                              1 if random.random() < 0.02 else 0, appt.date()])
            unit_emps[uid].append(emp_id)

    # ---------------- transactional tables ----------------
    case_master, complainants, victims, accused_rows = [], [], [], []
    arrests, act_assoc, chargesheets = [], [], []
    serials = {}       # (ps, category, year) -> serial
    case_id = comp_id = vic_id = acc_id = arr_id = cs_id = 0

    sub_ids = [s[0] for s in CRIME_SUBHEADS]
    sub_weights = [s[3] for s in CRIME_SUBHEADS]
    sub_by_id = {s[0]: s for s in CRIME_SUBHEADS}
    head_by_sub = {s[0]: s[1] for s in CRIME_SUBHEADS}

    def next_crimeno(ps, cat_id, year):
        code = dict((c[0], c[2]) for c in CASE_CATEGORIES)[cat_id]
        key = (ps, cat_id, year)
        serials[key] = serials.get(key, 0) + 1
        # district of this PS
        did = next(u[6] for u in units if u[0] == ps)
        return f"{code}{did:04d}{ps:04d}{year}{serials[key]:05d}", f"{year}{serials[key]:05d}"

    def add_case(district_id, subhead_id, reg_date, forced_accused=None,
                 forced_latlon=None):
        nonlocal case_id, comp_id, vic_id, acc_id, arr_id, cs_id
        case_id += 1
        ps = random.choice(dist_units[district_id])
        cat_id = random.choices([1, 2, 3, 4], weights=[86, 6, 4, 4])[0]
        year = reg_date.year
        crimeno, caseno = next_crimeno(ps, cat_id, year)
        head_id = head_by_sub[subhead_id]
        gravity = sub_by_id[subhead_id][4]
        status_id = random.choices([1, 2, 3, 4, 5], weights=[38, 28, 6, 16, 12])[0]
        officer = random.choice(unit_emps[ps])
        dlat, dlon = next((la, lo) for d, _, la, lo in DISTRICTS if d == district_id)
        lat, lon = forced_latlon or jitter(dlat, dlon)
        inc_from = reg_date - timedelta(hours=random.randint(2, 96))
        inc_to = inc_from + timedelta(hours=random.randint(0, 12))
        info = inc_to + timedelta(hours=random.randint(1, 48))

        # complainant
        comp_id += 1
        cname, cg = person_name()
        complainants.append([comp_id, case_id, cname, random.randint(18, 70),
                             random.choice(OCCUPATIONS)[0], random.choice(RELIGIONS)[0],
                             random.choice(CASTES)[0], 1 if cg == "M" else 2])
        # victims (1-2)
        for _ in range(random.choices([1, 2], weights=[8, 2])[0]):
            vic_id += 1
            vname, vg = person_name()
            victims.append([vic_id, case_id, vname, random.randint(12, 75), vg,
                            "1" if random.random() < 0.01 else "0"])
        # accused
        acc_list = forced_accused or []
        if not acc_list:
            for _ in range(random.choices([1, 2, 3], weights=[6, 3, 1])[0]):
                nm, g = person_name("M" if random.random() < 0.85 else "F")
                acc_list.append((nm, random.randint(18, 55), g))
        first_acc_names = []
        case_acc_ids = []
        for idx, (nm, age, g) in enumerate(acc_list):
            acc_id += 1
            accused_rows.append([acc_id, case_id, nm, age, g, f"A{idx+1}"])
            case_acc_ids.append(acc_id)
            first_acc_names.append(nm)
        # arrests for some accused
        for aid in case_acc_ids:
            if random.random() < 0.45:
                arr_id += 1
                adate = reg_date + timedelta(days=random.randint(1, 120))
                arrests.append([arr_id, case_id, random.choices([1, 2], weights=[9, 1])[0],
                                adate.date(), STATE_ID, district_id, ps,
                                random.choice(unit_emps[ps]), district_id, aid, 1,
                                1 if random.random() < 0.01 else 0])
        # act-sections
        for i, (act, sec) in enumerate(SUBHEAD_SECTIONS[subhead_id]):
            act_assoc.append([case_id, act, sec, i + 1, i + 1])
        # chargesheet
        if status_id in (2, 3, 4, 5):
            cs_id += 1
            cstype = {2: "A", 5: "A", 3: "B", 4: "C"}[status_id]
            chargesheets.append([cs_id, case_id,
                                 (reg_date + timedelta(days=random.randint(30, 180))),
                                 cstype, officer])
        # brief facts
        tmpl = BRIEF_TEMPLATES.get(subhead_id, BRIEF_TEMPLATES["default"])
        brief = tmpl.format(c=cname, a=", ".join(first_acc_names) or "unknown persons",
                            crime=sub_by_id[subhead_id][2],
                            loc=f"{next(n for d, n, _, _ in DISTRICTS if d == district_id)} area")
        court = district_id
        case_master.append([case_id, crimeno, caseno, reg_date.date(), officer, ps,
                            cat_id, gravity, head_id, subhead_id, status_id, court,
                            inc_from, inc_to, info, lat, lon, brief])

    start, end = datetime(years[0], 1, 1), datetime(years[-1], 6, 30)

    # P1 — the ring
    for _ in range(RING_CASES):
        d = random.choice(RING_DISTRICTS)
        sub = random.choice(RING_SUBHEADS)
        members = random.sample(RING, k=random.choice([2, 3, 3, 4]))
        add_case(d, sub, rand_date(start, end), forced_accused=members)

    # P3 — Hubballi burglary hotspot
    for _ in range(HOTSPOT_CASES):
        lat, lon = jitter(*HOTSPOT_CENTER, spread=0.012)
        add_case(HOTSPOT_DISTRICT, 7, rand_date(start, end), forced_latlon=(lat, lon))

    # bulk cases (with P2 seasonal snatching spike)
    remaining = args.firs - RING_CASES - HOTSPOT_CASES
    for _ in range(remaining):
        reg = rand_date(start, end)
        if reg.month in (10, 11, 12) and random.random() < 0.10:
            sub = 10                      # chain snatching spike Oct-Dec
        else:
            sub = random.choices(sub_ids, weights=sub_weights)[0]
        d = random.choices([d[0] for d in DISTRICTS],
                           weights=[10 if d[0] in (1, 4, 25) else 2 for d in DISTRICTS])[0]
        add_case(d, sub, reg)

    # ---------------- write CSVs ----------------
    def dump(name, header, rows):
        path = os.path.join(args.out, f"{name}.csv")
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)
        print(f"  {name}.csv  ({len(rows)} rows)")

    print(f"Writing CSVs to {args.out}")
    dump("State", ["StateID", "StateName", "NationalityID", "Active"], states)
    dump("District", ["DistrictID", "DistrictName", "StateID", "Active"], districts)
    dump("UnitType", ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"], unit_types)
    dump("Unit", ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"], units)
    dump("Court", ["CourtID", "CourtName", "DistrictID", "StateID", "Active"], courts)
    dump("Rank", ["RankID", "RankName", "Hierarchy", "Active"], [[r[0], r[1], r[2], 1] for r in RANKS])
    dump("Designation", ["DesignationID", "DesignationName", "Active", "SortOrder"], [[d[0], d[1], 1, d[2]] for d in DESIGNATIONS])
    dump("Employee", ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "KGID", "FirstName", "EmployeeDOB", "GenderID", "BloodGroupID", "PhysicallyChallenged", "AppointmentDate"], employees)
    dump("Act", ["ActCode", "ActDescription", "ShortName", "Active"], [[a, b, c, 1] for a, b, c in ACTS])
    dump("Section", ["ActCode", "SectionCode", "SectionDescription", "Active"], [[a, s, d, 1] for a, s, d in SECTIONS])
    dump("CrimeHead", ["CrimeHeadID", "CrimeGroupName", "Active"], [[i, n, 1] for i, n in CRIME_HEADS])
    dump("CrimeSubHead", ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"], [[s[0], s[1], s[2], s[0]] for s in CRIME_SUBHEADS])
    dump("CrimeHeadActSection", ["CrimeHeadID", "ActCode", "SectionCode"],
         [[head_by_sub[sid], act, sec] for sid, pairs in SUBHEAD_SECTIONS.items() for act, sec in pairs])
    dump("CaseCategory", ["CaseCategoryID", "LookupValue"], [[c[0], c[1]] for c in CASE_CATEGORIES])
    dump("GravityOffence", ["GravityOffenceID", "LookupValue"], [[1, "Heinous"], [2, "Non-Heinous"]])
    dump("CaseStatusMaster", ["CaseStatusID", "CaseStatusName"], CASE_STATUSES)
    dump("OccupationMaster", ["OccupationID", "OccupationName"], OCCUPATIONS)
    dump("ReligionMaster", ["ReligionID", "ReligionName"], RELIGIONS)
    dump("CasteMaster", ["caste_master_id", "caste_master_name"], CASTES)
    dump("CaseMaster", ["CaseMasterID", "CrimeNo", "CaseNo", "CrimeRegisteredDate", "PolicePersonID", "PoliceStationID", "CaseCategoryID", "GravityOffenceID", "CrimeMajorHeadID", "CrimeMinorHeadID", "CaseStatusID", "CourtID", "IncidentFromDate", "IncidentToDate", "InfoReceivedPSDate", "latitude", "longitude", "BriefFacts"], case_master)
    dump("ComplainantDetails", ["ComplainantID", "CaseMasterID", "ComplainantName", "AgeYear", "OccupationID", "ReligionID", "CasteID", "GenderID"], complainants)
    dump("Victim", ["VictimMasterID", "CaseMasterID", "VictimName", "AgeYear", "GenderID", "VictimPolice"], victims)
    dump("Accused", ["AccusedMasterID", "CaseMasterID", "AccusedName", "AgeYear", "GenderID", "PersonID"], accused_rows)
    dump("ArrestSurrender", ["ArrestSurrenderID", "CaseMasterID", "ArrestSurrenderTypeID", "ArrestSurrenderDate", "ArrestSurrenderStateId", "ArrestSurrenderDistrictId", "PoliceStationID", "IOID", "CourtID", "AccusedMasterID", "IsAccused", "IsComplainantAccused"], arrests)
    dump("ActSectionAssociation", ["CaseMasterID", "ActID", "SectionID", "ActOrderID", "SectionOrderID"], act_assoc)
    dump("ChargesheetDetails", ["CSID", "CaseMasterID", "csdate", "cstype", "PolicePersonID"], chargesheets)

    print("\nPlanted demo patterns:")
    print(f"  P1 ring: {', '.join(r[0] for r in RING)} — {RING_CASES} cases in Bengaluru City + Ramanagara")
    print(f"  P2 spike: Chain Snatching elevated in Oct–Dec every year")
    print(f"  P3 hotspot: {HOTSPOT_CASES} burglaries clustered at {HOTSPOT_CENTER} (Hubballi old city)")
    print("Done.")


if __name__ == "__main__":
    main()
