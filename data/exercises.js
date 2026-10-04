// OmniFit — Base d'exercices (169 exercices, materiel et anatomie detaillee inclus)
// Structure : { id, name, category, primaryMuscles:[{m,p}], secondaryMuscles:[{m,p}], difficulty, equipment }

export const MUSCLES = [
  { id: 'chest', label: 'Pectoraux', short: 'Pecs', group: 'Pectoraux' },
  { id: 'frontDelts', label: 'Deltoïdes antérieurs', short: 'Delt. ant.', group: 'Épaules' },
  { id: 'sideDelts', label: 'Deltoïdes latéraux', short: 'Delt. lat.', group: 'Épaules' },
  { id: 'rearDelts', label: 'Deltoïdes postérieurs', short: 'Delt. post.', group: 'Épaules' },
  { id: 'traps', label: 'Trapèzes', short: 'Trapèzes', group: 'Dos' },
  { id: 'rhomboids', label: 'Rhomboïdes', short: 'Rhomb.', group: 'Dos' },
  { id: 'lats', label: 'Grands dorsaux', short: 'Dorsaux', group: 'Dos' },
  { id: 'lowerback', label: 'Lombaires', short: 'Lomb.', group: 'Dos' },
  { id: 'biceps', label: 'Biceps', short: 'Biceps', group: 'Bras' },
  { id: 'triceps', label: 'Triceps', short: 'Triceps', group: 'Bras' },
  { id: 'forearms', label: 'Avant-bras', short: 'Av-bras', group: 'Bras' },
  { id: 'abs', label: 'Abdominaux', short: 'Abdos', group: 'Tronc' },
  { id: 'obliques', label: 'Obliques', short: 'Obliques', group: 'Tronc' },
  { id: 'glutes', label: 'Fessiers', short: 'Fessiers', group: 'Jambes' },
  { id: 'quads', label: 'Quadriceps', short: 'Quadris', group: 'Jambes' },
  { id: 'hamstrings', label: 'Ischios', short: 'Ischios', group: 'Jambes' },
  { id: 'adductors', label: 'Adducteurs', short: 'Adduct.', group: 'Jambes' },
  { id: 'calves', label: 'Mollets', short: 'Mollets', group: 'Jambes' },
];

// Anciens grands groupes (avant la v6.1) → répartition sur les muscles fins.
// Sert à convertir les exercices personnels, les répartitions modifiées et les
// sauvegardes importées.
export const LEGACY_SPLIT = {
  shoulders: [['frontDelts', 0.5], ['sideDelts', 0.3], ['rearDelts', 0.2]],
  back: [['lats', 0.6], ['rhomboids', 0.25], ['traps', 0.15]],
  core: [['abs', 0.75], ['obliques', 0.25]],
};
// Convertit une liste [{m, p}] qui contient d'anciens groupes. Les parts sont
// arrondies à l'unité ; le reste d'arrondi va à la plus grosse part, pour que
// le total reste exactement le même. Renvoie la liste telle quelle sinon.
export function splitLegacyMuscles(list) {
  if (!Array.isArray(list) || !list.some((x) => LEGACY_SPLIT[x.m])) return list;
  const acc = new Map();
  for (const { m, p } of list) {
    if (!LEGACY_SPLIT[m]) { acc.set(m, (acc.get(m) || 0) + p); continue; }
    const parts = LEGACY_SPLIT[m].map(([id, k]) => [id, Math.round(p * k)]);
    const diff = p - parts.reduce((a, [, v]) => a + v, 0);
    parts[0][1] += diff;
    for (const [id, v] of parts) if (v > 0) acc.set(id, (acc.get(id) || 0) + v);
  }
  return [...acc.entries()].map(([m, p]) => ({ m, p })).sort((a, b) => b.p - a.p);
}

export const muscleLabel = (id) => (MUSCLES.find((m) => m.id === id) || { label: id }).label;

function ex(id, name, category, primary, secondary, equipment, difficulty = 'Intermediate') {
  return {
    id,
    name,
    category,
    primaryMuscles: primary.map(([m, p]) => ({ m, p })),
    secondaryMuscles: secondary.map(([m, p]) => ({ m, p })),
    equipment,
    difficulty,
  };
}

