import ExcelJS from "exceljs";
import path from "path";
import { DATA_DIR, XLSX_PATH } from "./lib/config";

interface ItemDef {
  templateId: string;
  category: string;
  checkPoint: string;
  standard: string;
  frequency?: string;
  actionIfNotOk?: string;
}

const ALL_CHECKLISTS: ItemDef[] = [
  // 1. Laser Cutting
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

  // ==============================================================
  // 5S MACHINE CATEGORY-WISE CHECKPOINTS (16 Categories x 5 Points)
  // ==============================================================

  // 1. Laser Cutting - 5S
  { templateId: "LSR-5S-01", category: "Laser Cutting - 5S", checkPoint: "1S (Sort): Scrap sheet cutoffs, defective cuts & burr parts removed from laser table and transfer pallet", standard: "Work table cleared of offcut scrap; scrap metal placed in designated bin", frequency: "Daily", actionIfNotOk: "Clear scrap pieces to laser scrap bin" },
  { templateId: "LSR-5S-02", category: "Laser Cutting - 5S", checkPoint: "2S (Set in Order): Laser nozzles, cleaning brushes, optical centering tape, wrench kept in laser nozzle station box", standard: "All nozzle tips, spanners and centering tools in labeled station box", frequency: "Daily", actionIfNotOk: "Organize nozzles in numbered station kit" },
  { templateId: "LSR-5S-03", category: "Laser Cutting - 5S", checkPoint: "3S (Shine): Laser acrylic safety windows wiped clean, cutting bed scrap tray cleared, chiller radiator dust removed", standard: "Safety enclosure window transparent; slag drop tray cleared", frequency: "Daily", actionIfNotOk: "Wipe safety window and empty drop tray" },
  { templateId: "LSR-5S-04", category: "Laser Cutting - 5S", checkPoint: "4S (Standardize): Assist gas pressure markings (N2, O2) on regulators clearly visible, beam hazard warning intact", standard: "Regulator gauges marked with min/max green operating zones", frequency: "Daily", actionIfNotOk: "Remark operating pressure limits" },
  { templateId: "LSR-5S-05", category: "Laser Cutting - 5S", checkPoint: "5S (Sustain): Laser safety glasses OD 6+ worn by operator, beam path interlock verification logged daily", standard: "Mandatory OD 6+ laser eyewear verified and worn during operation", frequency: "Daily", actionIfNotOk: "Don laser safety glasses immediately" },

  // 2. Turret Punch - 5S
  { templateId: "TPP-5S-01", category: "Turret Punch - 5S", checkPoint: "1S (Sort): Slugs, offcut punch scrap, worn-out tools separated and cleared to scrap bins", standard: "Punching station free of rejected blanks and loose metal scrap", frequency: "Daily", actionIfNotOk: "Empty slug container to scrap skip" },
  { templateId: "TPP-5S-02", category: "Turret Punch - 5S", checkPoint: "2S (Set in Order): Punch dies, clamp shims, alignment pins stored in indexed turret tooling cabinet / shadow board", standard: "Dies, punches, and strippers stored in indexed cabinet by station size", frequency: "Daily", actionIfNotOk: "Return punch tools to indexed slots" },
  { templateId: "TPP-5S-03", category: "Turret Punch - 5S", checkPoint: "3S (Shine): Brush table balls free of chips, scrap slug bucket emptied, hydraulic tank area wiped clean", standard: "Ball transfer table vacuumed clean of metal particles; floor dry", frequency: "Daily", actionIfNotOk: "Vacuum brush table and clean grease" },
  { templateId: "TPP-5S-04", category: "Turret Punch - 5S", checkPoint: "4S (Standardize): Turret station capacity markings visible, clamp pressure gauge operating green zone labeled", standard: "Station tonnage limits and air pressure limits clearly indicated", frequency: "Daily", actionIfNotOk: "Verify station size & tonnage markings" },
  { templateId: "TPP-5S-05", category: "Turret Punch - 5S", checkPoint: "5S (Sustain): Hearing protection & safety shoes worn, sheet clamp pinch hazard zone observed", standard: "Hearing protection and safety boots worn; pinch perimeter kept clear", frequency: "Daily", actionIfNotOk: "Wear PPE before operating machine" },

  // 3. CNC Shearing Machine - 5S
  { templateId: "SHR-5S-01", category: "CNC Shearing Machine - 5S", checkPoint: "1S (Sort): Metal trim strips, defective shearing off-cuts cleared from front table and rear drop area", standard: "Cutting table cleared of scrap slivers; scrap bin emptied", frequency: "Daily", actionIfNotOk: "Clear scrap off-cuts to bin" },
  { templateId: "SHR-5S-02", category: "CNC Shearing Machine - 5S", checkPoint: "2S (Set in Order): Allen keys, gap adjustment gauges, sheet support arms stored in designated tool holder", standard: "Feeler gauges and adjustment spanners returned to tool holder", frequency: "Daily", actionIfNotOk: "Place gauges in labeled rack" },
  { templateId: "SHR-5S-03", category: "CNC Shearing Machine - 5S", checkPoint: "3S (Shine): Shearing table free of oil/burrs, backgauge guide rails wiped and lubricated, floor sweep done", standard: "Front ball supports clean; rear scrap ramp free of oil build-up", frequency: "Daily", actionIfNotOk: "Clean table surface and wipe guides" },
  { templateId: "SHR-5S-04", category: "CNC Shearing Machine - 5S", checkPoint: "4S (Standardize): Blade clearance setting chart displayed on machine, finger guard warning labels clear", standard: "Thickness vs blade clearance reference chart legible on frame", frequency: "Daily", actionIfNotOk: "Ensure clearance guide chart is posted" },
  { templateId: "SHR-5S-05", category: "CNC Shearing Machine - 5S", checkPoint: "5S (Sustain): Heavy cut-resistant gloves & safety shoes worn, foot pedal safety cover verified", standard: "Level 5 cut-resistant gloves and safety shoes worn; foot pedal hood intact", frequency: "Daily", actionIfNotOk: "Wear PPE and test pedal hood" },

  // 4. Bending Machine - 5S
  { templateId: "BND-5S-01", category: "Bending Machine - 5S", checkPoint: "1S (Sort): Test bends, reject profiles, scrap sheet strips removed from bending machine workspace", standard: "No surplus bent pieces or rejected parts left on side stands", frequency: "Daily", actionIfNotOk: "Clear test pieces from machine area" },
  { templateId: "BND-5S-02", category: "Bending Machine - 5S", checkPoint: "2S (Set in Order): Upper punches & bottom V-dies organized by radius and length in die storage rack", standard: "Segmented punches and dies placed in labeled rack slots", frequency: "Daily", actionIfNotOk: "Return tooling to organized die rack" },
  { templateId: "BND-5S-03", category: "Bending Machine - 5S", checkPoint: "3S (Shine): Die bed cleaned of scale, backgauge fingers wiped, hydraulic valves free of oil weeping", standard: "V-groove free of mill scale; backgauge stop fingers wiped", frequency: "Daily", actionIfNotOk: "Wipe die rail and oil drips" },
  { templateId: "BND-5S-04", category: "Bending Machine - 5S", checkPoint: "4S (Standardize): Tonnage limit warning label visible, crowning and angle reference chart posted", standard: "Bending tonnage chart and safety decals clearly displayed", frequency: "Daily", actionIfNotOk: "Verify tonnage and SOP charts" },
  { templateId: "BND-5S-05", category: "Bending Machine - 5S", checkPoint: "5S (Sustain): Operator maintains safe pinch distance from bending line, protective toe-caps worn", standard: "Safe bending standoff maintained; safety footwear verified", frequency: "Daily", actionIfNotOk: "Strictly observe pinch zone precautions" },

  // 5. Air Compressor - 5S
  { templateId: "CMP-5S-01", category: "Air Compressor - 5S", checkPoint: "1S (Sort): Old compressor filters, used oil cans, discarded hoses removed from compressor room", standard: "Zero redundant containers or waste packaging inside compressor room", frequency: "Daily", actionIfNotOk: "Dispose of used consumables" },
  { templateId: "CMP-5S-02", category: "Air Compressor - 5S", checkPoint: "2S (Set in Order): Maintenance wrench set, pressure gauge calibration tools kept in wall cabinet", standard: "Drain valve keys and oil fill funnel stored on wall shadow board", frequency: "Daily", actionIfNotOk: "Place tools in wall tool-board" },
  { templateId: "CMP-5S-03", category: "Air Compressor - 5S", checkPoint: "3S (Shine): Compressor body & motor casing dust-free, drain drip tray clean, floor dry", standard: "Cooling air intake vents dusted; floor dry with no oil slicks", frequency: "Daily", actionIfNotOk: "Wipe down compressor enclosure" },
  { templateId: "CMP-5S-04", category: "Air Compressor - 5S", checkPoint: "4S (Standardize): Target tank pressure range (6.5 - 8.5 bar) marked in green on pressure gauge", standard: "Pressure gauge marked with green operating sector", frequency: "Daily", actionIfNotOk: "Verify green/red limit stickers" },
  { templateId: "CMP-5S-05", category: "Air Compressor - 5S", checkPoint: "5S (Sustain): Compressor room ventilation confirmed, ear protection worn during inspection", standard: "Louver exhaust fan running; hearing protection worn upon entry", frequency: "Daily", actionIfNotOk: "Wear hearing protection in room" },

  // 6. EOT Crane - 5S
  { templateId: "CRN-5S-01", category: "EOT Crane - 5S", checkPoint: "1S (Sort): Damaged slings, frayed ropes, unrated D-shackles red-tagged and removed from crane bay", standard: "Uncertified or worn lifting tackles immediately taken out of service", frequency: "Daily", actionIfNotOk: "Remove rejected slings immediately" },
  { templateId: "CRN-5S-02", category: "EOT Crane - 5S", checkPoint: "2S (Set in Order): Lifting slings, web belts, chains hung neatly on rated sling stand with SWL tags", standard: "Slings organized by capacity and color code on designated sling tree", frequency: "Daily", actionIfNotOk: "Hang slings on designated A-frame rack" },
  { templateId: "CRN-5S-03", category: "EOT Crane - 5S", checkPoint: "3S (Shine): Crane hook and block clean, wire rope free of dried grit, pendant control wipe-down", standard: "Hook latch and pendant pushbutton box cleaned of grease", frequency: "Daily", actionIfNotOk: "Wipe pendant controller and hook" },
  { templateId: "CRN-5S-04", category: "EOT Crane - 5S", checkPoint: "4S (Standardize): Safe Working Load (SWL 8T) prominently painted on bridge and hook block", standard: "SWL capacity markings clearly visible from plant floor", frequency: "Daily", actionIfNotOk: "Ensure SWL markings are legible" },
  { templateId: "CRN-5S-05", category: "EOT Crane - 5S", checkPoint: "5S (Sustain): Rigging safety helmet and chin-strap verified, no walking under suspended load rule enforced", standard: "Rigger helmet worn; hoist travel horn tested; no personnel under load", frequency: "Daily", actionIfNotOk: "Wear safety helmet and clear load path" },

  // 7. CO2 Welding Machine - 5S
  { templateId: "WLD-5S-01", category: "CO2 Welding Machine - 5S", checkPoint: "1S (Sort): Spatter balls, used contact tips, empty wire spools, scrap filler wire cleared from welding bay", standard: "Welding bay floor free of wire cutoffs and used ceramic nozzles", frequency: "Daily", actionIfNotOk: "Clean welding bay floor and table" },
  { templateId: "WLD-5S-02", category: "CO2 Welding Machine - 5S", checkPoint: "2S (Set in Order): Welding torch, earth clamp, chipping hammer, wire brush hung on dedicated bay hooks", standard: "Torch cable uncoiled from floor; chipping hammer in wall holster", frequency: "Daily", actionIfNotOk: "Hang torch and clamp on wall hooks" },
  { templateId: "WLD-5S-03", category: "CO2 Welding Machine - 5S", checkPoint: "3S (Shine): Bay floor swept, welding curtain wiped clean of spatter, fume extraction hood cleaned", standard: "Welding booth curtains transparent/amber without heavy slag buildup", frequency: "Daily", actionIfNotOk: "Wipe spatter off curtains and table" },
  { templateId: "WLD-5S-04", category: "CO2 Welding Machine - 5S", checkPoint: "4S (Standardize): Gas cylinder secured with safety chain; cylinder regulator flow range marked", standard: "CO2 cylinder chained upright; gas flow ball float range (15-20 lpm) marked", frequency: "Daily", actionIfNotOk: "Chain gas cylinder and check regulator" },
  { templateId: "WLD-5S-05", category: "CO2 Welding Machine - 5S", checkPoint: "5S (Sustain): Auto-darkening welding helmet, leather gloves, leather apron worn; flash shield closed", standard: "Full welding PPE worn; protective booth screens closed before striking arc", frequency: "Daily", actionIfNotOk: "Don all welding safety gear" },

  // 8. Drill Machine - 5S
  { templateId: "DRL-5S-01", category: "Drill Machine - 5S", checkPoint: "1S (Sort): Metal drill swarf, chips, broken drill bits cleared from table to swarf bin", standard: "Work table and T-slots cleared of sharp metal curls", frequency: "Daily", actionIfNotOk: "Brush off chips to swarf bucket" },
  { templateId: "DRL-5S-02", category: "Drill Machine - 5S", checkPoint: "2S (Set in Order): Chuck key tethered to machine, drill bit index box organized by diameter in rack", standard: "Chuck key on spring retractor; drill bits in labeled metal stand", frequency: "Daily", actionIfNotOk: "Store drill bits in indexed stand" },
  { templateId: "DRL-5S-03", category: "Drill Machine - 5S", checkPoint: "3S (Shine): Drill table wiped clean, coolant tank strainer cleared of metal curls, column greased", standard: "Column wipe-down done; coolant return free of stagnant chips", frequency: "Daily", actionIfNotOk: "Clean table and oil drill column" },
  { templateId: "DRL-5S-04", category: "Drill Machine - 5S", checkPoint: "4S (Standardize): Spindle RPM speed selection chart clearly displayed for drill diameters", standard: "Speed selection table legible on belt cover for operator guidance", frequency: "Daily", actionIfNotOk: "Verify speed selection decal on head" },
  { templateId: "DRL-5S-05", category: "Drill Machine - 5S", checkPoint: "5S (Sustain): Hair tied back, safety goggles worn, loose clothing and hand gloves prohibited while drilling", standard: "Zero gloves worn during drilling; impact safety goggles in place", frequency: "Daily", actionIfNotOk: "Remove gloves before drilling; wear goggles" },

  // 9. Powder Coating Oven - 5S
  { templateId: "OVN-5S-01", category: "Powder Coating Oven - 5S", checkPoint: "1S (Sort): Rejected cured parts, scrap hooks, masking tape residues removed from oven loading area", standard: "Loading vestibule clear of old masking tape and fallen components", frequency: "Daily", actionIfNotOk: "Clear rejected parts from oven entry" },
  { templateId: "OVN-5S-02", category: "Powder Coating Oven - 5S", checkPoint: "2S (Set in Order): High-temp trolleys, hanging jigs, temperature logger kept in designated parking tracks", standard: "Conveyor hooks and trolleys stored on marked yellow parking lanes", frequency: "Daily", actionIfNotOk: "Park trolleys in marked floor lane" },
  { templateId: "OVN-5S-03", category: "Powder Coating Oven - 5S", checkPoint: "3S (Shine): Oven floor swept, exhaust ducts clean, loading door seals wiped free of powder residue", standard: "Door silicone gasket clean; floor vacuumed; zero loose powder accumulation", frequency: "Daily", actionIfNotOk: "Clean door seals and sweep entrance" },
  { templateId: "OVN-5S-04", category: "Powder Coating Oven - 5S", checkPoint: "4S (Standardize): Curing temp & cycle time SOP displayed on burner control panel; gas shutoff labeled", standard: "Curing temperature (e.g. 180°C - 200°C) and dwell time SOP visible", frequency: "Daily", actionIfNotOk: "Check SOP temperature chart" },
  { templateId: "OVN-5S-05", category: "Powder Coating Oven - 5S", checkPoint: "5S (Sustain): Heat-resistant thermal gloves worn when unloading, gas leak inspection completed", standard: "Heavy Kevlar/leather thermal gloves used when opening hot doors", frequency: "Daily", actionIfNotOk: "Wear thermal gloves when handling hot parts" },

  // 10. UPS - 5S
  { templateId: "UPS-5S-01", category: "UPS - 5S", checkPoint: "1S (Sort): Redundant battery cables, discarded packing, scrap packaging removed from UPS room", standard: "UPS and battery enclosure room 100% free of combustible packing", frequency: "Daily", actionIfNotOk: "Clear scrap materials from room" },
  { templateId: "UPS-5S-02", category: "UPS - 5S", checkPoint: "2S (Set in Order): Insulated electrical tool kit, multimeter kept in marked electrical locker", standard: "1000V rated insulated hand tools returned to designated wall case", frequency: "Daily", actionIfNotOk: "Place meter in designated locker" },
  { templateId: "UPS-5S-03", category: "UPS - 5S", checkPoint: "3S (Shine): UPS casing and battery rack tops wiped dust-free, room floor clean and dry", standard: "Battery terminal covers wiped clean; no white acid sulfate residue", frequency: "Daily", actionIfNotOk: "Wipe battery tops and sweep floor" },
  { templateId: "UPS-5S-04", category: "UPS - 5S", checkPoint: "4S (Standardize): Emergency power off (EPO) switch clearly signposted; battery bank numbers labeled", standard: "EPO push-button sign and battery string IDs (String 1, 2) clearly marked", frequency: "Daily", actionIfNotOk: "Check EPO signage and bank numbering" },
  { templateId: "UPS-5S-05", category: "UPS - 5S", checkPoint: "5S (Sustain): UPS room temperature maintained < 25°C; rubber insulating mats inspected", standard: "Room AC thermostat confirmed < 25°C; IS 15652 rubber floor mat clean", frequency: "Daily", actionIfNotOk: "Check AC cooling and floor rubber mat" },

  // 11. Stabilizer - 5S
  { templateId: "STB-5S-01", category: "Stabilizer - 5S", checkPoint: "1S (Sort): Scrap wire ends, redundant components cleared from stabilizer enclosure area", standard: "No loose conductors or discarded hardware on stabilizer roof or base", frequency: "Daily", actionIfNotOk: "Clear debris from around stabilizer" },
  { templateId: "STB-5S-02", category: "Stabilizer - 5S", checkPoint: "2S (Set in Order): Testing probes and safety gloves kept in labeled storage pouch", standard: "Voltage probes and safety class gloves hung in labeled pouch", frequency: "Daily", actionIfNotOk: "Keep probes in designated pouch" },
  { templateId: "STB-5S-03", category: "Stabilizer - 5S", checkPoint: "3S (Shine): Louver ventilation grilles cleaned of dust; exterior cabinet wiped down", standard: "Air intake louvers free of lint; paintwork free of heavy grime", frequency: "Daily", actionIfNotOk: "Vacuum air vents and wipe enclosure" },
  { templateId: "STB-5S-04", category: "Stabilizer - 5S", checkPoint: "4S (Standardize): Nominal voltage band (415V ± 1%) marked with green indicator zone on analog meters", standard: "Green target operating band clearly demarcated on voltmeter dial", frequency: "Daily", actionIfNotOk: "Verify meter green zone mark" },
  { templateId: "STB-5S-05", category: "Stabilizer - 5S", checkPoint: "5S (Sustain): Electrical shock hazard danger signage displayed; earth connection tag verified", standard: "415V caution skull signage legible; ground test tag verified", frequency: "Daily", actionIfNotOk: "Inspect high voltage warning sticker" },

  // 12. Electrical Panel - 5S
  { templateId: "PNL-5S-01", category: "Electrical Panel - 5S", checkPoint: "1S (Sort): Unused wire clips, loose terminal screws, redundant drawings cleared from inside panel", standard: "Panel gutter base completely free of loose screws, wire cutoffs and debris", frequency: "Daily", actionIfNotOk: "Remove clutter from panel base" },
  { templateId: "PNL-5S-02", category: "Electrical Panel - 5S", checkPoint: "2S (Set in Order): Panel key hung in key box; electrical circuit schematic diagram stored in door pocket", standard: "Single Line Diagram (SLD) schematic folded in door document pocket", frequency: "Daily", actionIfNotOk: "Place SLD schematic in door pouch" },
  { templateId: "PNL-5S-03", category: "Electrical Panel - 5S", checkPoint: "3S (Shine): Panel exterior clean, filter mats washed/replaced, zero cobwebs or conductive dust", standard: "Panel enclosure wiped; fan intake filter pads clean without clogging", frequency: "Daily", actionIfNotOk: "Clean panel exterior and exhaust filter" },
  { templateId: "PNL-5S-04", category: "Electrical Panel - 5S", checkPoint: "4S (Standardize): All MCB/MCCB breakers labeled with load name; phase indication lamps labeled (R-Y-B)", standard: "Permanent engraved/printed labels on all circuit breakers and fuses", frequency: "Daily", actionIfNotOk: "Check circuit identification tags" },
  { templateId: "PNL-5S-05", category: "Electrical Panel - 5S", checkPoint: "5S (Sustain): Panel doors always kept closed and locked; rubber floor mat maintained in front", standard: "Panel door latched shut; danger plate displayed; shock mat positioned", frequency: "Daily", actionIfNotOk: "Lock panel door and verify floor mat" },

  // 13. Pneumatic Machine / Blower - 5S
  { templateId: "PNM-5S-01", category: "Pneumatic Machine - 5S", checkPoint: "1S (Sort): Damaged fittings, split PU tubing, redundant clips removed from machine area", standard: "Workstation free of cracked air hoses and leaking push-in fittings", frequency: "Daily", actionIfNotOk: "Clear broken pneumatic fittings" },
  { templateId: "PNM-5S-02", category: "Pneumatic Machine - 5S", checkPoint: "2S (Set in Order): Air hose reels coiled neatly, hose clamp tools kept in pneumatic maintenance kit", standard: "Overhead hose reels retracting properly; hose cutter in toolkit", frequency: "Daily", actionIfNotOk: "Coil hoses and store clamp tools" },
  { templateId: "PNM-5S-03", category: "Pneumatic Machine - 5S", checkPoint: "3S (Shine): Motor housing cooling fins cleaned, blower intake screen freed from lint/powder", standard: "Blower mesh cleared of fibrous dust; motor casing free of thick grime", frequency: "Daily", actionIfNotOk: "Clean cooling fins and intake mesh" },
  { templateId: "PNM-5S-04", category: "Pneumatic Machine - 5S", checkPoint: "4S (Standardize): Direction of rotation arrow marked on blower casing; regulator pressure marked", standard: "Red directional rotation arrow painted on housing; 6 bar marked on gauge", frequency: "Daily", actionIfNotOk: "Verify rotation arrow and pressure decal" },
  { templateId: "PNM-5S-05", category: "Pneumatic Machine - 5S", checkPoint: "5S (Sustain): Hearing protection worn near blower; air leak inspection completed", standard: "Ear plugs/muffs worn when blower active; soap bubble leak test logged", frequency: "Daily", actionIfNotOk: "Wear ear protection and check joints" },

  // 14. Powder Spray Booth - 5S
  { templateId: "SPB-5S-01", category: "Powder Spray Booth - 5S", checkPoint: "1S (Sort): Spilled overspray powder, scrap masking caps, empty powder boxes cleared from booth area", standard: "Floor around booth swept; contaminated powder emptied into waste drum", frequency: "Daily", actionIfNotOk: "Scoop powder and remove waste" },
  { templateId: "SPB-5S-02", category: "Powder Spray Booth - 5S", checkPoint: "2S (Set in Order): Squeegees, recovery scoops, grounded air blow guns hung on booth wall brackets", standard: "Booth cleaning squeegees and conductive blow nozzles hung on hooks", frequency: "Daily", actionIfNotOk: "Hang cleaning tools on wall hooks" },
  { templateId: "SPB-5S-03", category: "Powder Spray Booth - 5S", checkPoint: "3S (Shine): Booth walls and recovery hopper squeegeed clean between color changes; floor swept", standard: "Polypropylene booth canopy clean; recovery hopper vacuumed", frequency: "Daily", actionIfNotOk: "Squeegee walls and clean hopper" },
  { templateId: "SPB-5S-04", category: "Powder Spray Booth - 5S", checkPoint: "4S (Standardize): Static grounding clamp cable tagged; differential pressure gauge clean", standard: "Booth earth cable copper braid verified intact; filter delta-P noted", frequency: "Daily", actionIfNotOk: "Check earth clamp and magnehelic gauge" },
  { templateId: "SPB-5S-05", category: "Powder Spray Booth - 5S", checkPoint: "5S (Sustain): Full chemical/dust respirator & anti-static suit worn; booth exhaust interlock verified", standard: "Operator wearing clean P2/P3 dust respirator and static-dissipative footwear", frequency: "Daily", actionIfNotOk: "Wear respirator and anti-static suit" },

  // 15. Powder Spray Gun - 5S
  { templateId: "GUN-5S-01", category: "Powder Spray Gun - 5S", checkPoint: "1S (Sort): Worn nozzles, stripped O-rings, contaminated powder hoses discarded to scrap", standard: "Damaged electrode tips and cracked powder tubes removed from station", frequency: "Daily", actionIfNotOk: "Dispose of worn spray tips" },
  { templateId: "GUN-5S-02", category: "Powder Spray Gun - 5S", checkPoint: "2S (Set in Order): Gun holder cradle used when gun is idle; spare spray tips organized in tip box", standard: "Gun rested in cradle between parts; spray nozzles organized in tip kit", frequency: "Daily", actionIfNotOk: "Rest gun in cradle; store spare tips" },
  { templateId: "GUN-5S-03", category: "Powder Spray Gun - 5S", checkPoint: "3S (Shine): Gun barrel wiped with alcohol wipe; fluidizing hopper interior clean and dry", standard: "Exterior of spray gun wiped free of powder; injector venturi blown clean", frequency: "Daily", actionIfNotOk: "Wipe gun body and blow powder clean" },
  { templateId: "GUN-5S-04", category: "Powder Spray Gun - 5S", checkPoint: "4S (Standardize): Gun cascade voltage & current limit settings card attached to control unit", standard: "Voltage (60-80 kV) and microamp limit recipe card laminated on unit", frequency: "Daily", actionIfNotOk: "Verify voltage/current preset card" },
  { templateId: "GUN-5S-05", category: "Powder Spray Gun - 5S", checkPoint: "5S (Sustain): Grounding path continuity through operator wrist/sole verified; gun cable untangled", standard: "Grounding resistance < 1 Megaohm verified; gun air/powder cable untangled", frequency: "Daily", actionIfNotOk: "Confirm operator grounding continuity" },

  // 16. Grinder Machine - 5S
  { templateId: "GRD-5S-01", category: "Grinder Machine - 5S", checkPoint: "1S (Sort): Worn grinding wheels, grinding scrap stubs, iron dust cleared to metal swarf container", standard: "Worn or out-of-round grinding wheels discarded; floor swept", frequency: "Daily", actionIfNotOk: "Empty grinding dust container" },
  { templateId: "GRD-5S-02", category: "Grinder Machine - 5S", checkPoint: "2S (Set in Order): Wheel dressing tool, pin spanner, face shield kept on dedicated grinder tool board", standard: "Huntington wheel dresser and flange pin spanners hung on tool board", frequency: "Daily", actionIfNotOk: "Hang dresser tool and face shield on board" },
  { templateId: "GRD-5S-03", category: "Grinder Machine - 5S", checkPoint: "3S (Shine): Wheel guard interior cleaned of swarf, machine pedestal wiped down, water cup clean", standard: "Inside of wheel guard vacuumed; quench pot filled with fresh clean water", frequency: "Daily", actionIfNotOk: "Wipe pedestal and clean quench cup" },
  { templateId: "GRD-5S-04", category: "Grinder Machine - 5S", checkPoint: "4S (Standardize): Wheel maximum safe operating RPM marked on guard; work rest 3mm limit labeled", standard: "Maximum rated RPM decal and 3mm gap gauge mark clearly visible", frequency: "Daily", actionIfNotOk: "Ensure max RPM and rest limit decals clear" },
  { templateId: "GRD-5S-05", category: "Grinder Machine - 5S", checkPoint: "5S (Sustain): Face shield & safety goggles mandatory; leather apron worn; spark curtain closed", standard: "Full polycarbonate face shield and safety spectacles worn without exception", frequency: "Daily", actionIfNotOk: "Wear full face shield and apron" },
];

