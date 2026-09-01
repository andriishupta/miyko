# TODO

## Application scaffold

- [ ] Create the initial app scaffold with mock data only; do not connect the API yet.
- [ ] Keep the first screen as Login.
- [ ] Add a temporary login action without real email or password validation.
- [ ] Navigate from Login to Home with route replacement after pressing the login action.
- [ ] Keep the app layout safe-area aware and platform-appropriate.
- [ ] Use native, simple UI components and avoid unnecessary custom styling duplication.

## Main navigation

- [ ] Add high-level Home and Manage your household routes.
- [ ] Use native bottom tab navigation on iOS.
- [ ] Keep the tab navigation clear and usable with the iOS safe area.
- [ ] Define the equivalent bottom-tab behavior for Android if Android support is enabled later.
- [ ] Use route replacement when switching between high-level application areas where appropriate.
- [ ] Use push/pop navigation for sub-routes that open from a high-level area.
- [ ] Add native-style screen titles and back navigation for pushed screens.

## Screens

- [ ] Create the Login screen.
- [ ] Create the Home screen.
- [ ] Create the Manage your household screen combining household and member management.
- [ ] Create the general Settings screen.
- [ ] Open Settings from a gear icon in the top-right area of the Home screen.
- [ ] Create the Invite Member sub-route from Manage your household.
- [ ] Add a clear back action from Invite Member to Manage your household.

## Home screen

- [ ] Add useful summary information at the top of Home.
- [ ] Add a prominent Record Audio action in the center of Home.
- [ ] Keep the audio action compatible with a future voice-input implementation while using mock behavior for now.
- [ ] Add a chat entry point or placeholder for the future audio/chat interface.
- [ ] Add a calendar-like planner with selectable days or date periods.
- [ ] Add mock upcoming food events such as breakfast, dinner and other meals.
- [ ] Show planned meal details and the related Silpo delivery when one exists.
- [ ] Show a standalone delivery event when it is not linked to a meal.
- [ ] Ensure the calendar and audio action do not conflict with bottom tabs or the safe-area inset.

## Deliveries

- [ ] Create a delivery details sub-route.
- [ ] Create an all deliveries sub-route.
- [ ] Show delivery status, title, date and linked meal when available.
- [ ] Show product names and basic product details in delivery views.
- [ ] Make delivery cards on Home open the corresponding delivery details route.
- [ ] Use mock delivery and product data until the API is connected.

## Household and members

- [ ] Show the current household summary in Manage your household.
- [ ] Show mock household members with names, roles and statuses.
- [ ] Add an Invite Member action.
- [ ] Create the Invite Member form as a pushed sub-route.
- [ ] Represent owner/member permissions in the mock UI without implementing backend authorization yet.

## Settings and UX

- [ ] Add theme-aware light and dark states.
- [ ] Use platform-native headers, back buttons and controls where possible.
- [ ] Add loading, empty and pressed states to the scaffold components.
- [ ] Keep primary actions visually distinct from navigation actions.
- [ ] Ensure every pushed route can return with the native back gesture or button.
- [ ] Review the navigation hierarchy so frequent actions are reachable without excessive tab or screen switching.