export const EXERCISES = [
  // ============ CHEST (14) ============
  ex('benchPress', 'Bench Press', 'Chest', [['chest', 70], ['shoulders', 15]], [['triceps', 15]], 'Barbell'),
  ex('inclineBench', 'Incline Bench Press', 'Chest', [['chest', 60], ['shoulders', 25]], [['triceps', 15]], 'Barbell'),
  ex('declineBench', 'Decline Bench Press', 'Chest', [['chest', 75]], [['triceps', 15], ['shoulders', 10]], 'Barbell'),
  ex('dbBenchPress', 'Dumbbell Bench Press', 'Chest', [['chest', 70], ['shoulders', 15]], [['triceps', 15]], 'Dumbbells'),
  ex('dbInclinePress', 'Incline Dumbbell Press', 'Chest', [['chest', 60], ['shoulders', 25]], [['triceps', 15]], 'Dumbbells'),
  ex('dbFly', 'Dumbbell Fly', 'Chest', [['chest', 85]], [['shoulders', 15]], 'Dumbbells'),
  ex('cableFly', 'Cable Fly', 'Chest', [['chest', 85]], [['shoulders', 15]], 'Cable'),
  ex('pecDeck', 'Pec Deck', 'Chest', [['chest', 90]], [['shoulders', 10]], 'Machine', 'Beginner'),
  ex('pushUp', 'Push Up', 'Chest', [['chest', 60], ['shoulders', 15]], [['triceps', 15], ['core', 10]], 'Bodyweight', 'Beginner'),
  ex('dips', 'Dip', 'Chest', [['chest', 55], ['triceps', 30]], [['shoulders', 15]], 'Bodyweight'),
  ex('machinePress', 'Machine Chest Press', 'Chest', [['chest', 70], ['shoulders', 15]], [['triceps', 15]], 'Machine', 'Beginner'),
  ex('pullover', 'Pull-over haltère', 'Chest', [['chest', 55], ['back', 30]], [['triceps', 15]], 'Dumbbells'),
  ex('svendPress', 'Svend Press', 'Chest', [['chest', 80]], [['shoulders', 10], ['triceps', 10]], 'Plate', 'Beginner'),
  ex('landminePress', 'Landmine Press', 'Chest', [['chest', 50], ['shoulders', 35]], [['triceps', 15]], 'Barbell'),

  // ============ BACK (15) ============
  ex('pullUp', 'Pull Up', 'Back', [['back', 70], ['biceps', 20]], [['forearms', 10]], 'Bodyweight'),
  ex('chinUp', 'Chin Up', 'Back', [['back', 60], ['biceps', 30]], [['forearms', 10]], 'Bodyweight'),
  ex('latPulldown', 'Lat Pulldown', 'Back', [['back', 70], ['biceps', 20]], [['forearms', 10]], 'Cable', 'Beginner'),
  ex('barbellRow', 'Barbell Row', 'Back', [['back', 65]], [['biceps', 15], ['lowerback', 10], ['forearms', 10]], 'Barbell'),
  ex('pendlayRow', 'Pendlay Row', 'Back', [['back', 70]], [['biceps', 15], ['lowerback', 15]], 'Barbell', 'Advanced'),
  ex('dbRow', 'Rowing haltère unilatéral', 'Back', [['back', 70]], [['biceps', 20], ['forearms', 10]], 'Dumbbells', 'Beginner'),
  ex('seatedCableRow', 'Seated Cable Row', 'Back', [['back', 70]], [['biceps', 20], ['forearms', 10]], 'Cable', 'Beginner'),
  ex('tBarRow', 'T Bar Row', 'Back', [['back', 70]], [['biceps', 15], ['lowerback', 15]], 'Barbell'),
  ex('deadlift', 'Deadlift', 'Back', [['back', 30], ['glutes', 25], ['hamstrings', 25]], [['lowerback', 10], ['forearms', 10]], 'Barbell', 'Advanced'),
  ex('rackPull', 'Rack Pull', 'Back', [['back', 45], ['glutes', 20]], [['hamstrings', 15], ['lowerback', 10], ['forearms', 10]], 'Barbell'),
  ex('facePull', 'Face Pull', 'Back', [['shoulders', 50], ['back', 40]], [['biceps', 10]], 'Cable', 'Beginner'),
  ex('straightArmPulldown', 'Straight Arm Pulldown', 'Back', [['back', 85]], [['triceps', 15]], 'Cable', 'Beginner'),
  ex('shrugs', 'Barbell Shrug', 'Back', [['back', 90]], [['forearms', 10]], 'Dumbbells', 'Beginner'),
  ex('machineRow', 'Machine Row', 'Back', [['back', 75]], [['biceps', 15], ['forearms', 10]], 'Machine', 'Beginner'),
  ex('invertedRow', 'Inverted Row', 'Back', [['back', 65], ['biceps', 20]], [['core', 15]], 'Bodyweight', 'Beginner'),

  // ============ SHOULDERS (13) ============
  ex('overheadPress', 'Military Press', 'Shoulders', [['shoulders', 70]], [['triceps', 20], ['core', 10]], 'Barbell'),
  ex('dbShoulderPress', 'Seated Dumbbell Press', 'Shoulders', [['shoulders', 70]], [['triceps', 20], ['core', 10]], 'Dumbbells'),
  ex('arnoldPress', 'Arnold Press', 'Shoulders', [['shoulders', 75]], [['triceps', 25]], 'Dumbbells'),
  ex('lateralRaise', 'Lateral Raise', 'Shoulders', [['shoulders', 90]], [['forearms', 10]], 'Dumbbells', 'Beginner'),
  ex('cableLateralRaise', 'Cable Lateral Raise', 'Shoulders', [['shoulders', 90]], [['forearms', 10]], 'Cable', 'Beginner'),
  ex('frontRaise', 'Front Raise', 'Shoulders', [['shoulders', 90]], [['core', 10]], 'Dumbbells', 'Beginner'),
  ex('rearDeltFly', 'Rear Delt Fly', 'Shoulders', [['shoulders', 80], ['back', 20]], [], 'Dumbbells', 'Beginner'),
  ex('reversePecDeck', 'Reverse Pec Deck', 'Shoulders', [['shoulders', 80], ['back', 20]], [], 'Machine', 'Beginner'),
  ex('uprightRow', 'Upright Row', 'Shoulders', [['shoulders', 60], ['back', 25]], [['biceps', 15]], 'Barbell'),
  ex('machineShoulderPress', 'Machine Shoulder Press', 'Shoulders', [['shoulders', 75]], [['triceps', 25]], 'Machine', 'Beginner'),
  ex('pushPress', 'Push Press', 'Shoulders', [['shoulders', 60]], [['triceps', 20], ['quads', 10], ['core', 10]], 'Barbell', 'Advanced'),
  ex('cubanRotation', 'Rotation cubaine', 'Shoulders', [['shoulders', 90]], [['forearms', 10]], 'Dumbbells', 'Beginner'),
  ex('plateFrontRaise', 'Élévation frontale disque', 'Shoulders', [['shoulders', 85]], [['core', 15]], 'Plate', 'Beginner'),

  // ============ BICEPS (12) ============
  ex('barbellCurl', 'Barbell Curl', 'Biceps', [['biceps', 80]], [['forearms', 20]], 'Barbell', 'Beginner'),
  ex('ezBarCurl', 'EZ Bar Curl', 'Biceps', [['biceps', 80]], [['forearms', 20]], 'Barbell', 'Beginner'),
  ex('dbCurl', 'Dumbbell Curl', 'Biceps', [['biceps', 80]], [['forearms', 20]], 'Dumbbells', 'Beginner'),
  ex('hammerCurl', 'Hammer Curl', 'Biceps', [['biceps', 60], ['forearms', 40]], [], 'Dumbbells', 'Beginner'),
  ex('inclineCurl', 'Incline Dumbbell Curl', 'Biceps', [['biceps', 90]], [['forearms', 10]], 'Dumbbells'),
  ex('preacherCurl', 'Preacher Curl', 'Biceps', [['biceps', 90]], [['forearms', 10]], 'Barbell'),
  ex('concentrationCurl', 'Concentration Curl', 'Biceps', [['biceps', 95]], [['forearms', 5]], 'Dumbbells', 'Beginner'),
  ex('cableCurl', 'Cable Curl', 'Biceps', [['biceps', 85]], [['forearms', 15]], 'Cable', 'Beginner'),
  ex('spiderCurl', 'Spider Curl', 'Biceps', [['biceps', 90]], [['forearms', 10]], 'Dumbbells'),
  ex('bayesianCurl', 'Curl bayésien poulie', 'Biceps', [['biceps', 90]], [['forearms', 10]], 'Cable'),
  ex('dragCurl', 'Drag Curl', 'Biceps', [['biceps', 85]], [['forearms', 15]], 'Barbell'),
  ex('zottmanCurl', 'Zottman Curl', 'Biceps', [['biceps', 60], ['forearms', 40]], [], 'Dumbbells'),

  // ============ TRICEPS (12) ============
  ex('closeGripBench', 'Close Grip Bench Press', 'Triceps', [['triceps', 60], ['chest', 30]], [['shoulders', 10]], 'Barbell'),
  ex('tricepsDips', 'Bench Dip', 'Triceps', [['triceps', 70]], [['chest', 20], ['shoulders', 10]], 'Bodyweight', 'Beginner'),
  ex('skullCrusher', 'Skull Crusher', 'Triceps', [['triceps', 90]], [['forearms', 10]], 'Barbell'),
  ex('overheadExtension', 'Extension nuque haltère', 'Triceps', [['triceps', 90]], [['core', 10]], 'Dumbbells', 'Beginner'),
  ex('cablePushdown', 'Triceps Pushdown', 'Triceps', [['triceps', 95]], [['forearms', 5]], 'Cable', 'Beginner'),
  ex('ropePushdown', 'Rope Pushdown', 'Triceps', [['triceps', 95]], [['forearms', 5]], 'Cable', 'Beginner'),
  ex('kickback', 'Triceps Kickback', 'Triceps', [['triceps', 95]], [['shoulders', 5]], 'Dumbbells', 'Beginner'),
  ex('overheadCableExt', 'Extension poulie nuque', 'Triceps', [['triceps', 90]], [['core', 10]], 'Cable'),
  ex('diamondPushUp', 'Diamond Push Up', 'Triceps', [['triceps', 60], ['chest', 25]], [['shoulders', 15]], 'Bodyweight'),
  ex('jmPress', 'JM Press', 'Triceps', [['triceps', 75], ['chest', 15]], [['shoulders', 10]], 'Barbell', 'Advanced'),
  ex('machineDips', 'Dips machine', 'Triceps', [['triceps', 70], ['chest', 20]], [['shoulders', 10]], 'Machine', 'Beginner'),
  ex('tatePress', 'Tate Press', 'Triceps', [['triceps', 90]], [['chest', 10]], 'Dumbbells', 'Advanced'),

  // ============ FOREARMS (8) ============
  ex('wristCurl', 'Wrist Curl', 'Forearms', [['forearms', 100]], [], 'Barbell', 'Beginner'),
  ex('reverseWristCurl', 'Reverse Wrist Curl', 'Forearms', [['forearms', 100]], [], 'Barbell', 'Beginner'),
  ex('reverseCurl', 'Reverse Curl', 'Forearms', [['forearms', 60], ['biceps', 40]], [], 'Barbell', 'Beginner'),
  ex('farmersWalk', 'Farmer\'s Walk', 'Forearms', [['forearms', 50]], [['core', 25], ['back', 25]], 'Dumbbells'),
  ex('platePinch', 'Plate Pinch', 'Forearms', [['forearms', 100]], [], 'Plate', 'Beginner'),
  ex('deadHang', 'Dead Hang', 'Forearms', [['forearms', 70]], [['back', 20], ['core', 10]], 'Bodyweight', 'Beginner'),
  ex('wristRoller', 'Wrist Roller', 'Forearms', [['forearms', 90]], [['shoulders', 10]], 'Other'),
  ex('gripper', 'Hand gripper', 'Forearms', [['forearms', 100]], [], 'Other', 'Beginner'),

  // ============ QUADS (14) ============
  ex('squat', 'Squat', 'Quads', [['quads', 50], ['glutes', 30]], [['hamstrings', 10], ['core', 10]], 'Barbell'),
  ex('frontSquat', 'Front Squat', 'Quads', [['quads', 60], ['glutes', 20]], [['core', 20]], 'Barbell', 'Advanced'),
  ex('gobletSquat', 'Goblet Squat', 'Quads', [['quads', 55], ['glutes', 30]], [['core', 15]], 'Dumbbells', 'Beginner'),
  ex('legPress', 'Leg Press', 'Quads', [['quads', 60], ['glutes', 30]], [['hamstrings', 10]], 'Machine', 'Beginner'),
  ex('hackSquat', 'Hack Squat', 'Quads', [['quads', 70], ['glutes', 20]], [['hamstrings', 10]], 'Machine'),
  ex('legExtension', 'Leg Extension', 'Quads', [['quads', 100]], [], 'Machine', 'Beginner'),
  ex('bulgarianSplitSquat', 'Bulgarian Split Squat', 'Quads', [['quads', 45], ['glutes', 40]], [['hamstrings', 15]], 'Dumbbells'),
  ex('walkingLunge', 'Walking Lunge', 'Quads', [['quads', 45], ['glutes', 40]], [['hamstrings', 15]], 'Dumbbells', 'Beginner'),
  ex('stepUp', 'Step Up', 'Quads', [['quads', 50], ['glutes', 40]], [['hamstrings', 10]], 'Dumbbells', 'Beginner'),
  ex('sissySquat', 'Sissy Squat', 'Quads', [['quads', 95]], [['core', 5]], 'Bodyweight', 'Advanced'),
  ex('pistolSquat', 'Pistol Squat', 'Quads', [['quads', 55], ['glutes', 30]], [['core', 15]], 'Bodyweight', 'Advanced'),
  ex('smithSquat', 'Smith Machine Squat', 'Quads', [['quads', 55], ['glutes', 30]], [['hamstrings', 15]], 'Machine', 'Beginner'),
  ex('pauseSquat', 'Pause Squat', 'Quads', [['quads', 55], ['glutes', 30]], [['core', 15]], 'Barbell', 'Advanced'),
  ex('wallSit', 'Wall Sit', 'Quads', [['quads', 80]], [['glutes', 15], ['core', 5]], 'Bodyweight', 'Beginner'),

  // ============ HAMSTRINGS (10) ============
  ex('romanianDeadlift', 'Romanian Deadlift', 'Hamstrings', [['hamstrings', 55], ['glutes', 30]], [['lowerback', 15]], 'Barbell'),
  ex('stiffLegDeadlift', 'Stiff Leg Deadlift', 'Hamstrings', [['hamstrings', 60], ['glutes', 25]], [['lowerback', 15]], 'Barbell'),
  ex('lyingLegCurl', 'Lying Leg Curl', 'Hamstrings', [['hamstrings', 95]], [['calves', 5]], 'Machine', 'Beginner'),
  ex('seatedLegCurl', 'Seated Leg Curl', 'Hamstrings', [['hamstrings', 95]], [['calves', 5]], 'Machine', 'Beginner'),
  ex('nordicCurl', 'Nordic Curl', 'Hamstrings', [['hamstrings', 90]], [['glutes', 5], ['core', 5]], 'Bodyweight', 'Advanced'),
  ex('goodMorning', 'Good Morning', 'Hamstrings', [['hamstrings', 50], ['lowerback', 25]], [['glutes', 25]], 'Barbell', 'Advanced'),
  ex('dbRDL', 'RDL haltères', 'Hamstrings', [['hamstrings', 55], ['glutes', 30]], [['lowerback', 15]], 'Dumbbells', 'Beginner'),
  ex('singleLegRDL', 'RDL unilatéral', 'Hamstrings', [['hamstrings', 50], ['glutes', 30]], [['core', 20]], 'Dumbbells'),
  ex('gluteHamRaise', 'Glute Ham Raise', 'Hamstrings', [['hamstrings', 70], ['glutes', 20]], [['lowerback', 10]], 'Machine', 'Advanced'),
  ex('swissBallCurl', 'Leg curl swiss ball', 'Hamstrings', [['hamstrings', 75], ['glutes', 15]], [['core', 10]], 'Other', 'Beginner'),

  // ============ GLUTES (10) ============
  ex('hipThrust', 'Hip Thrust', 'Glutes', [['glutes', 70]], [['hamstrings', 20], ['quads', 10]], 'Barbell'),
  ex('gluteBridge', 'Glute Bridge', 'Glutes', [['glutes', 75]], [['hamstrings', 20], ['core', 5]], 'Bodyweight', 'Beginner'),
  ex('cableKickback', 'Cable Kickback', 'Glutes', [['glutes', 90]], [['hamstrings', 10]], 'Cable', 'Beginner'),
  ex('sumoDeadlift', 'Sumo Deadlift', 'Glutes', [['glutes', 40], ['quads', 25], ['hamstrings', 20]], [['back', 10], ['forearms', 5]], 'Barbell', 'Advanced'),
  ex('abduction', 'Hip Abduction', 'Glutes', [['glutes', 100]], [], 'Machine', 'Beginner'),
  ex('frogPump', 'Frog Pump', 'Glutes', [['glutes', 90]], [['hamstrings', 10]], 'Bodyweight', 'Beginner'),
  ex('curtsyLunge', 'Curtsy Lunge', 'Glutes', [['glutes', 55], ['quads', 35]], [['hamstrings', 10]], 'Dumbbells'),
  ex('reverseHyper', 'Reverse hyperextension', 'Glutes', [['glutes', 60], ['hamstrings', 20]], [['lowerback', 20]], 'Machine'),
  ex('bandWalk', 'Band Walk', 'Glutes', [['glutes', 85]], [['quads', 15]], 'Band', 'Beginner'),
  ex('smithHipThrust', 'Hip thrust Smith', 'Glutes', [['glutes', 70]], [['hamstrings', 20], ['quads', 10]], 'Machine', 'Beginner'),

  // ============ CALVES (7) ============
  ex('standingCalfRaise', 'Standing Calf Raise', 'Calves', [['calves', 100]], [], 'Machine', 'Beginner'),
  ex('seatedCalfRaise', 'Seated Calf Raise', 'Calves', [['calves', 100]], [], 'Machine', 'Beginner'),
  ex('legPressCalfRaise', 'Mollets à la presse', 'Calves', [['calves', 100]], [], 'Machine', 'Beginner'),
  ex('donkeyCalfRaise', 'Donkey Calf Raise', 'Calves', [['calves', 100]], [], 'Machine'),
  ex('singleLegCalfRaise', 'Mollets unilatéral', 'Calves', [['calves', 95]], [['core', 5]], 'Bodyweight', 'Beginner'),
  ex('dbCalfRaise', 'Mollets haltères', 'Calves', [['calves', 95]], [['forearms', 5]], 'Dumbbells', 'Beginner'),
  ex('tibialisRaise', 'Tibialis raise', 'Calves', [['calves', 100]], [], 'Bodyweight', 'Beginner'),

  // ============ CORE (14) ============
  ex('plank', 'Plank', 'Core', [['core', 90]], [['shoulders', 10]], 'Bodyweight', 'Beginner'),
  ex('sidePlank', 'Side Plank', 'Core', [['core', 90]], [['shoulders', 10]], 'Bodyweight', 'Beginner'),
  ex('crunch', 'Crunch', 'Core', [['core', 100]], [], 'Bodyweight', 'Beginner'),
  ex('cableCrunch', 'Cable Crunch', 'Core', [['core', 100]], [], 'Cable', 'Beginner'),
  ex('hangingLegRaise', 'Hanging Leg Raise', 'Core', [['core', 85]], [['forearms', 15]], 'Bodyweight', 'Advanced'),
  ex('lyingLegRaise', 'Lying Leg Raise', 'Core', [['core', 95]], [['quads', 5]], 'Bodyweight', 'Beginner'),
  ex('russianTwist', 'Russian Twist', 'Core', [['core', 100]], [], 'Plate', 'Beginner'),
  ex('abWheel', 'Ab Wheel Rollout', 'Core', [['core', 75]], [['shoulders', 15], ['back', 10]], 'Other', 'Advanced'),
  ex('deadBug', 'Dead Bug', 'Core', [['core', 100]], [], 'Bodyweight', 'Beginner'),
  ex('birdDog', 'Bird Dog', 'Core', [['core', 70], ['lowerback', 20]], [['glutes', 10]], 'Bodyweight', 'Beginner'),
  ex('palofPress', 'Pallof Press', 'Core', [['core', 95]], [['shoulders', 5]], 'Cable', 'Beginner'),
  ex('mountainClimber', 'Mountain Climber', 'Core', [['core', 70]], [['shoulders', 15], ['quads', 15]], 'Bodyweight', 'Beginner'),
  ex('vUp', 'V Up', 'Core', [['core', 95]], [['quads', 5]], 'Bodyweight'),
  ex('dragonFlag', 'Dragon Flag', 'Core', [['core', 85]], [['back', 10], ['shoulders', 5]], 'Bodyweight', 'Advanced'),

  // ============ LOWER BACK (7) ============
  ex('backExtension', 'Back Extension', 'LowerBack', [['lowerback', 60], ['glutes', 25]], [['hamstrings', 15]], 'Bodyweight', 'Beginner'),
  ex('superman', 'Superman', 'LowerBack', [['lowerback', 70], ['glutes', 20]], [['back', 10]], 'Bodyweight', 'Beginner'),
  ex('jeffersonCurl', 'Jefferson Curl', 'LowerBack', [['lowerback', 60], ['hamstrings', 30]], [['back', 10]], 'Dumbbells', 'Advanced'),
  ex('weightedBackExtension', 'Weighted Back Extension', 'LowerBack', [['lowerback', 55], ['glutes', 30]], [['hamstrings', 15]], 'Plate'),
  ex('machineBackExtension', 'Extension lombaire machine', 'LowerBack', [['lowerback', 80]], [['glutes', 20]], 'Machine', 'Beginner'),
  ex('catCow', 'Chat-vache (mobilité)', 'LowerBack', [['lowerback', 80]], [['core', 20]], 'Bodyweight', 'Beginner'),
  ex('kettlebellSwing', 'Kettlebell swing', 'LowerBack', [['glutes', 45], ['hamstrings', 25], ['lowerback', 20]], [['core', 10]], 'Kettlebell'),

  // ============ FULL BODY / CARDIO (16) ============
  ex('burpee', 'Burpee', 'FullBody', [['quads', 30], ['chest', 25], ['core', 25]], [['shoulders', 10], ['triceps', 10]], 'Bodyweight'),
  ex('thruster', 'Thrusters', 'FullBody', [['quads', 35], ['shoulders', 30], ['glutes', 20]], [['triceps', 10], ['core', 5]], 'Barbell', 'Advanced'),
  ex('cleanAndPress', 'Clean & press', 'FullBody', [['shoulders', 30], ['quads', 25], ['back', 20]], [['glutes', 15], ['core', 10]], 'Barbell', 'Advanced'),
  ex('kbClean', 'Kettlebell Clean', 'FullBody', [['back', 30], ['glutes', 25], ['quads', 20]], [['forearms', 15], ['core', 10]], 'Kettlebell'),
  ex('kbSnatch', 'Kettlebell Snatch', 'FullBody', [['shoulders', 30], ['glutes', 25], ['back', 20]], [['core', 15], ['forearms', 10]], 'Kettlebell', 'Advanced'),
  ex('turkishGetUp', 'Turkish Get Up', 'FullBody', [['core', 40], ['shoulders', 30]], [['glutes', 15], ['quads', 15]], 'Kettlebell', 'Advanced'),
  ex('bearCrawl', 'Bear Crawl', 'FullBody', [['core', 40], ['shoulders', 30]], [['quads', 20], ['triceps', 10]], 'Bodyweight', 'Beginner'),
  ex('battleRopes', 'Battle ropes', 'FullBody', [['shoulders', 40], ['core', 30]], [['back', 15], ['forearms', 15]], 'Other'),
  ex('sledPush', 'Poussée de traîneau', 'FullBody', [['quads', 40], ['glutes', 25]], [['calves', 20], ['core', 15]], 'Other'),
  ex('boxJump', 'Box Jump', 'FullBody', [['quads', 40], ['glutes', 30], ['calves', 20]], [['core', 10]], 'Bodyweight'),
  ex('jumpSquat', 'Jump Squat', 'FullBody', [['quads', 45], ['glutes', 30], ['calves', 15]], [['core', 10]], 'Bodyweight', 'Beginner'),
  ex('rowingErg', 'Rameur (ergomètre)', 'FullBody', [['back', 35], ['quads', 25], ['hamstrings', 15]], [['biceps', 15], ['core', 10]], 'Machine', 'Beginner'),
  ex('assaultBike', 'Assault bike', 'FullBody', [['quads', 40], ['shoulders', 20]], [['hamstrings', 20], ['calves', 10], ['core', 10]], 'Machine', 'Beginner'),
  ex('jumpRope', 'Corde à sauter', 'FullBody', [['calves', 50]], [['shoulders', 20], ['forearms', 15], ['core', 15]], 'Other', 'Beginner'),
  ex('manMaker', 'Man maker', 'FullBody', [['chest', 25], ['back', 25], ['quads', 20]], [['shoulders', 15], ['core', 15]], 'Dumbbells', 'Advanced'),
  ex('devilPress', 'Devil press', 'FullBody', [['shoulders', 30], ['quads', 25], ['chest', 20]], [['glutes', 15], ['core', 10]], 'Dumbbells', 'Advanced'),
];

