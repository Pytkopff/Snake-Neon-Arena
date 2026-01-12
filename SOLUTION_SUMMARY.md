# 🔒 Root Cause Fix - Duplicate Profiles

## Problem
Twój użytkownik (Pytek, FID: 543636) pojawia się 3x w leaderboard z tym samym wynikiem:
- Anonymous #2 (2285)
- YOU - pytek (2285)
- Anonymous #3 (2285)

## Przyczyna (na podstawie faktycznych kolumn z bazy)

### Struktura `player_profiles`:
```
- user_id (TEXT)
- canonical_user_id (TEXT)
- wallet_address (TEXT)
- farcaster_fid (TEXT) ← BRAK UNIQUE CONSTRAINT!
- farcaster_username (TEXT)
- display_name (TEXT)
- avatar_url (TEXT)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Co się dzieje teraz:
1. User otwiera app na **Mobile** → tworzy się `user_id = "guest:xyz1"`
2. User loguje się przez **Farcaster** → tworzy się `user_id = "fc:543636"`
3. User otwiera app na **PC** → tworzy się `user_id = "guest:xyz2"`

**Wszystkie 3 profile mają różne `user_id`, więc leaderboard pokazuje 3 osoby!**

### Dlaczego tak się dzieje?

#### Problem #1: Brak UNIQUE CONSTRAINT
Baza pozwala na stworzenie **wielu profili z tym samym `farcaster_fid`**:
```sql
INSERT INTO player_profiles (user_id, farcaster_fid, ...) VALUES ('fc:543636', '543636', ...);
INSERT INTO player_profiles (user_id, farcaster_fid, ...) VALUES ('guest:abc', '543636', ...); -- ❌ DZIAŁA (nie powinno!)
```

#### Problem #2: Race Condition w kodzie
Frontend robi:
```javascript
// 1. Sprawdź czy istnieje
const existing = await supabase.from('player_profiles').select('*').eq('user_id', userId).single();

// 2. Jeśli nie istnieje, wstaw nowy
if (!existing) {
  await supabase.from('player_profiles').insert({...}); // ❌ Race condition!
}
```

Jeśli **2 requesty** przyjdą w tym samym czasie (np. Mobile + PC):
- Oba robią SELECT → oba dostają `null`
- Oba robią INSERT → **2 profile powstają!**

## Rozwiązanie

### 1️⃣ Poziom Bazy Danych (Prevention)

#### Dodaj UNIQUE CONSTRAINT:
```sql
ALTER TABLE player_profiles
ADD CONSTRAINT unique_farcaster_fid UNIQUE (farcaster_fid);
```

**Efekt:** Niemożliwe jest stworzenie 2 profili z tym samym FID.

#### Dodaj UNIQUE INDEX na wallet (case-insensitive):
```sql
CREATE UNIQUE INDEX idx_unique_wallet_address 
ON player_profiles (LOWER(wallet_address))
WHERE wallet_address IS NOT NULL;
```

**Efekt:** `0xABC` i `0xabc` są traktowane jako ten sam portfel.

### 2️⃣ Wyczyść istniejące duplikaty:
```sql
DO $$
DECLARE
  r RECORD;
  keep_user_id TEXT;
  delete_user_ids TEXT[];
BEGIN
  FOR r IN 
    SELECT farcaster_fid, ARRAY_AGG(user_id ORDER BY created_at ASC) AS user_ids
    FROM player_profiles
    WHERE farcaster_fid IS NOT NULL
    GROUP BY farcaster_fid
    HAVING COUNT(*) > 1
  LOOP
    keep_user_id := r.user_ids[1]; -- Najstarszy profil
    delete_user_ids := r.user_ids[2:]; -- Reszta do usunięcia
    
    -- Przenieś sesje do głównego profilu
    UPDATE game_sessions
    SET user_id = keep_user_id
    WHERE user_id = ANY(delete_user_ids);
    
    -- Usuń duplikaty
    DELETE FROM player_profiles
    WHERE user_id = ANY(delete_user_ids);
  END LOOP;
END $$;
```

### 3️⃣ Zmiana w kodzie (Frontend) - UPSERT zamiast INSERT

**Zamiast:**
```javascript
const { data: existing } = await supabase.from('player_profiles').select('*').eq('user_id', userId).single();
if (!existing) {
  await supabase.from('player_profiles').insert({...});
}
```

**Używaj UPSERT:**
```javascript
await supabase
  .from('player_profiles')
  .upsert({
    user_id: userId,
    canonical_user_id: canonicalUserId,
    farcaster_fid: farcasterFid || null,
    farcaster_username: username || null,
    wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
    display_name: displayName,
    avatar_url: avatarUrl || defaultAvatar,
  }, {
    onConflict: 'user_id', // Unikalny klucz (user_id)
    ignoreDuplicates: false, // Aktualizuj jeśli istnieje
  });
```

**Ale UWAGA:** `user_id` może się zmieniać (guest → fc:XXX), więc lepiej:
```javascript
// Użyj farcaster_fid jako klucza (jeśli istnieje)
if (farcasterFid) {
  await supabase
    .from('player_profiles')
    .upsert({
      user_id: `fc:${farcasterFid}`,
      canonical_user_id: `fc:${farcasterFid}`,
      farcaster_fid: farcasterFid,
      wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
      // ... reszta pól
    }, {
      onConflict: 'farcaster_fid', // UNIQUE CONSTRAINT musi istnieć!
    });
}
```

## Krok po kroku

### Teraz (w tej kolejności):

1. **Uruchom `DIAGNOSE_MY_DUPLICATES.sql`** → zobacz ile masz duplikatów
2. **Uruchom `FIX_ROOT_CAUSE.sql`** → wyczyść duplikaty + dodaj UNIQUE constraints
3. **Zmień kod w `storage.js`** → użyj UPSERT zamiast SELECT+INSERT
4. **Przetestuj:**
   - Otwórz app na Mobile (Farcaster)
   - Otwórz app na PC (ten sam Farcaster)
   - Sprawdź leaderboard → powinien być **tylko 1 wynik**

## Pliki do uruchomienia

1. `DIAGNOSE_MY_DUPLICATES.sql` - zobacz problem na własne oczy
2. `FIX_ROOT_CAUSE.sql` - napraw istniejące duplikaty + dodaj constrainty
3. (Następny krok) - Przepisuję `syncPlayerProfile()` w `storage.js`
