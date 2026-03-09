# Diabetes Supply App

A mobile app for managing diabetes supplies with pack-level tracking, barcode scanning, usage history, and a dedicated holiday planning mode.

This project focuses on solving a real everyday problem: keeping track of medical supplies reliably, planning ahead, and reducing the risk of running out of important items.

## Overview

The app is built with Expo / React Native and uses a local SQLite database via Drizzle ORM.  
It is designed around individual products and physical packs, not just rough stock counts.

Core idea:
- track what supplies exist,
- know which exact pack is being used,
- estimate future needs from real usage,
- support safe packing for holidays.

## Main Features

### Supply management
- Create and manage diabetes-related products
- Store product-specific defaults such as units per pack
- Mark products as active/inactive
- Support different product types, including session-based items

### Pack-level inventory
- Add individual packs to stock
- Track remaining units per pack
- Store expiry dates, production dates, and raw code data
- Keep inventory grounded in real physical packs instead of abstract totals

### Barcode scanning
- Integrated scanning flow for medical supply barcodes
- Native processing modules for performance-critical barcode recognition
- Support for GS1-style structured barcode content and extracted identifiers

### Usage tracking
- Record stock events such as adding, taking, discarding, adjusting, and undoing stock
- Track sessions for session-based products
- Build statistics from actual usage history

### Holiday Mode
A dedicated mode for planning supplies for a trip.

The user can:
- enter a destination and trip duration,
- choose which products are relevant,
- choose how each product should be calculated,
- generate a packing target per product,
- assign real packs to the holiday.

Supported calculation strategies include:
- average usage + percentage buffer
- average usage + fixed buffer
- fixed amount
- per day
- per day + buffer days

A key design decision is that the calculated required amount is snapshotted when a holiday is created.  
This prevents the plan from drifting later when usage statistics change.

The packing logic also considers:
- already packed units for the current holiday,
- reservations caused by other holidays,
- real remaining units in physical packs.

This helps avoid double-booking the same stock.

### Optional identification support
- Product identifiers such as GTIN / UDI-DI / EAN-13
- Optional colored-dot assignment for distinguishing physical packs more easily

## Tech Stack

- **Frontend:** React Native, Expo, Expo Router
- **Language:** TypeScript
- **Database:** SQLite
- **ORM:** Drizzle ORM
- **Data layer:** TanStack React Query
- **UI:** React Native Paper
- **Native scanning modules:** C++ / Kotlin integration for barcode processing
