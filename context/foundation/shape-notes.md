---
project: "Pauzaro"
context_type: greenfield
created: 2026-08-19
updated: 2026-08-20
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction + missing capability + decision paralysis"
    - topic: "insight"
      decision: "existing tools are web/mobile (don't interrupt desktop focus) + paid alternatives over-engineered"
    - topic: "primary persona"
      decision: "solo developer building for himself; MVP = 1 user"
    - topic: "access control"
      decision: "local profile; data on-device; no server; no roles; single user"
    - topic: "mvp timeline"
      decision: "5-6 weeks after-hours; user accepted sustained-effort cost"
    - topic: "secondary criterion"
      decision: "dinosaur mascot — must exist (app identity), polish level relaxed for MVP"
    - topic: "guardrails"
      decision: "notifications must work reliably + app must be lightweight in background"
  frs_drafted: 12
  socrates_completed: true
  quality_check_status: accepted
---

## Vision & Problem Statement

Programista pracujący przy komputerze traci poczucie czasu podczas deep focus — zapomina o przerwach, ruchu i odejściu od ekranu. Bez zewnętrznego impulsu przerwy są ciągle odkładane; flow state aktywnie działa przeciwko zdrowym nawykom.

Istniejące rozwiązania (Pomodoro, habit trackery) żyją w przeglądarce lub na telefonie — nie przerywają deep focus przy komputerze. Płatne alternatywy desktopowe są przeładowane funkcjami, podczas gdy potrzebna funkcjonalność jest prosta: konfigurowalne przypomnienia + gamifikacja (streaki) w lekkim desktop narzędziu.

## User & Persona

### Primary persona

**Rola:** Solo developer / programista pracujący zdalnie
**Kontekst:** Wielogodzinna praca przy komputerze w trybie deep focus
**Moment:** Siada do pracy, wpada w flow, mija 3-4 godziny bez przerwy
**Potrzeba:** Zewnętrzny impuls, który przerwie focus i wymusi krótką aktywność (ćwiczenie, rozciąganie, odejście od ekranu) — z motywacją do regularności przez system streaków
**MVP scope:** Jeden użytkownik (sam autor)

## Access Control

Single user; no auth; data lives on-device only. Lokalny profil — nawyki, streaki i konfiguracja przechowywane na dysku. Brak serwera, brak ról, brak separacji użytkowników.

## Success Criteria

### Primary
- Użytkownik tworzy nawyk z harmonogramem (dni tygodnia, godziny) i otrzymuje powiadomienia w skonfigurowanych momentach
- Po oznaczeniu zadania jako wykonane, streak jest aktualizowany i widoczny na dashboard
- Dashboard w stylu Duolingo pokazuje widok miesiąca z ikonami, liczbę streaków i postępy per nawyk
- MVP obsługuje 1 nawyk z pełną konfiguracją (dni, godziny, opcjonalna data end). Multi-habit w v2

### Secondary
- Maskotka dinozaura jako tożsamość aplikacji — musi istnieć w MVP, ale nie musi być w pełni dopracowana wizualnie

### Guardrails
- Powiadomienia muszą działać niezawodnie — cała wartość app to przypomnienia w odpowiednim momencie; jeśli nie działają, app jest bezwartościowa
- Aplikacja działająca cały dzień w tle nie może obciążać CPU/RAM — lekki footprint jest wymagany

## Timeline acknowledgment

Acknowledged on 2026-08-19: 6-week MVP requires sustained dedication; user accepted.

## Functional Requirements

### Habit Management
- FR-001: Użytkownik może przejść onboarding (powitanie z animacją, wyjaśnienie celu app, podanie imienia, kreator nawyku) przy pierwszym uruchomieniu. Priority: must-have
  > Socrates: Counter-argument: "onboarding to friction — solo app może od razu otworzyć dashboard." Resolution: kept; personalizacja od pierwszego momentu i poczucie zaopiekowania jest kluczowe. App wita, tłumaczy cel, prosi o imię, prowadzi do kreatora.
