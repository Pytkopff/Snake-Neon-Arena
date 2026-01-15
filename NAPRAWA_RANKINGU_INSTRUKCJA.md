# 🚨 NAPRAWA RANKINGU - Po repair streak zniknąłeś z leaderboardu

## 🐛 Co się stało?

1. Miałeś **70 jabłek** w rankingu (z gier)
2. Naprawiłeś streak za **500 jabłek** 💸
3. System zapisał **-500** do tabeli `apple_transactions`
4. Ranking sumował: `70 (gry) - 500 (repair) = -430` ❌
5. Widok SQL filtruje wyniki < 0, więc **zniknąłeś z rankingu**
6. Nowe jabłka z gier **NIE były widoczne** (bo suma była ujemna)

## ✅ Jak to naprawić?

### Krok 1: Wykonaj SQL w Supabase

1. Otwórz **Supabase Dashboard** → SQL Editor
2. Skopiuj i wykonaj plik: `SUPABASE_FIX_LEADERBOARD.sql`

To:
- Usuwa ujemne transakcje z `apple_transactions`
- Aktualizuje widok `leaderboard_total_apples` (bez sumowania wydatków)
- Ranking będzie pokazywał **TYLKO zarobione jabłka** (gry + daily rewards)

### Krok 2: Odśwież aplikację

```bash
# W terminalu
npm run dev
```

Lub po prostu odśwież stronę (Ctrl+F5 / Cmd+Shift+R)

### Krok 3: Sprawdź ranking

1. Wejdź w **Ranks** → zakładka **Total Apples**
2. **Powinieneś się pojawić** z prawidłową liczbą jabłek ✅
3. Zagraj grę → nowe jabłka **będą dodawane** do rankingu ✅

---

## 🔧 Co zostało naprawione w kodzie?

### 1. Ranking nie sumuje wydatków

**Przed:**
```sql
SUM(game_sessions.apples_eaten) + 
SUM(daily_claims.reward) + 
SUM(apple_transactions.amount)  -- ❌ To powodowało ujemne wartości
```

**Po:**
```sql
SUM(game_sessions.apples_eaten) + 
SUM(daily_claims.reward)  -- ✅ Tylko zarobione jabłka
```

### 2. Wydatki są tylko lokalne

**Przed:**
```javascript
// Zapisywało -500 do bazy
await supabase
  .from('apple_transactions')
  .insert({ amount: -500 }); // ❌
```

**Po:**
```javascript
// Wydatki są tylko w localStorage
setStorageItem('snake_apples_spent', spent + 500); // ✅
```

### 3. Używamy canonicalId wszędzie

**Przed:**
```javascript
repairStreakWithApples(walletAddress) // ❌ Mogło brać stary profil
```

**Po:**
```javascript
repairStreakWithApples(walletAddress, canonicalId) // ✅ Zawsze prawidłowy profil
```

---

## 🎯 Co to oznacza?

### Ranking pokazuje:
- ✅ Jabłka z gier (`game_sessions`)
- ✅ Jabłka z daily check-in (`daily_claims`)
- ❌ NIE pokazuje wydatków (repair streak, unlock skins)

### Wydatki (repair streak, unlock skins):
- ✅ Są odejmowane **lokalnie** (localStorage)
- ✅ Synchronizują się między urządzeniami (przez model gross/spent)
- ❌ **NIE wpływają** na ranking

---

## 📊 Przykład

### Przed naprawą:
```
Gracz:
- Gry: 70 jabłek
- Daily: 50 jabłek
- Repair: -500 jabłek
---
Ranking: 70 + 50 - 500 = -430 → ZNIKA ❌
```

### Po naprawie:
```
Gracz:
- Gry: 70 jabłek
- Daily: 50 jabłek
- Repair: (tylko lokalnie, nie w rankingu)
---
Ranking: 70 + 50 = 120 → WIDOCZNY ✅
```

---

## 🔍 Weryfikacja

Po wykonaniu SQL sprawdź w Supabase Dashboard:

### Table Editor → `apple_transactions`
- Powinno być **0 wpisów** (usunięte ujemne transakcje)
- Albo tylko wpisy z `amount > 0` (jeśli były jakieś dodatnie)

### SQL Editor → Wykonaj:
```sql
SELECT * FROM leaderboard_total_apples 
WHERE canonical_user_id = 'TWÓJ_CANONICAL_ID'
LIMIT 1;
```

Powinieneś zobaczyć:
- `total_apples`: Prawidłowa suma z gier i daily rewards
- **BEZ** ujemnych wartości

---

## ⚠️ Ważne uwagi

### 1. Stare dane
Jeśli miałeś ujemne transakcje w bazie **przed** naprawą, są one teraz usunięte. To jest OK - ranking pokazuje teraz prawidłowe wartości.

### 2. Cross-device sync
Jeśli logujesz się z różnych urządzeń (PC vs telefon):
- **Zawsze** używaj tego samego konta (Farcaster)
- Ranking synchronizuje się automatycznie
- Daily streak jest **lokalny** (na każdym urządzeniu osobno)

### 3. Daily streak między urządzeniami
Daily check-in jest zapisywany **lokalnie** (localStorage), więc:
- PC: Dzień 6 ✅
- Telefon: Dzień 4 ❌ (stare dane)

To jest normalne - każde urządzenie ma własny streak. Jeśli chcesz synchronizować streak, musisz logować się codziennie z tego samego urządzenia.

---

## 🆘 Troubleshooting

### Problem: Nadal nie ma mnie w rankingu
**Rozwiązanie:**
1. Sprawdź konsolę przeglądarki (F12) - czy są błędy?
2. Sprawdź w Supabase → Table Editor → `game_sessions` - czy są twoje gry?
3. Sprawdź w Supabase → Table Editor → `player_profiles` - czy jest twój profil?

### Problem: Nowe jabłka nie są dodawane
**Rozwiązanie:**
1. Zagraj grę
2. Sprawdź konsolę - czy pokazuje "✅ Game session saved to DB"?
3. Sprawdź w Supabase → Table Editor → `game_sessions` - czy pojawiła się nowa sesja?
4. Odśwież ranking (zamknij i otwórz ponownie)

### Problem: Daily streak się zresetował
**Rozwiązanie:**
To jest normalne po "repair streak" - streak został naprawiony, ale musisz odebrać dzisiejszą nagrodę. Jutro będziesz mógł kontynuować streak.

---

Daj znać jak poszło! 🚀