// ============================================================
// EXERCICES REPRIS DE MA BIBLIOTHÈQUE PERSONNELLE
// ============================================================
// Ces mouvements étaient stockés côté utilisateur (exercices « custom »). Ils
// rejoignent la base intégrée en GARDANT LEUR IDENTIFIANT : l'historique, les
// routines et les rangs déjà enregistrés continuent de pointer dessus.
// `refExercise` / `refCoef` : ceux qui n'ont pas de standard de force propre
// restent classés via un mouvement de référence pondéré (cf. customRefMap).
const IMPORTED = [
  ex('lo_adduction', 'Adduction des hanches', 'Glutes', [['glutes', 100]], [], 'Machine'),
  ex('lo_beltSquat', 'Squat avec ceinture', 'Quads', [['quads', 70], ['glutes', 20]], [['hamstrings', 10]], 'Machine'),
  ex('lo_smithBenchPress', 'Développé couché à la Smith machine', 'Chest', [['chest', 70], ['shoulders', 15]], [['triceps', 15]], 'Machine'),
  ex('lo_smithDeclinePress', 'Développé décliné à la Smith machine', 'Chest', [['chest', 75]], [['triceps', 15], ['shoulders', 10]], 'Machine'),
  ex('lo_smithInclinePress', 'Développé incliné à la Smith machine', 'Chest', [['chest', 60], ['shoulders', 25]], [['triceps', 15]], 'Machine'),
  ex('lo_smithRDL', 'RDLs à la Smith machine', 'Hamstrings', [['hamstrings', 55], ['glutes', 30]], [['lowerback', 15]], 'Machine'),
  ex('lo_smithRow', 'Tirage buste penché à la Smith machine', 'Back', [['back', 65]], [['biceps', 15], ['lowerback', 10], ['forearms', 10]], 'Machine'),
  ex('lo_smithShoulderPress', 'Développé épaules à la Smith machine', 'Shoulders', [['shoulders', 70]], [['triceps', 20], ['core', 10]], 'Machine'),
  ex('lo_yRaiseIncline', 'Élévation en Y sur banc incliné avec haltères', 'Shoulders', [['shoulders', 100]], [], 'Dumbbells'),
  ex('custom_hipAdduction', 'Hip Adduction', 'Glutes', [['glutes', 100]], [], 'Machine'),
  ex('custom_e8c04362', 'Machine Chest Press Lying', 'Chest', [['chest', 80]], [['shoulders', 10], ['triceps', 10]], 'Machine'),
  ex('custom_1ad5f699', 'Machine Chest Press Incline', 'Chest', [['chest', 70], ['shoulders', 20]], [['triceps', 10]], 'Machine'),
  ex('custom_c6a2d0dd', 'Triceps Pushdown Unilateral', 'Triceps', [['triceps', 100]], [], 'Cable'),
  ex('custom_790bf953', 'Curl Machine', 'Biceps', [['biceps', 100]], [], 'Machine'),
  ex('custom_e1389208', 'Tirage vertical prise neutre', 'Back', [['back', 80], ['biceps', 20]], [], 'Cable'),
  ex('custom_d549dec2', 'Élévations latérales haltères (unilatéral)', 'Shoulders', [['shoulders', 80]], [['back', 20]], 'Dumbbells'),
  ex('custom_22a584ca', 'Tirage Horizontal Machine', 'Back', [['back', 90]], [['biceps', 10]], 'Machine'),
];
// Références de classement conservées telles quelles.
const IMPORTED_REFS = {
  custom_hipAdduction: ['abduction', 1],
  custom_c6a2d0dd: ['cablePushdown', 0.35],
  custom_790bf953: ['preacherCurl', 1],
  custom_e1389208: ['latPulldown', 0.9],
  custom_d549dec2: ['lo_yRaiseIncline', 1.25],
  custom_22a584ca: ['seatedCableRow', 2],
};
for (const e of IMPORTED) {
  const r = IMPORTED_REFS[e.id];
  if (r) { e.refExercise = r[0]; e.refCoef = r[1]; }
  EXERCISES.push(e);
}

