(function () {
  window.CRISIS_MANUAL_TOPICS = {
    "malignant-hyperthermia": {
      title: "Malignant Hyperthermia",
      presentation: [
        "Sudden rise in ETCO2 (>55 mmHg)",
        "Unexplained tachycardia",
        "Masseter or generalized rigidity",
        "Rising patient temperature",
        "Cola-colored urine (myoglobinuria)",
        "Mottled or cyanotic skin",
        "Decreased SpO2",
        "Labile blood pressure"
      ],
      interventions: [
        "Call code / Call for help / Stop surgery",
        "Discontinue volatile anesthetics and succinylcholine",
        "Call MH Hotline: 1-800-644-9737",
        "Administer dantrolene bolus",
        "Hyperventilate with 100% oxygen at high flows",
        "Apply charcoal filters (replace q1 hour)",
        "Cooling: lavage cavities and chilled IV fluids",
        "Treat acidosis, hyperkalemia, and arrhythmias",
        "Check ABG, electrolytes, and glucose",
        "Target urine output > 1 mL/kg/hr",
        "Monitor vitals and consider central line"
      ],
      labs: "Respiratory/metabolic acidosis, serum K > 6 mEq/L, creatine kinase > 20,000 U/L, serum/urine myoglobin.",
      priorities: [
        "Early trigger recognition",
        "Immediate team role assignment",
        "Frequent reassessment every few minutes"
      ],
      aftercare: [
        "ICU-level monitoring",
        "Trend CK, potassium, renal markers",
        "Document suspected trigger and timeline"
      ],
      therapy: {
        dantroleneDose: "2.5 mg/kg IV bolus every 5-10 minutes until symptoms abate (usual max 10 mg/kg).",
        warning: "Do NOT initiate calcium channel blockers during active MH treatment due to severe hyperkalemia/myocardial depression risk.",
        clinicalNote: "If the patient was already receiving calcium channel blockers, dantrolene should still be administered for MH treatment.",
        reconstitution: [
          "Dantrium/Revonto: 20 mg vial + 60 mL sterile water (vigorous mixing).",
          "Ryanodex: 250 mg vial + 5 mL sterile water."
        ]
      }
    },
    "last": {
      title: "LAST",
      presentation: [
        "Perioral numbness, metallic taste, tinnitus",
        "Agitation, confusion, or seizure activity",
        "Progression to hypotension, conduction changes, or ventricular arrhythmias",
        "CNS symptoms may precede cardiovascular collapse, but delayed/atypical presentations can occur"
      ],
      interventions: [
        "Stop local anesthetic injection immediately",
        "Call for help and bring LAST kit with 20% lipid emulsion",
        "Manage airway/breathing with 100% oxygen and avoid hypoxia, hypercarbia, and acidosis",
        "Treat seizures with benzodiazepines first-line; avoid large propofol doses in unstable patients",
        "Use modified ACLS if cardiovascular instability/arrest develops",
        "Use lower epinephrine doses (prefer <1 mcg/kg per bolus)",
        "Start 20% lipid emulsion: 1.5 mL/kg bolus over ~1 minute, then 0.25 mL/kg/min infusion",
        "If still unstable, repeat bolus up to 2 times and increase infusion to 0.5 mL/kg/min",
        "Maximum total lipid dose about 12 mL/kg",
        "Avoid vasopressin, calcium channel blockers, and beta blockers during LAST resuscitation"
      ],
      priorities: [
        "Early airway support",
        "Prompt lipid rescue initiation",
        "Avoid medications that worsen instability"
      ],
      aftercare: [
        "Continuous telemetry and close cardiopulmonary monitoring",
        "Observe at least 4-6 hours after cardiovascular events or at least 2 hours after isolated limited CNS symptoms",
        "Document local anesthetic dose, site, and timing"
      ]
    },
    "bronchospasm": {
      title: "Bronchospasm",
      presentation: [
        "Wheezing with increased mucus secretion",
        "High inspiratory pressures with prolonged expiration",
        "Blunted expiratory CO2 waveform and reduced tidal volumes",
        "Hypoxemia with possible air trapping/lung hyperinflation"
      ],
      interventions: [
        "Call for help and deepen anesthesia (volatile agent, ketamine, propofol, lidocaine, or combination)",
        "Administer 100% oxygen",
        "Rule out mechanical causes and differential diagnoses: ETT obstruction/kink, endobronchial intubation, pneumothorax, anaphylaxis, pulmonary edema, aspiration",
        "Administer short-acting beta-agonist: albuterol 4-8 puffs MDI via circuit or 2.5-5 mg nebulized",
        "Add ipratropium 0.25-0.5 mg nebulized every 20 minutes for up to 3 doses in moderate-severe cases",
        "If severe, give epinephrine 10 mcg/kg IV or subcutaneously",
        "Give hydrocortisone 2-4 mg/kg IV",
        "If refractory, consider magnesium sulfate 2 g IV over 20 minutes",
        "Consider aminophylline selectively when prolonged postoperative ventilation is expected"
      ],
      priorities: [
        "Differentiate bronchospasm vs obstruction",
        "Prevent dynamic hyperinflation and barotrauma",
        "Escalate quickly if oxygenation worsens"
      ],
      aftercare: [
        "Use a ventilation strategy that prolongs expiratory time and accepts permissive hypercapnia when appropriate",
        "Trend airway pressures, capnography, oxygenation, and hemodynamics closely",
        "Plan postoperative respiratory observation and document trigger/response"
      ]
    },
    "difficult-airway": {
      title: "Difficult Airway",
      presentation: [
        "Unexpected poor laryngoscopic view",
        "Failed mask ventilation or supraglottic rescue",
        "Rapidly falling oxygen saturation",
        "Repeated failed airway attempts"
      ],
      interventions: [
        "Call for difficult airway help immediately",
        "Limit repeated attempts and optimize positioning",
        "Use alternative device strategy",
        "Proceed through airway algorithm with team callouts",
        "Move to emergency front-of-neck access when indicated"
      ],
      priorities: [
        "Prioritize oxygenation over intubation",
        "Declare cannot intubate/cannot oxygenate early",
        "Use predefined rescue sequence"
      ],
      aftercare: [
        "Debrief event and airway plan",
        "Document successful and failed techniques",
        "Update future airway warning"
      ]
    },
    "anaphylaxis": {
      title: "Anaphylaxis",
      presentation: [
        "Sudden hypotension after exposure",
        "Bronchospasm and rising airway pressures",
        "Possible rash, flushing, or angioedema",
        "Cardiovascular collapse in severe cases"
      ],
      interventions: [
        "Call for help and stop suspected trigger",
        "100% oxygen and secure airway",
        "Epinephrine titrated to severity",
        "Rapid IV fluid resuscitation",
        "Add adjuncts after epinephrine",
        "Prepare infusion support if needed"
      ],
      priorities: [
        "Do not delay epinephrine",
        "Frequent hemodynamic reassessment",
        "Track probable trigger timeline"
      ],
      aftercare: [
        "Observe for biphasic reaction",
        "Send post-event labs per protocol",
        "Document allergy clearly in chart"
      ]
    },
    "bradycardia": {
      title: "Bradycardia",
      presentation: [
        "Marked heart rate decrease",
        "Hypotension or low perfusion",
        "Possible high vagal tone or conduction issue",
        "Can precede arrest in severe hypoxia"
      ],
      interventions: [
        "Assess pulse quality and blood pressure",
        "Treat reversible causes (hypoxia, vagal stimulus, drugs)",
        "Administer anticholinergic as indicated",
        "Escalate to vasoactive support if unstable",
        "Prepare pacing pathway when refractory"
      ],
      priorities: [
        "Correct oxygenation first",
        "Stop provoking surgical stimulus if possible",
        "Escalate before progression to arrest"
      ],
      aftercare: [
        "Telemetry monitoring",
        "Review medication contributors",
        "Document response to therapy"
      ]
    },
    "delayed-emergence": {
      title: "Delayed Emergence",
      presentation: [
        "Failure to awaken as expected",
        "Inadequate ventilation or weak effort",
        "Persistent sedation after case end",
        "Potential metabolic or neurologic contributors"
      ],
      interventions: [
        "Stabilize airway and ventilation",
        "Check glucose, temperature, and blood gas",
        "Review anesthetic and medication timeline",
        "Reverse residual neuromuscular blockade if present",
        "Consider opioid or benzodiazepine reversal when appropriate",
        "Escalate neurologic evaluation if unexplained"
      ],
      priorities: [
        "Protect airway throughout evaluation",
        "Use structured differential",
        "Avoid premature extubation"
      ],
      aftercare: [
        "Frequent reassessment",
        "Targeted imaging/labs if indicated",
        "Document likely etiology"
      ]
    },
    "fire": {
      title: "Fire",
      presentation: [
        "Flame/smoke in field or airway",
        "Burn odor with sudden equipment alarms",
        "Rapid oxygen source involvement",
        "Potential airway injury signs"
      ],
      interventions: [
        "Announce fire and stop procedure",
        "Disconnect oxygen source and remove ignition source",
        "Extinguish fire with saline or extinguisher as indicated",
        "Remove burning materials",
        "Re-establish safe airway and ventilation",
        "Activate institutional emergency response"
      ],
      priorities: [
        "Stop fire triangle quickly",
        "Protect airway and team",
        "Early airway injury assessment"
      ],
      aftercare: [
        "Assess for inhalation injury",
        "Document timeline and equipment involved",
        "Post-event safety reporting"
      ]
    },
    "high-spinal": {
      title: "High Spinal",
      presentation: [
        "Rapid ascending numbness/weakness",
        "Hypotension and bradycardia",
        "Respiratory insufficiency or apnea",
        "Anxiety or decreased consciousness"
      ],
      interventions: [
        "Call for help and support airway",
        "100% oxygen and prepare ventilation",
        "Treat hypotension with vasopressor support",
        "Treat bradycardia promptly",
        "Reassure patient while supporting circulation"
      ],
      priorities: [
        "Early airway control if worsening",
        "Aggressive hemodynamic support",
        "Continuous monitoring during regression"
      ],
      aftercare: [
        "Post-event observation",
        "Document block level progression",
        "Debrief and prevention plan"
      ]
    },
    "hyperkalemia": {
      title: "Hyperkalemia",
      presentation: [
        "Peaked T waves and conduction changes",
        "Muscle weakness or arrhythmia",
        "Acidosis or renal impairment context",
        "Potential progression to arrest"
      ],
      interventions: [
        "Stop exogenous potassium sources",
        "Stabilize myocardium per protocol",
        "Shift potassium intracellularly",
        "Correct acidosis when indicated",
        "Enhance potassium elimination strategies",
        "Continuous ECG and lab reassessment"
      ],
      priorities: [
        "Treat ECG instability first",
        "Use combined temporizing and elimination steps",
        "Recheck potassium serially"
      ],
      aftercare: [
        "Frequent chemistry panels",
        "Address root cause",
        "Document treatment timeline"
      ]
    },
    "hypotension": {
      title: "Hypotension",
      presentation: [
        "Abrupt MAP reduction",
        "Decreased end-organ perfusion signs",
        "May follow induction, blood loss, or vasodilation",
        "Potential occult obstructive/cardiogenic cause"
      ],
      interventions: [
        "Confirm measurement and assess pulse/ETCO2",
        "Increase oxygen delivery and adjust anesthetic depth",
        "Give fluid or blood products as indicated",
        "Use vasopressor/inotrope support",
        "Evaluate for bleeding, anaphylaxis, tension physiology, ischemia"
      ],
      priorities: [
        "Rapid cause-directed treatment",
        "Avoid prolonged low perfusion",
        "Frequent trend reassessment"
      ],
      aftercare: [
        "Trend lactate and perfusion markers",
        "Document likely etiology",
        "Handoff ongoing support needs"
      ]
    },
    "hypoxia": {
      title: "Hypoxia",
      presentation: [
        "Falling SpO2",
        "Ventilation/perfusion mismatch signs",
        "Airway or equipment problem possibility",
        "Potential hemodynamic compromise"
      ],
      interventions: [
        "Call for help and give 100% oxygen",
        "Manual ventilate and check chest rise",
        "Verify tube position and circuit integrity",
        "Treat bronchospasm or secretions if present",
        "Use structured differential if unresolved"
      ],
      priorities: [
        "Recognize and fix mechanical issues early",
        "Prioritize oxygenation",
        "Escalate before arrest"
      ],
      aftercare: [
        "ABG and imaging as indicated",
        "Monitor recurrence risk",
        "Document root cause"
      ]
    },
    "laryngospasm": {
      title: "Laryngospasm",
      presentation: [
        "Inspiratory stridor or complete silence",
        "Paradoxical chest movement with little air entry",
        "Rapid desaturation",
        "High airway pressure with minimal ventilation"
      ],
      interventions: [
        "Call for help and remove stimulus",
        "100% oxygen, tight mask seal, CPAP, and jaw thrust",
        "Apply Larson maneuver (firm bilateral pressure at laryngospasm notch) as an adjunct",
        "Deepen anesthesia if needed",
        "Do not delay succinylcholine or other rapid neuromuscular rescue if unresolved",
        "Intubate if ventilation remains inadequate"
      ],
      priorities: [
        "Break spasm quickly",
        "Prevent severe hypoxemia",
        "Escalate early instead of repeating non-definitive maneuvers when oxygenation worsens"
      ],
      aftercare: [
        "Observe for negative pressure edema",
        "Post-event airway monitoring",
        "Document trigger and response"
      ]
    },
    "loss-of-evoked-potential": {
      title: "Loss of Evoked Potential",
      presentation: [
        "Sudden SSEP/MEP amplitude loss",
        "Signal latency worsening",
        "Often correlates with physiologic shifts",
        "Can indicate neural compromise"
      ],
      interventions: [
        "Announce change and pause critical surgical step",
        "Optimize MAP and oxygenation",
        "Check anesthetic depth and recent medication changes",
        "Review temperature and hemoglobin",
        "Coordinate immediate team troubleshooting"
      ],
      priorities: [
        "Rapid multidisciplinary communication",
        "Protect spinal cord perfusion",
        "Trend signal response to interventions"
      ],
      aftercare: [
        "Document event timeline",
        "Handoff neurologic concerns",
        "Plan postoperative neuro checks"
      ]
    },
    "mass-transfusion-protocol": {
      title: "Mass Transfusion Protocol",
      presentation: [
        "Ongoing major hemorrhage",
        "Hypotension and rising vasopressor need",
        "Worsening coagulopathy",
        "Hypothermia and acidosis risk"
      ],
      interventions: [
        "Activate MTP early",
        "Coordinate blood product delivery",
        "Warm patient and blood products",
        "Monitor coagulation and calcium",
        "Control bleeding source with surgical team"
      ],
      priorities: [
        "Balanced resuscitation",
        "Prevent lethal triad",
        "Serial lab-guided correction"
      ],
      aftercare: [
        "Reconcile product totals",
        "Trend coagulation recovery",
        "Structured ICU handoff"
      ]
    },
    "mi": {
      title: "MI",
      presentation: [
        "ST changes or new ischemic pattern",
        "Hemodynamic instability",
        "Ventricular dysfunction signs",
        "Arrhythmia or chest pressure (if awake)"
      ],
      interventions: [
        "Call for help and notify surgical team",
        "Optimize oxygenation and hemodynamics",
        "Reduce myocardial demand",
        "Treat severe hypotension/arrhythmia",
        "Initiate institutional ischemia pathway"
      ],
      priorities: [
        "Balance supply-demand quickly",
        "Early expert consultation",
        "Continuous ECG/hemodynamic monitoring"
      ],
      aftercare: [
        "Serial biomarkers/ECG",
        "Definitive cardiology evaluation",
        "Document perioperative event"
      ]
    },
    "pea": {
      title: "PEA",
      presentation: [
        "Organized rhythm with no pulse",
        "Sudden perfusion collapse",
        "Potential obstructive, metabolic, or hypoxic cause",
        "Requires immediate high-quality CPR"
      ],
      interventions: [
        "Start CPR and call code",
        "Confirm rhythm and pulse absence",
        "Administer vasopressor per arrest protocol",
        "Search and treat reversible causes",
        "Use ultrasound when available"
      ],
      priorities: [
        "Minimize compression interruptions",
        "Cause-directed treatment",
        "Frequent rhythm checks"
      ],
      aftercare: [
        "Post-ROSC optimization",
        "Targeted diagnostics",
        "Team debrief"
      ]
    },
    "power-outage": {
      title: "Power Outage",
      presentation: [
        "Sudden equipment and monitor failure",
        "Ventilator interruption",
        "Lighting and device dependency issues",
        "Potential infusion/pump interruptions"
      ],
      interventions: [
        "Announce outage and call for support",
        "Manual ventilation with oxygen source verification",
        "Switch to battery/backup systems",
        "Prioritize critical monitoring restoration",
        "Coordinate with engineering and charge team"
      ],
      priorities: [
        "Airway and oxygen first",
        "Simplify workflow to essentials",
        "Track medication continuity"
      ],
      aftercare: [
        "Verify all systems recovered",
        "Check for missed infusions/alarms",
        "Incident documentation"
      ]
    },
    "systole": {
      title: "Systole",
      presentation: [
        "Asystole on monitor",
        "No pulse and no perfusion",
        "Potential preceding severe brady/hypoxia",
        "Immediate arrest protocol required"
      ],
      interventions: [
        "Call code and start CPR",
        "Confirm true asystole in two leads",
        "Administer vasopressor per protocol",
        "Treat reversible causes aggressively",
        "Continue cycles with rhythm reassessment"
      ],
      priorities: [
        "High-quality compressions",
        "Rapid correction of reversible causes",
        "Strict rhythm-check timing"
      ],
      aftercare: [
        "Post-ROSC stabilization if achieved",
        "Team debrief and documentation",
        "Family/team communication pathway"
      ]
    },
    "tachycardia": {
      title: "Tachycardia",
      presentation: [
        "Sustained rapid heart rate",
        "Narrow or wide complex rhythm",
        "Possible hypotension, ischemia, or symptoms",
        "Potential progression to instability"
      ],
      interventions: [
        "Assess stability and blood pressure",
        "Identify rhythm type quickly",
        "Treat reversible triggers (pain, hypovolemia, hypoxia)",
        "Apply rhythm-specific therapy per protocol",
        "Prepare synchronized cardioversion when unstable"
      ],
      priorities: [
        "Stability-based decision making",
        "Rhythm identification",
        "Early escalation if deteriorating"
      ],
      aftercare: [
        "Telemetry and cause workup",
        "Document rhythm strips and response",
        "Handoff recurrence plan"
      ]
    },
    "transfusion-reaction": {
      title: "Transfusion Reaction",
      presentation: [
        "Fever, hypotension, or bronchospasm during transfusion",
        "Unexpected bleeding or hemolysis concern",
        "Hemoglobinuria or renal deterioration",
        "Possible anaphylactoid signs"
      ],
      interventions: [
        "Stop transfusion immediately",
        "Maintain IV access with compatible fluid",
        "Call blood bank and send required samples",
        "Support airway, breathing, circulation",
        "Treat reaction type per protocol"
      ],
      priorities: [
        "Do not discard blood bag/tubing",
        "Rapid communication with blood bank",
        "Hemodynamic stabilization"
      ],
      aftercare: [
        "Trend hemolysis labs",
        "Monitor renal function",
        "Document reaction in record"
      ]
    },
    "venous-air-emboli": {
      title: "Venous Air Emboli",
      presentation: [
        "Sudden ETCO2 drop",
        "Hypotension and hypoxemia",
        "Mill-wheel murmur possible",
        "Risk increased with open venous field"
      ],
      interventions: [
        "Notify team and flood surgical field",
        "Prevent additional air entrainment",
        "100% oxygen and hemodynamic support",
        "Aspirate via central line if available",
        "Positioning maneuvers per protocol"
      ],
      priorities: [
        "Stop air entry immediately",
        "Support right heart function",
        "Frequent ETCO2 and pressure reassessment"
      ],
      aftercare: [
        "Assess for neurologic sequelae",
        "Document event conditions",
        "Post-event multidisciplinary debrief"
      ]
    },
    "vfib": {
      title: "Vfib",
      presentation: [
        "Chaotic ventricular rhythm",
        "No effective pulse",
        "Immediate shockable arrest",
        "Rapid perfusion collapse"
      ],
      interventions: [
        "Start CPR and call code",
        "Defibrillate per protocol",
        "Resume compressions immediately",
        "Administer medications per arrest sequence",
        "Treat reversible causes"
      ],
      priorities: [
        "Early defibrillation",
        "Minimize pause time",
        "Cycle-based reassessment"
      ],
      aftercare: [
        "Post-ROSC stabilization",
        "Cause investigation",
        "Structured handoff"
      ]
    },
    "vtach": {
      title: "Vtach",
      presentation: [
        "Wide-complex tachycardia",
        "May be with or without pulse",
        "Potential hypotension or shock",
        "Can degenerate to VF arrest"
      ],
      interventions: [
        "Assess pulse and stability immediately",
        "Pulseless: treat as shockable arrest",
        "Unstable with pulse: synchronized cardioversion",
        "Stable: rhythm-directed antiarrhythmic pathway",
        "Correct electrolytes and ischemic triggers"
      ],
      priorities: [
        "Pulse-guided pathway",
        "Early cardioversion when unstable",
        "Continuous monitoring"
      ],
      aftercare: [
        "Telemetry and cardiology input",
        "Review trigger/medication causes",
        "Document event rhythm response"
      ]
    }
  };
})();
