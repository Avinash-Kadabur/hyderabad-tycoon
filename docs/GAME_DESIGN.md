# Hyderabad Tycoon: game design

## The idea

A cute, cozy city-builder set in Hyderabad. You start with an empty stretch of Deccan land (the Musi
river, a couple of lakes, trees and those famous balancing boulders) and grow it into a city however
you like. It's a sandbox: no fail state, no timer.

## Pillars

1. **Cute and cozy.** Pastel colours, rounded shapes, bouncy animations and little details everywhere.
   Every tap should feel good: a pop, a sparkle, a happy sound.
2. **Fun first, realism second.** As few "you can't" moments as possible, and a friendly message when
   something isn't allowed.
3. **Recognisably Hyderabad.** Real places, food, festivals and everyday problems, told with affection.
4. **Phone-first.** Touch controls, big buttons, and smooth on a cheap Android phone. The same game runs
   on the web, Android and iPhone.

## Core loop

Lay roads → zone land as Homes, Shops or IT Offices → buildings grow and people move in → collect taxes
→ spend on services and landmarks → the city grows and unlocks more.

## Hyderabad flavour (built up over time)

- **Terrain:** Musi river, Hussain Sagar and other lakes, Deccan boulders (expensive to clear)
- **Areas:** Old City, Secunderabad, Banjara and Jubilee Hills, HITEC City and Gachibowli
- **Landmarks to unlock:** Charminar, Golconda Fort, the Buddha statue in Hussain Sagar, Falaknuma Palace
- **Economy:** IT offices, pharma, pearls and bangles, biryani houses, Irani chai cafés
- **Transport:** Metro, Outer Ring Road, flyovers, MMTS trains
- **Problems:** traffic, monsoon flooding, water supply
- **Events:** Bonalu, Bathukamma, Ganesh immersion, Haleem season

Real public landmarks are fine. Real companies, restaurants and brands get made-up names.

## Mechanics borrowed from other games

We borrow how things work, never names, art, music or maps.

- **SimCity:** zoning, demand, budget
- **Cities: Skylines:** road-first building, transit lines, traffic
- **RollerCoaster Tycoon / Transport Tycoon:** finances, loans, goals

## Money

Rupees with Indian digit grouping (₹10,00,000). A new city starts with ₹10 lakh.

| Action | Cost |
|---|---|
| Road | ₹2,000 per tile |
| Homes, Shops or IT Offices zone | ₹500 per tile |
| Bulldoze | ₹200 per tile |
| Clear Deccan boulders | ₹5,000 per tile |

## Roadmap (playable after every step)

1. ✅ Map you can scroll and zoom; roads and zones; bulldoze; money
2. Buildings grow; population; taxes; game speed; save and load
3. Power, water, traffic, pollution, happiness
4. The Hyderabad layer: landmarks, Metro, ORR, festivals, real art
5. Tutorial, music, polish
6. Android app (Google Play needs a closed test: 12 testers for 14 days), then the iPhone app

## Platforms and cost

Web first (GitHub Pages), then Android and iPhone from the same code using Capacitor. Free tools only.
The only planned costs are Google Play ($25 once) and Apple ($99 a year, done last).
