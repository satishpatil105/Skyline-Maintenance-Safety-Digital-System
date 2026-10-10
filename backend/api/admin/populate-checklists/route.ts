import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ItemDef {
  templateId: string;
  category: string;
  checkPoint: string;
  standard: string;
  frequency?: string;
  actionIfNotOk?: string;
}

const ALL_CHECKLISTS: ItemDef[] = [
  // 1. Laser Cutting (Existing)
  { templateId: "LSR-001", category: "Laser Cutting", checkPoint: "Machine guarding / doors / interlocks", standard: "All doors and interlock switches properly engaged; machine stops when door opens", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-002", category: "Laser Cutting", checkPoint: "Emergency Stop", standard: "Emergency Stop switch functioning smoothly, immediately halts all machine motion", frequency: "Daily", actionIfNotOk: "Stop and report" },
  { templateId: "LSR-003", category: "Laser Cutting", checkPoint: "Laser safety signage", standard: "Laser safety caution signage clean, legible, and displayed in prominent view", frequency: "Daily", actionIfNotOk: "Report to Safety" },
  { templateId: "LSR-004", category: "Laser Cutting", checkPoint: "Assist gas leakage", standard: "No gas leakage from lines, joints, or regulators; cutting gas pressure stable", frequency: "Daily", actionIfNotOk: "Stop and report" },
  { templateId: "LSR-005", category: "Laser Cutting", checkPoint: "Chiller condition", standard: "Chiller water temp within 20°C - 24°C; no condensation or water leakage", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-006", category: "Laser Cutting", checkPoint: "Source Condition", standard: "Laser source status LED green, power output normal, no fault alarm", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-007", category: "Laser Cutting", checkPoint: "Nozzle / optics condition", standard: "Nozzle centered, clean, free from burr/slag, lens inspected and clean", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-008", category: "Laser Cutting", checkPoint: "Electrical condition", standard: "Electrical cabinet closed, panel fan working, no burnt odor or warning lights", frequency: "Daily", actionIfNotOk: "Stop and report" },
  { templateId: "LSR-009", category: "Laser Cutting", checkPoint: "Abnormal sound / vibration", standard: "Smooth axis travel (X/Y/Z), no abnormal mechanical grinding or vibration", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-010", category: "Laser Cutting", checkPoint: "Housekeeping / fire safety", standard: "Laser enclosure clean, scrap tray empty, CO2 fire extinguisher accessible", frequency: "Daily", actionIfNotOk: "Clean and report" },
  { templateId: "LSR-011", category: "Laser Cutting", checkPoint: "Chiller/cooling system", standard: "Chiller coolant level at full mark, intake filter mesh clean and dust-free", frequency: "Daily", actionIfNotOk: "Top up and report" },
  { templateId: "LSR-012", category: "Laser Cutting", checkPoint: "Coolant level", standard: "Laser cutting head coolant level verified within operating range", frequency: "Daily", actionIfNotOk: "Top up and report" },
  { templateId: "LSR-013", category: "Laser Cutting", checkPoint: "Electrical panel condition", standard: "Electrical panel door locked, temperature normal, interior free of dust", frequency: "Weekly", actionIfNotOk: "Clean and report" },
  { templateId: "LSR-014", category: "Laser Cutting", checkPoint: "Electrical cables and connections", standard: "Cable drag-chains free of debris, all cables intact without abrasion", frequency: "Monthly", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-015", category: "Laser Cutting", checkPoint: "Machine earthing", standard: "Grounding/earthing cable securely connected, resistance within spec (< 1 Ohm)", frequency: "Monthly", actionIfNotOk: "Report to Maintenance" },
  { templateId: "LSR-016", category: "Laser Cutting", checkPoint: "Cutting table/slats", standard: "Support slats flat, damaged slats replaced, slag build-up cleaned", frequency: "Daily", actionIfNotOk: "Clean/replace slats" },
  { templateId: "LSR-017", category: "Laser Cutting", checkPoint: "Lubrication system", standard: "Central lubrication reservoir filled, automatic pump pressure confirmed", frequency: "Daily", actionIfNotOk: "Top up lubricant" },
  { templateId: "LSR-018", category: "Laser Cutting", checkPoint: "PPE availability", standard: "Operators wearing OD 6+ laser safety glasses, safety shoes, cut-resistant gloves", frequency: "Daily", actionIfNotOk: "Wear PPE immediately" },
  { templateId: "LSR-019", category: "Laser Cutting", checkPoint: "Housekeeping around machine", standard: "Surrounding 1.5m perimeter clean, no scrap metal accumulation or tripping hazards", frequency: "Daily", actionIfNotOk: "Clean work area" },

  // 2. Turret Punch Machine (Turret Punch)
  { templateId: "TPP-001", category: "Turret Punch", checkPoint: "Emergency Stop buttons & interlocks", standard: "Immediate motion cut-off; locks securely upon press", frequency: "Daily", actionIfNotOk: "Stop machine and report" },
  { templateId: "TPP-002", category: "Turret Punch", checkPoint: "Turret alignment & station indexing", standard: "Smooth rotation without abnormal click, jerk or indexing error", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "TPP-003", category: "Turret Punch", checkPoint: "Die holders & clamp condition", standard: "Clamps tight, no loose tool holders, zero play on clamp jaw", frequency: "Daily", actionIfNotOk: "Tighten clamps" },
  { templateId: "TPP-004", category: "Turret Punch", checkPoint: "Sheet support brush table cleanliness", standard: "Clean and free from metal chips, burs and scrap fragments", frequency: "Daily", actionIfNotOk: "Clean table balls" },
  { templateId: "TPP-005", category: "Turret Punch", checkPoint: "Slug chute & scrap collection box", standard: "Chute unobstructed, scrap box cleared before starting shift", frequency: "Daily", actionIfNotOk: "Empty slug box" },
  { templateId: "TPP-006", category: "Turret Punch", checkPoint: "Hydraulic oil pressure & temperature", standard: "Pressure within operating range (140-160 bar), temp < 55°C", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "TPP-007", category: "Turret Punch", checkPoint: "Auto lubrication reservoir oil level", standard: "Oil level between Min and Max indicator lines; pump working", frequency: "Daily", actionIfNotOk: "Top up oil" },
  { templateId: "TPP-008", category: "Turret Punch", checkPoint: "Safety light curtains & guard interlocks", standard: "Machine stops immediately upon breaking light beam perimeter", frequency: "Daily", actionIfNotOk: "Stop work, call maintenance" },
  { templateId: "TPP-009", category: "Turret Punch", checkPoint: "Punch & die tool wear / clearance", standard: "Sharp cutting edges, no chipped dies, correct clearance for sheet", frequency: "Weekly", actionIfNotOk: "Sharpen or replace tool" },
  { templateId: "TPP-010", category: "Turret Punch", checkPoint: "Work clamp pneumatic pressure", standard: "Pneumatic clamp holding pressure steady (min 5.5 bar), no air leaks", frequency: "Weekly", actionIfNotOk: "Check airline pressure" },

  // 3. CNC Shearing Machine (CNC Shearing Machine)
  { templateId: "SHR-001", category: "CNC Shearing Machine", checkPoint: "Emergency stop switches (front and rear)", standard: "Tested functional; shuts off hydraulic pump and blade movement", frequency: "Daily", actionIfNotOk: "Stop machine and report" },
  { templateId: "SHR-002", category: "CNC Shearing Machine", checkPoint: "Finger guard barrier & safety interlocks", standard: "Physical guard securely bolted, gap < 8mm, halts blade if lifted", frequency: "Daily", actionIfNotOk: "Adjust guard barrier" },
  { templateId: "SHR-003", category: "CNC Shearing Machine", checkPoint: "Hydraulic system pressure & oil level", standard: "Operating pressure normal, tank level > 75%, no valve block weeping", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "SHR-004", category: "CNC Shearing Machine", checkPoint: "Blade cutting edge condition & clearance", standard: "Upper/lower blade edges sharp, gap set according to sheet gauge", frequency: "Daily", actionIfNotOk: "Adjust blade clearance" },
  { templateId: "SHR-005", category: "CNC Shearing Machine", checkPoint: "Sheet hold-down jacks / clamps", standard: "All hold-downs clamp sheet firmly without slippage or oil leakage", frequency: "Daily", actionIfNotOk: "Service hold-down jacks" },
  { templateId: "SHR-006", category: "CNC Shearing Machine", checkPoint: "Backgauge calibration & digital readout", standard: "Backgauge zeroed, parallel to blade, accuracy within ±0.2 mm", frequency: "Daily", actionIfNotOk: "Calibrate backgauge" },
  { templateId: "SHR-007", category: "CNC Shearing Machine", checkPoint: "Rear area optical safety sensor", standard: "Sensor operational; beam break prevents or halts shearing stroke", frequency: "Daily", actionIfNotOk: "Clean sensor lenses" },
  { templateId: "SHR-008", category: "CNC Shearing Machine", checkPoint: "Auto centralized lubrication system", standard: "Slide guide rails and pivot pins greased, reservoir topped up", frequency: "Weekly", actionIfNotOk: "Refill lubricant" },
  { templateId: "SHR-009", category: "CNC Shearing Machine", checkPoint: "Scrap collection bin & floor housekeeping", standard: "Drop-off chute clean, off-cuts cleared, no tripping hazard", frequency: "Daily", actionIfNotOk: "Clear scrap bin" },

  // 4. Bending Machine (Bending Machine)
  { templateId: "BND-001", category: "Bending Machine", checkPoint: "Emergency stop buttons & 3-position foot pedal", standard: "E-stop and foot pedal safety switch responsive on tap", frequency: "Daily", actionIfNotOk: "Stop machine and report" },
  { templateId: "BND-002", category: "Bending Machine", checkPoint: "Optical safety light curtain / laser guard", standard: "Alignment green; beam interruption immediately halts ram descent", frequency: "Daily", actionIfNotOk: "Re-align safety curtain" },
  { templateId: "BND-003", category: "Bending Machine", checkPoint: "Upper punch & lower V-die condition", standard: "Tools clamped rigid, centered, free from cracks or uneven wear", frequency: "Daily", actionIfNotOk: "Inspect and align tooling" },
  { templateId: "BND-004", category: "Bending Machine", checkPoint: "Backgauge finger stops (X & R axis)", standard: "Smooth movement, calibration true, fingers tight and undamaged", frequency: "Daily", actionIfNotOk: "Calibrate backgauge" },
  { templateId: "BND-005", category: "Bending Machine", checkPoint: "Hydraulic pressure, oil temp & cylinder seals", standard: "Tonnage pressure reaches setpoint; cylinder rod clean without oil weep", frequency: "Daily", actionIfNotOk: "Report to Maintenance" },
  { templateId: "BND-006", category: "Bending Machine", checkPoint: "Ram parallelism & Y1/Y2 axis balance", standard: "Upper beam parallel to bed; angle accuracy uniform across full length", frequency: "Daily", actionIfNotOk: "Re-zero Y1/Y2 axes" },
  { templateId: "BND-007", category: "Bending Machine", checkPoint: "Guide way lubrication & grease level", standard: "Side guide liners lubricated; grease pump reservoir adequate", frequency: "Weekly", actionIfNotOk: "Pump manual grease" },
  { templateId: "BND-008", category: "Bending Machine", checkPoint: "Sheet support arms & front stops", standard: "Front support brackets level, securely locked at working height", frequency: "Daily", actionIfNotOk: "Adjust support arms" },

  // 5. Air Compressor (Air Compressor)
  { templateId: "CMP-001", category: "Air Compressor", checkPoint: "Operating pressure (Cut-in / Cut-out)", standard: "Main line pressure maintained between 7.0 bar and 8.5 bar", frequency: "Daily", actionIfNotOk: "Adjust pressure switch" },
  { templateId: "CMP-002", category: "Air Compressor", checkPoint: "Air receiver tank manual condensate drain", standard: "Moisture drained completely twice daily until dry air escapes", frequency: "Daily", actionIfNotOk: "Drain moisture valve" },
  { templateId: "CMP-003", category: "Air Compressor", checkPoint: "Lubricating oil level & color", standard: "Oil sight glass at mid-to-high mark; oil clean and amber", frequency: "Daily", actionIfNotOk: "Top up compressor oil" },
  { templateId: "CMP-004", category: "Air Compressor", checkPoint: "Discharge air temperature", standard: "Running discharge temp between 75°C and 95°C (< 100°C alarm limit)", frequency: "Daily", actionIfNotOk: "Check cooler fan/radiator" },
  { templateId: "CMP-005", category: "Air Compressor", checkPoint: "Air filter restriction indicator", standard: "Filter indicator in green zone; no heavy dust loading on intake", frequency: "Daily", actionIfNotOk: "Clean/replace air filter" },
  { templateId: "CMP-006", category: "Air Compressor", checkPoint: "Safety relief valve & pressure gauge", standard: "Safety pop valve free, pressure gauge needle steady and calibrated", frequency: "Weekly", actionIfNotOk: "Replace safety valve" },
  { templateId: "CMP-007", category: "Air Compressor", checkPoint: "Drive belt tension or coupling", standard: "V-belts tight (deflection < 10mm under thumb); no squeal or fraying", frequency: "Weekly", actionIfNotOk: "Tension drive belts" },
  { templateId: "CMP-008", category: "Air Compressor", checkPoint: "Refrigerated air dryer dew point & auto-drain", standard: "Dryer dew point in green zone (3°C - 7°C); auto-drain cycles freely", frequency: "Daily", actionIfNotOk: "Clean dryer drain" },

  // 6. EOT Crane (EOT Crane)
  { templateId: "EOT-001", category: "EOT Crane", checkPoint: "Pendant controller / remote & emergency stop", standard: "E-stop cuts crane power instantly; pushbuttons return cleanly without sticking", frequency: "Daily", actionIfNotOk: "Stop crane, report electrical" },
  { templateId: "EOT-002", category: "EOT Crane", checkPoint: "Upper and lower hoist limit switches", standard: "Hoisting automatically stops before hook block contacts drum or floor", frequency: "Daily", actionIfNotOk: "Adjust limit switches" },
  { templateId: "EOT-003", category: "EOT Crane", checkPoint: "Wire rope condition & drum seating", standard: "Rope seated in grooves; no kinks, bird-caging, or broken strands", frequency: "Daily", actionIfNotOk: "Replace wire rope" },
  { templateId: "EOT-004", category: "EOT Crane", checkPoint: "Hook safety latch & 360° swivel rotation", standard: "Safety latch spring intact and closes fully; hook swivels smoothly", frequency: "Daily", actionIfNotOk: "Replace hook latch" },
  { templateId: "EOT-005", category: "EOT Crane", checkPoint: "Hoist mechanical brake holding test", standard: "Holds rated test load suspended without slippage or downward drift", frequency: "Daily", actionIfNotOk: "Adjust hoist brake shoe" },
  { templateId: "EOT-006", category: "EOT Crane", checkPoint: "Cross travel (CT) & Long travel (LT) brakes", standard: "Smooth traverse along runway rails; brakes stop bridge within distance", frequency: "Daily", actionIfNotOk: "Service brake thruster" },
  { templateId: "EOT-007", category: "EOT Crane", checkPoint: "Warning horn, flashing beacon & travel sirens", standard: "Audible siren and flashing strobe light operational during travel", frequency: "Daily", actionIfNotOk: "Repair beacon light" },
  { templateId: "EOT-008", category: "EOT Crane", checkPoint: "Runway rail end stoppers & buffers", standard: "Rubber/spring buffers securely mounted and undamaged at rail ends", frequency: "Weekly", actionIfNotOk: "Fasten rail buffers" },

  // 7. CO2 Welding Machine (CO2 Welding Machine)
  { templateId: "WLD-001", category: "CO2 Welding Machine", checkPoint: "Shielding gas cylinder & regulator pressure", standard: "Cylinder secured in trolley; regulator flow 15-20 L/min; no leak", frequency: "Daily", actionIfNotOk: "Fix gas leak" },
  { templateId: "WLD-002", category: "CO2 Welding Machine", checkPoint: "Gas heater / regulator pre-heater", standard: "CO2 inline heater functional to prevent regulator icing", frequency: "Daily", actionIfNotOk: "Plug in heater" },
  { templateId: "WLD-003", category: "CO2 Welding Machine", checkPoint: "Welding torch, cable & Euro-connector", standard: "Torch cable sheath intact, no copper exposed; connector tight", frequency: "Daily", actionIfNotOk: "Repair torch cable" },
  { templateId: "WLD-004", category: "CO2 Welding Machine", checkPoint: "Contact tip, gas nozzle & diffuser", standard: "Contact tip matches wire diameter; nozzle clean of spatter", frequency: "Daily", actionIfNotOk: "Clean/change tip" },
  { templateId: "WLD-005", category: "CO2 Welding Machine", checkPoint: "Wire feed mechanism & drive rolls", standard: "Feed roller groove clean, matching wire size; tension calibrated", frequency: "Daily", actionIfNotOk: "Adjust wire tension" },
  { templateId: "WLD-006", category: "CO2 Welding Machine", checkPoint: "Earth ground clamp & work lead", standard: "Earth clamp heavy-duty with strong spring; clamped to bare workpiece", frequency: "Daily", actionIfNotOk: "Clean earth contact" },
  { templateId: "WLD-007", category: "CO2 Welding Machine", checkPoint: "Machine cooling fan & ventilation grills", standard: "Internal cooling fan spinning at full speed; vents clear of dust", frequency: "Daily", actionIfNotOk: "Clean fan vents" },
  { templateId: "WLD-008", category: "CO2 Welding Machine", checkPoint: "PPE & auto-darkening welding helmet", standard: "Auto-darkening helmet (DIN 9-13), leather apron, gloves worn", frequency: "Daily", actionIfNotOk: "Wear full PPE" },

  // 8. Drill Machine (Drill Machine)
  { templateId: "DRL-001", category: "Drill Machine", checkPoint: "Emergency stop button & spindle power cut-off", standard: "E-stop button stops motor immediately; accessible to operator", frequency: "Daily", actionIfNotOk: "Fix E-stop switch" },
  { templateId: "DRL-002", category: "Drill Machine", checkPoint: "Transparent chuck guard & interlock", standard: "Polycarbonate shield in place; interlock prevents running when open", frequency: "Daily", actionIfNotOk: "Mount chuck guard" },
  { templateId: "DRL-003", category: "Drill Machine", checkPoint: "Drill chuck, arbor & quill return spring", standard: "Chuck jaws hold bit true (runout < 0.05mm); quill returns smoothly", frequency: "Daily", actionIfNotOk: "Adjust quill spring" },
  { templateId: "DRL-004", category: "Drill Machine", checkPoint: "Machine vise & workpiece clamping", standard: "Vise bolted to slotted table; workpiece clamped rigid (no hand-holding)", frequency: "Daily", actionIfNotOk: "Clamp vise securely" },
  { templateId: "DRL-005", category: "Drill Machine", checkPoint: "Belt pulley guard & speed shift lever", standard: "Top pulley cover closed and interlocked; drive belt tensioned", frequency: "Daily", actionIfNotOk: "Close pulley cover" },
  { templateId: "DRL-006", category: "Drill Machine", checkPoint: "Table height lock & column clamp", standard: "Work table locking clamp holds firmly under drilling thrust", frequency: "Daily", actionIfNotOk: "Tighten table clamp" },
  { templateId: "DRL-007", category: "Drill Machine", checkPoint: "Coolant pump & swarf collection tray", standard: "Soluble oil coolant flowing cleanly to drill point; swarf cleared", frequency: "Daily", actionIfNotOk: "Clean coolant filter" },

  // 9. Powder Coating Oven (Powder Coating Oven)
  { templateId: "OVN-001", category: "Powder Coating Oven", checkPoint: "Temperature controller (PID) display", standard: "Digital temp readout calibrated; reaches baking setpoint (180°C - 200°C)", frequency: "Daily", actionIfNotOk: "Calibrate PID controller" },
  { templateId: "OVN-002", category: "Powder Coating Oven", checkPoint: "Hot air circulation blower & exhaust", standard: "Circulation fan running smoothly; no vibration; draft switch active", frequency: "Daily", actionIfNotOk: "Inspect blower fan" },
  { templateId: "OVN-003", category: "Powder Coating Oven", checkPoint: "Oven door gasket & thermal seals", standard: "High-temp silicone door seal intact; zero hot air leakage around frame", frequency: "Daily", actionIfNotOk: "Replace door gasket" },
  { templateId: "OVN-004", category: "Powder Coating Oven", checkPoint: "Heating elements / Burner condition", standard: "Uniform heating across all zones; burner pilot/flame detector OK", frequency: "Daily", actionIfNotOk: "Service burner/heaters" },
  { templateId: "OVN-005", category: "Powder Coating Oven", checkPoint: "Over-temperature safety limit cut-out", standard: "Independent thermal cut-out triggers power shut-off if temp exceeds limit", frequency: "Daily", actionIfNotOk: "Test high-limit cut-out" },
  { templateId: "OVN-006", category: "Powder Coating Oven", checkPoint: "Conveyor track & trolley hooks in oven", standard: "High-temp chain lubricated; trolleys glide without jamming", frequency: "Weekly", actionIfNotOk: "Lube conveyor track" },
  { templateId: "OVN-007", category: "Powder Coating Oven", checkPoint: "Emergency internal safety door release latch", standard: "Internal safety release latch operational; doors push open from inside", frequency: "Daily", actionIfNotOk: "Free exit release latch" },

  // 10. UPS (UPS)
  { templateId: "UPS-001", category: "UPS", checkPoint: "Output voltage & frequency stability", standard: "Output voltage stable (400V 3-phase ±1% or 230V ±1%); 50 Hz steady", frequency: "Daily", actionIfNotOk: "Check inverter parameters" },
  { templateId: "UPS-002", category: "UPS", checkPoint: "Battery bank charge voltage & capacity", standard: "Float charge voltage normal; battery indicator shows 100% capacity", frequency: "Daily", actionIfNotOk: "Check charger module" },
  { templateId: "UPS-003", category: "UPS", checkPoint: "Battery physical condition & terminals", standard: "No cell swelling, no electrolyte leakage, terminal posts clean", frequency: "Daily", actionIfNotOk: "Clean/replace battery cell" },
  { templateId: "UPS-004", category: "UPS", checkPoint: "Ventilation fans & battery room temp", standard: "All cooling fans running; ambient battery room temp < 25°C", frequency: "Daily", actionIfNotOk: "Check AC cooling" },
  { templateId: "UPS-005", category: "UPS", checkPoint: "LCD status panel & alarm warning lights", standard: "Status reads 'Normal / On Inverter'; no red alarm LEDs or beeping", frequency: "Daily", actionIfNotOk: "Check fault log" },
  { templateId: "UPS-006", category: "UPS", checkPoint: "Static bypass switch transfer test", standard: "Seamless transfer to bypass and back without load interruption", frequency: "Monthly", actionIfNotOk: "Service static switch" },

  // 11. Stabilizer (Stabilizer)
  { templateId: "STB-001", category: "Stabilizer", checkPoint: "Input vs Output voltage regulation", standard: "Output regulated precisely to 415V ±1% regardless of grid fluctuation", frequency: "Daily", actionIfNotOk: "Calibrate sensing card" },
  { templateId: "STB-002", category: "Stabilizer", checkPoint: "Servo motor & variac carbon brush", standard: "Servo motor tracks smoothly; carbon brush not sparking or worn out", frequency: "Daily", actionIfNotOk: "Replace carbon brush" },
  { templateId: "STB-003", category: "Stabilizer", checkPoint: "Over-voltage & Under-voltage trip relay", standard: "Relay isolates load if voltage exceeds 460V or drops below 340V", frequency: "Weekly", actionIfNotOk: "Test trip threshold" },
  { templateId: "STB-004", category: "Stabilizer", checkPoint: "Overload & short-circuit protection MCCB", standard: "Output MCCB sized correctly; trip indicators and auxiliary contacts OK", frequency: "Weekly", actionIfNotOk: "Inspect breaker" },
  { templateId: "STB-005", category: "Stabilizer", checkPoint: "Transformer oil level / cooling fans", standard: "Oil level visible in conservator; cooling fans running smoothly", frequency: "Daily", actionIfNotOk: "Top up dielectric oil" },
  { templateId: "STB-006", category: "Stabilizer", checkPoint: "Phase reversal & single phasing preventer", standard: "Unit trips immediately if any phase is lost or reversed", frequency: "Weekly", actionIfNotOk: "Test single-phase trip" },

  // 12. Electrical Panel (Electrical Panel)
  { templateId: "PNL-001", category: "Electrical Panel", checkPoint: "Panel door closed, locked & IP gasket", standard: "Door firmly latched; dust gasket sealed; key in authorized custody", frequency: "Daily", actionIfNotOk: "Lock panel door" },
  { templateId: "PNL-002", category: "Electrical Panel", checkPoint: "Phase indication lamps (R-Y-B) & voltmeter", standard: "All three lamps glowing; phase-to-phase voltage 415V balanced", frequency: "Daily", actionIfNotOk: "Replace indicator bulb" },
  { templateId: "PNL-003", category: "Electrical Panel", checkPoint: "Incomer breaker & mechanical door interlock", standard: "Breaker in ON position; interlock prevents door opening when energized", frequency: "Daily", actionIfNotOk: "Repair door interlock" },
  { templateId: "PNL-004", category: "Electrical Panel", checkPoint: "Thermography & temperature check", standard: "No hot spots, no discoloration of busbars, no burning ozone odor", frequency: "Daily", actionIfNotOk: "De-energize & tighten lug" },
  { templateId: "PNL-005", category: "Electrical Panel", checkPoint: "Panel exhaust fans & air filter mesh", standard: "Filters dust-free; exhaust fans blowing warm air outward", frequency: "Daily", actionIfNotOk: "Clean fan filter mats" },
  { templateId: "PNL-006", category: "Electrical Panel", checkPoint: "Earth busbar & double body earthing", standard: "Earth strips tightly bolted; earth loop resistance < 1.0 Ohm", frequency: "Weekly", actionIfNotOk: "Tighten earth bonding" },
  { templateId: "PNL-007", category: "Electrical Panel", checkPoint: "Danger 415V signage & insulating rubber mat", standard: "Hazard sign visible; 11kV electrical rubber mat in front of panel", frequency: "Daily", actionIfNotOk: "Place electrical mat" },

  // 13. Pneumatic Machine (Pneumatic Machine)
  { templateId: "PNM-001", category: "Pneumatic Machine", checkPoint: "Main air inlet pressure (FRL unit)", standard: "Regulated pressure between 5.5 bar and 7.0 bar; gauge pointer stable", frequency: "Daily", actionIfNotOk: "Adjust regulator knob" },
  { templateId: "PNM-002", category: "Pneumatic Machine", checkPoint: "FRL filter bowl moisture & auto-drain", standard: "Filter bowl cleared of water; condensate drained; no oil sludge", frequency: "Daily", actionIfNotOk: "Drain filter bowl" },
  { templateId: "PNM-003", category: "Pneumatic Machine", checkPoint: "FRL lubricator oil reservoir level", standard: "ISO VG 32 pneumatic oil filled; drip rate 1 drop/min active", frequency: "Daily", actionIfNotOk: "Fill lubricator oil" },
  { templateId: "PNM-004", category: "Pneumatic Machine", checkPoint: "Dual palm anti-tie-down safety buttons", standard: "Both buttons pressed simultaneously within 0.5s to cycle press", frequency: "Daily", actionIfNotOk: "Fix anti-tie-down timer" },
  { templateId: "PNM-005", category: "Pneumatic Machine", checkPoint: "Ram / punch tooling alignment & stop", standard: "Tooling aligned vertically; mechanical depth stop locked firmly", frequency: "Daily", actionIfNotOk: "Align tooling die" },
  { templateId: "PNM-006", category: "Pneumatic Machine", checkPoint: "Pneumatic cylinder rod & seal leaks", standard: "Chrome rod unscratched; zero air hissing at gland packing", frequency: "Daily", actionIfNotOk: "Replace cylinder seal" },
  { templateId: "PNM-007", category: "Pneumatic Machine", checkPoint: "Emergency stop & pressure dump valve", standard: "Pressing E-stop dumps pneumatic pressure and returns ram immediately", frequency: "Daily", actionIfNotOk: "Test quick dump valve" },

  // 14. Powder Spray Booth (Powder Spray Booth)
  { templateId: "SPB-001", category: "Powder Spray Booth", checkPoint: "Exhaust suction draft & face air velocity", standard: "Continuous negative pressure suction; no powder cloud drifting out", frequency: "Daily", actionIfNotOk: "Check exhaust fan/damper" },
  { templateId: "SPB-002", category: "Powder Spray Booth", checkPoint: "Cartridge filter reverse pulse-jet cleaning", standard: "Pneumatic pulse timer cycling; filters unclogged; differential pressure OK", frequency: "Daily", actionIfNotOk: "Check pulse solenoids" },
  { templateId: "SPB-003", category: "Powder Spray Booth", checkPoint: "Booth interior illumination & fixtures", standard: "Min 500 Lux illumination; dust-tight LED enclosures clean", frequency: "Daily", actionIfNotOk: "Wipe clean LED glass" },
  { templateId: "SPB-004", category: "Powder Spray Booth", checkPoint: "Grounding of booth & component hangers", standard: "Jig hangers clean with metal-to-metal contact; resistance < 10 Ohm", frequency: "Daily", actionIfNotOk: "Burn off powder on jigs" },
  { templateId: "SPB-005", category: "Powder Spray Booth", checkPoint: "Powder fluidizing hopper air pressure", standard: "Powder boiling evenly like liquid in hopper without volcanic spurts", frequency: "Daily", actionIfNotOk: "Adjust fluidizing pad" },
  { templateId: "SPB-006", category: "Powder Spray Booth", checkPoint: "Emergency stop & fire detection interlock", standard: "E-stop shuts down powder flow and exhaust; flame sensor interlocked", frequency: "Daily", actionIfNotOk: "Test booth interlocks" },

  // 15. Powder Spray Gun (Powder Spray Gun)
  { templateId: "GUN-001", category: "Powder Spray Gun", checkPoint: "High voltage cascade & kV controller setting", standard: "Digital kV display sets between 60 kV and 90 kV; current < 100 μA", frequency: "Daily", actionIfNotOk: "Calibrate HV controller" },
  { templateId: "GUN-002", category: "Powder Spray Gun", checkPoint: "Gun ground cable & operator grounding", standard: "Gun body cable securely grounded; operator wears conductive shoes", frequency: "Daily", actionIfNotOk: "Connect ground clamp" },
  { templateId: "GUN-003", category: "Powder Spray Gun", checkPoint: "Powder feed injector & delivery hose", standard: "Venturi insert clean of impact fusion; hose kink-free with smooth flow", frequency: "Daily", actionIfNotOk: "Clean injector sleeve" },
  { templateId: "GUN-004", category: "Powder Spray Gun", checkPoint: "Spray nozzle, deflector cone & electrode", standard: "Deflector clean; electrode needle straight; spray pattern uniform", frequency: "Daily", actionIfNotOk: "Clean/replace nozzle" },
  { templateId: "GUN-005", category: "Powder Spray Gun", checkPoint: "Purge air cleaning trigger function", standard: "Purge blast clears gun barrel and nozzle of residual powder instantly", frequency: "Daily", actionIfNotOk: "Check purge air valve" },
  { templateId: "GUN-006", category: "Powder Spray Gun", checkPoint: "Gun trigger switch & cable connection", standard: "Trigger engages and disengages electro-pneumatic valves without lag", frequency: "Daily", actionIfNotOk: "Replace trigger microswitch" },

  // 16. Grinder Machine (Grinder Machine)
  { templateId: "GRN-001", category: "Grinder Machine", checkPoint: "Wheel safety guard covering min 180° of wheel", standard: "Steel guard in place, tight and covers at least half the grinding wheel", frequency: "Daily", actionIfNotOk: "Mount wheel guard" },
  { templateId: "GRN-002", category: "Grinder Machine", checkPoint: "Grinding wheel condition (No chips or cracks)", standard: "Free from chips, grooving, cracks, oil saturation; dressed flat", frequency: "Daily", actionIfNotOk: "Replace cracked wheel" },
  { templateId: "GRN-003", category: "Grinder Machine", checkPoint: "Adjustable work rest clearance (< 3 mm)", standard: "Work rest distance from wheel face maintained at max 3 mm", frequency: "Daily", actionIfNotOk: "Adjust work rest gap" },
  { templateId: "GRN-004", category: "Grinder Machine", checkPoint: "Eye shield & spark deflector (< 2 mm)", standard: "Clear shatterproof eye shield mounted; spark deflector clearance < 2 mm", frequency: "Daily", actionIfNotOk: "Adjust spark arrestor" },
  { templateId: "GRN-005", category: "Grinder Machine", checkPoint: "Spindle speed vs Wheel max rated RPM", standard: "Wheel rated RPM strictly exceeds machine spindle max RPM", frequency: "Daily", actionIfNotOk: "Verify wheel RPM stamp" },
  { templateId: "GRN-006", category: "Grinder Machine", checkPoint: "Flange clamping blotters & spindle nut", standard: "Paper blotters intact between flanges; nut tightened with correct spanner", frequency: "Weekly", actionIfNotOk: "Fit flange blotters" },
  { templateId: "GRN-007", category: "Grinder Machine", checkPoint: "PPE (Face shield, safety glasses, apron)", standard: "Full face shield, safety goggles, leather apron, hearing protection worn", frequency: "Daily", actionIfNotOk: "Wear full face shield" },
];

export async function GET(_request: NextRequest) {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  try {
    const { getMongoDb } = await import("@/lib/mongodb");
    const mongoDb = await getMongoDb();
    const collection = mongoDb.collection("checklist_master");

    let inserted = 0;
    let updated = 0;

    for (const item of ALL_CHECKLISTS) {
      const doc = {
        "Template ID": item.templateId,
        "Category": item.category,
        "Check Point": item.checkPoint,
        "Standard / Requirement": item.standard,
        "Frequency": item.frequency || "Daily",
        "Response": "OK / Not OK / N/A",
        "Required Photo": "No",
        "IF Not ok Action": item.actionIfNotOk || "Report to Maintenance",
        "Active": "Yes",
        "Last Updated": new Date().toISOString(),
      };

      const res = await collection.updateOne(
        { "Template ID": item.templateId },
        { $set: doc },
        { upsert: true }
      );

      if (res.upsertedCount > 0) inserted++;
      else updated++;
    }

    return NextResponse.json({
      success: true,
      message: "Checklist Master populated directly in MongoDB Atlas (Database: skyms).",
      totalCheckPoints: ALL_CHECKLISTS.length,
      categoriesCount: new Set(ALL_CHECKLISTS.map((c) => c.category)).size,
      inserted,
      updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
