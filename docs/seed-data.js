// Manual checks from the TG-224 daily QA template (myQA export). Sphinx measurements are added on first import.
window.PORTAL_SEED = {
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
   "expected": 0.0,
   "warn": 1.5,
   "fail": 2.0,
   "tol_mode": "absolute",
   "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm"
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – Align Sphinx to kV/kV Iso – Y",
   "type": "numeric",
   "expected": 0.0,
   "warn": 1.5,
   "fail": 2.0,
   "tol_mode": "absolute",
   "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm"
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – Align Sphinx to kV/kV Iso – Z",
   "type": "numeric",
   "expected": 0.0,
   "warn": 1.5,
   "fail": 2.0,
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
   "expected": 50.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – CBCT Correction Vector – Y",
   "type": "numeric",
   "expected": 10.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – CBCT Correction Vector – Z",
   "type": "numeric",
   "expected": -45.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer."
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – X",
   "type": "numeric",
   "expected": 50.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Y",
   "type": "numeric",
   "expected": 10.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
  },
  {
   "category": "Mechanical",
   "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Z",
   "type": "numeric",
   "expected": -45.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm"
  },
  {
   "category": "CBCT kv/MV",
   "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta X",
   "type": "numeric",
   "expected": 0.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
  },
  {
   "category": "CBCT kv/MV",
   "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Y",
   "type": "numeric",
   "expected": 0.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
  },
  {
   "category": "CBCT kv/MV",
   "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Z",
   "type": "numeric",
   "expected": 0.0,
   "warn": 0.3,
   "fail": 0.5,
   "tol_mode": "absolute",
   "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max."
  }
 ]
};
