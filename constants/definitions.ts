
import { InspectionItemConfig } from '../types';

/**
 * INSTRUCTIONS FOR ADDING NEW INSPECTION ITEMS:
 * 1. Add your new item object to the relevant array below (e.g. INSPECTION_ITEMS).
 * 2. Ensure the 'id' is unique and contains NO spaces (e.g. 'brakeFluidLevel').
 * 3. IMPORTANT: You MUST add a matching column header in your Google Sheet 
 *    (the exact same 'id') for the data to be saved.
 */

export const SECTIONS = [
  { id: 'details', title: 'Details', label: 'Details' },
  { id: 'photos', title: 'Photos (Paused)', label: 'Photos' },
  { id: 'checklist_1', title: 'Checklist 1', label: 'Part 1' },
  { id: 'checklist_2', title: 'Checklist 2', label: 'Part 2' },
  { id: 'checklist_3', title: 'Checklist 3', label: 'Part 3' },
  { id: 'signatures', title: 'Signatures', label: 'Signatures' },
  { id: 'summary', title: 'Summary', label: 'Summary' }
];

export const INSPECTION_CATEGORIES = {
  PPE: 'PPE & Safety Gear',
  DOCUMENTATION: 'Documentation & Legal',
  VEHICLE_EXTERIOR: 'Vehicle Exterior & Cab',
  LIGHTS_ELECTRICAL: 'Lights & Electrical',
  MECHANICAL: 'Mechanical & Safety Equipment',
  TRAILER: 'Trailer Specifics'
};

export const INSPECTION_ITEMS: InspectionItemConfig[] = [
  // PPE
  { id: 'reflectiveWorkSuit', label: 'Reflective Work Suit', category: INSPECTION_CATEGORIES.PPE },
  { id: 'safetyGear', label: 'Safety Goggles, Boots, Gloves, Hard Hat', category: INSPECTION_CATEGORIES.PPE },
  { id: 'dustMask', label: 'Dust Mask (Task Application)', category: INSPECTION_CATEGORIES.PPE },
  
  // Documents
  { id: 'roadFitness', label: 'Valid Road Fitness / Road Tax / Insurance', category: INSPECTION_CATEGORIES.DOCUMENTATION },
  { id: 'validDriverDocs', label: 'Valid Driver’s License, DDT Certificate, Driver ID', category: INSPECTION_CATEGORIES.DOCUMENTATION },
  { id: 'driverManual', label: 'Driver Manual', category: INSPECTION_CATEGORIES.DOCUMENTATION },
  { id: 'routeRisk', label: 'Route Risk Assessment', category: INSPECTION_CATEGORIES.DOCUMENTATION },

  // Exterior & Cab
  { id: 'windscreen', label: 'Windscreen Condition', category: INSPECTION_CATEGORIES.VEHICLE_EXTERIOR },
  { id: 'mirrors', label: 'Mirrors Condition', category: INSPECTION_CATEGORIES.VEHICLE_EXTERIOR },
  { id: 'chevrons', label: 'Chevrons, Plate/Reflective Tape', category: INSPECTION_CATEGORIES.VEHICLE_EXTERIOR },
  { id: 'generalCondition', label: 'General Condition (Interior Cab, Body: Signs of Tear & Wear, Dents)', category: INSPECTION_CATEGORIES.VEHICLE_EXTERIOR },
  { id: 'seatBelt', label: 'Three-Point Retractable Seat Belt', category: INSPECTION_CATEGORIES.VEHICLE_EXTERIOR },

  // Lights & Electrical
  { id: 'headLamps', label: 'Head Lamps Condition', category: INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL },
  { id: 'indicators', label: 'Indicators Condition', category: INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL },
  { id: 'parkingLights', label: 'Parking Lights Condition', category: INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL },
  { id: 'reverseAlarm', label: 'Reverse Alarm, Reverse Lights Condition', category: INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL },
  { id: 'hornIgnition', label: 'Horn, Ignition & Electrical (Doors/Windows)', category: INSPECTION_CATEGORIES.LIGHTS_ELECTRICAL },

  // Mechanical & Safety
  { id: 'brakes', label: 'Brakes, Brake Lights, Trailer Lights, Brake Air Pipes', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'tyres', label: 'Tyres Condition (Not Worn Out, Pressure, Spare)', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'wheelNuts', label: 'Wheel Nuts, Wheel Pointers', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'fluidLeaks', label: 'No Leaks of Lubricants/Fluids (Oil, Coolant, etc.)', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'fireExtinguisher', label: 'Recommended Fire Extinguisher (9Kg & 2.5Kg)', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'warningTriangles', label: 'Warning Triangles, Two Approved Wheel Chocks', category: INSPECTION_CATEGORIES.MECHANICAL },
  { id: 'firstAid', label: 'First Aid Kit', category: INSPECTION_CATEGORIES.MECHANICAL },

  // Trailer
  { id: 'trailerCondition', label: 'Trailer Condition', category: INSPECTION_CATEGORIES.TRAILER },
  { id: 'fifthWheel', label: 'Fifth Wheel Condition', category: INSPECTION_CATEGORIES.TRAILER },
  { id: 'landingLegs', label: 'Position and Condition of Landing Legs', category: INSPECTION_CATEGORIES.TRAILER },
  { id: 'tarpaulins', label: 'Tarpaulins, Ropes, Belts or Straps', category: INSPECTION_CATEGORIES.TRAILER },
];



