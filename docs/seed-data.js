// Generated from portal/seed.json by build_pages.py; edit the JSON, not this file.
// One daily QA template per machine type (plus the TrueBeam SRS list) and the machines that get a copy of each.
// Draft for physicist review: limits left blank are Recorded, not judged, until confirmed.
window.PORTAL_SEED = {
 "templates": [
  {
   "name": "Daily QA template – Proton gantry (TG-224)",
   "kind": "",
   "list": "Daily QA",
   "frequency": "daily",
   "setup": "Daily QA protocol, in accordance with TG-224\n\nLast updated August, 2026.",
   "checks": [
    {
     "category": "Other",
     "name": "Other – Daily QA Setup",
     "type": "boolean",
     "description": "Template 0.01. Patient Name:  QA G2 PBS\n\nIs loading bar shifted to Gantry 270. \nIs RS taken off?\nIs Snout Retracted?\nIs Electrometer setup, turn on voltage, set to -300V. \nCompensate and Run Background.\n\nBegin Imaging protocol: \nIndex to Sphinx to H3. \nValidate PPC05 is correct number.\nSet DCEU to at least 800."
    },
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
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Align Sphinx to kV/kV Iso – Y",
     "type": "numeric",
     "expected": 0.0,
     "warn": 1.5,
     "fail": 2.0,
     "tol_mode": "absolute",
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – Align Sphinx to kV/kV Iso – Z",
     "type": "numeric",
     "expected": 0.0,
     "warn": 1.5,
     "fail": 2.0,
     "tol_mode": "absolute",
     "description": "Template 2.02. Align phantom to lasers. \nCapture kV/kV\n\nDocument offset applied after kV/kV to go to iso.\nApply correction vector.\n\n*TG-224: Mechanical Laser Position accuracy: 2mm",
     "unit": "mm"
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
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer.",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – CBCT Correction Vector – Y",
     "type": "numeric",
     "expected": 10.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer.",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – CBCT Correction Vector – Z",
     "type": "numeric",
     "expected": -45.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.04. APPLY KNOWN SHIFT: -5cm, -1cm, 4.5cm \n\nRetract panel A\nCBCT with preset: Head ND, Gantry 0, CW, half arc. \nUse Auto function to automatch. \n\nRecord recommended shift, BUT DO NOT APPLY OFFSET. \nClose imaging field on sequencer.",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – X",
     "type": "numeric",
     "expected": 50.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Y",
     "type": "numeric",
     "expected": 10.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm",
     "unit": "mm"
    },
    {
     "category": "Mechanical",
     "name": "Mechanical – kV/kV Correction Vector for Couch Translational Accuracy – Z",
     "type": "numeric",
     "expected": -45.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.05. Close imaging field on sequencer. \nOpen Daily QA field on Mosaic. \nMove Gantry to 90  (Go to Treatment Setup, Gantry, Move Enable). \n\nMove both Panel A out, acquire kV/kV, manually align to center of BB. (Automatch doesn't work well).\nRecord recommended shift, and APPLY SHIFT.\n\n** Expected Shift: 5cm, 1cm, -4.5cm \n\n**TG-224: Mechanical: Couch translational motion should be < 1mm",
     "unit": "mm"
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta X",
     "type": "numeric",
     "expected": 0.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max.",
     "unit": "mm"
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Y",
     "type": "numeric",
     "expected": 0.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max.",
     "unit": "mm"
    },
    {
     "category": "CBCT kv/MV",
     "name": "CBCT kv/MV – kV/kV to CBCT coincidence – Delta Z",
     "type": "numeric",
     "expected": 0.0,
     "warn": 0.3,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 2.06. Report the absolute difference between kV/kV and CBCT recommended shifts.\n\n**TG-142: CBCT iso to treatment iso < 1mm. We assume the kV iso is within the 0.5mm tolerance, so 0.5+ 0.5 = 1mm max.",
     "unit": "mm"
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [100 MeV] – Distal Depth",
     "expected": 77.8,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01. Patient Name:  QA G2 PBS\n\nDocument MUs\nDocument Charge\nRun Sphinx Analysis\n\nCompleting TG-224: \n\nImaging: \n- X-ray and proton beam isocenter coincidence < 1mm (Spot)\n\nDosimetry: \n- Output < 3% for different energies on different days with one consistent field.  (Output)\n- Distal Depth: 1mm at distal 90% depth dose. (Energy)\n- Spot position: 2mm/1mm absolute/relative. (Spot)"
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [100 MeV] – Distal Fall Off",
     "expected": 2.1,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [100 MeV] – Proximal Depth",
     "expected": 72.2,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [100 MeV] – Width",
     "expected": 5.6,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [150 MeV] – Distal Depth",
     "expected": 156.9,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [150 MeV] – Distal Fall Off",
     "expected": 3.9,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [150 MeV] – Proximal Depth",
     "expected": 147.7,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [150 MeV] – Width",
     "expected": 9.2,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [200 MeV] – Distal Depth",
     "expected": 259.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [200 MeV] – Distal Fall Off",
     "expected": 5.5,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [200 MeV] – Proximal Depth",
     "expected": 250.3,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Energy",
     "type": "numeric",
     "unit": "mm",
     "name": "Energy [200 MeV] – Width",
     "expected": 8.7,
     "warn": 0.1,
     "fail": 0.2,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 1 [225 MeV] – Position X",
     "expected": -49.4,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 1 [225 MeV] – Position Y",
     "expected": 81.2,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 1 [225 MeV] – Sigma X",
     "expected": 2.9,
     "warn": 0.5,
     "fail": 1.6,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 1 [225 MeV] – Sigma Y",
     "expected": 2.8,
     "warn": 0.5,
     "fail": 1.6,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 1 [225 MeV] – Skewness X",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 1 [225 MeV] – Skewness Y",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 1 [225 MeV] – Intensity",
     "expected": 75.5,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 2 [200 MeV] – Position X",
     "expected": -49.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 2 [200 MeV] – Position Y",
     "expected": 51.3,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 2 [200 MeV] – Sigma X",
     "expected": 3.1,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 2 [200 MeV] – Sigma Y",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 2 [200 MeV] – Skewness X",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 2 [200 MeV] – Skewness Y",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 2 [200 MeV] – Intensity",
     "expected": 72.42,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 3 [180 MeV] – Position X",
     "expected": -49.3,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 3 [180 MeV] – Position Y",
     "expected": 11.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 3 [180 MeV] – Sigma X",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 3 [180 MeV] – Sigma Y",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 3 [180 MeV] – Skewness X",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 3 [180 MeV] – Skewness Y",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 3 [180 MeV] – Intensity",
     "expected": 68.07,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 4 [160 MeV] – Position X",
     "expected": -9.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 4 [160 MeV] – Position Y",
     "expected": 30.2,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 4 [160 MeV] – Sigma X",
     "expected": 7.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 4 [160 MeV] – Sigma Y",
     "expected": 7.3,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 4 [160 MeV] – Skewness X",
     "expected": 0.235,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 4 [160 MeV] – Skewness Y",
     "expected": 0.0,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 4 [160 MeV] – Intensity",
     "expected": 54.42,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 5 [140 MeV] – Position X",
     "expected": 30.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 5 [140 MeV] – Position Y",
     "expected": 30.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 5 [140 MeV] – Sigma X",
     "expected": 7.9,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 5 [140 MeV] – Sigma Y",
     "expected": 8.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 5 [140 MeV] – Skewness X",
     "expected": 0.184,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 5 [140 MeV] – Skewness Y",
     "expected": 0.421,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 5 [140 MeV] – Intensity",
     "expected": 41.96,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 6 [120 MeV] – Position X",
     "expected": 70.7,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 6 [120 MeV] – Position Y",
     "expected": 30.8,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 6 [120 MeV] – Sigma X",
     "expected": 9.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "mm",
     "name": "Spot 6 [120 MeV] – Sigma Y",
     "expected": 9.3,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 6 [120 MeV] – Skewness X",
     "expected": 0.535,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "",
     "name": "Spot 6 [120 MeV] – Skewness Y",
     "expected": 0.535,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Spot",
     "type": "numeric",
     "unit": "%",
     "name": "Spot 6 [120 MeV] – Intensity",
     "expected": 31.42,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Coincidence",
     "type": "numeric",
     "unit": "mm",
     "name": "Coincidence – Distance X",
     "expected": 0.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Coincidence",
     "type": "numeric",
     "unit": "mm",
     "name": "Coincidence – Distance Y",
     "expected": 0.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Homogeneity",
     "type": "numeric",
     "unit": "%",
     "name": "Homogeneity – Flatness",
     "expected": 0.0,
     "warn": 2.0,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.01."
    },
    {
     "category": "Output",
     "type": "numeric",
     "unit": "cGy",
     "name": "Output – Absolute Dose",
     "expected": 100.682,
     "warn": 2.0,
     "fail": 3.0,
     "tol_mode": "percent",
     "description": "Template 3.01."
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
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB position y (BB)",
     "type": "numeric",
     "description": "Template 4.02. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "mm",
     "expected": 101.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Left-Right (BB)",
     "type": "numeric",
     "description": "Template 4.03. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "mm",
     "expected": 203.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Left-Top (BB)",
     "type": "numeric",
     "description": "Template 4.04. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "mm",
     "expected": 144.5,
     "tol_mode": "absolute"
    },
    {
     "category": "CT Geometry",
     "name": "CT Geometry – CT BB distance Top-Right (BB)",
     "type": "numeric",
     "description": "Template 4.05. Reference from RadMachine 'Bigbore CT Daily'. Tolerances not entered yet: recorded, not judged.",
     "unit": "mm",
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
   "setup": "Run on SRS treatment days. Import the DoseLab Winston-Lutz PDF to fill summary results, report settings, and individual field offsets. Only Maximum delta determines pass/fail: less than 1 mm passes; 1 mm or more fails.",
   "checks": [
    {
     "category": "Winston-Lutz",
     "name": "Maximum delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "description": "Template 1.01. [rule: wl-max-delta] Pass only when Maximum delta is less than 1 mm."
    },
    {
     "category": "Winston-Lutz",
     "name": "Maximum total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "Template 1.02. Context only; does not determine pass or fail."
    },
    {
     "category": "Winston-Lutz",
     "name": "Mean total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "Template 1.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL settings",
     "name": "SID",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 2.0 WL settings] Template 2.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL settings",
     "name": "Radiation field threshold",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 2.0 WL settings] Template 2.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL settings",
     "name": "Center object threshold",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 2.0 WL settings] Template 2.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL settings",
     "name": "Image count",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 2.0 WL settings] Template 2.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 3.0 WL field G 0°, C 0°, T 0°] Template 3.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 270°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 4.0 WL field G 0°, C 0°, T 270°] Template 4.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 180°, C 90°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 5.0 WL field G 180°, C 90°, T 0°] Template 5.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 90°, C 90°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 6.0 WL field G 90°, C 90°, T 0°] Template 6.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 0°, T 90°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 7.0 WL field G 0°, C 0°, T 90°] Template 7.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 270°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 8.0 WL field G 0°, C 270°, T 0°] Template 8.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 0°, C 90°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 9.0 WL field G 0°, C 90°, T 0°] Template 9.06. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Gantry angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.01. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Collimator angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.02. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Couch angle",
     "type": "numeric",
     "unit": "°",
     "expected": null,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.03. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Horizontal delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.04. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Vertical delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.05. Context only; does not determine pass or fail."
    },
    {
     "category": "WL field G 270°, C 90°, T 0°",
     "name": "Total delta",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": null,
     "fail": null,
     "description": "[Section: 10.0 WL field G 270°, C 90°, T 0°] Template 10.06. Context only; does not determine pass or fail."
    }
   ]
  },
  {
   "name": "PBS DailyQA Template - Sphinx",
   "kind": "Proton gantry",
   "list": "PBS Daily QA (Sphinx)",
   "frequency": "daily",
   "setup": "Transcribed from the RadMachine list '(SBF-113) :: PBS DailyQA Sphinx' (October 2026). References are RadMachine's reference values; warning and fail tolerances were not shown, so values are recorded, not judged, until limits are entered.",
   "checks": [
    {
     "category": "Administrative",
     "name": "Last Edited By:",
     "type": "text",
     "description": "Template 1.01. [Section: Setup and Safety] [auto: user]"
    },
    {
     "category": "Administrative",
     "name": "QA Performed By:",
     "type": "text",
     "description": "Template 1.02. [Section: Setup and Safety] [auto: performer]"
    },
    {
     "category": "Safety",
     "name": "PTS Version",
     "type": "text",
     "description": "Template 1.03. [Section: Setup and Safety]"
    },
    {
     "category": "Safety",
     "name": "PTS Config Version",
     "type": "text",
     "description": "Template 1.04. [Section: Setup and Safety]"
    },
    {
     "category": "Dosimetry",
     "name": "Chamber Temperature, °C",
     "type": "numeric",
     "unit": "°C",
     "expected": 22,
     "tol_mode": "absolute",
     "description": "Template 1.05. [Section: Setup and Safety]"
    },
    {
     "category": "Dosimetry",
     "name": "Air Pressure [kPa]",
     "type": "numeric",
     "unit": "kPa",
     "expected": 101.3,
     "tol_mode": "absolute",
     "description": "Template 1.06. [Section: Setup and Safety]"
    },
    {
     "category": "Dosimetry",
     "name": "Temp. & Press. Correction (Output)",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 1.07. [Section: Setup and Safety] [calc: ktp] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%20Temperature%2C%20%5Cu00b0C%22%2C%20%22category%22%3A%20%22Dosimetry%22%7D%2C%20%7B%22name%22%3A%20%22Air%20Pressure%20%5BkPa%5D%22%2C%20%22category%22%3A%20%22Dosimetry%22%7D%5D%2C%20%22formula%22%3A%20%22%28273.15%2BA%29%2F295.15%2A101.325%2FB%22%7D]"
    },
    {
     "category": "Safety",
     "name": "Please connect the power cord and the chamber cable to the electrometer (DOSE-X) in the control room, then turn on the electrometer.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 1.08. [Section: Setup and Safety]"
    },
    {
     "category": "A tip for the next procedure",
     "name": "Please log in to the 'MOSAIQ2' computer and launch the myQA software.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 1.09. [Section: Setup and Safety]"
    },
    {
     "category": "Safety",
     "name": "Please setup the Sphinx (index: H3) and move the couch BARS to the patient's right side to prevent potential collision during CBCT.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 1.10. [Section: Setup and Safety]"
    },
    {
     "category": "A tip for the next procedure",
     "name": "Please remove the range shifter to prevent collisions and beam delivery.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 1.11. [Section: Setup and Safety]"
    },
    {
     "category": "A tip for the next procedure",
     "name": "Please connect the chamber cable in the treatment room.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 1.12. [Section: Setup and Safety]"
    },
    {
     "category": "Mechanical and Safety",
     "name": "Is a room laser's offset less than ± 2 mm?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.01. [Section: Mechanical and Imaging]"
    },
    {
     "category": "Mechanical and Safety",
     "name": "[Ortho - kV/kV] PPS 2 XRAY Offset X [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.02. [Section: Mechanical and Imaging]",
     "warn": 0.15,
     "fail": 0.2
    },
    {
     "category": "Mechanical and Safety",
     "name": "[Ortho - kV/kV] PPS 2 XRAY Offset Y [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.03. [Section: Mechanical and Imaging]",
     "warn": 0.15,
     "fail": 0.2
    },
    {
     "category": "Mechanical and Safety",
     "name": "[Ortho - kV/kV] PPS 2 XRAY Offset Z [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.04. [Section: Mechanical and Imaging]",
     "warn": 0.15,
     "fail": 0.2
    },
    {
     "category": "Mechanical and Safety",
     "name": "[Ortho - kV/kV] PPS 2 XRAY Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.05. [Section: Mechanical and Imaging] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22%5BOrtho%20-%20kV%2FkV%5D%20PPS%202%20XRAY%20Offset%20X%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Mechanical%20and%20Safety%22%7D%2C%20%7B%22name%22%3A%20%22%5BOrtho%20-%20kV%2FkV%5D%20PPS%202%20XRAY%20Offset%20Y%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Mechanical%20and%20Safety%22%7D%2C%20%7B%22name%22%3A%20%22%5BOrtho%20-%20kV%2FkV%5D%20PPS%202%20XRAY%20Offset%20Z%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Mechanical%20and%20Safety%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Mechanical and Safety",
     "name": "Please move PPS in X (-4.0 cm), Y (+1.0 cm), Z (+1.0 cm) using the correction vector to run CBCT.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.06. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[CBCT - Pelvis SFOV ND] Required Correction Vector - X [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.07. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[CBCT - Pelvis SFOV ND] Required Correction Vector - Y [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.08. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[CBCT - Pelvis SFOV ND] Required Correction Vector - Z [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.09. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[CBCT - Pelvis SFOV ND] Required 3D Correction Vector Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.10. [Section: Mechanical and Imaging] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22%5BCBCT%20-%20Pelvis%20SFOV%20ND%5D%20Required%20Correction%20Vector%20-%20X%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%2C%20%7B%22name%22%3A%20%22%5BCBCT%20-%20Pelvis%20SFOV%20ND%5D%20Required%20Correction%20Vector%20-%20Y%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%2C%20%7B%22name%22%3A%20%22%5BCBCT%20-%20Pelvis%20SFOV%20ND%5D%20Required%20Correction%20Vector%20-%20Z%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Mechanical and Safety",
     "name": "Please set all angles (Rotation, Pitch, Roll) in the correction vector to 0 degrees, and apply the 3D correction vector (x, y, z) based on the CBCT to return to the isocenter position.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.11. [Section: Mechanical and Imaging]"
    },
    {
     "category": "A tip for the next procedure",
     "name": "Please retract the CBCT imaging panel.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.12. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[OBs] Required Correction Vector - X [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.13. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[OBs] Required Correction Vector - Y [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.14. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[OBs] Required Correction Vector - Z [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.15. [Section: Mechanical and Imaging]"
    },
    {
     "category": "AI_PBS_Daily_Imaging",
     "name": "[OBs] Required 3D Correction Vector Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.16. [Section: Mechanical and Imaging] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22%5BOBs%5D%20Required%20Correction%20Vector%20-%20X%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%2C%20%7B%22name%22%3A%20%22%5BOBs%5D%20Required%20Correction%20Vector%20-%20Y%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%2C%20%7B%22name%22%3A%20%22%5BOBs%5D%20Required%20Correction%20Vector%20-%20Z%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22AI_PBS_Daily_Imaging%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Mechanical and Safety",
     "name": "Please review the isocenter position by selecting OB's DR image and apply a correction vector if necessary (if any axis exceeds 0.05 cm: x, y, or z).",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.17. [Section: Mechanical and Imaging]"
    },
    {
     "category": "A tip for the next procedure",
     "name": "Go to MyQA, open your machine QA, connect Sphinx, and measure the background.",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 2.18. [Section: Mechanical and Imaging]"
    },
    {
     "category": "Beam_Parameters",
     "name": "[MU] Delivered MU (Record in IC2)",
     "type": "numeric",
     "unit": "MU",
     "expected": 587.2,
     "tol_mode": "absolute",
     "description": "Template 3.01. [Section: Sphinx Measurements]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Beam Irradiation Time [min:s]",
     "type": "text",
     "description": "Template 3.02. [Section: Sphinx Measurements] Entered as min:s."
    },
    {
     "category": "Device Selection",
     "name": "Chamber",
     "type": "choice",
     "description": "Template 3.03. [Section: Sphinx Measurements] [device: chamber] [choices: %5B%22SAMPLE%20chamber%20A%20%5Cu2014%20placeholder%22%2C%20%22SAMPLE%20chamber%20B%20%5Cu2014%20placeholder%22%5D]"
    },
    {
     "category": "Device Selection",
     "name": "Chamber Cal. Factor(Proton), Gy/C",
     "type": "numeric",
     "unit": "Gy/C",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.04. [Section: Sphinx Measurements] [derived: %7B%22kind%22%3A%20%22lookup%22%2C%20%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22values%22%3A%20%5B%7B%22choice%22%3A%20%22SAMPLE%20chamber%20A%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%20100000000%7D%2C%20%7B%22choice%22%3A%20%22SAMPLE%20chamber%20B%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%20200000000%7D%5D%2C%20%22sample%22%3A%20true%7D]"
    },
    {
     "category": "Device Selection",
     "name": "Electrometer",
     "type": "choice",
     "description": "Template 3.05. [Section: Sphinx Measurements] [device: electrometer] [choices: %5B%22SAMPLE%20electrometer%20A%20%5Cu2014%20placeholder%22%2C%20%22SAMPLE%20electrometer%20B%20%5Cu2014%20placeholder%22%5D]"
    },
    {
     "category": "Device Selection",
     "name": "Electrometer Calibration Factor",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.06. [Section: Sphinx Measurements] [derived: %7B%22kind%22%3A%20%22lookup%22%2C%20%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Electrometer%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22values%22%3A%20%5B%7B%22choice%22%3A%20%22SAMPLE%20electrometer%20A%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%201.0%7D%2C%20%7B%22choice%22%3A%20%22SAMPLE%20electrometer%20B%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%201.1%7D%5D%2C%20%22sample%22%3A%20true%7D]"
    },
    {
     "category": "Device Selection",
     "name": "Overall Calibration Factor [Gy/C]",
     "type": "numeric",
     "unit": "Gy/C",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.07. [Section: Sphinx Measurements] [calc: product] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%20Cal.%20Factor%28Proton%29%2C%20Gy%2FC%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%2C%20%7B%22name%22%3A%20%22Electrometer%20Calibration%20Factor%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%22%7D]"
    },
    {
     "category": "Daily_PBS_Dosimetry",
     "name": "Daily output: Charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.08. [Section: Sphinx Measurements]"
    },
    {
     "category": "Daily_PBS_Dosimetry",
     "name": "Daily output: Dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": 150,
     "tol_mode": "absolute",
     "description": "Template 3.09. [Section: Sphinx Measurements] [calc: dose] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Daily%20output%3A%20Charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Daily_PBS_Dosimetry%22%7D%2C%20%7B%22name%22%3A%20%22Overall%20Calibration%20Factor%20%5BGy%2FC%5D%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20%28Output%29%22%2C%20%22category%22%3A%20%22Dosimetry%22%7D%5D%2C%20%22formula%22%3A%20%22A%2A0.000000001%2AB%2AC%2A100%22%7D]"
    },
    {
     "category": "Data",
     "name": "Sphinx acquisition date and time",
     "type": "text",
     "description": "Template 3.10. [Section: Sphinx Measurements] [auto: sphinx-finished]"
    },
    {
     "category": "Dosimetry",
     "name": "Energy [100.00 MeV]: Distal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 77.7,
     "tol_mode": "absolute",
     "description": "Template 3.11. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [100.00 MeV]: Distal Fall Off [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 2.3,
     "tol_mode": "absolute",
     "description": "Template 3.12. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Dosimetry",
     "name": "Energy [100.00 MeV]: Proximal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 72.1,
     "tol_mode": "absolute",
     "description": "Template 3.13. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [100.00 MeV]: Width [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 5.6,
     "tol_mode": "absolute",
     "description": "Template 3.14. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Dosimetry",
     "name": "Energy [150.00 MeV]: Distal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 158.5,
     "tol_mode": "absolute",
     "description": "Template 3.15. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [150.00 MeV]: Distal Fall Off [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 3.9,
     "tol_mode": "absolute",
     "description": "Template 3.16. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Dosimetry",
     "name": "Energy [150.00 MeV]: Proximal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 149.3,
     "tol_mode": "absolute",
     "description": "Template 3.17. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [150.00 MeV]: Width [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 9.2,
     "tol_mode": "absolute",
     "description": "Template 3.18. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Dosimetry",
     "name": "Energy [200.00 MeV]: Distal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 260.7,
     "tol_mode": "absolute",
     "description": "Template 3.19. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [200.00 MeV]: Distal Fall Off [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 5.2,
     "tol_mode": "absolute",
     "description": "Template 3.20. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Dosimetry",
     "name": "Energy [200.00 MeV]: Proximal Depth [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 250.8,
     "tol_mode": "absolute",
     "description": "Template 3.21. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Dosimetry",
     "name": "Energy [200.00 MeV]: Width [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 9.9,
     "tol_mode": "absolute",
     "description": "Template 3.22. [Section: Sphinx Measurements]",
     "warn": 0.1,
     "fail": 0.2
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": -49.4,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.23. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 81.2,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.24. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 2.9,
     "warn": 0.5,
     "fail": 1.6,
     "tol_mode": "absolute",
     "description": "Template 3.25. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 2.8,
     "warn": 0.5,
     "fail": 1.6,
     "tol_mode": "absolute",
     "description": "Template 3.26. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.27. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.28. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 1 [226.4 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 75.5,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.29. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": -49.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.30. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 51.3,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.31. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 3.1,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.32. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.33. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.34. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.35. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 2 [201 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 72.42,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.36. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": -49.3,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.37. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 11.0,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.38. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.39. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 3.2,
     "warn": 0.5,
     "fail": 0.8,
     "tol_mode": "absolute",
     "description": "Template 3.40. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.41. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.8,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.42. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 3 [180.1 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 68.07,
     "warn": 12.0,
     "fail": 15.0,
     "tol_mode": "absolute",
     "description": "Template 3.43. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": -9.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.44. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 30.2,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.45. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 7.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.46. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 7.3,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.47. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.235,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.48. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.0,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.49. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 4 [160.7 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 54.42,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.50. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": 30.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.51. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 30.5,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.52. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 7.9,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.53. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 8.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.54. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.184,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.55. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.421,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.56. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 5 [140.6 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 41.96,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.57. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Position X",
     "type": "numeric",
     "unit": "mm",
     "expected": 70.7,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.58. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Position Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 30.8,
     "warn": 0.5,
     "fail": 1.0,
     "tol_mode": "absolute",
     "description": "Template 3.59. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Sigma X",
     "type": "numeric",
     "unit": "mm",
     "expected": 9.0,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.60. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Sigma Y",
     "type": "numeric",
     "unit": "mm",
     "expected": 9.3,
     "warn": 0.4,
     "fail": 0.5,
     "tol_mode": "absolute",
     "description": "Template 3.61. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Skewness X",
     "type": "numeric",
     "unit": "",
     "expected": 0.535,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.62. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Skewness Y",
     "type": "numeric",
     "unit": "",
     "expected": 0.535,
     "warn": 0.25,
     "fail": 0.3,
     "tol_mode": "absolute",
     "description": "Template 3.63. [Section: Sphinx Measurements]"
    },
    {
     "category": "Spot",
     "name": "Spot 6 [120.6 MeV] – Intensity",
     "type": "numeric",
     "unit": "%",
     "expected": 31.42,
     "warn": 2.5,
     "fail": 3.0,
     "tol_mode": "absolute",
     "description": "Template 3.64. [Section: Sphinx Measurements]"
    },
    {
     "category": "Dosimetry",
     "name": "Field Homogeneity [%]",
     "type": "numeric",
     "unit": "%",
     "expected": 1.7,
     "tol_mode": "absolute",
     "description": "Template 3.65. [Section: Sphinx Measurements]",
     "warn": 2.0,
     "fail": 3.0
    },
    {
     "category": "Alignment",
     "name": "Isocenter Coincidence [X-ray vs. Proton Beam]: X offset [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 3.66. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Alignment",
     "name": "Isocenter Coincidence [X-ray vs. Proton Beam]: Y offset [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 3.67. [Section: Sphinx Measurements]",
     "warn": 0.5,
     "fail": 1.0
    },
    {
     "category": "Safety",
     "name": "Does search button & its chime work?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.01. [Section: Final safety checks]"
    },
    {
     "category": "Safety",
     "name": "Does \"Beam ON\" indicator function correctly?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.02. [Section: Final safety checks]"
    },
    {
     "category": "Safety",
     "name": "Did you hear beeping sound from the neutron detector?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.03. [Section: Final safety checks]"
    },
    {
     "category": "Safety",
     "name": "Does beam pause work and resume right after pause?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.04. [Section: Final safety checks]"
    },
    {
     "category": "Safety",
     "name": "Does A/V intercom work?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.05. [Section: Final safety checks]"
    },
    {
     "category": "Safety",
     "name": "QA reviewed by therapist?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.06. [Section: Final safety checks]"
    }
   ]
  },
  {
   "name": "Eyeline Daily QA template",
   "kind": "Proton eyeline",
   "list": "Eyeline Daily QA",
   "frequency": "daily",
   "setup": "Transcribed from the RadMachine lists 'Eyeline (PAT006-FSTR4) :: Eyeline Daily QA - Dosimetry: PDD', '- Dosimetry: Output' and '- Imaging' (October 2026), combined into one daily list. References are RadMachine's; no warn / fail limits were shown, so values are recorded, not judged, until limits are entered. The Output section is PARTIAL: its screenshot was too small to read past the first items — add the rest from a readable copy.",
   "checks": [
    {
     "category": "Administrative",
     "name": "Last Edited By:",
     "type": "text",
     "description": "Template 1.01. [Section: Administrative] [auto: user]"
    },
    {
     "category": "Administrative",
     "name": "QA Performed By:",
     "type": "text",
     "description": "Template 1.02. [Section: Administrative] [auto: performer]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_RM Wheel ID",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.01. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_RM Block ID",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.02. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Aperture (diameter in cm)",
     "type": "text",
     "description": "Template 2.03. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_Exp_Range (D90) [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.04. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_Exp_P90 [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.05. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_Exp_MOD [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.06. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Beam_Parameters",
     "name": "Field1_Exp_IsoDepth [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.07. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Device Selection",
     "name": "Chamber",
     "type": "choice",
     "description": "Template 2.08. [Section: Dosimetry: PDD] [device: chamber] [choices: %5B%22SAMPLE%20chamber%20A%20%5Cu2014%20placeholder%22%2C%20%22SAMPLE%20chamber%20B%20%5Cu2014%20placeholder%22%5D]"
    },
    {
     "category": "Device Selection",
     "name": "Eyeline Phantom",
     "type": "text",
     "description": "Template 2.09. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Device Selection",
     "name": "Chamber Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.10. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Device Selection",
     "name": "Phantom Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.11. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Device Selection",
     "name": "Record User offset (feeler gauge or gauge block) [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.12. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Device Selection",
     "name": "Total Offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.13. [Section: Dosimetry: PDD] [calc: sum:3] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%20Offset%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%2C%20%7B%22name%22%3A%20%22Phantom%20Offset%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%2C%20%7B%22name%22%3A%20%22Record%20User%20offset%20%28feeler%20gauge%20or%20gauge%20block%29%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22formula%22%3A%20%22A%2BB%2BC%22%7D]"
    },
    {
     "category": "Dosimetry",
     "name": "Measured Range (D90) without offset [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.14. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Measured Range Eyeline Field 1 (D90) [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 2.5,
     "tol_mode": "absolute",
     "description": "Template 2.15. [Section: Dosimetry: PDD] [calc: sum:2] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Total%20Offset%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%2C%20%7B%22name%22%3A%20%22Measured%20Range%20%28D90%29%20without%20offset%20%5Bcm%5D%22%2C%20%22category%22%3A%20%22Dosimetry%22%7D%5D%2C%20%22formula%22%3A%20%22A%2BB%22%7D]"
    },
    {
     "category": "Dosimetry",
     "name": "Record MLIC Range - Field1 [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 2.5,
     "tol_mode": "absolute",
     "description": "Template 2.16. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Measured P90 [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 2.17. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Relative Dose at the expected P90 (at 0.1 cm) [%]",
     "type": "numeric",
     "unit": "%",
     "expected": 90,
     "tol_mode": "absolute",
     "description": "Template 2.18. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Measured Modulation Eyeline Field 1 [cm]",
     "type": "numeric",
     "unit": "cm",
     "expected": 2,
     "tol_mode": "absolute",
     "description": "Template 2.19. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Max relative dose Eyeline [%]",
     "type": "numeric",
     "unit": "%",
     "expected": 100,
     "tol_mode": "absolute",
     "description": "Template 2.20. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Min relative dose Eyeline [%]",
     "type": "numeric",
     "unit": "%",
     "expected": 100,
     "tol_mode": "absolute",
     "description": "Template 2.21. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Dosimetry",
     "name": "Flatness [%]",
     "type": "numeric",
     "unit": "%",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 2.22. [Section: Dosimetry: PDD]"
    },
    {
     "category": "Temp & Pressure",
     "name": "Air Temperature [°C]",
     "type": "numeric",
     "unit": "°C",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.01. [Section: Dosimetry: Output]"
    },
    {
     "category": "Temp & Pressure",
     "name": "Air Pressure [kPa]",
     "type": "numeric",
     "unit": "kPa",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.02. [Section: Dosimetry: Output]"
    },
    {
     "category": "Temp & Pressure",
     "name": "Temp. & Press. Correction",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.03. [Section: Dosimetry: Output] [calc: ktp] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Air%20Temperature%20%5B%5Cu00b0C%5D%22%2C%20%22category%22%3A%20%22Temp%20%26%20Pressure%22%7D%2C%20%7B%22name%22%3A%20%22Air%20Pressure%20%5BkPa%5D%22%2C%20%22category%22%3A%20%22Temp%20%26%20Pressure%22%7D%5D%2C%20%22formula%22%3A%20%22%28273.15%2BA%29%2F295.15%2A101.325%2FB%22%7D]"
    },
    {
     "category": "Device Selection",
     "name": "Chamber Cal. Factor [Gy/C]",
     "type": "numeric",
     "unit": "Gy/C",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.04. [Section: Dosimetry: Output] [derived: %7B%22kind%22%3A%20%22lookup%22%2C%20%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22values%22%3A%20%5B%7B%22choice%22%3A%20%22SAMPLE%20chamber%20A%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%20100000000%7D%2C%20%7B%22choice%22%3A%20%22SAMPLE%20chamber%20B%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%20200000000%7D%5D%2C%20%22sample%22%3A%20true%7D]"
    },
    {
     "category": "Device Selection",
     "name": "Electrometer",
     "type": "choice",
     "description": "Template 3.05. [Section: Dosimetry: Output] [device: electrometer] [choices: %5B%22SAMPLE%20electrometer%20A%20%5Cu2014%20placeholder%22%2C%20%22SAMPLE%20electrometer%20B%20%5Cu2014%20placeholder%22%5D]"
    },
    {
     "category": "Device Selection",
     "name": "Electrometer Calibration Factor",
     "type": "numeric",
     "unit": "",
     "expected": null,
     "tol_mode": "absolute",
     "description": "Template 3.06. [Section: Dosimetry: Output] [derived: %7B%22kind%22%3A%20%22lookup%22%2C%20%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Electrometer%22%2C%20%22category%22%3A%20%22Device%20Selection%22%7D%5D%2C%20%22values%22%3A%20%5B%7B%22choice%22%3A%20%22SAMPLE%20electrometer%20A%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%201.0%7D%2C%20%7B%22choice%22%3A%20%22SAMPLE%20electrometer%20B%20%5Cu2014%20placeholder%22%2C%20%22value%22%3A%201.1%7D%5D%2C%20%22sample%22%3A%20true%7D]"
    },
    {
     "category": "Dosimetry",
     "name": "Remaining output items",
     "type": "text",
     "description": "Template 3.07. [Section: Dosimetry: Output] Placeholder: the output measurements (background, MU, charge, irradiation time, dose and dose rate per run, averaging) still need to be added from a readable copy of the RadMachine list."
    },
    {
     "category": "Alignment",
     "name": "1st Correction vector from the offset position - X [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 5,
     "tol_mode": "absolute",
     "description": "Template 4.01. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "1st Correction vector from the offset position - Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 5,
     "tol_mode": "absolute",
     "description": "Template 4.02. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "1st Correction vector from the offset position - Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 5,
     "tol_mode": "absolute",
     "description": "Template 4.03. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "2nd Correction vector after chair adjustment - X [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 4.04. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "2nd Correction vector after chair adjustment - Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 4.05. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "2nd Correction vector after chair adjustment - Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "tol_mode": "absolute",
     "description": "Template 4.06. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "Eyeline phantom diameter - Axial [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 25,
     "tol_mode": "absolute",
     "description": "Template 4.07. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "Eyeline phantom diameter - Lateral [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 25,
     "tol_mode": "absolute",
     "description": "Template 4.08. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "After correcting a chair position with imaging, check laser alignment (< 1 mm)",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.09. [Section: Imaging]"
    },
    {
     "category": "Alignment",
     "name": "After installing a pin-hole aperture, check light field projection (< 1 mm)",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 4.10. [Section: Imaging]"
    },
    {
     "category": "Safety",
     "name": "Light-pen system functional?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 5.01. [Section: Safety]"
    },
    {
     "category": "Safety",
     "name": "Eye cameras and monitors functional?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 5.02. [Section: Safety]"
    },
    {
     "category": "Safety",
     "name": "Gazing light functional?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 5.03. [Section: Safety]"
    },
    {
     "category": "Safety",
     "name": "Panic button functional?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 5.04. [Section: Safety]"
    },
    {
     "category": "Safety",
     "name": "QA reviewed by therapist?",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 5.05. [Section: Safety]"
    }
   ]
  },
  {
   "name": "Monthly QA template – Proton gantry (TG-224)",
   "kind": "Proton gantry",
   "list": "Monthly QA",
   "frequency": "monthly",
   "setup": "From the GTR5 Monthly QA worksheet (GTR5_Monthly_QA_Worksheet.xlsx, structure and tolerances per AAPM TG-224 Table III), as extracted for the floridaphysics.com Monthly QA page. Baselines the worksheet fixes are filled in; baselines set once from commissioning (ranges, output dose, imaging) are blank until entered in Setup QA. Pass / Fail checks have no N/A here.",
   "checks": [
    {
     "category": "Conditions",
     "name": "Spot QA performed this month (quarterly items)",
     "type": "boolean",
     "unit": "Yes/No",
     "description": "Template 0.01. [Section: Chamber and conditions] Quarterly spot QA (Lynx, two gantry angles): answer No in months when it is not performed and leave those rows blank."
    },
    {
     "category": "Conditions",
     "name": "Chamber temperature [°C]",
     "type": "numeric",
     "unit": "°C",
     "expected": 22,
     "tol_mode": "absolute",
     "description": "Template 0.02. [Section: Chamber and conditions] PPC05 temperature. Reference 22 °C."
    },
    {
     "category": "Conditions",
     "name": "Air pressure [hPa]",
     "type": "numeric",
     "unit": "hPa",
     "expected": 1013.25,
     "tol_mode": "absolute",
     "description": "Template 0.03. [Section: Chamber and conditions] PPC05 pressure. Reference 1013.25 hPa."
    },
    {
     "category": "Conditions",
     "name": "Temp. & Press. Correction kTP",
     "type": "numeric",
     "unit": "",
     "tol_mode": "absolute",
     "description": "Template 0.04. [Section: Chamber and conditions] [calc: ktp] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Chamber%20temperature%20%5B%5Cu00b0C%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22Air%20pressure%20%5BhPa%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22%28273.15%2BA%29%2F295.15%2A1013.25%2FB%22%7D]"
    },
    {
     "category": "Conditions",
     "name": "Chamber (model / serial)",
     "type": "text",
     "description": "Template 0.05. [Section: Chamber and conditions]"
    },
    {
     "category": "Conditions",
     "name": "N_Dw [cGy/nC]",
     "type": "numeric",
     "unit": "cGy/nC",
     "tol_mode": "absolute",
     "description": "Template 0.06. [Section: Chamber and conditions] Chamber calibration coefficient; enter once."
    },
    {
     "category": "Conditions",
     "name": "k_Q",
     "type": "numeric",
     "unit": "",
     "tol_mode": "absolute",
     "description": "Template 0.07. [Section: Chamber and conditions] Beam quality factor; enter once."
    },
    {
     "category": "Conditions",
     "name": "k_s",
     "type": "numeric",
     "unit": "",
     "tol_mode": "absolute",
     "description": "Template 0.08. [Section: Chamber and conditions] Ion recombination factor; enter once."
    },
    {
     "category": "Conditions",
     "name": "k_pol",
     "type": "numeric",
     "unit": "",
     "tol_mode": "absolute",
     "description": "Template 0.09. [Section: Chamber and conditions] Polarity factor; enter once."
    },
    {
     "category": "Safety",
     "name": "Door interlock",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.01. [Section: Safety] Also verified at daily QA; the monthly record documents functional status. Enter Pass / Fail / N/A.\nOpen treatment room door during delivery — verify beam terminates\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "MU chamber interlocks",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.02. [Section: Safety] Deliver test field — verify termination on MU1 and on MU2\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "Beam pause / hold and resume",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.03. [Section: Safety] Pause mid-delivery — verify hold, correct resume and MU accounting\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "Audio intercom and video monitoring",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.04. [Section: Safety] Two-way audio and all room cameras from console\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "“Beam ON” indicator",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.05. [Section: Safety] Console, room entrance and in-room indicators\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "“X-ray ON” indicator",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.06. [Section: Safety] Console and room entrance indicators during kV / CBCT\nTG-224: Functional"
    },
    {
     "category": "Safety",
     "name": "Room search / clearance chime",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.07. [Section: Safety] Full search sequence — verify chime and interlock set\nTG-224: Functional"
    },
    {
     "category": "Patient positioner",
     "name": "Couch translational accuracy — X (lateral) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 65,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.01. [Section: Mechanical] Applied shift verified against the machinist rule in each axis; rotation against digital level / protractor.\nApply 65.0 mm shift from setup position, read on rule\nBaseline is the applied shift; edit if a different shift is used.\nTG-224: ≤1 mm"
    },
    {
     "category": "Patient positioner",
     "name": "Couch translational accuracy — Y (longitudinal) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 65,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.02. [Section: Mechanical] Apply 65.0 mm shift from setup position, read on rule\nBaseline is the applied shift; edit if a different shift is used.\nTG-224: ≤1 mm"
    },
    {
     "category": "Patient positioner",
     "name": "Couch translational accuracy — Z (vertical) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 65,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.03. [Section: Mechanical] Apply 65.0 mm shift from setup position, read on rule\nBaseline is the applied shift; edit if a different shift is used.\nTG-224: ≤1 mm"
    },
    {
     "category": "Patient positioner",
     "name": "Couch rotational accuracy — T090 [deg]",
     "type": "numeric",
     "unit": "deg",
     "expected": 90,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.04. [Section: Mechanical] Digital level / protractor at nominal angle\nTG-224: 1°"
    },
    {
     "category": "Patient positioner",
     "name": "Couch pitch accuracy [deg]",
     "type": "numeric",
     "unit": "deg",
     "expected": 2,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.05. [Section: Mechanical] Apply 2.0° pitch correction — verify with digital inclinometer / imaging (edit baseline if a different angle is applied)\nTG-224: 1°"
    },
    {
     "category": "Patient positioner",
     "name": "Couch roll accuracy [deg]",
     "type": "numeric",
     "unit": "deg",
     "expected": 2,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.06. [Section: Mechanical] Apply 2.0° roll correction — verify with digital inclinometer / imaging (edit baseline if a different angle is applied)\nTG-224: 1°"
    },
    {
     "category": "Patient positioner",
     "name": "Couch yaw accuracy [deg]",
     "type": "numeric",
     "unit": "deg",
     "expected": 2,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.07. [Section: Mechanical] Apply 2.0° yaw correction — verify with digital inclinometer / imaging (edit baseline if a different angle is applied)\nTG-224: 1°"
    },
    {
     "category": "Patient positioner",
     "name": "Couch trueness (vertical sag) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.08. [Section: Mechanical] Deviation of vertical axis over full travel — AI monthly composite\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "CBCT match residual — X [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.09. [Section: Mechanical] Residual after applying the correction; enter the residual, not the applied shift.\nTOFU phantom, CBCT registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "CBCT match residual — Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.10. [Section: Mechanical] TOFU phantom, CBCT registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "CBCT match residual — Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.11. [Section: Mechanical] TOFU phantom, CBCT registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "kV-kV match residual — X [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.12. [Section: Mechanical] TOFU phantom, kV-kV registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "kV-kV match residual — Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.13. [Section: Mechanical] TOFU phantom, kV-kV registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "IGRT re-positioning",
     "name": "kV-kV match residual — Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.14. [Section: Mechanical] TOFU phantom, kV-kV registration residual after correction\nTG-224: ≤1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 0° – BB walkout X [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.15. [Section: Mechanical] Align a BB (TOFU or any BB phantom) at isocentre and zero the position: T000 is the 0,0,0 reference. Rotate the couch to each angle, acquire an image, and record how the BB moves in each axis. Couch angles are editable. TG-224 gives ≤2 mm as a circle diameter — scored here as radial displacement ≤1 mm and per-axis range ≤2 mm.\nReference position — BB aligned at isocentre, zero the readout\nLimits are set on the summary row below.\nTG-224: R ≤ 1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 0° – BB walkout Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.16. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 0° – BB walkout Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.17. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 0° – BB walkout [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.18. [Section: Mechanical] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 315° – BB walkout X [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.19. [Section: Mechanical] Rotate couch, re-image, record BB shift from the T000 position\nTG-224: R ≤ 1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 315° – BB walkout Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.20. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 315° – BB walkout Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.21. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 315° – BB walkout [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.22. [Section: Mechanical] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 270° – BB walkout X [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.23. [Section: Mechanical] Rotate couch, re-image, record BB shift from the T000 position\nTG-224: R ≤ 1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 270° – BB walkout Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.24. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 270° – BB walkout Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.25. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 270° – BB walkout [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.26. [Section: Mechanical] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 225° – BB walkout X [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.27. [Section: Mechanical] Rotate couch, re-image, record BB shift from the T000 position\nTG-224: R ≤ 1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 225° – BB walkout Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.28. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 225° – BB walkout Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.29. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 225° – BB walkout [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.30. [Section: Mechanical] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 180° – BB walkout X [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.31. [Section: Mechanical] Rotate couch, re-image, record BB shift from the T000 position\nTG-224: R ≤ 1 mm"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 180° – BB walkout Y [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.32. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 180° – BB walkout Z [mm]",
     "type": "numeric",
     "unit": "mm",
     "tol_mode": "absolute",
     "description": "Template 2.33. [Section: Mechanical]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch angle 180° – BB walkout [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.34. [Section: Mechanical] [calc: 3d-offset] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22sqrt%28A%2AA%2BB%2AB%2BC%2AC%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch isocentricity — max radial displacement [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 2.35. [Section: Mechanical] [calc: max:BB walkout [mm]:5] Calculated here: max of the 5 rows above. Worst case of the couch angles above (sets the limits used by those rows)\nRadius form of the TG-224 ≤2 mm circle-diameter limit.\nTG-224: ≤2 mm dia [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22max%28abs%28A%29%2Cabs%28B%29%2Cabs%28C%29%2Cabs%28D%29%2Cabs%28E%29%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch isocentricity — range of ΔX (max − min) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.36. [Section: Mechanical] [calc: range:BB walkout X [mm]:5] Calculated here: range of the 5 rows above. Spread of the BB position across all couch angles\nTG-224: ≤2 mm dia [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20X%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22max%28A%2CB%2CC%2CD%2CE%29-min%28A%2CB%2CC%2CD%2CE%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch isocentricity — range of ΔY (max − min) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.37. [Section: Mechanical] [calc: range:BB walkout Y [mm]:5] Calculated here: range of the 5 rows above. Spread of the BB position across all couch angles\nTG-224: ≤2 mm dia [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20Y%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22max%28A%2CB%2CC%2CD%2CE%29-min%28A%2CB%2CC%2CD%2CE%29%22%7D]"
    },
    {
     "category": "Couch isocentricity",
     "name": "Couch isocentricity — range of ΔZ (max − min) [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.38. [Section: Mechanical] [calc: range:BB walkout Z [mm]:5] Calculated here: range of the 5 rows above. Spread of the BB position across all couch angles\nTG-224: ≤2 mm dia [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Couch%20angle%200%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20315%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20270%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20225%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%2C%20%7B%22name%22%3A%20%22Couch%20angle%20180%5Cu00b0%20%5Cu2013%20BB%20walkout%20Z%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22Couch%20isocentricity%22%7D%5D%2C%20%22formula%22%3A%20%22max%28A%2CB%2CC%2CD%2CE%29-min%28A%2CB%2CC%2CD%2CE%29%22%7D]"
    },
    {
     "category": "Snout",
     "name": "Snout extension accuracy [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "absolute",
     "description": "Template 2.39. [Section: Mechanical] Machinist rule at one nominal position\nEnter the nominal snout position as the baseline (set once).\nTG-224: ±10 mm"
    },
    {
     "category": "XRV-124 coincidence",
     "name": "XRV ISO difference — G000 [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.40. [Section: Mechanical] Energy sweep matches the range list: 70–220 MeV in 10 MeV steps plus 225 MeV. Phantom set up by kV / CBCT, then verified by delivered radiation. Enter the worst-case ISO difference at each angle.\nMax |ISO difference| over the full energy sweep at this gantry angle\nTG-224: ±2 mm"
    },
    {
     "category": "XRV-124 coincidence",
     "name": "XRV ISO difference — G060 [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.41. [Section: Mechanical] Max |ISO difference| over the full energy sweep at this gantry angle\nTG-224: ±2 mm"
    },
    {
     "category": "XRV-124 coincidence",
     "name": "XRV ISO difference — G120 [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.42. [Section: Mechanical] Max |ISO difference| over the full energy sweep at this gantry angle\nTG-224: ±2 mm"
    },
    {
     "category": "XRV-124 coincidence",
     "name": "XRV ISO difference — G180 [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.43. [Section: Mechanical] Max |ISO difference| over the full energy sweep at this gantry angle\nTG-224: ±2 mm"
    },
    {
     "category": "XRV-124 coincidence",
     "name": "XRV — max over all angles [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 2.44. [Section: Mechanical] [calc: max:XRV ISO difference:4] Calculated here: max of the 4 rows above. Worst case of the four gantry angles above\nTG-224: ±2 mm [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22XRV%20ISO%20difference%20%5Cu2014%20G000%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22XRV-124%20coincidence%22%7D%2C%20%7B%22name%22%3A%20%22XRV%20ISO%20difference%20%5Cu2014%20G060%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22XRV-124%20coincidence%22%7D%2C%20%7B%22name%22%3A%20%22XRV%20ISO%20difference%20%5Cu2014%20G120%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22XRV-124%20coincidence%22%7D%2C%20%7B%22name%22%3A%20%22XRV%20ISO%20difference%20%5Cu2014%20G180%20%5Bmm%5D%22%2C%20%22category%22%3A%20%22XRV-124%20coincidence%22%7D%5D%2C%20%22formula%22%3A%20%22max%28abs%28A%29%2Cabs%28B%29%2Cabs%28C%29%2Cabs%28D%29%29%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 70 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.01. [Section: Dosimetry] Enter the chamber constants once, then the raw charge each month. Dose = M(nC) × k_TP × N_Dw × k_Q × k_s × k_pol, with k_TP taken from cell F6. Proteus ONE permits gantry 0° and 90° only; the four energies are editable and intended to be cycled.\nGantry 0° · PPC05 in solid water at reference depth\nReference dose = commissioned dose at this energy (set once).\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 70 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.02. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G0%20%5Cu2013%2070%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 120 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.03. [Section: Dosimetry] Gantry 0° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 120 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.04. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G0%20%5Cu2013%20120%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 180 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.05. [Section: Dosimetry] Gantry 0° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 180 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.06. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G0%20%5Cu2013%20180%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 225 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.07. [Section: Dosimetry] Gantry 0° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G0 – 225 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.08. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G0%20%5Cu2013%20225%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 70 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.09. [Section: Dosimetry] Gantry 90° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 70 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.10. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G90%20%5Cu2013%2070%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 120 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.11. [Section: Dosimetry] Gantry 90° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 120 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.12. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G90%20%5Cu2013%20120%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 180 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.13. [Section: Dosimetry] Gantry 90° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 180 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.14. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G90%20%5Cu2013%20180%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 225 MeV – charge [nC]",
     "type": "numeric",
     "unit": "nC",
     "tol_mode": "absolute",
     "description": "Template 3.15. [Section: Dosimetry] Gantry 90° · PPC05 in solid water at reference depth\nTG-224: ±2%"
    },
    {
     "category": "Output constancy",
     "name": "Output G90 – 225 MeV – dose [cGy]",
     "type": "numeric",
     "unit": "cGy",
     "expected": null,
     "warn": 1.5,
     "fail": 2,
     "tol_mode": "percent",
     "description": "Template 3.16. [Section: Dosimetry] [calc: dose-ndw] [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Output%20G90%20%5Cu2013%20225%20MeV%20%5Cu2013%20charge%20%5BnC%5D%22%2C%20%22category%22%3A%20%22Output%20constancy%22%7D%2C%20%7B%22name%22%3A%20%22Temp.%20%26%20Press.%20Correction%20kTP%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22N_Dw%20%5BcGy%2FnC%5D%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_Q%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_s%22%2C%20%22category%22%3A%20%22Conditions%22%7D%2C%20%7B%22name%22%3A%20%22k_pol%22%2C%20%22category%22%3A%20%22Conditions%22%7D%5D%2C%20%22formula%22%3A%20%22A%2AB%2AC%2AD%2AE%2AF%22%7D]"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 70 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.17. [Section: Dosimetry] Stand-alone acquisition. Enter measured R80; baselines are filled once from commissioning.\nR90 depth in water (Zebra)\nFill baseline once from commissioning R80.\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 80 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.18. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 90 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.19. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 100 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.20. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 110 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.21. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 120 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.22. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 130 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.23. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 140 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.24. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 150 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.25. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 160 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.26. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 170 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.27. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 180 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.28. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 190 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.29. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 200 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.30. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 210 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.31. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 220 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.32. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Range verification (Zebra)",
     "name": "Range R90 (Zebra) – 225 MeV [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 3.33. [Section: Dosimetry] R90 depth in water (Zebra)\nTG-224: ±1 mm"
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 100 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.34. [Section: Dosimetry] Set cell C7 to NO in months when this is not performed — every row below then reads SKIPPED. Daily Sphinx QA already covers spot position and size; this is the quarterly two-angle check. Energy layers are editable (blue).\nGantry 0° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 100 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.35. [Section: Dosimetry] Gantry 0° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 100 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.36. [Section: Dosimetry] Gantry 0° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 100 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.37. [Section: Dosimetry] Gantry 0° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 160 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.38. [Section: Dosimetry] Gantry 0° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 160 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.39. [Section: Dosimetry] Gantry 0° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 160 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.40. [Section: Dosimetry] Gantry 0° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 160 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.41. [Section: Dosimetry] Gantry 0° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 220 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.42. [Section: Dosimetry] Gantry 0° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 220 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.43. [Section: Dosimetry] Gantry 0° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 220 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.44. [Section: Dosimetry] Gantry 0° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G0 – 220 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.45. [Section: Dosimetry] Gantry 0° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 100 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.46. [Section: Dosimetry] Gantry 90° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 100 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.47. [Section: Dosimetry] Gantry 90° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 100 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.48. [Section: Dosimetry] Gantry 90° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 100 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.49. [Section: Dosimetry] Gantry 90° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 160 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.50. [Section: Dosimetry] Gantry 90° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 160 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.51. [Section: Dosimetry] Gantry 90° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 160 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.52. [Section: Dosimetry] Gantry 90° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 160 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.53. [Section: Dosimetry] Gantry 90° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 220 MeV – position deviation [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": 0,
     "warn": 1,
     "fail": 2,
     "tol_mode": "absolute",
     "description": "Template 3.54. [Section: Dosimetry] Gantry 90° · max deviation from planned spot position (all spots in layer)\nTG-224: not specified monthly\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 220 MeV – σx [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.55. [Section: Dosimetry] Gantry 90° · spot size σx (or FWHM x)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 220 MeV – σy [%]",
     "type": "numeric",
     "unit": "%",
     "expected": null,
     "warn": 7.5,
     "fail": 10,
     "tol_mode": "percent",
     "description": "Template 3.56. [Section: Dosimetry] Gantry 90° · spot size σy (or FWHM y)\nTG-224: ±10%\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "Spot QA (quarterly)",
     "name": "Spot QA G90 – 220 MeV – skewness",
     "type": "numeric",
     "unit": "",
     "expected": 0,
     "warn": 0.1,
     "fail": 0.15,
     "tol_mode": "absolute",
     "description": "Template 3.57. [Section: Dosimetry] Gantry 90° · spot skewness (max |value| of x, y)\nTG-224: not specified\nQuarterly item: leave blank in months when spot QA is not performed."
    },
    {
     "category": "kV planar imaging",
     "name": "Spatial resolution (high contrast)",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.01. [Section: Imaging] Per TG-142 / TG-179. myQA imaging licence under investigation; until then, score against the baseline image.\nCompare against the baseline phantom image\nTG-224: baseline"
    },
    {
     "category": "kV planar imaging",
     "name": "Low-contrast detectability",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.02. [Section: Imaging] Compare against the baseline phantom image\nTG-224: baseline"
    },
    {
     "category": "kV planar imaging",
     "name": "Uniformity and noise",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.03. [Section: Imaging] Compare against the baseline phantom image\nTG-224: baseline"
    },
    {
     "category": "kV planar imaging",
     "name": "Artefacts / dead pixels",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.04. [Section: Imaging] Compare against the baseline phantom image\nTG-224: baseline"
    },
    {
     "category": "kV planar imaging",
     "name": "Geometric accuracy / scaling [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 4.05. [Section: Imaging] Known phantom length measured on the image\nBaseline = true phantom length (set once).\nTG-224: ±1 mm"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "HU constancy — water insert [HU]",
     "type": "numeric",
     "unit": "HU",
     "expected": null,
     "warn": 30,
     "fail": 40,
     "tol_mode": "absolute",
     "description": "Template 4.06. [Section: Imaging] Mean HU in the water ROI\nBaseline = commissioned water HU (set once).\nTG-224: baseline ±40 HU"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "Uniformity [HU]",
     "type": "numeric",
     "unit": "HU",
     "expected": 0,
     "warn": 30,
     "fail": 40,
     "tol_mode": "absolute",
     "description": "Template 4.07. [Section: Imaging] Max HU difference between peripheral and central ROIs\nTG-224: baseline"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "Geometric distortion / scaling [mm]",
     "type": "numeric",
     "unit": "mm",
     "expected": null,
     "warn": 0.75,
     "fail": 1,
     "tol_mode": "absolute",
     "description": "Template 4.08. [Section: Imaging] Known phantom distance measured on the reconstruction\nBaseline = true phantom distance (set once).\nTG-224: ±1 mm"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "Spatial resolution",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.09. [Section: Imaging] Compare against the baseline reconstruction\nTG-224: baseline"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "Low-contrast detectability",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.10. [Section: Imaging] Compare against the baseline reconstruction\nTG-224: baseline"
    },
    {
     "category": "CBCT (CATPHAN)",
     "name": "Noise / SNR",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 4.11. [Section: Imaging] Compare against the baseline reconstruction\nTG-224: baseline"
    }
   ]
  },
  {
   "name": "Daily QA – HDR Flexitron",
   "kind": "HDR brachytherapy",
   "list": "Daily QA",
   "frequency": "asneeded",
   "setup": "Flexitron HDR Treatment Day Quality Assurance Tests. Based on the supplied departmental form dated October 20, 2026. Complete on treatment days (on demand). Enter today’s readings; no completed values or signatures from the source form are prefilled. List exceptions in comments.",
   "checks": [
    {
     "name": "Emergency and operating procedures, emergency equipment, and TCS self-test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.01. [Section: HDR treatment-day QA] Procedures and emergency equipment must be present; TCS must pass its self-test.\nSource: 10-20-2026.pdf, check 1.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Video system operational",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.02. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 2.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Intercom operational",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.03. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 3.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Survey meter operational",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.04. [Section: HDR treatment-day QA] Cs-137 check source at 30 cm. Form states: normal < 0.035 mR/hr, ±20%. Retained as a manual acceptance check because the form does not unambiguously define the reference/band.\nSource: 10-20-2026.pdf, check 4.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Survey meter Cs-137 check source reading",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mR/hr",
     "description": "Template 1.04. [Section: HDR treatment-day QA] Record today’s reading at 30 cm. Apply the departmental acceptance criterion above.\nSource: 10-20-2026.pdf, check 4.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Battery check OK",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.05. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 5.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Source air kerma strength and proper decay verification",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.06. [Section: HDR treatment-day QA] Tolerance: ±1%. Compare today’s TCS Sk with today’s decay table Sk.\nSource: 10-20-2026.pdf, check 6.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Source air kerma strength — TCS Sk",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mGy·m²·h⁻¹",
     "description": "Template 1.06. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 6.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Source air kerma strength — decay table Sk",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mGy·m²·h⁻¹",
     "description": "Template 1.06. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 6.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Source air kerma strength — difference",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "%",
     "description": "Template 1.06. [Section: HDR treatment-day QA] Enter the calculated signed percent difference.\nSource: 10-20-2026.pdf, check 6. [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Source%20air%20kerma%20strength%20%5Cu2014%20TCS%20Sk%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%2C%20%7B%22name%22%3A%20%22Source%20air%20kerma%20strength%20%5Cu2014%20decay%20table%20Sk%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%5D%2C%20%22formula%22%3A%20%22100%2A%28A-B%29%2FB%22%7D]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Position verification",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.07. [Section: HDR treatment-day QA] Tolerance: ±1 mm. Use special positioning mode and source position ruler.\nSource: 10-20-2026.pdf, check 7.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Position verification — console distance",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 1.07. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 7.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Position verification — ruler reading",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 1.07. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 7.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Position verification — console minus ruler",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 1.07. [Section: HDR treatment-day QA] Enter console distance minus ruler reading.\nSource: 10-20-2026.pdf, check 7. [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Position%20verification%20%5Cu2014%20console%20distance%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%2C%20%7B%22name%22%3A%20%22Position%20verification%20%5Cu2014%20ruler%20reading%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%5D%2C%20%22formula%22%3A%20%22A-B%22%7D]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Emergency stop test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.08. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 8.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Console stop test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.09. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 9.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Catheter misconnect test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.10. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 10.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Catheter misconnect — channel",
     "category": "HDR treatment-day QA",
     "type": "text",
     "unit": "",
     "description": "Template 1.10. [Section: HDR treatment-day QA] Record the channel tested; no channel is preselected.\nSource: 10-20-2026.pdf, check 10.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Door open test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.11. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 11.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation monitor test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.12. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 12.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dwell time test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.13. [Section: HDR treatment-day QA] Tolerance: ±2%. Record set and measured dwell times.\nSource: 10-20-2026.pdf, check 13.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dwell time — set time",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "s",
     "description": "Template 1.13. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 13.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dwell time — measured time",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "s",
     "description": "Template 1.13. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 13.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dwell time — difference",
     "category": "HDR treatment-day QA",
     "type": "numeric",
     "unit": "%",
     "description": "Template 1.13. [Section: HDR treatment-day QA] Enter the calculated signed percent difference.\nSource: 10-20-2026.pdf, check 13. [derived: %7B%22inputs%22%3A%20%5B%7B%22name%22%3A%20%22Dwell%20time%20%5Cu2014%20set%20time%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%2C%20%7B%22name%22%3A%20%22Dwell%20time%20%5Cu2014%20measured%20time%22%2C%20%22category%22%3A%20%22HDR%20treatment-day%20QA%22%7D%5D%2C%20%22formula%22%3A%20%22100%2A%28A-B%29%2FA%22%7D]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation warning light test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.14. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 14.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Position indicator light test",
     "category": "HDR treatment-day QA",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.15. [Section: HDR treatment-day QA] \nSource: 10-20-2026.pdf, check 15.",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    }
   ],
   "departmental_id": "hdr-daily-2026-v1",
   "install_machine": "HDR Flexitron"
  },
  {
   "name": "Source Exchange QA – HDR Flexitron",
   "kind": "HDR brachytherapy",
   "list": "Source Exchange QA",
   "frequency": "asneeded",
   "setup": "Add the approved departmental HDR checklist before use.",
   "checks": []
  },
  {
   "name": "Monthly QA – TrueBeam",
   "kind": "Linac",
   "list": "Monthly QA",
   "frequency": "monthly",
   "departmental_id": "truebeam-monthly-2026-v1",
   "install_machine": "TrueBeam",
   "setup": "Monthly TrueBeam QA from TB_Monthly_QA_2026_October.xlsx, Parts A–F. Today’s inputs start blank. Baselines come from the labeled Baseline cells. Use Upload Excel to read a completed workbook or Download Excel to continue in the original workbook. Checks with inconsistent source criteria are marked for manual physics review; original Excel formulas are preserved.",
   "checks": [
    {
     "name": "Warning Lights",
     "category": "Safety",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.01. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!C6. [excel: A. Safety!C6]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Intercom",
     "category": "Safety",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.02. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!C7. [excel: A. Safety!C7]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Video Monitor",
     "category": "Safety",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.03. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!C8. [excel: A. Safety!C8]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Door Interlock",
     "category": "Safety",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.04. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!C9. [excel: A. Safety!C9]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Emergency Off Switches",
     "category": "Safety",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 1.05. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!C10. [excel: A. Safety!C10]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Gantry digital readout — 180°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.01. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F8. [excel: B. Mechanical!F8]",
     "expected": 180,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Gantry digital readout — 90°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.02. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G8. [excel: B. Mechanical!G8]",
     "expected": 90,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Gantry digital readout — 0°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.03. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H8. [excel: B. Mechanical!H8]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Gantry digital readout — 270°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.04. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!I8. [excel: B. Mechanical!I8]",
     "expected": 270,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Collimator digital readout — 90°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.05. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F12. [excel: B. Mechanical!F12]",
     "expected": 90,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Collimator digital readout — 0°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.06. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G12. [excel: B. Mechanical!G12]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Collimator digital readout — 270°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.07. [Section: Mechanical] Use a digital level for the mechanical reference; tolerance ±1°. At nominal 0°, enter 0 rather than the equivalent 360°.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H12. [excel: B. Mechanical!H12]",
     "expected": 270,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Optical distance indicator",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.08. [Section: Mechanical] Test Condition: Gantry/Collimator @ 0, use calibrated front pointer and set couch height to 100 cm\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F18. [excel: B. Mechanical!F18]",
     "expected": 100,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Crosshair centricity — maximum difference",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.09. [Section: Mechanical] Test Condition: 100 SSD, Gantry @ 0, define a stationary crosshair w/ Collimator @ 0, then rotate Collimator from 90 to 270 and note offset from center of stationary crosshar to center of lightfield crosshair Criterion: <1 mm; assess strict boundary manually.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F23. [excel: B. Mechanical!F23]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — Y1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.10. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E31. [excel: B. Mechanical!E31]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — Y2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.11. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F31. [excel: B. Mechanical!F31]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — X1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.12. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H31. [excel: B. Mechanical!H31]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — X2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.13. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!I31. [excel: B. Mechanical!I31]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — Y total",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.14. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G31. [excel: B. Mechanical!G31] [calc: workbook]",
     "expected": 4,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 4×4 cm — X total",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.15. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!J31. [excel: B. Mechanical!J31] [calc: workbook]",
     "expected": 4,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — Y1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.16. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E32. [excel: B. Mechanical!E32]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — Y2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.17. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F32. [excel: B. Mechanical!F32]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — X1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.18. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H32. [excel: B. Mechanical!H32]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — X2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.19. [Section: Mechanical] Record each jaw as in the workbook. Assess ±2 mm total field size using the original workbook result. Individual jaw reference/sign convention is not defined by this table.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!I32. [excel: B. Mechanical!I32]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — Y total",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.20. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G32. [excel: B. Mechanical!G32] [calc: workbook]",
     "expected": 30,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Symmetric field 30×30 cm — X total",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.21. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!J32. [excel: B. Mechanical!J32] [calc: workbook]",
     "expected": 30,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Asymmetric field — X1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.22. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E35. [excel: B. Mechanical!E35]",
     "expected": 1.9,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Asymmetric field — X2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.23. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H35. [excel: B. Mechanical!H35]",
     "expected": -1.9,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Asymmetric field — Y1",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.24. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E36. [excel: B. Mechanical!E36]",
     "expected": 9,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Asymmetric field — Y2",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.25. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H36. [excel: B. Mechanical!H36]",
     "expected": -9,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Couch translation — Vertical",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.26. [Section: Mechanical] Test Condition: Use ruler or graph paper to assess 10 cm shift against laser or crosshair Printed ±1 mm; workbook formula uses ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F41. [excel: B. Mechanical!F41] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Couch translation — Lateral",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.27. [Section: Mechanical] Test Condition: Use ruler or graph paper to assess 10 cm shift against laser or crosshair Printed ±1 mm; workbook formula uses ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F42. [excel: B. Mechanical!F42] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Couch translation — Longitudinal",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.28. [Section: Mechanical] Test Condition: Use ruler or graph paper to assess 10 cm shift against laser or crosshair Printed ±1 mm; workbook formula uses ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F43. [excel: B. Mechanical!F43] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Couch angle — 90°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.29. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F48. [excel: B. Mechanical!F48]",
     "expected": 90,
     "warn": null,
     "fail": 0.5,
     "tol_mode": "absolute"
    },
    {
     "name": "Couch angle — 270°",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "°",
     "description": "Template 2.30. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G48. [excel: B. Mechanical!G48]",
     "expected": 270,
     "warn": null,
     "fail": 0.5,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Right-Ax",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.31. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!D54. [excel: B. Mechanical!D54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Right-Cor",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.32. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E54. [excel: B. Mechanical!E54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Left-Ax",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.33. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F54. [excel: B. Mechanical!F54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Left-Cor",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.34. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!G54. [excel: B. Mechanical!G54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Ceil-Sag",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.35. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!H54. [excel: B. Mechanical!H54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Laser alignment — Ceil-Ax",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.36. [Section: Mechanical] Test Condition: Reference: looking at gantry, isocenter phantom aligned to lightfield @ 100cm SSD\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!I54. [excel: B. Mechanical!I54]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Winston–Lutz — Collimator maximum total delta",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.37. [Section: Mechanical] Criterion: <1 mm. Use the source workbook procedure and assess the strict boundary manually.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E63. [excel: B. Mechanical!E63]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Winston–Lutz — Gantry maximum total delta",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.38. [Section: Mechanical] Criterion: <1 mm. Use the source workbook procedure and assess the strict boundary manually.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E66. [excel: B. Mechanical!E66]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Winston–Lutz — Couch maximum total delta",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 2.39. [Section: Mechanical] Criterion: <1 mm. Use the source workbook procedure and assess the strict boundary manually.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E69. [excel: B. Mechanical!E69]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 6X Vertical",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.40. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E78. [excel: B. Mechanical!E78] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 6X Horizontal",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.41. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F78. [excel: B. Mechanical!F78] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 10X Vertical",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.42. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E79. [excel: B. Mechanical!E79] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 10X Horizontal",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.43. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F79. [excel: B. Mechanical!F79] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 6X FFF Vertical",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.44. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E80. [excel: B. Mechanical!E80] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 6X FFF Horizontal",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.45. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F80. [excel: B. Mechanical!F80] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 10X FFF Vertical",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.46. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!E81. [excel: B. Mechanical!E81] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Radiation field size — 10X FFF Horizontal",
     "category": "Mechanical",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 2.47. [Section: Mechanical] Printed tolerance: ±2 mm in any direction or ±1 mm per jaw. Original workbook formula instead evaluates ±1 cm.\nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!F81. [excel: B. Mechanical!F81] Source formula or instructions conflict with the printed criterion; manual physics review required. Portal uses the printed limit; original Excel formulas differ and require review.",
     "expected": 10,
     "warn": null,
     "fail": 0.2,
     "tol_mode": "absolute"
    },
    {
     "name": "Chamber model",
     "category": "Dosimetry",
     "type": "text",
     "unit": "",
     "description": "Template 3.01. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E10. [excel: C. Dosimetry!E10]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Chamber serial number",
     "category": "Dosimetry",
     "type": "text",
     "unit": "",
     "description": "Template 3.02. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E11. [excel: C. Dosimetry!E11]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Chamber calibration",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁷ Gy/C",
     "description": "Template 3.03. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E12. [excel: C. Dosimetry!E12]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Electrometer model",
     "category": "Dosimetry",
     "type": "text",
     "unit": "",
     "description": "Template 3.04. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E14. [excel: C. Dosimetry!E14]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Electrometer serial number",
     "category": "Dosimetry",
     "type": "text",
     "unit": "",
     "description": "Template 3.05. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E15. [excel: C. Dosimetry!E15]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Electrometer calibration",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.06. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E16. [excel: C. Dosimetry!E16]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Temperature",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "°C",
     "description": "Template 3.07. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E18. [excel: C. Dosimetry!E18]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Pressure",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "hPa",
     "description": "Template 3.08. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E19. [excel: C. Dosimetry!E19]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Temperature–pressure correction",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.09. [Section: Dosimetry] Calculated using the original workbook formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E20. [excel: C. Dosimetry!E20] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.10. [Section: Dosimetry] Test Condition: 103.5cm SSD, depth = 2.5cm, (note that the chamber will be @ depth = 1cm when placed inside 5cm solid water slab with drilled chamber hole, thus need to add additional 1.5cm solid water), -300 V, use clinical dose rate, e.g. 600 MU/min for FF and 1400 MU/min for FFF, Deliver 100 MU\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F24. [excel: C. Dosimetry!F24]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.11. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G24. [excel: C. Dosimetry!G24] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.12. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I24. [excel: C. Dosimetry!I24] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.13. [Section: Dosimetry] Test Condition: 103.5cm SSD, depth = 2.5cm, (note that the chamber will be @ depth = 1cm when placed inside 5cm solid water slab with drilled chamber hole, thus need to add additional 1.5cm solid water), -300 V, use clinical dose rate, e.g. 600 MU/min for FF and 1400 MU/min for FFF, Deliver 100 MU\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F25. [excel: C. Dosimetry!F25]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.14. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G25. [excel: C. Dosimetry!G25] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.15. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I25. [excel: C. Dosimetry!I25] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X FFF raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.16. [Section: Dosimetry] Test Condition: 103.5cm SSD, depth = 2.5cm, (note that the chamber will be @ depth = 1cm when placed inside 5cm solid water slab with drilled chamber hole, thus need to add additional 1.5cm solid water), -300 V, use clinical dose rate, e.g. 600 MU/min for FF and 1400 MU/min for FFF, Deliver 100 MU\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F26. [excel: C. Dosimetry!F26]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X FFF corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.17. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G26. [excel: C. Dosimetry!G26] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 6X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.18. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I26. [excel: C. Dosimetry!I26] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X FFF raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.19. [Section: Dosimetry] Test Condition: 103.5cm SSD, depth = 2.5cm, (note that the chamber will be @ depth = 1cm when placed inside 5cm solid water slab with drilled chamber hole, thus need to add additional 1.5cm solid water), -300 V, use clinical dose rate, e.g. 600 MU/min for FF and 1400 MU/min for FFF, Deliver 100 MU\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F27. [excel: C. Dosimetry!F27]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X FFF corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.20. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G27. [excel: C. Dosimetry!G27] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Output constancy — 10X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.21. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I27. [excel: C. Dosimetry!I27] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.22. [Section: Dosimetry] Test Condition: Add 5cm solid water, don't change table height, i.e. SSD = 98.5cm, depth = 7.5cm, Deliver 100 MU \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G33. [excel: C. Dosimetry!G33]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.23. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!H33. [excel: C. Dosimetry!H33] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X ratio",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.24. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I33. [excel: C. Dosimetry!I33] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.25. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!J33. [excel: C. Dosimetry!J33] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.26. [Section: Dosimetry] Test Condition: Add 5cm solid water, don't change table height, i.e. SSD = 98.5cm, depth = 7.5cm, Deliver 100 MU \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G34. [excel: C. Dosimetry!G34]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.27. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!H34. [excel: C. Dosimetry!H34] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X ratio",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.28. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I34. [excel: C. Dosimetry!I34] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.29. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!J34. [excel: C. Dosimetry!J34] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X FFF raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.30. [Section: Dosimetry] Test Condition: Add 5cm solid water, don't change table height, i.e. SSD = 98.5cm, depth = 7.5cm, Deliver 100 MU \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G35. [excel: C. Dosimetry!G35]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X FFF corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.31. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!H35. [excel: C. Dosimetry!H35] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X FFF ratio",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.32. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I35. [excel: C. Dosimetry!I35] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 6X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.33. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!J35. [excel: C. Dosimetry!J35] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X FFF raw reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.34. [Section: Dosimetry] Test Condition: Add 5cm solid water, don't change table height, i.e. SSD = 98.5cm, depth = 7.5cm, Deliver 100 MU \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G36. [excel: C. Dosimetry!G36]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X FFF corrected reading",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "10⁻⁸ C",
     "description": "Template 3.35. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!H36. [excel: C. Dosimetry!H36] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X FFF ratio",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.36. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!I36. [excel: C. Dosimetry!I36] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Energy constancy — 10X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.37. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!J36. [excel: C. Dosimetry!J36] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X full dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.38. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D43. [excel: C. Dosimetry!D43]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X half dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.39. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E43. [excel: C. Dosimetry!E43]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.40. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F43. [excel: C. Dosimetry!F43] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X full dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.41. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D44. [excel: C. Dosimetry!D44]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X half dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.42. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E44. [excel: C. Dosimetry!E44]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.43. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F44. [excel: C. Dosimetry!F44] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X FFF full dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.44. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D45. [excel: C. Dosimetry!D45]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X FFF half dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.45. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E45. [excel: C. Dosimetry!E45]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 6X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.46. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F45. [excel: C. Dosimetry!F45] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X FFF full dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.47. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D46. [excel: C. Dosimetry!D46]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X FFF half dose rate",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "",
     "description": "Template 3.48. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 100 MU and both full and half clinical dose rates.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E46. [excel: C. Dosimetry!E46]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Dose-rate constancy — 10X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.49. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F46. [excel: C. Dosimetry!F46] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X ION1",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.50. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D51. [excel: C. Dosimetry!D51]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X ION2",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.51. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E51. [excel: C. Dosimetry!E51]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.52. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F51. [excel: C. Dosimetry!F51] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X ION1",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.53. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D52. [excel: C. Dosimetry!D52]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X ION2",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.54. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E52. [excel: C. Dosimetry!E52]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.55. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F52. [excel: C. Dosimetry!F52] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X FFF ION1",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.56. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D53. [excel: C. Dosimetry!D53]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X FFF ION2",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.57. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E53. [excel: C. Dosimetry!E53]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 6X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.58. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F53. [excel: C. Dosimetry!F53] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X FFF ION1",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.59. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!D54. [excel: C. Dosimetry!D54]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X FFF ION2",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "MU",
     "description": "Template 3.60. [Section: Dosimetry] Test Condition: Same setup as test C.2, use 300 MU and full dose rate\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!E54. [excel: C. Dosimetry!E54]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Backup monitor — 10X FFF difference",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.61. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!F54. [excel: C. Dosimetry!F54] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X Y flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.62. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G59. [excel: C. Dosimetry!G59]",
     "expected": 2.3,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X Y symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.63. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G60. [excel: C. Dosimetry!G60]",
     "expected": 0.1,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X X flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.64. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G61. [excel: C. Dosimetry!G61]",
     "expected": 1.9,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X X symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.65. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G62. [excel: C. Dosimetry!G62]",
     "expected": 0.1,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X Y flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.66. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G63. [excel: C. Dosimetry!G63]",
     "expected": 1.8,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X Y symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.67. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G64. [excel: C. Dosimetry!G64]",
     "expected": 0.3,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X X flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.68. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G65. [excel: C. Dosimetry!G65]",
     "expected": 1.5,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X X symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.69. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G66. [excel: C. Dosimetry!G66]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X FFF Y flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.70. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G67. [excel: C. Dosimetry!G67]",
     "expected": 13,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X FFF Y symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.71. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G68. [excel: C. Dosimetry!G68]",
     "expected": 0.2,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X FFF X flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.72. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G69. [excel: C. Dosimetry!G69]",
     "expected": 12.6,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 6X FFF X symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.73. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G70. [excel: C. Dosimetry!G70]",
     "expected": -0.6,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X FFF Y flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.74. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G71. [excel: C. Dosimetry!G71]",
     "expected": 21.2,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X FFF Y symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.75. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G72. [excel: C. Dosimetry!G72]",
     "expected": 0.6,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X FFF X flatness",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.76. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G73. [excel: C. Dosimetry!G73]",
     "expected": 20.8,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Profile — 10X FFF X symmetry",
     "category": "Dosimetry",
     "type": "numeric",
     "unit": "%",
     "description": "Template 3.77. [Section: Dosimetry] Test Condition: SSD = 99cm to surface of profiler, add 9cm solid water, FS = 20x20, MU = 100 for all engergies, clinical DR. Difference is in percentage points, matching the workbook subtraction formula.\nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!G74. [excel: C. Dosimetry!G74]",
     "expected": -0.5,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC field 10×10 — Vertical",
     "category": "MLC",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 4.01. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F26. [excel: D. MLC!F26]",
     "expected": 9.88,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC field 10×10 — Horizontal",
     "category": "MLC",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 4.02. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F27. [excel: D. MLC!F27]",
     "expected": 9.97,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC field 15×15 — Vertical",
     "category": "MLC",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 4.03. [Section: MLC] 15×15 baseline table differs from the embedded setup note/formula.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F29. [excel: D. MLC!F29] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 14.87,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC field 15×15 — Horizontal",
     "category": "MLC",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 4.04. [Section: MLC] 15×15 baseline table differs from the embedded setup note/formula.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F30. [excel: D. MLC!F30] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 15.07,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Static — Failing peaks",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.05. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F50. [excel: D. MLC!F50]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Static — Maximum difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.06. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F51. [excel: D. MLC!F51]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Static — Standard deviation",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.07. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F52. [excel: D. MLC!F52]",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Static — Interstrip ratio",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.08. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F53. [excel: D. MLC!F53]",
     "expected": 33,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Static — Isocenter-to-strip distance",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.09. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F54. [excel: D. MLC!F54]",
     "expected": -0.7,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Rotational — Failing peaks",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.10. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F57. [excel: D. MLC!F57]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Rotational — Maximum difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.11. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F58. [excel: D. MLC!F58]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Rotational — Standard deviation",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.12. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F59. [excel: D. MLC!F59]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Rotational — Interstrip ratio",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.13. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F60. [excel: D. MLC!F60]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Picket fence Rotational — Isocenter-to-strip distance",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.14. [Section: MLC] Printed tolerance is ±1% for the test as a whole; metric-specific units/limits are not defined. Assess in DoseLab and document exceptions.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F61. [excel: D. MLC!F61]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -4.5 cm — R_LS",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.15. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!C77. [excel: D. MLC!C77]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -4.5 cm — Ropen",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.16. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!C78. [excel: D. MLC!C78]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -4.5 cm — Rcorr",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.17. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!C79. [excel: D. MLC!C79] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -4.5 cm — difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "%",
     "description": "Template 4.18. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!C80. [excel: D. MLC!C80] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2.5,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -1.5 cm — R_LS",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.19. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!D77. [excel: D. MLC!D77]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -1.5 cm — Ropen",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.20. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!D78. [excel: D. MLC!D78]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -1.5 cm — Rcorr",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.21. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!D79. [excel: D. MLC!D79] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at -1.5 cm — difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "%",
     "description": "Template 4.22. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!D80. [excel: D. MLC!D80] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2.5,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 1.5 cm — R_LS",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.23. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!E77. [excel: D. MLC!E77]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 1.5 cm — Ropen",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.24. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!E78. [excel: D. MLC!E78]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 1.5 cm — Rcorr",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.25. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!E79. [excel: D. MLC!E79] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 1.5 cm — difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "%",
     "description": "Template 4.26. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!E80. [excel: D. MLC!E80] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2.5,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 4.5 cm — R_LS",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.27. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F77. [excel: D. MLC!F77]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 4.5 cm — Ropen",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.28. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F78. [excel: D. MLC!F78]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 4.5 cm — Rcorr",
     "category": "MLC",
     "type": "numeric",
     "unit": "",
     "description": "Template 4.29. [Section: MLC] Use a 10×10 pixel ROI as specified by the workbook.\nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F79. [excel: D. MLC!F79] [calc: workbook]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MLC travel speed at 4.5 cm — difference",
     "category": "MLC",
     "type": "numeric",
     "unit": "%",
     "description": "Template 4.30. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!F80. [excel: D. MLC!F80] [calc: workbook]",
     "expected": 0,
     "warn": null,
     "fail": 2.5,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Vertical",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.01. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E33. [excel: E. Patient Alignment!E33]",
     "expected": 2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Longitudinal",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.02. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E34. [excel: E. Patient Alignment!E34]",
     "expected": 2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Lateral",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.03. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E35. [excel: E. Patient Alignment!E35]",
     "expected": -2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Rotation",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.04. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E36. [excel: E. Patient Alignment!E36]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Pitch",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.05. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E37. [excel: E. Patient Alignment!E37]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "kV/kV — Roll",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.06. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E38. [excel: E. Patient Alignment!E38]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Vertical",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.07. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L33. [excel: E. Patient Alignment!L33]",
     "expected": 2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Longitudinal",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.08. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L34. [excel: E. Patient Alignment!L34]",
     "expected": 2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Lateral",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.09. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L35. [excel: E. Patient Alignment!L35]",
     "expected": -2,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Rotation",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.10. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L36. [excel: E. Patient Alignment!L36]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Pitch",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.11. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L37. [excel: E. Patient Alignment!L37]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT — Roll",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "°",
     "description": "Template 5.12. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L38. [excel: E. Patient Alignment!L38]",
     "expected": 0,
     "warn": null,
     "fail": 1,
     "tol_mode": "absolute"
    },
    {
     "name": "Post-correction CBCT — Vertical",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.13. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E46. [excel: E. Patient Alignment!E46]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Post-correction CBCT — Longitudinal",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.14. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E47. [excel: E. Patient Alignment!E47]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Post-correction CBCT — Lateral",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.15. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!E48. [excel: E. Patient Alignment!E48]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Perfect Pitch CBCT — Vertical",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.16. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L46. [excel: E. Patient Alignment!L46]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Perfect Pitch CBCT — Longitudinal",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.17. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L47. [excel: E. Patient Alignment!L47]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Perfect Pitch CBCT — Lateral",
     "category": "Patient alignment",
     "type": "numeric",
     "unit": "cm",
     "description": "Template 5.18. [Section: Patient alignment] Follow the workbook positioning/repositioning steps. Watch for couch collision during rotations.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!L48. [excel: E. Patient Alignment!L48]",
     "expected": 0,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "Phantom + marker aligned to crosshair within 1 mm",
     "category": "Patient alignment",
     "type": "boolean",
     "unit": "Pass/Fail",
     "description": "Template 5.19. [Section: Patient alignment] Workbook Step 5, gantry 0 and 90.\nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!I40. [excel: E. Patient Alignment!I40]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Scaling discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.01. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F49. [excel: F. Image Quality!F49] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Geometric distortion (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.02. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F50. [excel: F. Image Quality!F50] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Spatial resolution (lp/mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "lp/mm",
     "description": "Template 6.03. [Section: Image quality] (Tol. ± 0.07 lp/mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F51. [excel: F. Image Quality!F51] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0.46,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Overall uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.04. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F52. [excel: F. Image Quality!F52]",
     "expected": 96,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Minimum uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.05. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F53. [excel: F. Image Quality!F53]",
     "expected": 96,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Contrast (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.06. [Section: Image quality] (Tol. ± 1%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F54. [excel: F. Image Quality!F54]",
     "expected": 1,
     "warn": null,
     "fail": 1.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — CNR (arb)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "arb",
     "description": "Template 6.07. [Section: Image quality] (Tol. ± 1). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F55. [excel: F. Image Quality!F55]",
     "expected": 0.3,
     "warn": null,
     "fail": 1.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Max HU deviation (HU)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "HU",
     "description": "Template 6.08. [Section: Image quality] (Tol. ± 100HU). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F56. [excel: F. Image Quality!F56]",
     "expected": 180,
     "warn": null,
     "fail": 100.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Head — Slice width discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.09. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F57. [excel: F. Image Quality!F57] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 2,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Scaling discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.10. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F60. [excel: F. Image Quality!F60] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Geometric distortion (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.11. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F61. [excel: F. Image Quality!F61] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Spatial resolution (lp/mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "lp/mm",
     "description": "Template 6.12. [Section: Image quality] (Tol. ± 0.1 lp/mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F62. [excel: F. Image Quality!F62]",
     "expected": 0.54,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Overall uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.13. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F63. [excel: F. Image Quality!F63]",
     "expected": 98,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Minimum uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.14. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F64. [excel: F. Image Quality!F64]",
     "expected": 98,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Contrast (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.15. [Section: Image quality] (Tol. ± 0.5%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F65. [excel: F. Image Quality!F65]",
     "expected": 1,
     "warn": null,
     "fail": 0.5,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — CNR (arb)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "arb",
     "description": "Template 6.16. [Section: Image quality] (Tol. ± 1). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F66. [excel: F. Image Quality!F66]",
     "expected": 2,
     "warn": null,
     "fail": 1.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Max HU deviation (HU)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "HU",
     "description": "Template 6.17. [Section: Image quality] (Tol. ± 100HU). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F67. [excel: F. Image Quality!F67]",
     "expected": 0,
     "warn": null,
     "fail": 100.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Pelvis — Slice width discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.18. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F68. [excel: F. Image Quality!F68] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 2,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — Scaling discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.19. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F71. [excel: F. Image Quality!F71] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 3.5,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — Spatial resolution (lp/mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "lp/mm",
     "description": "Template 6.20. [Section: Image quality] (Tol. ± 0.07 lp/mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F72. [excel: F. Image Quality!F72]",
     "expected": 0.34,
     "warn": null,
     "fail": 0.07,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — Minimum uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.21. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F73. [excel: F. Image Quality!F73]",
     "expected": 100,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — Contrast (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.22. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F74. [excel: F. Image Quality!F74]",
     "expected": 2.6,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — CNR (arb)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "arb",
     "description": "Template 6.23. [Section: Image quality] (Tol. ± 5). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F75. [excel: F. Image Quality!F75]",
     "expected": 52.6,
     "warn": null,
     "fail": 5.0,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — X positioning offset (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.24. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F76. [excel: F. Image Quality!F76] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "MV — Y positioning offset (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.25. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F77. [excel: F. Image Quality!F77] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — Scaling discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.26. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F80. [excel: F. Image Quality!F80] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — Spatial resolution (lp/mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "lp/mm",
     "description": "Template 6.27. [Section: Image quality] (Tol. ± 0.07 lp/mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F81. [excel: F. Image Quality!F81]",
     "expected": 1.25,
     "warn": null,
     "fail": 0.07,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — Minimum uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.28. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F82. [excel: F. Image Quality!F82]",
     "expected": 100,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — Contrast (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.29. [Section: Image quality] (Tol. ± 3%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F83. [excel: F. Image Quality!F83]",
     "expected": 19,
     "warn": null,
     "fail": 3.0,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — CNR (arb)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "arb",
     "description": "Template 6.30. [Section: Image quality] (Tol. ± 50). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F84. [excel: F. Image Quality!F84]",
     "expected": 65,
     "warn": null,
     "fail": 50.0,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — X positioning offset (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.31. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F85. [excel: F. Image Quality!F85] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "kV — Y positioning offset (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.32. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F86. [excel: F. Image Quality!F86] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Scaling discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.33. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F98. [excel: F. Image Quality!F98] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Geometric distortion (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.34. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F99. [excel: F. Image Quality!F99] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 0,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Spatial resolution (lp/mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "lp/mm",
     "description": "Template 6.35. [Section: Image quality] (Tol. ± 0.1 lp/mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F100. [excel: F. Image Quality!F100]",
     "expected": 0.54,
     "warn": null,
     "fail": 0.1,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Overall uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.36. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F101. [excel: F. Image Quality!F101]",
     "expected": 98,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Minimum uniformity (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.37. [Section: Image quality] (Tol. ± 2%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F102. [excel: F. Image Quality!F102]",
     "expected": 98,
     "warn": null,
     "fail": 2.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Contrast (%)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "%",
     "description": "Template 6.38. [Section: Image quality] (Tol. ± 0.5%). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F103. [excel: F. Image Quality!F103]",
     "expected": 1,
     "warn": null,
     "fail": 0.5,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — CNR (arb)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "arb",
     "description": "Template 6.39. [Section: Image quality] (Tol. ± 1). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F104. [excel: F. Image Quality!F104]",
     "expected": 2,
     "warn": null,
     "fail": 1.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Max HU deviation (HU)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "HU",
     "description": "Template 6.40. [Section: Image quality] (Tol. ± 100HU). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F105. [excel: F. Image Quality!F105]",
     "expected": 0,
     "warn": null,
     "fail": 100.0,
     "tol_mode": "absolute"
    },
    {
     "name": "CBCT Large Pelvis — Slice width discrepancy (mm)",
     "category": "Image quality",
     "type": "numeric",
     "unit": "mm",
     "description": "Template 6.41. [Section: Image quality] (Tol. < 1mm). Use the original Catphan/SNC image acquisition and DoseLab analysis procedure.\nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!F106. [excel: F. Image Quality!F106] Source formula or instructions conflict with the printed criterion; manual physics review required. No automatic tolerance applied.",
     "expected": 2,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "Safety",
     "type": "text",
     "unit": "",
     "description": "Template 1.06. [Section: Safety] \nSource: TB_Monthly_QA_2026_October.xlsx, A. Safety!B13. [excel: A. Safety!B13]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "Mechanical",
     "type": "text",
     "unit": "",
     "description": "Template 2.48. [Section: Mechanical] \nSource: TB_Monthly_QA_2026_October.xlsx, B. Mechanical!B84. [excel: B. Mechanical!B84]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "Dosimetry",
     "type": "text",
     "unit": "",
     "description": "Template 3.78. [Section: Dosimetry] \nSource: TB_Monthly_QA_2026_October.xlsx, C. Dosimetry!B77. [excel: C. Dosimetry!B77]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "MLC",
     "type": "text",
     "unit": "",
     "description": "Template 4.31. [Section: MLC] \nSource: TB_Monthly_QA_2026_October.xlsx, D. MLC!B84. [excel: D. MLC!B84]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "Patient alignment",
     "type": "text",
     "unit": "",
     "description": "Template 5.20. [Section: Patient alignment] \nSource: TB_Monthly_QA_2026_October.xlsx, E. Patient Alignment!B54. [excel: E. Patient Alignment!B54]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
    },
    {
     "name": "Section comments",
     "category": "Image quality",
     "type": "text",
     "unit": "",
     "description": "Template 6.42. [Section: Image quality] \nSource: TB_Monthly_QA_2026_October.xlsx, F. Image Quality!B89. [excel: F. Image Quality!B89]",
     "expected": null,
     "warn": null,
     "fail": null,
     "tol_mode": "absolute"
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
   "name": "Eyeline GTR4",
   "kind": "Proton eyeline",
   "notes": "Eyeline (PAT006-FSTR4): fixed proton beam line for ocular treatments."
  },
  {
   "name": "TrueBeam",
   "kind": "Linac"
  },
  {
   "name": "Ethos",
   "kind": "Varian Ethos"
  },
  {
   "name": "Big Bore CT (7064)",
   "kind": "CT simulator"
  },
  {
   "name": "MRI Sim",
   "kind": "MRI simulator"
  },
  {
   "name": "HDR Flexitron",
   "kind": "HDR brachytherapy"
  }
 ],
 "pbs_tolerance_source": "Daily QA-TG-224-Tests.xls",
 "pbs_tolerances": [
  {
   "key": "distal|100|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 172
  },
  {
   "key": "dfo|100|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 173
  },
  {
   "key": "proximal|100|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 174
  },
  {
   "key": "width|100|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 175
  },
  {
   "key": "distal|150|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 182
  },
  {
   "key": "dfo|150|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 183
  },
  {
   "key": "proximal|150|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 184
  },
  {
   "key": "width|150|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 185
  },
  {
   "key": "distal|200|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 192
  },
  {
   "key": "dfo|200|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 193
  },
  {
   "key": "proximal|200|",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 194
  },
  {
   "key": "width|200|",
   "unit": "mm",
   "warn": 0.1,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 195
  },
  {
   "key": "pos_x|225|1",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 204
  },
  {
   "key": "pos_y|225|1",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 205
  },
  {
   "key": "sigma_x|225|1",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.6,
   "tol_mode": "absolute",
   "source_row": 206
  },
  {
   "key": "sigma_y|225|1",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.6,
   "tol_mode": "absolute",
   "source_row": 207
  },
  {
   "key": "skew_x|225|1",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 208
  },
  {
   "key": "skew_y|225|1",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 209
  },
  {
   "key": "intensity|225|1",
   "unit": "%",
   "warn": 12.0,
   "fail": 15.0,
   "tol_mode": "absolute",
   "source_row": 210
  },
  {
   "key": "pos_x|200|2",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 217
  },
  {
   "key": "pos_y|200|2",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 218
  },
  {
   "key": "sigma_x|200|2",
   "unit": "mm",
   "warn": 0.5,
   "fail": 0.8,
   "tol_mode": "absolute",
   "source_row": 219
  },
  {
   "key": "sigma_y|200|2",
   "unit": "mm",
   "warn": 0.5,
   "fail": 0.8,
   "tol_mode": "absolute",
   "source_row": 220
  },
  {
   "key": "skew_x|200|2",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 221
  },
  {
   "key": "skew_y|200|2",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 222
  },
  {
   "key": "intensity|200|2",
   "unit": "%",
   "warn": 12.0,
   "fail": 15.0,
   "tol_mode": "absolute",
   "source_row": 223
  },
  {
   "key": "pos_x|180|3",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 230
  },
  {
   "key": "pos_y|180|3",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 231
  },
  {
   "key": "sigma_x|180|3",
   "unit": "mm",
   "warn": 0.5,
   "fail": 0.8,
   "tol_mode": "absolute",
   "source_row": 232
  },
  {
   "key": "sigma_y|180|3",
   "unit": "mm",
   "warn": 0.5,
   "fail": 0.8,
   "tol_mode": "absolute",
   "source_row": 233
  },
  {
   "key": "skew_x|180|3",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 234
  },
  {
   "key": "skew_y|180|3",
   "unit": "",
   "warn": 0.8,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 235
  },
  {
   "key": "intensity|180|3",
   "unit": "%",
   "warn": 12.0,
   "fail": 15.0,
   "tol_mode": "absolute",
   "source_row": 236
  },
  {
   "key": "pos_x|160|4",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 243
  },
  {
   "key": "pos_y|160|4",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 244
  },
  {
   "key": "sigma_x|160|4",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 245
  },
  {
   "key": "sigma_y|160|4",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 246
  },
  {
   "key": "skew_x|160|4",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 247
  },
  {
   "key": "skew_y|160|4",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 248
  },
  {
   "key": "intensity|160|4",
   "unit": "%",
   "warn": 2.5,
   "fail": 3.0,
   "tol_mode": "absolute",
   "source_row": 249
  },
  {
   "key": "pos_x|140|5",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 256
  },
  {
   "key": "pos_y|140|5",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 257
  },
  {
   "key": "sigma_x|140|5",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 258
  },
  {
   "key": "sigma_y|140|5",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 259
  },
  {
   "key": "skew_x|140|5",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 260
  },
  {
   "key": "skew_y|140|5",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 261
  },
  {
   "key": "intensity|140|5",
   "unit": "%",
   "warn": 2.5,
   "fail": 3.0,
   "tol_mode": "absolute",
   "source_row": 262
  },
  {
   "key": "pos_x|120|6",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 269
  },
  {
   "key": "pos_y|120|6",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 270
  },
  {
   "key": "sigma_x|120|6",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 271
  },
  {
   "key": "sigma_y|120|6",
   "unit": "mm",
   "warn": 0.4,
   "fail": 0.5,
   "tol_mode": "absolute",
   "source_row": 272
  },
  {
   "key": "skew_x|120|6",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 273
  },
  {
   "key": "skew_y|120|6",
   "unit": "",
   "warn": 0.25,
   "fail": 0.3,
   "tol_mode": "absolute",
   "source_row": 274
  },
  {
   "key": "intensity|120|6",
   "unit": "%",
   "warn": 2.5,
   "fail": 3.0,
   "tol_mode": "absolute",
   "source_row": 275
  },
  {
   "key": "coin_x||",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 284
  },
  {
   "key": "coin_y||",
   "unit": "mm",
   "warn": 0.5,
   "fail": 1.0,
   "tol_mode": "absolute",
   "source_row": 285
  },
  {
   "key": "flatness||",
   "unit": "%",
   "warn": 2.0,
   "fail": 3.0,
   "tol_mode": "absolute",
   "source_row": 296
  },
  {
   "key": "output||",
   "unit": "cGy",
   "warn": 2.0,
   "fail": 3.0,
   "tol_mode": "percent",
   "source_row": 305
  }
 ],
 "pbs_imaging_defaults": [
  {
   "name": "[Ortho - kV/kV] PPS 2 XRAY Offset X [cm]",
   "unit": "cm",
   "expected": 0,
   "warn": 0.15,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 109
  },
  {
   "name": "[Ortho - kV/kV] PPS 2 XRAY Offset Y [cm]",
   "unit": "cm",
   "expected": 0,
   "warn": 0.15,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 110
  },
  {
   "name": "[Ortho - kV/kV] PPS 2 XRAY Offset Z [cm]",
   "unit": "cm",
   "expected": 0,
   "warn": 0.15,
   "fail": 0.2,
   "tol_mode": "absolute",
   "source_row": 111
  }
 ],
 "srs_placeholder_names": [
  "Safety – SRS interlocks and cone / MLC accessory recognised",
  "Mechanical – Lasers to isocenter (SRS)",
  "Mechanical – ODI at isocenter (SRS)",
  "Dosimetry – Dose Pro measurement",
  "Physics review – SRS QA reviewed before treatment"
 ]
};