// ============================================================
// ANATOMIE DÉTAILLÉE (v6.1)
// ============================================================
// Les grands groupes « épaules », « dos » et « abdos » sont éclatés : trois
// faisceaux du deltoïde, trapèzes / rhomboïdes / grands dorsaux, abdominaux /
// obliques, plus les adducteurs. Chaque exercice concerné est réécrit ici,
// muscle par muscle (format « principaux | secondaires », total = 100 %).
// Les exercices absents de la table gardent leur répartition d'origine.
const MUSCLE_MAP = {
  // Pectoraux
  benchPress: 'chest 65, frontDelts 15 | triceps 20',
  inclineBench: 'chest 55, frontDelts 25 | triceps 20',
  declineBench: 'chest 72 | triceps 20, frontDelts 8',
  dbBenchPress: 'chest 65, frontDelts 15 | triceps 20',
  dbInclinePress: 'chest 55, frontDelts 25 | triceps 20',
  dbFly: 'chest 85 | frontDelts 15',
  cableFly: 'chest 85 | frontDelts 15',
  pecDeck: 'chest 90 | frontDelts 10',
  pushUp: 'chest 55, frontDelts 15 | triceps 20, abs 10',
  dips: 'chest 50, triceps 30 | frontDelts 20',
  machinePress: 'chest 65, frontDelts 15 | triceps 20',
  pullover: 'chest 45, lats 35 | triceps 20',
  svendPress: 'chest 80 | frontDelts 10, triceps 10',
  landminePress: 'chest 45, frontDelts 35 | triceps 15, abs 5',
  lo_smithBenchPress: 'chest 65, frontDelts 15 | triceps 20',
  lo_smithDeclinePress: 'chest 72 | triceps 20, frontDelts 8',
  lo_smithInclinePress: 'chest 55, frontDelts 25 | triceps 20',
  custom_e8c04362: 'chest 75 | frontDelts 12, triceps 13',
  custom_1ad5f699: 'chest 62, frontDelts 23 | triceps 15',
  // Dos
  pullUp: 'lats 55, biceps 15 | rhomboids 10, rearDelts 5, traps 5, forearms 10',
  chinUp: 'lats 50, biceps 25 | rhomboids 10, rearDelts 5, forearms 10',
  latPulldown: 'lats 55, biceps 15 | rhomboids 10, rearDelts 5, traps 5, forearms 10',
  custom_e1389208: 'lats 55, biceps 20 | rhomboids 10, rearDelts 5, forearms 10',
  barbellRow: 'lats 35, rhomboids 20, traps 10 | rearDelts 10, biceps 10, lowerback 10, forearms 5',
  pendlayRow: 'lats 35, rhomboids 20, traps 10 | rearDelts 10, biceps 10, lowerback 15',
  dbRow: 'lats 50, rhomboids 15 | biceps 15, rearDelts 10, forearms 10',
  seatedCableRow: 'lats 40, rhomboids 25 | traps 10, biceps 15, rearDelts 10',
  custom_22a584ca: 'lats 40, rhomboids 25 | traps 10, biceps 15, rearDelts 10',
  tBarRow: 'lats 35, rhomboids 25, traps 10 | biceps 10, rearDelts 10, lowerback 10',
  machineRow: 'lats 40, rhomboids 25 | biceps 15, rearDelts 10, traps 10',
  lo_smithRow: 'lats 35, rhomboids 20, traps 10 | rearDelts 10, biceps 10, lowerback 10, forearms 5',
  invertedRow: 'lats 35, rhomboids 25 | biceps 15, rearDelts 10, abs 15',
  deadlift: 'glutes 25, hamstrings 20, lowerback 15 | traps 10, lats 10, quads 10, forearms 10',
  rackPull: 'lowerback 20, traps 20, glutes 20 | lats 15, hamstrings 10, forearms 15',
  facePull: 'rearDelts 50, rhomboids 20 | traps 15, biceps 10, sideDelts 5',
  straightArmPulldown: 'lats 80 | triceps 15, rearDelts 5',
  shrugs: 'traps 90 | forearms 10',
  // Épaules
  overheadPress: 'frontDelts 45, sideDelts 20 | triceps 20, traps 5, abs 10',
  dbShoulderPress: 'frontDelts 45, sideDelts 25 | triceps 20, traps 10',
  lo_smithShoulderPress: 'frontDelts 45, sideDelts 25 | triceps 20, traps 10',
  arnoldPress: 'frontDelts 50, sideDelts 25 | triceps 25',
  machineShoulderPress: 'frontDelts 50, sideDelts 20 | triceps 25, traps 5',
  pushPress: 'frontDelts 40, sideDelts 15 | triceps 20, quads 15, abs 10',
  lateralRaise: 'sideDelts 80 | traps 15, frontDelts 5',
  cableLateralRaise: 'sideDelts 85 | traps 10, frontDelts 5',
  custom_d549dec2: 'sideDelts 80 | traps 15, frontDelts 5',
  lo_yRaiseIncline: 'sideDelts 45, traps 30 | rearDelts 15, frontDelts 10',
  frontRaise: 'frontDelts 80 | sideDelts 10, chest 10',
  plateFrontRaise: 'frontDelts 80 | sideDelts 5, abs 15',
  rearDeltFly: 'rearDelts 70 | rhomboids 20, traps 10',
  reversePecDeck: 'rearDelts 70 | rhomboids 20, traps 10',
  uprightRow: 'sideDelts 45, traps 35 | biceps 10, frontDelts 10',
  cubanRotation: 'rearDelts 70 | sideDelts 15, forearms 15',
  // Triceps
  closeGripBench: 'triceps 55, chest 30 | frontDelts 15',
  tricepsDips: 'triceps 70 | chest 20, frontDelts 10',
  overheadExtension: 'triceps 90 | abs 10',
  kickback: 'triceps 95 | rearDelts 5',
  overheadCableExt: 'triceps 90 | abs 10',
  diamondPushUp: 'triceps 60, chest 25 | frontDelts 15',
  jmPress: 'triceps 75, chest 15 | frontDelts 10',
  machineDips: 'triceps 70, chest 20 | frontDelts 10',
  // Avant-bras
  farmersWalk: 'forearms 50 | traps 25, abs 15, obliques 10',
  deadHang: 'forearms 70 | lats 20, abs 10',
  wristRoller: 'forearms 90 | frontDelts 10',
  // Jambes
  squat: 'quads 50, glutes 25 | adductors 10, hamstrings 5, lowerback 10',
  pauseSquat: 'quads 50, glutes 25 | adductors 10, hamstrings 5, lowerback 10',
  frontSquat: 'quads 60, glutes 15 | abs 10, adductors 5, lowerback 10',
  gobletSquat: 'quads 55, glutes 20 | adductors 10, abs 15',
  legPress: 'quads 60, glutes 20 | adductors 10, hamstrings 10',
  hackSquat: 'quads 70, glutes 15 | adductors 10, hamstrings 5',
  smithSquat: 'quads 55, glutes 25 | adductors 10, hamstrings 10',
  lo_beltSquat: 'quads 65, glutes 20 | adductors 10, hamstrings 5',
  bulgarianSplitSquat: 'quads 45, glutes 35 | adductors 10, hamstrings 10',
  walkingLunge: 'quads 40, glutes 35 | adductors 10, hamstrings 10, calves 5',
  stepUp: 'quads 45, glutes 35 | hamstrings 10, calves 10',
  sissySquat: 'quads 90 | abs 10',
  pistolSquat: 'quads 50, glutes 30 | adductors 5, abs 10, calves 5',
  wallSit: 'quads 85 | glutes 15',
  nordicCurl: 'hamstrings 85 | glutes 10, calves 5',
  singleLegRDL: 'hamstrings 45, glutes 35 | lowerback 10, abs 5, obliques 5',
  swissBallCurl: 'hamstrings 75 | glutes 15, abs 10',
  gluteBridge: 'glutes 75 | hamstrings 20, abs 5',
  sumoDeadlift: 'glutes 30, quads 20, adductors 15 | hamstrings 15, lowerback 10, traps 5, forearms 5',
  lo_adduction: 'adductors 100',
  custom_hipAdduction: 'adductors 100',
  curtsyLunge: 'glutes 45, quads 30 | adductors 15, hamstrings 10',
  singleLegCalfRaise: 'calves 95 | abs 5',
  // Abdos et lombaires
  plank: 'abs 70 | obliques 20, frontDelts 10',
  sidePlank: 'obliques 70 | abs 20, glutes 10',
  crunch: 'abs 100',
  cableCrunch: 'abs 85 | obliques 15',
  hangingLegRaise: 'abs 70, obliques 15 | forearms 15',
  lyingLegRaise: 'abs 85 | obliques 10, quads 5',
  russianTwist: 'obliques 70 | abs 30',
  abWheel: 'abs 70 | lats 15, obliques 15',
  deadBug: 'abs 80 | obliques 20',
  birdDog: 'lowerback 50, abs 20 | glutes 30',
  palofPress: 'obliques 60, abs 30 | glutes 10',
  mountainClimber: 'abs 50 | quads 20, frontDelts 15, obliques 15',
  vUp: 'abs 85 | obliques 10, quads 5',
  dragonFlag: 'abs 80 | lats 10, obliques 10',
  superman: 'lowerback 70 | glutes 20, rearDelts 10',
  jeffersonCurl: 'lowerback 50, hamstrings 30 | glutes 20',
  catCow: 'lowerback 70 | abs 30',
  // Corps entier
  kettlebellSwing: 'glutes 40, hamstrings 25 | lowerback 15, frontDelts 10, abs 10',
  burpee: 'quads 30, chest 25 | frontDelts 15, abs 15, calves 15',
  thruster: 'quads 35, frontDelts 30 | glutes 15, triceps 10, abs 10',
  cleanAndPress: 'quads 20, frontDelts 25, traps 15 | glutes 15, triceps 15, hamstrings 10',
  kbClean: 'glutes 30, traps 20, hamstrings 20 | forearms 15, frontDelts 15',
  kbSnatch: 'glutes 30, frontDelts 20, hamstrings 20 | traps 15, lowerback 15',
  turkishGetUp: 'frontDelts 30, abs 30 | glutes 20, obliques 20',
  bearCrawl: 'frontDelts 30, abs 30 | quads 20, triceps 20',
  battleRopes: 'frontDelts 40, sideDelts 10 | abs 20, forearms 15, biceps 15',
  sledPush: 'quads 45, glutes 25 | calves 15, abs 15',
  boxJump: 'quads 45, glutes 25 | calves 20, hamstrings 10',
  jumpSquat: 'quads 45, glutes 30 | calves 15, abs 10',
  rowingErg: 'lats 30, quads 25, hamstrings 15 | biceps 10, rhomboids 10, abs 10',
  assaultBike: 'quads 40, frontDelts 15 | hamstrings 20, calves 10, abs 15',
  jumpRope: 'calves 50 | frontDelts 15, forearms 15, abs 20',
  manMaker: 'chest 25, lats 20, quads 20 | frontDelts 15, abs 20',
  devilPress: 'frontDelts 30, quads 25, chest 20 | glutes 15, abs 10',
};
const parseSide = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean)
  .map((x) => { const [m, p] = x.split(/\s+/); return { m, p: +p }; });