- FR-002: Użytkownik może stworzyć nawyk (ikona z biblioteki komponentów zmapowana do typowych nawyków, nazwa, opis zadania). Priority: must-have
  > Socrates: Counter-argument: "icon picker to dodatkowy UI component." Resolution: kept; użycie istniejącej biblioteki komponentów z mapowaniem ikon do typowych nawyków — minimalna dodatkowa praca.
- FR-003: Użytkownik może skonfigurować harmonogram nawyku (dni tygodnia, godziny/przedziały). Priority: must-have
  > Socrates: Core functionality — bez tego app nie ma wartości. Stands.
- FR-004: Użytkownik może ustawić datę start + opcjonalny end date per nawyk. Priority: must-have
  > Socrates: Counter-argument: "end date podważa streak — sugeruje tymczasowość." Resolution: modified; end date opcjonalne. Użytkownik może ustawić "bez deadline" lub konkretną datę (np. 30-dniowe wyzwanie).
- FR-005: Użytkownik może zarządzać wieloma nawykami (dodaj/edytuj/usuń). Priority: nice-to-have
  > Socrates: Counter-argument: "MVP z 1 nawykiem byłby prostszy — cały UI to jeden nawyk, jeden streak." Resolution: demoted to nice-to-have (v2). MVP = 1 nawyk.

### Notifications & Tracking
- FR-006: Użytkownik otrzymuje własne okno overlay (nie systemowe powiadomienie) w skonfigurowanym momencie. Priority: must-have
  > Socrates: Counter-argument: "systemowe powiadomienie jest łatwiejsze do implementacji." Resolution: modified; overlay zamiast system notification — trudniejsze do zignorowania w deep focus. Konfiguracja agresywności powiadomień w v2.
- FR-007: Użytkownik może oznaczyć zadanie jako wykonane z overlay (przycisk "done") lub z dashboard. Overlay ma też "przypomnij za 9 min" (snooze). Po 3x snooze nawyk oznaczony jako niewykonany. Priority: must-have
  > Socrates: Counter-argument: "tylko dashboard jest prostsze." Resolution: modified; oba kanały (overlay + dashboard). Snooze 3x = auto-fail — ważna reguła biznesowa zapobiegająca nieskończonemu odkładaniu.

### Streak & Gamification
- FR-012: Użytkownik może zamrozić streak na max 2 dni (streak freeze). Priority: must-have
  > Socrates: Bez freeze jeden zły dzień niszczy całą motywację. Freeze to safety net trzymający użytkownika w grze.

### Dashboard & Gamification
- FR-008: Użytkownik widzi dashboard z pełnym widokiem miesiąca (kalendaryczny grid, ikony/kolory per dzień) i streakami. Priority: must-have
  > Socrates: Counter-argument: "prostsza lista + counter zamiast month view." Resolution: kept; month view to core visual identity produktu — Duolingo-style.
- FR-009: Użytkownik widzi maskotkę dinozaura w aplikacji (statyczny asset, 2-3 stany: happy/neutral/sad). Priority: must-have
  > Socrates: Counter-argument: "animacje Lottie to dużo pracy." Resolution: modified; statyczne assety (2-3 stany) w MVP. Animacje Lottie via mascot editor w v2.

### Localization & Theme
- FR-010: Użytkownik korzysta z aplikacji w jednym języku (hardcoded). Priority: nice-to-have
  > Socrates: Counter-argument: "solo app, budujesz dla siebie — i18n to boilerplate." Resolution: demoted; jeden język w MVP. i18n w v2 gdy pojawią się inni użytkownicy.
- FR-011: Aplikacja respektuje system preference dark/light mode. Priority: nice-to-have
  > Socrates: Counter-argument: "auto-switch po czasie to custom logic." Resolution: modified; czytaj OS dark/light preference zamiast własnej detekcji czasu. Prostsze.

## User Stories

### US-01: Onboarding i stworzenie pierwszego nawyku

- **Given** pierwsze uruchomienie aplikacji (brak istniejącego profilu)
- **When** użytkownik przechodzi onboarding (podaje imię) i tworzy pierwszy nawyk z harmonogramem (dni, godziny)
- **Then** nawyk pojawia się na dashboard, harmonogram przypomnień jest aktywny