async function populateChecklistMaster() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const ws = wb.getWorksheet("2. Checklist Master");
  if (!ws) {
    throw new Error("Worksheet '2. Checklist Master' not found!");
  }

  // Ensure headers
  const headers = [
    "Template ID",
    "Category",
    "Check Point",
    "Standard / Requirement",
    "Frequency",
    "Response",
    "Required Photo",
    "IF Not ok Action",
    "Active",
  ];

  const headerRow = ws.getRow(1);
  headerRow.values = headers;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15547D" } };

  console.log(`Writing all ${ALL_CHECKLISTS.length} checklist points (category-wise + 5S)...`);

  ALL_CHECKLISTS.forEach((item, index) => {
    const row = ws.getRow(index + 2);
    row.values = [
      item.templateId,
      item.category,
      item.checkPoint,
      item.standard,
      item.frequency || "Daily",
      "OK / Not OK / N/A",
      "No",
      item.actionIfNotOk || "Report to Maintenance",
      "Yes",
    ];
  });

  // Clear any extra rows that might have existed previously
  for (let r = ALL_CHECKLISTS.length + 2; r <= ws.rowCount; r++) {
    ws.getRow(r).values = [];
  }

  // Format columns
  headers.forEach((h, i) => {
    const maxLen = ALL_CHECKLISTS.reduce((acc, r) => {
      const val = i === 0 ? r.templateId : i === 1 ? r.category : i === 2 ? r.checkPoint : i === 3 ? r.standard : "";
      return Math.max(acc, String(val ?? "").length);
    }, h.length);
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 14), 70);
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  await wb.xlsx.writeFile(XLSX_PATH);
  console.log(`✓ Successfully populated 2. Checklist Master with all ${ALL_CHECKLISTS.length} points across ${new Set(ALL_CHECKLISTS.map(c => c.category)).size} categories!`);
}

populateChecklistMaster().catch(console.error);