for (const e of EXERCISES) {
  const spec = MUSCLE_MAP[e.id];
  if (spec) {
    const [prim, sec] = spec.split('|');
    e.primaryMuscles = parseSide(prim);
    e.secondaryMuscles = parseSide(sec);
  }
}

export const CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];
export const EQUIPMENT_TYPES = [...new Set(EXERCISES.map((e) => e.equipment))].sort();

// ============================================================
// MATÉRIEL
// ============================================================
// Un exercice ne tient pas dans une seule case : un développé couché demande
// une barre ET un banc. `equipment` (au singulier) reste la grande famille du
// mouvement, utilisée par le filtre des réglages ; `equip` liste tout ce qu'il
// faut réellement avoir sous la main.
export const EQUIPMENT = [
  { id: 'barbell', label: 'Barre' },
  { id: 'ezbar', label: 'Barre EZ' },
  { id: 'dumbbells', label: 'Haltères' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'machine', label: 'Machine' },
  { id: 'smith', label: 'Smith machine' },
  { id: 'cable', label: 'Poulie' },
  { id: 'rope', label: 'Corde de poulie' },
  { id: 'pullupBar', label: 'Barre de traction' },
  { id: 'dipBar', label: 'Barres parallèles' },
  { id: 'bench', label: 'Banc' },
  { id: 'inclineBench', label: 'Banc incliné' },
  { id: 'preacherBench', label: 'Pupitre à curl' },
  { id: 'rack', label: 'Rack / support' },
  { id: 'landmine', label: 'Landmine' },
  { id: 'plate', label: 'Disque' },
  { id: 'band', label: 'Élastique' },
  { id: 'ball', label: 'Swiss ball' },
  { id: 'box', label: 'Box / step' },
  { id: 'mat', label: 'Tapis' },
  { id: 'abwheel', label: 'Roue abdominale' },
  { id: 'ghd', label: 'Banc à lombaires' },
  { id: 'sled', label: 'Traîneau' },
  { id: 'battleRope', label: 'Battle ropes' },
  { id: 'jumpRope', label: 'Corde à sauter' },
  { id: 'ergometer', label: 'Ergomètre' },
  { id: 'gripper', label: 'Pince de force' },
  { id: 'wristRoller', label: 'Enrouleur de poignet' },
  { id: 'belt', label: 'Ceinture de lest' },
  { id: 'bodyweight', label: 'Poids du corps' },
];
export const equipLabel = (id) => (EQUIPMENT.find((e) => e.id === id) || { label: id }).label;
// Matériel réellement nécessaire, exercice par exercice.
const EQUIP_BY_ID = {
  // Pectoraux
  benchPress: ['barbell', 'bench', 'rack'], inclineBench: ['barbell', 'inclineBench', 'rack'],
  declineBench: ['barbell', 'bench', 'rack'], dbBenchPress: ['dumbbells', 'bench'],
  dbInclinePress: ['dumbbells', 'inclineBench'], dbFly: ['dumbbells', 'bench'],
  cableFly: ['cable'], pecDeck: ['machine'], pushUp: ['bodyweight'],
  dips: ['dipBar', 'bodyweight'], machinePress: ['machine'], pullover: ['dumbbells', 'bench'],
  svendPress: ['plate'], landminePress: ['barbell', 'landmine'],
  // Dos
  pullUp: ['pullupBar', 'bodyweight'], chinUp: ['pullupBar', 'bodyweight'],
  latPulldown: ['cable', 'machine'], barbellRow: ['barbell'], pendlayRow: ['barbell'],
  dbRow: ['dumbbells', 'bench'], seatedCableRow: ['cable', 'machine'],
  tBarRow: ['barbell', 'landmine'], deadlift: ['barbell'], rackPull: ['barbell', 'rack'],
  facePull: ['cable', 'rope'], straightArmPulldown: ['cable'], shrugs: ['barbell', 'dumbbells'],
  machineRow: ['machine'], invertedRow: ['barbell', 'rack', 'bodyweight'],
  // Épaules
  overheadPress: ['barbell', 'rack'], dbShoulderPress: ['dumbbells', 'bench'],
  arnoldPress: ['dumbbells', 'bench'], lateralRaise: ['dumbbells'], cableLateralRaise: ['cable'],
  frontRaise: ['dumbbells'], rearDeltFly: ['dumbbells', 'bench'], reversePecDeck: ['machine'],
  uprightRow: ['barbell'], machineShoulderPress: ['machine'], pushPress: ['barbell', 'rack'],
  cubanRotation: ['dumbbells'], plateFrontRaise: ['plate'],
  // Biceps
  barbellCurl: ['barbell'], ezBarCurl: ['ezbar'], dbCurl: ['dumbbells'], hammerCurl: ['dumbbells'],
  inclineCurl: ['dumbbells', 'inclineBench'], preacherCurl: ['ezbar', 'preacherBench'],
  concentrationCurl: ['dumbbells', 'bench'], cableCurl: ['cable'],
  spiderCurl: ['dumbbells', 'inclineBench'], bayesianCurl: ['cable'], dragCurl: ['barbell'],
  zottmanCurl: ['dumbbells'],
  // Triceps
  closeGripBench: ['barbell', 'bench', 'rack'], tricepsDips: ['bench', 'bodyweight'],
  skullCrusher: ['ezbar', 'bench'], overheadExtension: ['dumbbells'], cablePushdown: ['cable'],
  ropePushdown: ['cable', 'rope'], kickback: ['dumbbells'], overheadCableExt: ['cable', 'rope'],
  diamondPushUp: ['bodyweight'], jmPress: ['barbell', 'bench'], machineDips: ['machine'],
  tatePress: ['dumbbells', 'bench'],
  // Avant-bras
  wristCurl: ['barbell', 'bench'], reverseWristCurl: ['barbell', 'bench'], reverseCurl: ['ezbar'],
  farmersWalk: ['dumbbells'], platePinch: ['plate'], deadHang: ['pullupBar', 'bodyweight'],
  wristRoller: ['wristRoller'], gripper: ['gripper'],
  // Quadriceps
  squat: ['barbell', 'rack'], frontSquat: ['barbell', 'rack'], gobletSquat: ['dumbbells'],
  legPress: ['machine'], hackSquat: ['machine'], legExtension: ['machine'],
  bulgarianSplitSquat: ['dumbbells', 'bench'], walkingLunge: ['dumbbells'],
  stepUp: ['dumbbells', 'box'], sissySquat: ['bodyweight'], pistolSquat: ['bodyweight'],
  smithSquat: ['smith'], pauseSquat: ['barbell', 'rack'], wallSit: ['bodyweight'],
  // Ischios
  romanianDeadlift: ['barbell'], stiffLegDeadlift: ['barbell'], lyingLegCurl: ['machine'],
  seatedLegCurl: ['machine'], nordicCurl: ['bodyweight'], goodMorning: ['barbell', 'rack'],
  dbRDL: ['dumbbells'], singleLegRDL: ['dumbbells'], gluteHamRaise: ['machine', 'ghd'],
  swissBallCurl: ['ball', 'bodyweight'],
  // Fessiers
  hipThrust: ['barbell', 'bench'], gluteBridge: ['bodyweight'], cableKickback: ['cable'],
  sumoDeadlift: ['barbell'], abduction: ['machine'], frogPump: ['bodyweight'],
  curtsyLunge: ['dumbbells'], reverseHyper: ['machine'], bandWalk: ['band'],
  smithHipThrust: ['smith', 'bench'],
  // Mollets
  standingCalfRaise: ['machine'], seatedCalfRaise: ['machine'], legPressCalfRaise: ['machine'],
  donkeyCalfRaise: ['machine'], singleLegCalfRaise: ['bodyweight', 'box'],
  dbCalfRaise: ['dumbbells'], tibialisRaise: ['bodyweight'],
  // Abdos
  plank: ['bodyweight', 'mat'], sidePlank: ['bodyweight', 'mat'], crunch: ['bodyweight', 'mat'],
  cableCrunch: ['cable', 'rope'], hangingLegRaise: ['pullupBar', 'bodyweight'],
  lyingLegRaise: ['bodyweight', 'mat'], russianTwist: ['plate', 'mat'], abWheel: ['abwheel', 'mat'],
  deadBug: ['bodyweight', 'mat'], birdDog: ['bodyweight', 'mat'], palofPress: ['cable'],
  mountainClimber: ['bodyweight', 'mat'], vUp: ['bodyweight', 'mat'], dragonFlag: ['bench', 'bodyweight'],
  // Lombaires
  backExtension: ['ghd', 'bodyweight'], superman: ['bodyweight', 'mat'],
  jeffersonCurl: ['dumbbells', 'box'], weightedBackExtension: ['ghd', 'plate'],
  machineBackExtension: ['machine'], catCow: ['bodyweight', 'mat'],
  // Full body
  kettlebellSwing: ['kettlebell'], burpee: ['bodyweight'], thruster: ['barbell', 'rack'],
  cleanAndPress: ['barbell'], kbClean: ['kettlebell'], kbSnatch: ['kettlebell'],
  turkishGetUp: ['kettlebell'], bearCrawl: ['bodyweight'], battleRopes: ['battleRope'],
  sledPush: ['sled'], boxJump: ['box', 'bodyweight'], jumpSquat: ['bodyweight'],
  rowingErg: ['ergometer'], assaultBike: ['ergometer'], jumpRope: ['jumpRope'],
  manMaker: ['dumbbells'], devilPress: ['dumbbells'],
  // Bibliothèque personnelle
  lo_adduction: ['machine'], lo_beltSquat: ['machine', 'belt'],
  lo_smithBenchPress: ['smith', 'bench'], lo_smithDeclinePress: ['smith', 'bench'],
  lo_smithInclinePress: ['smith', 'inclineBench'], lo_smithRDL: ['smith'],
  lo_smithRow: ['smith'], lo_smithShoulderPress: ['smith', 'bench'],
  lo_yRaiseIncline: ['dumbbells', 'inclineBench'],
  custom_hipAdduction: ['machine'], custom_e8c04362: ['machine'], custom_1ad5f699: ['machine'],
  custom_c6a2d0dd: ['cable'], custom_790bf953: ['machine'], custom_e1389208: ['cable'],
  custom_d549dec2: ['dumbbells'], custom_22a584ca: ['machine'],
};
// Repli sur la grande famille si un exercice n'est pas dans la table.
const EQUIP_FALLBACK = {
  Barbell: ['barbell'], Dumbbells: ['dumbbells'], Cable: ['cable'], Machine: ['machine'],
  Bodyweight: ['bodyweight'], Plate: ['plate'], Band: ['band'], Kettlebell: ['kettlebell'],
  Other: [],
};
for (const e of EXERCISES) {
  e.equip = EQUIP_BY_ID[e.id] || EQUIP_FALLBACK[e.equipment] || [];
}

