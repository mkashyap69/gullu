# 07 · Notifications and widgets

Designs: `design/screens/V-9-1` to `V-9-6` (lock screen, expanded notification, settings, home-screen widgets, and the two system sheets).

## Notifications: 8 kinds, at most 2 a week

All are **local notifications** scheduled on the phone with `expo-notifications`. There's no push, no server and no permission prompt until the end of onboarding (ask with a pre-prompt screen that says what they're for).

Voice: Gullu, one line, plain. No exclamation marks except "goal reached". Never about markets moving, never urgent, never selling anything.

| Kind | Title / body | When | How often |
| --- | --- | --- | --- |
| Payday | **Payday: ₹55,000 to place** / 4 goals and your PPF. Tap to see the split. | Payday date, 9 am. Variable income: when the user logs money in. | Monthly |
| Check-in | **Did April's money go in?** / 4 of 7 moves ticked. Two taps to finish. | Day after payday, only if moves are left | Monthly, once |
| Value update | **Your values are 30 days old** / Confirm them in 20 seconds to keep goals accurate. | 30 days since the last update | Monthly |
| Safety net full | **Your safety net is full** / From May, money flows on to your goals. | Safety net reaches target | Once |
| Goal near | **Japan trip is 6 months away** / Its money now sits mostly in debt and cash. | A goal crosses a horizon band (5, 3, 1 years) | A few times per goal |
| Goal reached | **Japan is paid for!** / ₹3.31 L ready. Tap to decide what happens next. | A goal hits its amount (from a value update) | Once per goal |
| PPF year end | **₹37,500 left for PPF this year** / Add it by 31 March to use the full ₹1.5 L. | Mid-March, if the yearly limit isn't used | Yearly |
| Yearly check | **It's been a year** / 2 minutes to check your risk profile still fits. | 12 months since the last risk check | Yearly |

**Rules**
- A scheduler (`src/notifications/schedule.ts`) recomputes the next 8 weeks of notifications after every data change and enforces **max 2 per rolling 7 days** (priority: Payday > Check-in > Goal reached > Safety net > Value update > Goal near > PPF > Yearly check).
- Quiet hours (default 10 pm – 8 am) push notifications to 8 am.
- **Hide amounts on lock screen**: the Payday body becomes "Payday: money to place", and other amounts are removed.
- Each kind can be switched off in 9.3. Settings shows "At most 2 a week" live.
- **Actions** (notification categories) on Payday: *Show me the moves* (opens Check-in), *Remind me tomorrow*, *Already done* (opens the Receipt flow). Do not use "Show me what to buy" as shown in the 9.2 design; it breaks the no-buy/sell rule.
- Every notification deep-links to the screen it talks about (Expo Router URLs, e.g. `moneyplan://payday`).
- Since "Goal reached" and "Safety net full" depend on user values, they fire right after a value update, so the in-app moment (2.3 / 3.5) should usually show instead. Schedule the notification only if the app goes to background before the user saw the moment.

## Widgets

Widgets read the app's own data on the phone and refresh after each payday, check-in or value update. Each opens the screen it shows. With Hide amounts on, rupee figures show as `₹ ••••••`.

| Size | Content |
| --- | --- |
| Small · Status | "Goals · 3 of 4 · on track" + mini rings |
| Small · Payday | "Payday · ₹55,000 · to place · tap to start" (on payday) |
| Small · One goal | "Education · ₹6 L short" (the user picks the goal) |
| Medium · Goals | "Money Plan · goals 3 of 4 on track" + 4 goal rows with status |
| Medium · This month's moves | "April moves · 4 of 7 done · Next: S&P 500 fund · ₹4,500 · Done" |
| Large · Summary | Headline + 4 goal rows + "₹55,000 landed · Place it" |
| Lock screen (iOS) | Circular "3/4 goals"; rectangular "Payday today · ₹55,000 to place"; inline "Payday · ₹55,000 to place" |

**Implementation**
- **iOS:** `expo-widgets` (stable from Expo SDK 56). Widgets are written with Expo UI SwiftUI components and run in an isolated runtime, so the app writes a small JSON snapshot to the shared App Group container and the widget renders from it.
- **Android:** use `expo-widgets` with its `enableAndroid` option if your SDK version supports it. Otherwise use `react-native-android-widget` (it has an Expo config plugin).
- Write the snapshot from one function, `publishWidgetSnapshot()`, called after payday, check-in, value update, goal edits and settings changes (hide amounts, Gullu look).
- Widgets use the same gradients (`dusk` for status and summary, `ember` on payday) and a small static Gullu in the user's chosen look.
- Widgets are static (system-rendered). No animation is expected beyond what the OS does.
