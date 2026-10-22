// Generated from portal/seed.json by build_pages.py; edit the JSON, not this file.
// One daily QA template per machine type (plus the TrueBeam SRS list) and the machines that get a copy of each.
// Draft for physicist review: limits left blank are Recorded, not judged, until confirmed.
window.PORTAL_SEED = {
 "templates": [
  {
   "name": "Daily QA template – Proton gantry (TG-224)",
   "kind": "Proton gantry",
   "list": "Daily QA",
   "frequency": "daily",
   "setup": "Patient Name:  QA G2 PBS\n\nIs loading bar shifted to Gantry 270. \nIs RS taken off?\nIs Snout Retracted?\nIs Electrometer setup, turn on voltage, set to -300V. \nCompensate and Run Background.\n\nBegin Imaging protocol: \nIndex to Sphinx to H3. \nValidate PPC05 is correct number.\nSet DCEU to at least 800.",
   "checks": [
    {
     "category": "Safety",
     "name": "Safety – Door interlock",
     "type": "boolean",
     "description": "Template 1.01. Load up a patient field, and open door."
    },
    {
     "category": "Safety",
     "name": "Safety – A/V works",
     "type": "boolean",
     "description": "Template 1.02. Test primary and secondary system"
    },
    {
     "category": "Safety",
     "name": "Safety – Beam on indicator",
     "type": "boolean",
     "description": "Template 1.03."
    },
    {
     "category": "Safety",
     "name": "Safety – X-ray on indicator",
     "type": "boolean",
     "description": "Template 1.04."
    },
    {
     "category": "Safety",
     "name": "Safety – Search button works",
     "type": "boolean",
     "description": "Template 1.05. Try to deliver beam without search button"
    },
    {
     "category": "Safety",
     "name": "Safety – Beam pause and resume",
     "type": "boolean",
     "description": "Template 1.06. Pause and resume during delivery"
    },
    {
     "category": "Safety",
     "name": "Safety – Beam pause and resume (3)",
     "type": "boolean",
     "description": "Template 1.06. Pause and resume during delivery"
    },
    {
     "category": "Safety",
     "name": "Safety – Emergency motion stop button",
     "type": "boolean",
     "description": "Template 1.07."
    },
    {
     "category": "Safety",
     "name": "Safety – MU Interlocks",
     "type": "boolean",
     "description": "Template 1.08. Attempt to deliver with low MU on DCEU."
    },
    {
     "category": "Safety",
     "name": "Safety – Collission Interlocks",
     "type": "boolean",
     "description": "Template 1.09."
    },
    {
     "category": "Safety",
     "name": "Safety – Radiation Monitor Present",
     "type": "boolean",
     "description": "Template 1.10."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Align Sphinx to kV/kV Iso – X",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Align Sphinx to kV/kV Iso – Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Align Sphinx to kV/kV Iso – Z",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Check X-ray isocenter vs. Laser Isocenter",
     "type": "boolean",
     "description": "Template 2.03. AFTER applying, kV/kV correction:\n\nIs laser offset less than 2mm?\n\n\n** TG-224: Imaging: X-ray isocenter vs. Laser isocenter"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – CBCT Correction Vector – X",
     "type": "numeric",
     "unit": "mm",
     "expected": 50,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – CBCT Correction Vector – Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 10,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – CBCT Correction Vector – Z",
     "type": "numeric",
     "unit": "mm",
     "expected": -45,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – X",
     "type": "numeric",
     "unit": "mm",
     "expected": 50,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 10,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Z",
     "type": "numeric",
     "unit": "mm",
     "expected": -45,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta X",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Z",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
    }
   ]
  },
  {
   "name": "Daily QA template – TrueBeam (TG-142 / TG-198)",
   "kind": "Linac",
   "list": "Daily QA",
   "frequency": "daily",
   "setup": "Same items and order as the Penn TrueBeam daily list: 1.xx Safety, 2.xx Dosimetry on the daily QA device per energy, 3.0 Physics Review. Each item is marked Pass / Warning / Fail. Numeric tolerances (TG-142 Table III / Table IV) are not entered in this draft.",
   "checks": [
    {
     "category": "Safety",
     "name": "Safety – Water level",
     "type": "status",
     "description": "Template 1.00."
    },
    {
     "category": "Safety",
     "name": "Safety – Water pressure",
     "type": "status",
     "description": "Template 1.01."
    },
    {
     "category": "Safety",
     "name": "Safety – Gas pressure",
     "type": "status",
     "description": "Template 1.02."
    },
    {
     "category": "Safety",
     "name": "Safety – Intercom",
     "type": "status",
     "description": "Template 1.03."
    },
    {
     "category": "Safety",
     "name": "Safety – Video monitor",
     "type": "status",
     "description": "Template 1.04."
    },
    {
     "category": "Safety",
     "name": "Safety – Door warning light",
     "type": "status",
     "description": "Template 1.05."
    },
    {
     "category": "Safety",
     "name": "Safety – Beam off functionality",
     "type": "status",
     "description": "Template 1.06."
    },
    {
     "category": "Safety",
     "name": "Safety – Door interlock",
     "type": "status",
     "description": "Template 1.07."
    },
    {
     "category": "Safety",
     "name": "Safety – Primealert",
     "type": "status",
     "description": "Template 1.08."
    },
    {
     "category": "Safety",
     "name": "Safety – Backup MU counter accuracy",
     "type": "status",
     "description": "Template 1.09."
    },
    {
     "category": "Safety",
     "name": "Safety – Laser alignment",
     "type": "status",
     "description": "Template 1.10. TG-142 daily tolerance."
    },
    {
     "category": "Safety",
     "name": "Safety – ODI accuracy",
     "type": "status",
     "description": "Template 1.11. TG-142 daily tolerance."
    },
    {
     "category": "Safety",
     "name": "Safety – Light field size",
     "type": "status",
     "description": "Template 1.12. TG-142 daily tolerance."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 6X daily QA device",
     "type": "status",
     "description": "Template 2.01."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 10X daily QA device",
     "type": "status",
     "description": "Template 2.02."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 10X FFF daily QA device",
     "type": "status",
     "description": "Template 2.03."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 15X daily QA device",
     "type": "status",
     "description": "Template 2.04."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 6X EDW 30 IN daily QA device",
     "type": "status",
     "description": "Template 2.05."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 6E daily QA device",
     "type": "status",
     "description": "Template 2.07."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 9E daily QA device",
     "type": "status",
     "description": "Template 2.08."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 12E daily QA device",
     "type": "status",
     "description": "Template 2.09."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 16E daily QA device",
     "type": "status",
     "description": "Template 2.10."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 18E daily QA device",
     "type": "status",
     "description": "Template 2.11."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – 20E daily QA device",
     "type": "status",
     "description": "Template 2.12."
    },
    {
     "category": "Physics Review",
     "name": "Physics Review – Physics Review",
     "type": "status",
     "description": "Template 3.00."
    }
   ]
  },
  {
   "name": "Bigbore CT Daily template – Big Bore CT",
   "kind": "CT simulator",
   "list": "Bigbore CT Daily",
   "frequency": "daily",
   "setup": "Bigbore CT Daily, as performed in RadMachine. References are the RadMachine reference values. Warning and fail tolerances are NOT entered yet, so measured values are Recorded, not judged, until a physicist enters them.",
   "checks": [
    {
     "category": "Mechanical and Safety",
     "name": "Mechanical and Safety – \"X-Ray ON\" indicator",
     "type": "boolean",
     "description": "Template 1.01. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged."
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Head CT Number (HU)",
     "type": "numeric",
     "description": "Template 2.01. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Head Uniformity (HU)",
     "type": "numeric",
     "description": "Template 2.02. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Head Noise (HU)",
     "type": "numeric",
     "description": "Template 2.03. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 2.7,
     "tol_mode": "absolute"
    },
    {
     "category": "Quality",
     "name": "Quality – Head Low Contrast (mm)",
     "type": "numeric",
     "description": "Template 3.01. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "mm",
     "expected": 4,
     "tol_mode": "absolute"
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Body CT Number (HU)",
     "type": "numeric",
     "description": "Template 2.04. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Body Uniformity (HU)",
     "type": "numeric",
     "description": "Template 2.05. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT HU constancy",
     "name": "CT HU constancy – Body Noise (HU)",
     "type": "numeric",
     "description": "Template 2.06. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "HU",
     "expected": 7.65,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB position x (BB)",
     "type": "numeric",
     "description": "Template 4.01. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB position y (BB)",
     "type": "numeric",
     "description": "Template 4.02. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "",
     "expected": 101.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Left-Right (BB)",
     "type": "numeric",
     "description": "Template 4.03. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "",
     "expected": 203.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Left-Top (BB)",
     "type": "numeric",
     "description": "Template 4.04. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "",
     "expected": 144.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Top-Right (BB)",
     "type": "numeric",
     "description": "Template 4.05. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "",
     "expected": 144.5,
     "tol_mode": "absolute"
    }
   ]
  },
  {
   "name": "Daily QA template – MRI simulator",
   "kind": "MRI simulator",
   "list": "Daily QA",
   "frequency": "daily",
   "setup": "Placeholder until we see what the MRI simulator collects each day. Only safety checks and a record of the daily phantom scan for now.",
   "checks": [
    {
     "category": "Safety",
     "name": "Safety – Zone signage, doors and screening in place",
     "type": "status",
     "description": "Template 1.01."
    },
    {
     "category": "Safety",
     "name": "Safety – Emergency stop and quench button unobstructed",
     "type": "status",
     "description": "Template 1.02."
    },
    {
     "category": "Safety",
     "name": "Safety – Intercom and video monitor",
     "type": "status",
     "description": "Template 1.03."
    },
    {
     "category": "Safety",
     "name": "Safety – Cryogen (helium) level",
     "type": "numeric",
     "unit": "%",
     "description": "Template 1.04. Recorded from the console; action level from the vendor."
    },
    {
     "category": "Image quality",
     "name": "Image quality – Daily phantom scan acquired and free of artifacts",
     "type": "status",
     "description": "Template 2.01. Items to add once the daily collection is known."
    },
    {
     "category": "Physics review",
     "name": "Physics review – Daily results reviewed",
     "type": "status",
     "description": "Template 3.00."
    }
   ]
  },
  {
   "name": "SRS QA template – TrueBeam (Dose Pro)",
   "kind": "Linac",
   "list": "SRS QA",
   "frequency": "asneeded",
   "setup": "Run on SRS treatment days only (scheduled 'as needed', so it is never overdue). Placeholder checks until the Dose Pro procedure and its export are available.",
   "checks": [
    {
     "category": "Safety",
     "name": "Safety – SRS interlocks and cone / MLC accessory recognised",
     "type": "status",
     "description": "Template 1.01. TG-142 daily (SRS/SBRT): stereotactic interlocks functional."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Lasers to isocenter (SRS)",
     "type": "status",
     "description": "Template 2.01. Tolerance per TG-142 daily, SRS/SBRT column; to be entered."
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – ODI at isocenter (SRS)",
     "type": "status",
     "description": "Template 2.02. Tolerance per TG-142 daily, SRS/SBRT column; to be entered."
    },
    {
     "category": "Dosimetry",
     "name": "Dosimetry – Dose Pro measurement",
     "type": "status",
     "description": "Template 3.01. Dose Pro daily SRS output / isocentre check. Export import not built yet; values and tolerances to follow the Dose Pro procedure."
    },
    {
     "category": "Physics review",
     "name": "Physics review – SRS QA reviewed before treatment",
     "type": "status",
     "description": "Template 4.00."
    }
   ]
  }
 ],
 "machines": [
  {
   "name": "GTR1",
   "kind": "Proton gantry"
  },
  {
   "name": "GTR2",
   "kind": "Proton gantry"
  },
  {
   "name": "GTR5",
   "kind": "Proton gantry"
  },
  {
   "name": "TrueBeam",
   "kind": "Linac"
  },
  {
   "name": "Big Bore CT (7064)",
   "kind": "CT simulator"
  },
  {
   "name": "MRI Sim",
   "kind": "MRI simulator"
  }
 ]
};
