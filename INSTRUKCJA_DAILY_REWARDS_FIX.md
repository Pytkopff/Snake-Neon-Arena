# 🎁 Instrukcja: Naprawa Daily Rewards w Rankingu

## Problem
Jabłka z dziennych nagród (Daily Check-in) nie były dodawane do rankingu "Total Apples", ponieważ zapisywały się tylko w localStorage, a ranking czytał dane wyłącznie z tabeli `game_sessions`.

## Rozwiązanie
Dodaliśmy:
1. Tabelę `daily_claims` - zapisuje wszystkie odebrane daily rewards
2. Tabelę `apple_transactions` - zapisuje wszystkie transakcje jabłek (w tym wydatki jak "repair streak")
3. Zaktualizowany widok `leaderboard_total_apples` - sumuje jabłka z 3 źródeł:
   - `game_sessions.apples_eaten` (jabłka zebrane w grze)
   - `daily_claims.reward` (jabłka z daily check-in)
   - `apple_transactions.amount` (inne transakcje: wydatki są ujemne)

## Kroki do wykonania

### 1. Wykonaj migrację SQL w Supabase

1. Otwórz **Supabase Dashboard** → SQL Editor
2. Skopiuj i wykonaj plik `SUPABASE_MIGRATION_DAILY_REWARDS.sql`
3. Sprawdź wynik w sekcji "Results" - powinny pojawić się 3 tabele/widoki

### 2. Zrestartuj aplikację

```bash
npm run dev
```

### 3. Przetestuj

1. **Zaloguj się** (daily rewards są zapisywane do bazy tylko dla zalogowanych użytkowników)
2. **Odbierz daily reward** (kliknij "CLAIM REWARD")
3. **Sprawdź ranking** → zakładka "Total Apples"
4. **Twoje jabłka powinny się zaktualizować!** 🎉

### 4. (Opcjonalnie) Retroaktywne dodanie starych daily claims

Jeśli użytkownicy już odebrali jakieś daily rewards przed tą zmianą, ich jabłka nie są w bazie. Możesz:

**Opcja A: Poczekać** - przy następnym daily claim system zaktualizuje ranking

**Opcja B: Ręczna migracja** - dodaj wpisy ręcznie w SQL:
```sql
-- Przykład: dodaj 50 jabłek dla użytkownika
INSERT INTO daily_claims (user_id, reward, streak_day, claimed_at)
VALUES ('user_canonical_id', 50, 1, NOW());
```

## Zmiany w kodzie

### `storage.js`
- **`claimDaily()`**: Teraz zapisuje do tabeli `daily_claims` w bazie (oprócz localStorage)
- **`repairStreakWithApples()`**: Teraz zapisuje wydatek do tabeli `apple_transactions` w bazie

### Struktura bazy danych

#### Tabela `daily_claims`
```sql
id              UUID
user_id         TEXT (canonical_user_id)
reward          INTEGER (50, 100, 150, 200, 250, 300, 1000)
streak_day      INTEGER (1-7)
claimed_at      TIMESTAMPTZ
```

#### Tabela `apple_transactions`
```sql
id                 UUID
user_id            TEXT (canonical_user_id)
amount             INTEGER (dodatni = zarobek, ujemny = wydatek)
transaction_type   TEXT ('daily_claim', 'game', 'repair_streak', 'unlock_skin')
description        TEXT
created_at         TIMESTAMPTZ
```

#### Widok `leaderboard_total_apples`
```sql
SELECT
  p.canonical_user_id,
  p.display_name,
  p.avatar_url,
  SUM(game_sessions.apples_eaten) +      -- jabłka z gier
  SUM(daily_claims.reward) +             -- jabłka z daily check-in
  SUM(apple_transactions.amount)         -- inne transakcje (wydatki = ujemne)
  AS total_apples
FROM player_profiles p
...
```

## Weryfikacja

Po wykonaniu migracji, sprawdź w Supabase Dashboard → Table Editor:

1. **daily_claims** - powinna być pusta (na start)
2. **apple_transactions** - powinna być pusta (na start)
3. **leaderboard_total_apples** - powinien pokazywać istniejące dane

Po pierwszym daily claim:
- **daily_claims** - powinien pojawić się nowy wpis z twoim user_id i reward
- **leaderboard_total_apples** - twoje total_apples powinno się zwiększyć o wartość reward

## Troubleshooting

### Problem: "permission denied for table daily_claims"
**Rozwiązanie**: Sprawdź czy w SQL wykonał się `GRANT SELECT, INSERT ON daily_claims TO anon, authenticated;`

### Problem: "relation daily_claims does not exist"
**Rozwiązanie**: Wykonaj ponownie migrację `SUPABASE_MIGRATION_DAILY_REWARDS.sql`

### Problem: Moje jabłka nadal nie są w rankingu
**Rozwiązanie**: 
1. Sprawdź konsolę przeglądarki (F12) - czy są błędy przy zapisie do bazy?
2. Sprawdź w Supabase → Table Editor → `daily_claims` - czy pojawił się nowy wpis?
3. Sprawdź w Supabase → Table Editor → `player_profiles` - czy twój wallet_address jest tam zapisany?

---

## 📊 Statystyki

Po tej zmianie, ranking "Total Apples" będzie bardziej sprawiedliwy, ponieważ:
- ✅ Jabłka z gier są liczone (`game_sessions`)
- ✅ Jabłka z daily check-in są liczone (`daily_claims`)
- ✅ Wydatki są odejmowane (`apple_transactions` z ujemnymi wartościami)

Dzięki temu gracze, którzy regularnie odbierają daily rewards, będą mieli to odzwierciedlone w rankingu! 🎉