// Noms alternatifs (anglais / autres appellations courantes, façon StrengthLevel.com)
// Utilisés uniquement pour la recherche — n'affecte pas le nom affiché.
export const AKA = {
  benchPress: ['Développé couché', 'Barbell Bench Press', 'Flat Bench Press'],
  inclineBench: ['Développé incliné', 'Incline Barbell Bench Press', 'Incline Bench Press'],
  declineBench: ['Développé décliné', 'Decline Barbell Bench Press', 'Decline Bench Press'],
  dbBenchPress: ['Développé couché haltères', 'Dumbbell Bench Press', 'Dumbbell Chest Press'],
  dbInclinePress: ['Développé incliné haltères', 'Incline Dumbbell Press', 'Incline Dumbbell Bench Press'],
  dbFly: ['Écartés haltères', 'Dumbbell Fly', 'Dumbbell Chest Fly'],
  cableFly: ['Écartés poulie', 'Cable Fly', 'Cable Crossover'],
  pecDeck: ['Pec deck', 'Pec Deck Fly', 'Machine Fly', 'Butterfly Machine'],
  pushUp: ['Pompes', 'Push-Up', 'Press-Up'],
  dips: ['Dips (buste penché)', 'Dips', 'Parallel Bar Dips', 'Chest Dips'],
  machinePress: ['Développé machine convergente', 'Machine Chest Press', 'Chest Press Machine'],
  pullover: ['Dumbbell Pullover', 'Straight Arm Pullover'],
  svendPress: ['Svend press', 'Svend Press', 'Plate Press'],
  landminePress: ['Landmine press', 'Landmine Press', 'Landmine Shoulder Press'],

  pullUp: ['Tractions pronation', 'Pull-Up', 'Pullup'],
  chinUp: ['Tractions supination', 'Chin-Up', 'Chinup'],
  latPulldown: ['Tirage vertical', 'Lat Pulldown', 'Wide Grip Pulldown'],
  barbellRow: ['Rowing barre', 'Barbell Row', 'Bent Over Row'],
  pendlayRow: ['Pendlay row', 'Pendlay Row'],
  dbRow: ['Dumbbell Row', 'One Arm Dumbbell Row', 'Single Arm Row'],
  seatedCableRow: ['Tirage horizontal poulie', 'Seated Cable Row', 'Seated Row'],
  tBarRow: ['T-bar row', 'T-Bar Row'],
  deadlift: ['Soulevé de terre', 'Deadlift', 'Conventional Deadlift'],
  rackPull: ['Rack pull', 'Rack Pull'],
  facePull: ['Face pull', 'Face Pull'],
  straightArmPulldown: ['Pull-over poulie haute', 'Straight Arm Pulldown', 'Straight Arm Lat Pulldown'],
  shrugs: ['Shrugs (trapèzes)', 'Barbell Shrug', 'Shrugs'],
  machineRow: ['Rowing machine', 'Machine Row', 'Chest Supported Row'],
  invertedRow: ['Rowing inversé', 'Inverted Row', 'Bodyweight Row'],

  overheadPress: ['Développé militaire', 'Overhead Press', 'Military Press', 'Standing Barbell Press'],
  dbShoulderPress: ['Développé épaules haltères', 'Dumbbell Shoulder Press', 'Dumbbell Overhead Press'],
  arnoldPress: ['Arnold press', 'Arnold Press'],
  lateralRaise: ['Élévations latérales', 'Lateral Raise', 'Side Raise', 'Dumbbell Lateral Raise'],
  cableLateralRaise: ['Élévations latérales poulie', 'Cable Lateral Raise'],
  frontRaise: ['Élévations frontales', 'Front Raise', 'Dumbbell Front Raise'],
  rearDeltFly: ['Oiseau (rear delt)', 'Rear Delt Fly', 'Bent Over Lateral Raise', 'Reverse Fly'],
  reversePecDeck: ['Reverse pec deck', 'Reverse Pec Deck', 'Reverse Fly Machine'],
  uprightRow: ['Rowing menton', 'Upright Row'],
  machineShoulderPress: ['Développé épaules machine', 'Machine Shoulder Press'],
  pushPress: ['Push press', 'Push Press'],
  cubanRotation: ['Cuban Rotation', 'Cuban Press'],
  plateFrontRaise: ['Plate Front Raise'],

  barbellCurl: ['Curl barre', 'Barbell Curl'],
  ezBarCurl: ['Curl barre EZ', 'EZ Bar Curl', 'EZ Barbell Curl'],
  dbCurl: ['Curl haltères', 'Dumbbell Curl', 'Dumbbell Bicep Curl'],
  hammerCurl: ['Curl marteau', 'Hammer Curl'],
  inclineCurl: ['Curl incliné', 'Incline Dumbbell Curl'],
  preacherCurl: ['Curl pupitre (Larry Scott)', 'Preacher Curl'],
  concentrationCurl: ['Curl concentration', 'Concentration Curl'],
  cableCurl: ['Curl poulie basse', 'Cable Curl', 'Cable Bicep Curl'],
  spiderCurl: ['Spider curl', 'Spider Curl'],
  bayesianCurl: ['Bayesian Curl', 'Cable Behind the Back Curl'],
  dragCurl: ['Drag curl', 'Drag Curl'],
  zottmanCurl: ['Curl Zottman', 'Zottman Curl'],

  closeGripBench: ['Développé couché prise serrée', 'Close Grip Bench Press'],
  tricepsDips: ['Dips triceps (banc)', 'Triceps Dips', 'Bench Dips'],
  skullCrusher: ['Barre au front', 'Skull Crusher', 'Lying Triceps Extension', 'French Press'],
  overheadExtension: ['Overhead Triceps Extension', 'Overhead Extension'],
  cablePushdown: ['Extension poulie haute (barre)', 'Cable Pushdown', 'Triceps Pushdown'],
  ropePushdown: ['Extension poulie corde', 'Rope Pushdown', 'Rope Triceps Extension'],
  kickback: ['Kickback haltère', 'Triceps Kickback', 'Dumbbell Kickback'],
  overheadCableExt: ['Overhead Cable Extension'],
  diamondPushUp: ['Pompes diamant', 'Diamond Push-Up', 'Close Grip Push-Up'],
  jmPress: ['JM press', 'JM Press'],
  machineDips: ['Machine Dips', 'Assisted Dip Machine'],
  tatePress: ['Tate press', 'Tate Press'],

  wristCurl: ['Curl poignets', 'Wrist Curl'],
  reverseWristCurl: ['Curl poignets inversé', 'Reverse Wrist Curl'],
  reverseCurl: ['Curl inversé', 'Reverse Curl', 'Reverse Grip Curl'],
  farmersWalk: ['Farmer walk', "Farmer's Walk", 'Farmers Carry'],
  platePinch: ['Pince disques', 'Plate Pinch'],
  deadHang: ['Suspension barre (dead hang)', 'Dead Hang'],
  wristRoller: ['Wrist roller', 'Wrist Roller'],
  gripper: ['Hand Gripper'],

  squat: ['Squat barre', 'Squat', 'Barbell Back Squat', 'Back Squat'],
  frontSquat: ['Front squat', 'Front Squat'],
  gobletSquat: ['Goblet squat', 'Goblet Squat'],
  legPress: ['Presse à cuisses', 'Leg Press'],
  hackSquat: ['Hack squat', 'Hack Squat'],
  legExtension: ['Leg extension', 'Leg Extension'],
  bulgarianSplitSquat: ['Fentes bulgares', 'Bulgarian Split Squat', 'Rear Foot Elevated Split Squat'],
  walkingLunge: ['Fentes marchées', 'Walking Lunge'],
  stepUp: ['Step-up', 'Step-Up'],
  sissySquat: ['Sissy squat', 'Sissy Squat'],
  pistolSquat: ['Pistol squat', 'Pistol Squat', 'One Leg Squat'],
  smithSquat: ['Squat Smith machine', 'Smith Machine Squat'],
  pauseSquat: ['Squat pause', 'Pause Squat'],
  wallSit: ['Chaise (wall sit)', 'Wall Sit'],
  romanianDeadlift: ['Soulevé de terre roumain', 'Romanian Deadlift', 'RDL'],
  stiffLegDeadlift: ['SDT jambes tendues', 'Stiff Leg Deadlift'],
  lyingLegCurl: ['Leg curl allongé', 'Lying Leg Curl'],
  seatedLegCurl: ['Leg curl assis', 'Seated Leg Curl'],
  nordicCurl: ['Nordic curl', 'Nordic Curl', 'Nordic Hamstring Curl'],
  goodMorning: ['Good morning', 'Good Morning'],
  dbRDL: ['Dumbbell Romanian Deadlift'],
  singleLegRDL: ['Single Leg RDL', 'Single Leg Romanian Deadlift'],
  gluteHamRaise: ['Glute ham raise', 'Glute Ham Raise', 'GHR'],
  swissBallCurl: ['Swiss Ball Leg Curl', 'Stability Ball Leg Curl'],
  hipThrust: ['Hip thrust', 'Hip Thrust', 'Barbell Hip Thrust'],
  gluteBridge: ['Pont fessier', 'Glute Bridge'],
  cableKickback: ['Kickback poulie', 'Cable Kickback', 'Glute Kickback'],
  sumoDeadlift: ['Soulevé de terre sumo', 'Sumo Deadlift'],
  abduction: ['Abduction machine', 'Hip Abduction'],
  frogPump: ['Frog pump', 'Frog Pump'],
  curtsyLunge: ['Fente curtsy', 'Curtsy Lunge'],
  reverseHyper: ['Reverse Hyperextension', 'Reverse Hyper'],
  bandWalk: ['Marche latérale élastique', 'Band Walk', 'Lateral Band Walk'],
  smithHipThrust: ['Smith Machine Hip Thrust'],
  standingCalfRaise: ['Mollets debout', 'Standing Calf Raise'],
  seatedCalfRaise: ['Mollets assis', 'Seated Calf Raise'],
  legPressCalfRaise: ['Calf Press', 'Leg Press Calf Raise'],
  donkeyCalfRaise: ['Donkey calf raise', 'Donkey Calf Raise'],
  singleLegCalfRaise: ['Single Leg Calf Raise'],
  dbCalfRaise: ['Dumbbell Calf Raise'],
  tibialisRaise: ['Tibialis Raise'],

  plank: ['Planche', 'Plank'],
  sidePlank: ['Planche latérale', 'Side Plank'],
  crunch: ['Crunch', 'Crunch'],
  cableCrunch: ['Crunch poulie', 'Cable Crunch'],
  hangingLegRaise: ['Relevés de jambes suspendu', 'Hanging Leg Raise'],
  lyingLegRaise: ['Relevés de jambes au sol', 'Lying Leg Raise'],
  russianTwist: ['Russian twist', 'Russian Twist'],
  abWheel: ['Roue abdominale', 'Ab Wheel Rollout', 'Ab Roller'],
  deadBug: ['Dead bug', 'Dead Bug'],
  birdDog: ['Bird dog', 'Bird Dog'],
  palofPress: ['Pallof press', 'Pallof Press'],
  mountainClimber: ['Mountain climbers', 'Mountain Climber'],
  vUp: ['V-up', 'V-Up'],
  dragonFlag: ['Dragon flag', 'Dragon Flag'],

  backExtension: ['Extension lombaire (banc)', 'Back Extension', 'Hyperextension'],
  superman: ['Superman', 'Superman'],
  jeffersonCurl: ['Jefferson curl', 'Jefferson Curl'],
  weightedBackExtension: ['Extension lombaire lestée', 'Weighted Back Extension'],
  machineBackExtension: ['Machine Back Extension'],
  catCow: ['Cat-Cow'],

  kettlebellSwing: ['Kettlebell Swing'],
  burpee: ['Burpees', 'Burpee'],
  thruster: ['Thruster'],
  cleanAndPress: ['Clean and Press'],
  kbClean: ['Kettlebell clean', 'Kettlebell Clean'],
  kbSnatch: ['Kettlebell snatch', 'Kettlebell Snatch'],
  turkishGetUp: ['Turkish get-up', 'Turkish Get-Up'],
  bearCrawl: ['Bear crawl', 'Bear Crawl'],
  battleRopes: ['Battle Ropes'],
  sledPush: ['Sled Push'],
  boxJump: ['Box jump', 'Box Jump'],
  jumpSquat: ['Squat sauté', 'Jump Squat'],
  rowingErg: ['Rowing Machine', 'Rowing Erg'],
  assaultBike: ['Assault Bike', 'Air Bike'],
  jumpRope: ['Jump Rope'],
  manMaker: ['Man Maker'],
  devilPress: ['Devil Press'],
};