#### Acceptance Criteria
- Onboarding zbiera imię użytkownika
- Użytkownik definiuje nazwę nawyku i opis zadania
- Użytkownik ustawia dni tygodnia i przedziały czasowe
- Po zakończeniu dashboard pokazuje nowy nawyk
- Przypomnienia są zaplanowane zgodnie z konfiguracją

### US-02: Core habit loop — overlay, wykonanie/snooze, streak

- **Given** skonfigurowany nawyk z aktywnym harmonogramem i nadchodzi zaplanowany czas
- **When** overlay pojawia się na ekranie z przyciskami "done" i "przypomnij za 9 min"
- **Then** użytkownik klika "done" → wykonanie zapisane, streak aktualizowany na dashboard; LUB klika snooze → overlay pojawi się ponownie za 9 min; po 3x snooze nawyk oznaczony jako niewykonany

#### Acceptance Criteria
- Overlay (własne okno, nie systemowe powiadomienie) pojawia się w skonfigurowanym momencie
- Overlay ma przycisk "done" i "przypomnij za 9 min"
- "Done" z overlay lub dashboard zapisuje wykonanie natychmiast
- Snooze odlicza 9 minut i wyświetla overlay ponownie
- 3x snooze = nawyk automatycznie oznaczony jako niewykonany
- Dashboard odzwierciedla stan (wykonany/niewykonany) natychmiast
- Streak rośnie gdy dzień zaliczony; dzień z auto-fail psuje streak
- Widok miesiąca pokazuje status dnia

## Business Logic

Aplikacja śledzi wykonanie skonfigurowanych nawyków w czasie i na podstawie wzorca wykonań/pominięć oblicza streak (ciągłość serii) oraz wymusza próg zaangażowania — streak jest domyślną walutą motywacji.

Reguła konsumuje: harmonogram nawyku (dni tygodnia, przedziały czasowe) oraz reakcję użytkownika na overlay (done / snooze / brak reakcji). Na tej podstawie oblicza: czy dzień jest zaliczony (wszystkie wymagane wykonania zrealizowane), jaki jest aktualny streak (ciągła seria zaliczonych dni), oraz jaki jest stan streaka (aktywny / zagrożony / stracony).

Mechanizm snooze wymusza zaangażowanie: overlay można odłożyć max 3 razy po 9 minut; po trzecim snooze nawyk jest automatycznie oznaczony jako niewykonany. Mechanizm streak freeze pozwala ochronić serię przez max 2 dni bez wykonania — safety net zapobiegający utracie motywacji z powodu jednorazowego zdarzenia.

Użytkownik spotyka wynik reguły na dashboard: widok miesiąca (kalendaryczny grid z ikonami/kolorami per dzień), licznik streaków, oraz maskotka reagująca stanem (happy/neutral/sad) na bieżący status.

## Non-Functional Requirements

- Aplikacja w tle zużywa ≤ 50MB RAM — działa cały dzień bez wpływu na pracę programisty
- Dane użytkownika (nawyki, streaki, konfiguracja) nigdy nie opuszczają urządzenia — zero network calls, pełna prywatność
- Aplikacja działa na macOS i Windows

## Non-Goals

- Brak synchronizacji między urządzeniami / cloud sync — dane lokalne, brak kont, brak serwera. Kształtuje całą architekturę: zero backend, zero network calls.
- Brak społeczności / leaderboard / współzawodnictwa — solo app. Brak social features, rankingów, udostępniania streaków.

## Quality cross-check

All 6 elements present. No gaps. Status: accepted.

## Open Questions

(none — all elements resolved during shaping)

## Forward: tech-stack

Użytkownik zadeklarował preferencję: Tauri (backend) + React (frontend). Repo zawiera zainicjalizowany projekt Tauri. Decyzja do potwierdzenia downstream w tech-stack-selection.

## Forward: technical-roadmap

Mascot editor — osobna paczka w repo z assetami i promptami do AI, umożliwiająca łatwe generowanie animacji Lottie z maskotką (machanie łapką, smutek przy traconym streaku). Developer tooling, nie user-facing feature.
