# MindMitra Frontend

MindMitra is a React Native (Expo) frontend application serving as a companion for patients and caregivers. It provides an AI-based cognitive gaming and memory assistance platform, fully powered by a Supabase backend.

## Overview
- **Framework**: React Native with Expo (Expo Router for navigation)
- **Backend**: Supabase (PostgreSQL Database, Authentication, Edge Functions)
- **Styling**: Native UI components, custom fonts (DM Sans, Special Elite), and Reanimated for animations.

## Key Screens and Features

### Caregiver Flow
- **CaregiverHome**: The central dashboard for caregivers to monitor patient progress, view upcoming appointments, set daily reminders, and review the patient's performance metrics.
- **BookAppointmentScreen**: Interface to book and schedule doctor appointments for the patient.
- **AddReminderScreen**: Create day-to-day reminders for medicines, hydration, or tasks.
- **CareCircleScreen**: Manage caregiver-to-patient connections and links.
- **CaregiverPatientScreen**: Detailed view of specific patient profiles.

### Patient Flow
- **PatientHome**: The main hub for patients, offering an accessible interface to launch cognitive games and view their schedule.
- **PatientOnboarding**: Setup flow tailored for patients during their first login.
- **MyDayScreen**: A simplified view of the patient's daily tasks, reminders, and appointments.
- **GamePackGamesScreen / MemoryScreen**: Entries to the cognitive games suite designed to test domains like Recall, Visuospatial, and Executive functions.

### Shared / Global Features
- **MyJourneyScreen**: Tracking and displaying patient journey metrics over time.
- **ProfileSettingsScreen**: General app settings, localization preferences, and account management.
- **TalkToMitraScreen**: Voice assistant interface (Mitra) for accessibility and interaction.
- **BookingScreen**: General booking utility interface.

## AI Decision Layer (Upcoming)
The app is currently being integrated with an AI-Decision layer which takes performance data from the patient's games and:
1. Recommends dynamic difficulty settings for the next game.
2. Generates comprehensive progress reports in a modular Mad-Libs style format.
*Note: The AI operates purely on numeric/structured data and does not generate free-form diagnostic text.*

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   You will need to set up your Supabase connection strings (URL and Anon Key) in your `.env` or configuration file (`src/lib/supabaseClient.ts`).

3. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

## Folder Structure
- `/screens`: Contains all the main UI views for both patients and caregivers.
- `/src/lib`: Contains Supabase client configuration, API hooks, and shared business logic.
- `/components`: Reusable UI components used across screens.
- `/assets`: Images, fonts, and static files.
- `/theme`: Centralized styling and design tokens.