// ============================================================
// NOMS FRANÇAIS
// ============================================================
// Les exercices sont affichés en français, MAIS les termes passés dans l'usage
// courant en salle restent tels quels : traduire « Hack Squat », « Face Pull »
// ou « Hip Thrust » nuirait à la reconnaissance plutôt que d'aider.
// Un exercice absent de cette table garde donc son nom d'origine, volontairement.
//
// L'ancien nom anglais est automatiquement versé dans AKA (voir plus bas) :
// chercher « bench press » trouve toujours « Développé couché ».
const NAME_FR = {
  // Pectoraux
  benchPress: 'Développé couché', inclineBench: 'Développé incliné',
  declineBench: 'Développé décliné', dbBenchPress: 'Développé couché haltères',
  dbInclinePress: 'Développé incliné haltères', dbFly: 'Écartés haltères',
  cableFly: 'Écartés poulie', pushUp: 'Pompes', machinePress: 'Développé machine',
  // Dos
  pullUp: 'Tractions pronation', chinUp: 'Tractions supination',
  latPulldown: 'Tirage vertical', barbellRow: 'Rowing barre',
  seatedCableRow: 'Tirage horizontal poulie', deadlift: 'Soulevé de terre',
  straightArmPulldown: 'Pull-over poulie haute', shrugs: 'Shrugs barre',
  machineRow: 'Rowing machine', invertedRow: 'Rowing inversé',
  // Épaules
  overheadPress: 'Développé militaire', dbShoulderPress: 'Développé épaules haltères',
  lateralRaise: 'Élévations latérales', cableLateralRaise: 'Élévations latérales poulie',
  frontRaise: 'Élévations frontales', rearDeltFly: 'Oiseau (deltoïde postérieur)',
  uprightRow: 'Rowing menton', machineShoulderPress: 'Développé épaules machine',
  // Biceps
  barbellCurl: 'Curl barre', ezBarCurl: 'Curl barre EZ', dbCurl: 'Curl haltères',
  hammerCurl: 'Curl marteau', inclineCurl: 'Curl incliné', preacherCurl: 'Curl pupitre',
  concentrationCurl: 'Curl concentration', cableCurl: 'Curl poulie',
  // Triceps
  closeGripBench: 'Développé couché prise serrée', tricepsDips: 'Dips sur banc',
  skullCrusher: 'Barre au front', cablePushdown: 'Extension triceps poulie',
  ropePushdown: 'Extension triceps corde', kickback: 'Kickback triceps',
  diamondPushUp: 'Pompes diamant',
  // Avant-bras
  wristCurl: 'Curl poignets', reverseWristCurl: 'Curl poignets inversé',
  reverseCurl: 'Curl inversé', farmersWalk: 'Marche du fermier',
  platePinch: 'Pince disque', deadHang: 'Suspension à la barre',
  wristRoller: 'Enrouleur de poignet', gripper: 'Pince de force',
  // Quadriceps
  legPress: 'Presse à cuisses', bulgarianSplitSquat: 'Squat bulgare',
  walkingLunge: 'Fentes marchées', stepUp: 'Montées sur banc',
  smithSquat: 'Squat à la Smith', pauseSquat: 'Squat avec pause',
  wallSit: 'Chaise murale',
  // Ischios
  romanianDeadlift: 'Soulevé de terre roumain', stiffLegDeadlift: 'Soulevé de terre jambes tendues',
  lyingLegCurl: 'Leg Curl allongé', seatedLegCurl: 'Leg Curl assis',
  // Fessiers
  gluteBridge: 'Pont fessier', cableKickback: 'Kickback poulie',
  sumoDeadlift: 'Soulevé de terre sumo', abduction: 'Abduction des hanches',
  curtsyLunge: 'Fente croisée', bandWalk: 'Marche élastique',
  // Mollets
  standingCalfRaise: 'Mollets debout', seatedCalfRaise: 'Mollets assis',
  donkeyCalfRaise: 'Mollets donkey', tibialisRaise: 'Extension des tibiaux',
  // Abdos / lombaires
  plank: 'Gainage (planche)', sidePlank: 'Gainage latéral', cableCrunch: 'Crunch poulie',
  hangingLegRaise: 'Relevés de jambes suspendu', lyingLegRaise: 'Relevés de jambes au sol',
  abWheel: 'Roulette abdominale', backExtension: 'Extension lombaire',
  weightedBackExtension: 'Extension lombaire lestée',
  // Full body
  burpee: 'Burpees', kbClean: 'Clean kettlebell', kbSnatch: 'Snatch kettlebell',
  bearCrawl: 'Marche de l\'ours', jumpSquat: 'Squat sauté',
};

// Applique les noms français et conserve l'ancien nom anglais comme synonyme de
// recherche. Fait ici (et non dans chaque appel à ex()) pour garder la table de
// traduction lisible d'un seul tenant.
for (const e of EXERCISES) {
  const fr = NAME_FR[e.id];
  if (!fr || fr === e.name) continue;
  const syn = AKA[e.id] || (AKA[e.id] = []);
  if (!syn.includes(e.name)) syn.push(e.name);
  e.name = fr;
}
