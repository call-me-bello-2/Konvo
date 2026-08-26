/**
 * Ingles — fonte da verdade das chaves.
 *
 * O tipo de `pt-BR` deriva daqui, entao esquecer de traduzir uma chave vira
 * erro de compilacao, nao string faltando na tela do usuario.
 */
export const en = {
  // --- navegacao ---
  "nav.home": "Home",
  "nav.trips": "Trips",
  "nav.new": "New Konvo",
  "nav.activity": "Activity",
  "nav.you": "You",

  // --- home ---
  "home.prompt": "Where are we going?",
  "home.addDestination": "Add destination",
  "home.upcoming": "Upcoming",
  "home.recent": "Recent",
  "home.openKonvo": "Open Konvo",
  "home.inProgress": "In progress",

  // --- botao + (brief §08) ---
  "new.title": "Start a Konvo",
  "new.together": "Travel together",
  "new.togetherCopy": "Same journey. Different vehicles.",
  "new.meet": "Meet somewhere",
  "new.meetCopy": "Different places. Same destination.",
  "new.addStop": "Add stop",
  "new.addStopCopy": "Everyone gets the same meeting point",
  "new.invite": "Invite someone",
  "new.inviteCopy": "Share the link to this Konvo",
  "new.another": "New Konvo",

  // --- estado do grupo (brief §13) ---
  // Frases curtas de proposito: sao lidas de relance, dirigindo.
  "status.together": "Everyone together",
  "status.fallingBehind": "{name} is falling behind",
  "status.split": "Group split",
  "status.splitDetail": "{back} behind the group",
  "status.memberStopped": "{name} stopped",
  "status.membersStopped": "{count} people stopped",
  "status.regrouping": "Regrouping",
  "status.arrivingIn": "Everyone here in ~{time}",
  "status.allArrived": "Everyone arrived",
  "status.noSignal": "No signal from anyone",
  "status.rejoined": "{name} rejoined",
  "status.backTogether": "Everyone's together again",

  // --- estado individual ---
  "member.leader": "Leader",
  "member.onRoute": "On route",
  "member.behind": "{distance} behind",
  "member.behindTime": "{time} behind",
  "member.ahead": "{distance} ahead",
  "member.stopped": "Stopped {ago}",
  "member.offRoute": "Off route",
  "member.offline": "No signal {ago}",
  "member.arrived": "Arrived",
  "member.passengerWith": "Passenger · with {name}",
  "member.trackedBy": "Tracked by {name}'s phone",

  // --- contagens ---
  "count.people": "{count} people",
  "count.vehicles": "{count} vehicles",
  "count.remaining": "{distance} · {time} remaining",

  // --- transporte ---
  "transport.car": "Car",
  "transport.motorcycle": "Motorcycle",
  "transport.bus": "Bus",
  "transport.passenger": "Passenger",
  "transport.other": "Other",

  // --- trips (brief §19) ---
  "trips.title": "Trips",
  "trips.active": "Active",
  "trips.upcoming": "Upcoming",
  "trips.past": "Past",

  // --- activity (brief §21) ---
  "activity.title": "Activity",
  "activity.empty": "Nothing yet",
  "activity.emptyCopy": "What happens during a trip shows up here.",
  "activity.view": "View",
  "activity.addForEveryone": "Add for everyone",
  "activity.markAllRead": "Mark all read",

  "event.memberJoined": "{name} joined",
  "event.memberLeft": "{name} left",
  "event.tripStarted": "Konvo started",
  "event.tripCompleted": "Everyone arrived",
  "event.stopProposed": "{name} requested a stop",
  "event.stopAccepted": "New group stop",
  "event.groupSplit": "Group split",
  "event.groupRejoined": "{name} rejoined the group",
  "event.memberStopped": "{name} stopped",
  "event.memberArrived": "{name} arrived",
  "event.voiceNote": "{name} sent a message",

  // --- acoes rapidas (brief §15) ---
  "quick.gas": "Need gas",
  "quick.bathroom": "Bathroom",
  "quick.food": "Food",
  "quick.stop": "Stop",
  "quick.problem": "Problem",
  "quick.regroup": "Regroup",
  "quick.ok": "I'm OK",

  // --- you (brief §22) ---
  "you.theme": "Appearance",
  "you.themeAuto": "Auto",
  "you.themeLight": "Light",
  "you.themeDark": "Dark",
  "you.themeAutoCopy": "Dark after 6pm — easier on the eyes while driving at night",
  "you.title": "You",
  "you.navigateWith": "Navigate with",
  "you.distanceUnit": "Distance",
  "you.language": "Language",
  "you.locationSection": "Location",
  "you.locationOnlyActive": "Share only during active Konvos",
  "you.locationOnlyActiveCopy":
    "Outside a trip, Konvo never receives where you are.",
  "you.emergencyContact": "Emergency contact",
  "you.emergencyContactCopy": "Shown to the group if you report a problem",
  "you.notSet": "Not set",
  "you.signOut": "Sign out",
  "you.unitKm": "km",
  "you.unitMi": "miles",

  // --- vazios (brief §33) ---
  "empty.home.tagline": "Travel together.",
  "empty.home.copy":
    "Keep everyone together, even when you're traveling in different vehicles.",
  "empty.home.cta": "Start a Konvo",
  "empty.trips.title": "No Konvos yet",
  "empty.trips.copy": "Create your first shared journey.",

  // --- conexao / GPS (a realidade da estrada) ---
  "conn.offline": "You're offline",
  "conn.offlineDetail": "Saving your position — it'll sync when signal returns",
  "conn.queued": "{count} positions waiting to sync",
  "conn.locationDenied": "Location is off",
  "conn.locationDeniedDetail": "Konvo can't show you to the group without it",
  "conn.enable": "Turn on",
  "conn.screenOn": "Keeping the screen on",

  // --- fluxos reais (M2) ---
  "live.back": "Back",
  "live.navigate": "Navigate",
  "live.openWith": "Open with",
  "live.holdToTalk": "Hold to talk",
  "live.talkingTo": "Talking to {count} people",
  "live.isTalking": "{name} is talking…",
  "live.group": "Group",
  "live.quickActions": "Quick actions",
  "live.regroup": "Regroup",
  "live.arrived": "I arrived",
  "live.endTrip": "End Konvo",
  "live.screenOn": "Screen staying on",
  "live.needLocation": "Turn on location",
  "live.needLocationCopy": "Konvo can't show you to the group without it.",
  "live.waitingFix": "Getting your location…",
  "live.emergency": "Emergency",
  "live.emergencyCopy": "Tells everyone you need help, with your location.",
  "live.emergencySent": "{name} needs help",
  "live.confirm": "Confirm",
  "live.cancel": "Cancel",
  "live.offlineQueued": "{count} positions saved to send later",
  "new.title2": "Where are you going?",
  "new.searching": "Searching…",
  "new.noResults": "Nothing found",
  "new.yourName": "Your name",
  "new.howYouGo": "How are you going?",
  "new.withWho": "With whom?",
  "new.startNow": "Start now",
  "new.scheduleLater": "Schedule",
  "new.create": "Start Konvo",
  "new.creating": "Creating…",
  "new.useMyLocation": "Starting from my location",
  "new.routeFailed": "Couldn't get the road route — using a straight line for distances.",
  "join.invited": "{name} invited you to",
  "join.join": "Join Konvo",
  "join.joining": "Joining…",
  "join.notFound": "This invite is no longer valid",
  "join.alreadyIn": "You're already in this Konvo",
  "invite.title": "Invite",
  "invite.copy": "Copy link",
  "invite.copied": "Copied",
  "invite.share": "Share",
  "invite.code": "Or use the code",
  "setup.needsDb": "Database not set up yet",
  "setup.needsDbCopy": "Run the SQL in Supabase and enable Anonymous sign-ins, then reload.",
  "setup.retry": "Try again",

  // --- barra de acao / demo ---
  "live.attention": "Attention",
  "live.attentionCopy": "Buzzes everyone — use when they need to look now",
  "live.attentionSent": "{name} is asking for attention",
  "live.call": "Call",
  "live.callNobody": "No one added a phone number",
  "live.noPhone": "No number",
  "live.demoBanner": "Demonstration — simulated cars on the real route",
  "live.scenario": "Scenario",
  "live.play": "Play",
  "live.pause": "Pause",
  "new.phone": "Phone (optional)",
  "new.phoneCopy": "So the group can call you if the app fails",
  "live.stopRequested": "{name} asked to stop",

  // --- transportes e camera ---
  "transport.van": "Van",
  "transport.bicycle": "Bicycle",
  "transport.walking": "Walking",
  "transport.train": "Train",
  "transport.plane": "Plane",
  "transport.boat": "Boat",
  "member.ownWay": "Own way · {distance} to go",
  "live.camera": "View",
  "live.cameraTop": "Overhead",
  "live.cameraFollow": "Follow",
  "transport.ownWayNote": "You follow your own way — Konvo shows your distance and arrival time, and won't say the group split because of you.",
  "transport.more": "More options",
} as const;

export type TranslationKey = keyof typeof en;