export const ACID_CATEGORIES = {
    PPE: 'A. Personal Protective Equipment',
    VEHICLE: 'B. Vehicle (Horse & Trailer)',
    SPILL_KIT: 'C. Spill Kit',
    DOCUMENTATION: 'D. Documentation'
};

export const ACID_INSPECTION_ITEMS: InspectionItemConfig[] = [
    // A. PPE
    { id: 'acid_1', label: '1. Reflective Work Suit (Acid Proof), Gumboots Safety Goggles', category: ACID_CATEGORIES.PPE },
    { id: 'acid_2', label: '2. Hard Hat, PVC Gloves, Respirator (Double side), Face shield', category: ACID_CATEGORIES.PPE },

    // B. Vehicle
    { id: 'acid_3', label: '3. Valid road fitness/road tax/Insurance/permit', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_4', label: '4. Wind screen condition', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_5', label: '5. Mirrors in good condition', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_6', label: '6. Three-point retractable seat belt', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_7', label: '7. Horn working, ignition switch, electrical (doors/windows)', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_8', label: '8. Valid Fire extinguisher (9kg=2, 2kg=1)', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_9', label: '9. Warning triangles, Cones, two approved wheel chokes', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_10', label: '10. Headlamps working', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_11', label: '11. Amber beacon', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_12', label: '12. Brake lights, trailer lights, indicators working', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_13', label: '13. Brakes, air pipes, air bags OK', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_14', label: '14. Tyres not worn – out, visual Tyre Pressure, Spare wheel', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_15', label: '15. Wheel nuts, wheel pointers, bolts, Flanges OK', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_16', label: '16. Revers alarm, reverse lights working', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_17', label: '17. Chevrons plate/reflective tape', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_18', label: '18. Hazchem diamond symbols correct & display on both 2 sides', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_19', label: '19. Anti-slip protection, Ladder, Hand rails', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_20', label: '20. Over spill hose connected to containment container', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_21', label: '21. Hatch, Valves, Vents', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_22', label: '22. No leaks of chemicals/lubricants (oil, coolants, acid etc.)', category: ACID_CATEGORIES.VEHICLE },
    { id: 'acid_23', label: '23. General condition (interior cab, body: signs of Corrosion, Cracks, leaks)', category: ACID_CATEGORIES.VEHICLE },
    
    // C. Spill Kit
    { id: 'acid_25', label: '25. Lime box filled with lime', category: ACID_CATEGORIES.SPILL_KIT },
    { id: 'acid_26', label: '26. First Aid Kit, Diphotrine', category: ACID_CATEGORIES.SPILL_KIT },
    { id: 'acid_27', label: '27. Pick and Shovel', category: ACID_CATEGORIES.SPILL_KIT },
    { id: 'acid_28', label: '28. Barricading tape', category: ACID_CATEGORIES.SPILL_KIT },
    { id: 'acid_29', label: '29. Water (20 liters container)', category: ACID_CATEGORIES.SPILL_KIT },

    // D. Documentation
    { id: 'acid_30', label: '30. Pressure/Thickness Test Certificate', category: ACID_CATEGORIES.DOCUMENTATION },
    { id: 'acid_31', label: '31. Electric System Certificate', category: ACID_CATEGORIES.DOCUMENTATION },
    { id: 'acid_32', label: '32. Tank Cleanliness Certificate', category: ACID_CATEGORIES.DOCUMENTATION },
    { id: 'acid_33', label: '33. Driver Manual, Route Risk Assessment/Journey plan', category: ACID_CATEGORIES.DOCUMENTATION },
    { id: 'acid_34', label: '34. Valid Driver licence, DDT certificate, ID', category: ACID_CATEGORIES.DOCUMENTATION },
];

export const PETROLEUM_V2_CATEGORIES = {
    PRIME_MOVER: 'Prime Mover',
    TRAILER_TANKS: 'Trailer/Tanks',
    DRIVER: 'Driver',
    SAFETY_SIGNS: 'Safety & Warning Signs',
    DOCUMENTS: 'Licence & Mandatory Documents'
};

export const PETROLEUM_V2_ITEMS: InspectionItemConfig[] = [
    // Prime Mover
    { id: 'petro2_1', label: '1. General: Appearance, Paint, Leaks, Charge line', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_2', label: '2. Visibility: Windscreen, Windows, Wipers, Mirrors', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_3', label: '3. Lighting: Headlights, Beacon, Turning, Stop, Reverse Lights', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_4', label: '4. Provision for Orange Diamond', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_5', label: '5. Seat Belt: 3-point Contact, Retractable', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_6', label: '6. IVMS /Speed limiting device: installed, working', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_7', label: '7. Document Holder/Box : Position, Colour, Labeled', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_8', label: '8. Tools: Jack, Wheel Spanner, Cabin, Triangles (4), Cones (3)', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_9', label: '9. Equipment: Spill Kit, First Aid Kit, Barricading Tape, Fire Extinguisher (Cabin, Trailer x2)', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_10', label: '10. Electrical: Battery Master Switch, Battery Box, Terminals, Wiring', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_11', label: '11. Tyres: No Retread, Combination, Spray Suppression, Wheels', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_12', label: '12. Brake System: ABS, Wheel Pointers, Brake Testing Required?', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_13', label: '13. Shielding of Engine, Rear Window Non-opening', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_14', label: '14. Exhaust: Discharge on Right Side, Tank outlet 100mm Clearance', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },
    { id: 'petro2_15', label: '15. Condition of the Fifth Wheel (Lock/Lubrication)', category: PETROLEUM_V2_CATEGORIES.PRIME_MOVER },

    // Trailer/Tanks
    { id: 'petro2_16', label: '16. Compartment Capacities: labeled, < 7000L per compartment', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_17', label: '17. Under Run Protection: Sides, Rear End', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_18', label: '18. Overturn Damage Protection', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_19', label: '19. Valves: Discharge, Actuator, Dust Cups, Colour Coding', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_20', label: '20. Emergency Shut Off: Main, Side(s)/ Brake Interlock System', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_21', label: '21. Electrical Bonding: Cable, Bronze Earthing Studs', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_22', label: '22. Spill Tray, Hose Storage Rack, Fire Extinguisher Holders', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_23', label: '23. Tyres: Tread Depth, Spare Tyre, Non-retread, Combination', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_24', label: '24. Mudguards for all Wheels, Spray Suppressors', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_25', label: '25. Landing Legs', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_26', label: '26. Reversing Alarm', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_27', label: '27. Delivery Hose(s): State, Continuity, Colour Coded, Dust Cups', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_28', label: '28. Lighting: Brakes, Reverse, Warning, Emergency Lighting', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_29', label: '29. Rear Bumper: > 300mm Beyond Tank', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_30', label: '30. Fall Protection: Access Ladder, Anti-slip Walkway, Handrail', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_31', label: '31. Manholes: Dia, Center, Secured, Standard (EN 13317)', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },
    { id: 'petro2_32', label: '32. Fittings: Ullage Marks, Overfill Protection, Pressure Release', category: PETROLEUM_V2_CATEGORIES.TRAILER_TANKS },

    // Driver
    { id: 'petro2_33', label: '33. Work Suit: Anti-static, Reflective', category: PETROLEUM_V2_CATEGORIES.DRIVER },
    { id: 'petro2_34', label: '34. Safety Gloves: For Hydrocarbon Handing', category: PETROLEUM_V2_CATEGORIES.DRIVER },
    { id: 'petro2_35', label: '35. Safety Boot: With Toe Cap, Oil Resistant', category: PETROLEUM_V2_CATEGORIES.DRIVER },
    { id: 'petro2_36', label: '36. Safety Helmet: 2- 4-Point Chin Strap', category: PETROLEUM_V2_CATEGORIES.DRIVER },
    { id: 'petro2_37', label: '37. Driver’s ID: Identity Card, Driver Blue Tag', category: PETROLEUM_V2_CATEGORIES.DRIVER },

    // Safety & Warning
    { id: 'petro2_38', label: '38. Hazchem: Both Sides, Rear', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_39', label: '39. No Smocking, Naked Flame, Cell Phone', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_40', label: '40. Orange Reflectors: Continuous', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_41', label: '41. Chevron, Red Reflectors at Rear', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_42', label: '42. Number Plate: ZABS Approved, Lighting', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_43', label: '43. Speed Limit Sign: 80 km/h', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },
    { id: 'petro2_44', label: '44. Data Plate: Pressure Test', category: PETROLEUM_V2_CATEGORIES.SAFETY_SIGNS },

    // Documents
    { id: 'petro2_45', label: '45. Road Tax, Certificate of Fitness, Insurance, Identity', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_46', label: '46. Defensive Driver Training (DDT): Dangerous Goods Certificate', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_47', label: '47. Driver’s License: Validity of Dangerous Goods, CE', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_48', label: '48. Electric Certificate', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_49', label: '49. Drivers Manual', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_50', label: '50. Route Risk Assessment Guide', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_51', label: '51. ZCSA Certificate', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_52', label: '52. Assize Certificate', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
    { id: 'petro2_53', label: '53. TREM Card', category: PETROLEUM_V2_CATEGORIES.DOCUMENTS },
];
